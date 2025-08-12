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
                # Add a completion marker to the queue
                self.active_requests[request_id]['queue'].put({'done': True})
    
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
    """Process the streaming response from the LLM server and add tokens to the queue"""
    def log_to_file(message):
        with open(log_file, 'a', encoding='utf-8') as f:
            timestamp = datetime.datetime.now().strftime('%H:%M:%S.%f')[:-3]
            f.write(f"[{timestamp}] {message}\n")
            f.flush()
    
    try:
        queue_obj = streaming_manager.get_queue(request_id)
        if not queue_obj:
            log_to_file(f"Queue for request {request_id} not found")
            return
        
        line_count = 0
        buffer = ""
        
        # Process the streaming response
        try:
            for chunk in response.iter_content(chunk_size=1024, decode_unicode=True):
                if not streaming_manager.is_active(request_id):
                    log_to_file(f"Request {request_id} is no longer active, stopping processing")
                    break
                
                if chunk:
                    buffer += chunk
                    
                    # Process complete lines from buffer
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
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
                                        log_to_file(f"Sending token: {repr(delta['content'])}")
                                        queue_obj.put({'token': delta['content']})
                                    
                                    # Check for completion
                                    if choice.get('finish_reason'):
                                        log_to_file(f"Finish reason: {choice.get('finish_reason')}")
                                        streaming_manager.mark_complete(request_id)
                                        return
                                        
                            except json.JSONDecodeError as e:
                                log_to_file(f"JSON decode error: {e} for data: {data_content}")
                                continue
                                
                        elif line.startswith('event:') or line.startswith('id:'):
                            # Handle other SSE fields (event type, id)
                            log_to_file(f"SSE metadata: {line}")
                            continue
                        else:
                            log_to_file(f"Non-SSE line: {line}")
            
            # Process any remaining buffer content
            if buffer.strip():
                log_to_file(f"Processing remaining buffer: {repr(buffer)}")
                for line in buffer.split('\n'):
                    line = line.strip()
                    if line.startswith('data: '):
                        data_content = line[6:].strip()
                        if data_content and data_content != '[DONE]':
                            try:
                                chunk_data = json.loads(data_content)
                                if 'choices' in chunk_data and chunk_data['choices']:
                                    choice = chunk_data['choices'][0]
                                    delta = choice.get('delta', {})
                                    if 'content' in delta and delta['content'] is not None:
                                        queue_obj.put({'token': delta['content']})
                            except json.JSONDecodeError:
                                continue
        
        except requests.exceptions.ChunkedEncodingError as e:
            log_to_file(f"ChunkedEncodingError: {e}")
            # Instead of treating this as expected, check if we received any content
            if line_count > 0:
                log_to_file("Stream ended with chunked encoding error after receiving content - marking as complete")
                streaming_manager.mark_complete(request_id)
                return
            else:
                # If we didn't receive any content, this is an actual error
                log_to_file("Stream ended with chunked encoding error before receiving any content - this is an error")
                queue_obj.put({'error': 'Connection error: The server closed the connection unexpectedly. Please try again.'})
                streaming_manager.mark_complete(request_id)
                return
            
        except Exception as e:
            log_to_file(f"Stream processing error: {e}")
            queue_obj.put({'error': f'Stream error: {str(e)}'})
            streaming_manager.mark_complete(request_id)
            return
        
        # Send final done signal if we exit the loop
        log_to_file("Exited iter_lines loop, sending final done signal")
        streaming_manager.mark_complete(request_id)
        
    except Exception as e:
        log_to_file(f"Streaming error: {e}")
        if streaming_manager.is_active(request_id):
            queue_obj = streaming_manager.get_queue(request_id)
            if queue_obj:
                queue_obj.put({'error': str(e)})
            streaming_manager.mark_complete(request_id)
    finally:
        try:
            response.close()
            log_to_file("Response closed")
        except:
            log_to_file("Error closing response")
            pass