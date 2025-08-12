# streaming_queue.py
# Queue-based solution for handling multiple streaming clients for LLM server

import threading
import queue
import time
import datetime
import json
import requests

class StreamingQueueManager:
    """Manages queues for multiple streaming clients to the LLM server"""
    
    def __init__(self):
        self.active_requests = {}
        self.lock = threading.Lock()
        # Start cleanup thread
        self.cleanup_thread = threading.Thread(target=self._cleanup_thread, daemon=True)
        self.cleanup_thread.start()
    
    def create_request(self, request_id):
        """Create a new request queue"""
        with self.lock:
            if request_id in self.active_requests:
                return False
            
            self.active_requests[request_id] = {
                'queue': queue.Queue(),
                'active': True,
                'created_at': time.time()
            }
            return True
    
    def get_queue(self, request_id):
        """Get the queue for a specific request"""
        with self.lock:
            if request_id not in self.active_requests:
                return None
            return self.active_requests[request_id]['queue']
    
    def is_active(self, request_id):
        """Check if a request is still active"""
        with self.lock:
            if request_id not in self.active_requests:
                return False
            return self.active_requests[request_id]['active']
    
    def mark_complete(self, request_id):
        """Mark a request as complete"""
        with self.lock:
            if request_id in self.active_requests:
                self.active_requests[request_id]['active'] = False
    
    def cleanup(self, max_age=300):  # Clean up requests older than 5 minutes
        """Clean up completed requests that are older than max_age seconds"""
        with self.lock:
            current_time = time.time()
            to_remove = []
            
            for request_id, request_data in self.active_requests.items():
                if not request_data['active'] and (current_time - request_data['created_at']) > max_age:
                    to_remove.append(request_id)
            
            for request_id in to_remove:
                del self.active_requests[request_id]
    
    def _cleanup_thread(self):
        """Background thread to periodically clean up old requests"""
        while True:
            time.sleep(60)  # Run cleanup every minute
            self.cleanup()

# Function to process LLM responses and add to the appropriate queue
def process_llm_response(streaming_manager, request_id, response, log_file):
    """Process streaming response from llama-server using proper SSE handling"""
    queue_obj = streaming_manager.get_queue(request_id)
    if not queue_obj:
        log_to_file(f"No queue found for request {request_id}")
        return
    
    def log_to_file(message):
        with open(log_file, 'a', encoding='utf-8') as f:
            timestamp = datetime.datetime.now().strftime('%H:%M:%S.%f')[:-3]
            f.write(f"[{timestamp}] {message}\n")
            f.flush()
    
    log_to_file(f"[INFO] Starting to process LLM response for request {request_id}")
    log_to_file(f"[INFO] Response status: {response.status_code}")
    log_to_file(f"[INFO] Response headers: {dict(response.headers)}")
    log_to_file(f"[INFO] Response encoding: {response.encoding}")
    
    line_count = 0
    token_count = 0
    
    try:
        # CRITICAL FIX: Use iter_lines() for Server-Sent Events, not iter_content()
        # SSE requires line-by-line processing, not arbitrary chunk processing
        for line in response.iter_lines(decode_unicode=True):
            if not streaming_manager.is_active(request_id):
                log_to_file(f"Request {request_id} is no longer active, stopping processing")
                break
            
            if not line:
                continue
                
            line = line.strip()
            if not line:
                continue
                
            line_count += 1
            log_to_file(f"Processing line #{line_count}: {repr(line)}")
            
            # Handle SSE format from llama-server
            if line.startswith('data: '):
                data_content = line[6:].strip()
                log_to_file(f"SSE data: {data_content}")
                
                # Handle completion signal
                if data_content == '[DONE]':
                    log_to_file("Received [DONE] signal")
                    queue_obj.put({'done': True})
                    streaming_manager.mark_complete(request_id)
                    return
                
                # Parse JSON data
                try:
                    chunk_data = json.loads(data_content)
                    log_to_file(f"Parsed chunk: {chunk_data}")
                    
                    if 'choices' in chunk_data and chunk_data['choices']:
                        choice = chunk_data['choices'][0]
                        delta = choice.get('delta', {})
                        
                        # Send token content
                        if 'content' in delta and delta['content'] is not None:
                            token_count += 1
                            log_to_file(f"Token #{token_count}: {repr(delta['content'])}")
                            queue_obj.put({'token': delta['content']})
                        
                        # Check for completion
                        if choice.get('finish_reason'):
                            log_to_file(f"Finish reason: {choice.get('finish_reason')}")
                            queue_obj.put({'done': True})
                            streaming_manager.mark_complete(request_id)
                            return
                            
                except json.JSONDecodeError as e:
                    log_to_file(f"JSON decode error: {e} for data: {data_content}")
                    continue
                    
            elif line.startswith('event: ') or line.startswith('id: ') or line.startswith('retry: '):
                # SSE metadata lines - log but don't process
                log_to_file(f"SSE metadata: {line}")
                continue
            else:
                log_to_file(f"Unexpected line format: {line}")
        
        # If we reach here without a [DONE] signal, the stream ended unexpectedly
        log_to_file(f"Stream ended without [DONE] signal. Processed {line_count} lines, {token_count} tokens")
        queue_obj.put({'done': True})
        streaming_manager.mark_complete(request_id)
        
    except Exception as e:
        log_to_file(f"Error processing response: {str(e)}")
        log_to_file(f"Exception type: {type(e).__name__}")
        import traceback
        log_to_file(f"Traceback: {traceback.format_exc()}")
        
        # Send error to queue
        queue_obj.put({'error': f'Stream processing error: {str(e)}'})
        streaming_manager.mark_complete(request_id)