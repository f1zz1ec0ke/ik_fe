import os
import json
import subprocess
import threading
import time
import requests
import socket
import logging
from datetime import datetime
from flask import Flask, request, jsonify, Response, send_from_directory, session, stream_with_context
from flask_cors import CORS
import signal
import sys
import psutil
from urllib.parse import urljoin
import glob
import platform
import shutil
import re

# Import the streaming queue manager
from streaming_queue import StreamingQueueManager, process_llm_response

# Configure logging to file
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('debug.log'),
        logging.StreamHandler()  # Also log to console
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='.')
app.secret_key = 'your-secret-key-here'  # Required for sessions
CORS(app)

# Global variable to track build status
build_in_progress = False

# Create a global instance of the streaming queue manager
streaming_manager = StreamingQueueManager()

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')



class LlamaServerManager:
    def __init__(self):
        self.server_process = None
        self.current_config = None
        self.is_server_running = False
        self.server_port = 8080
        self.server_host = "127.0.0.1"
        self.server_url = f"http://{self.server_host}:{self.server_port}"

    def find_llama_server(self):
        """Find llama-server executable"""
        possible_paths = [
            os.path.join("ik_llama.cpp", "build", "bin", "llama-server"),
            os.path.join("ik_llama.cpp", "build", "bin", "llama-server.exe"),
            os.path.join("ik_llama.cpp", "llama-server"),
            os.path.join("ik_llama.cpp", "llama-server.exe"),
            "llama-server",
            "llama-server.exe"
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return path
        return None
    
    def get_version(self):
        """Get llama-server version information"""
        try:
            executable = self.find_llama_server()
            if not executable:
                return False, "llama-server executable not found"
            
            # Run llama-server --version
            result = subprocess.run(
                [executable, "--version"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                return True, result.stdout.strip()
            else:
                return False, f"Version check failed: {result.stderr.strip()}"
                
        except subprocess.TimeoutExpired:
            return False, "Version check timed out"
        except Exception as e:
            return False, f"Version check error: {str(e)}"

    def start_server(self, config):
        """Start llama-server with given configuration"""
        try:
            # Stop existing server if running
            if self.server_process:
                self.stop_server()
            
            # Handle model path - support both relative and absolute paths
            model_path = config["model"]
            
            # If it's a relative path, check if it exists relative to the current directory
            if not os.path.isabs(model_path):
                # First try relative to current directory
                if os.path.exists(model_path):
                    model_path = os.path.abspath(model_path)
                # If not found, try relative to models directory
                elif os.path.exists(os.path.join("models", model_path)):
                    model_path = os.path.abspath(os.path.join("models", model_path))
                # If still not found, try the original path as absolute
                else:
                    model_path = os.path.abspath(model_path)
            else:
                # It's already an absolute path
                model_path = os.path.abspath(model_path)
            
            if not os.path.exists(model_path):
                return False, f"Model file not found: {model_path}"
            
            print(f"Using model path: {model_path}")
            
            # Find llama-server executable
            executable = self.find_llama_server()
            if not executable:
                return False, "llama-server executable not found. Please build ik_llama.cpp first."
            
            # Build command line arguments
            cmd = [
                executable,
                "-m", model_path,
                "--host", self.server_host,
                "--port", str(self.server_port),
                "-c", str(config["ctx_size"]),
                "--threads", str(config.get("threads", 8)),
                "--timeout", "3600"  # Set server timeout to 1 hour to prevent connection interruptions
            ]
            
            # Add ik_llama.cpp specific parameters
            if config.get("n_gpu_layers", 0) > 0:
                cmd.extend(["-ngl", str(config["n_gpu_layers"])])
            
            if config.get("ctk"):
                cmd.extend(["-ctk", config["ctk"]])
            
            if config.get("mla") and config.get("mla") > 0:
                cmd.extend(["-mla", str(config["mla"])])
            
            if config.get("flash_attn", False):
                cmd.append("-fa")
            
            if config.get("amb"):
                cmd.extend(["-amb", str(config["amb"])])
            
            if config.get("fmoe", False):
                cmd.append("-fmoe")
            
            if config.get("ser", False):
                cmd.append("-ser")
            
            if config.get("rtr", False):
                cmd.append("-rtr")
                
            # Add override tensor pattern option
            if config.get("override_tensor"):
                cmd.append("-ot")
                cmd.append(config.get("override_tensor"))
            
            # Add mmap option (disabled by default in ik_llama.cpp, so add --no-mmap if disabled)
            if not config.get("mmap", True):
                cmd.append("--no-mmap")
            
            print(f"Starting llama-server with command: {' '.join(cmd)}")
            
            # Start the server process
            # CRITICAL: Don't capture stdout/stderr to avoid pipe deadlock during streaming
            # The subprocess will block if pipes fill up while Flask is busy streaming responses
            self.server_process = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                text=True
            )
            
            # Wait for server to start (increased timeout for large models)
            if not self.wait_for_server(max_wait_seconds=90):
                return False, "Server failed to start or is not responding"
            
            # Server is now available and configured
            self.current_config = config
            self.current_config["model"] = model_path  # Store the resolved absolute path
            self.is_server_running = True
            print("Server started successfully")
            return True, f"Server started successfully at {self.server_url}"
        except Exception as e:
            return False, str(e)

    def start_server_stream(self, config):
        """Start llama-server with streaming output for real-time feedback"""
        try:
            # Stop existing server if running
            if self.server_process:
                self.stop_server()
                yield f"data: {json.dumps({'status': 'preparing', 'progress': 5, 'message': 'Stopping existing server...'})}\n\n"
            
            # Handle model path - support both relative and absolute paths
            model_path = config["model"]
            
            yield f"data: {json.dumps({'status': 'preparing', 'progress': 10, 'message': 'Resolving model path...'})}\n\n"
            
            # If it's a relative path, check if it exists relative to the current directory
            if not os.path.isabs(model_path):
                # First try relative to current directory
                if os.path.exists(model_path):
                    model_path = os.path.abspath(model_path)
                # If not found, try relative to models directory
                elif os.path.exists(os.path.join("models", model_path)):
                    model_path = os.path.abspath(os.path.join("models", model_path))
                # If still not found, try the original path as absolute
                else:
                    model_path = os.path.abspath(model_path)
            else:
                # It's already an absolute path
                model_path = os.path.abspath(model_path)
            
            if not os.path.exists(model_path):
                yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': f'Model file not found: {model_path}'})}\n\n"
                return
            
            yield f"data: {json.dumps({'status': 'preparing', 'progress': 15, 'message': f'Found model: {os.path.basename(model_path)}'})}\n\n"
            
            # Find llama-server executable
            executable = self.find_llama_server()
            if not executable:
                yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': 'llama-server executable not found. Please build ik_llama.cpp first.'})}\n\n"
                return
            
            yield f"data: {json.dumps({'status': 'preparing', 'progress': 20, 'message': 'Found llama-server executable'})}\n\n"
            
            # Build command line arguments
            cmd = [
                executable,
                "-m", model_path,
                "--host", self.server_host,
                "--port", str(self.server_port),
                "-c", str(config["ctx_size"]),
                "--threads", str(config.get("threads", 8)),
                "--timeout", "3600"  # Set server timeout to 1 hour to prevent connection interruptions
            ]
            
            # Add ik_llama.cpp specific parameters
            if config.get("n_gpu_layers", 0) > 0:
                cmd.extend(["-ngl", str(config["n_gpu_layers"])])
            
            if config.get("ctk"):
                cmd.extend(["-ctk", config["ctk"]])
            
            if config.get("mla") and config.get("mla") > 0:
                cmd.extend(["-mla", str(config["mla"])])
            
            if config.get("flash_attn", False):
                cmd.append("-fa")
            
            if config.get("amb"):
                cmd.extend(["-amb", str(config["amb"])])
            
            if config.get("fmoe", False):
                cmd.append("-fmoe")
            
            if config.get("ser", False):
                cmd.append("-ser")
            
            if config.get("rtr", False):
                cmd.append("-rtr")
                
            # Add override tensor pattern option
            if config.get("override_tensor"):
                cmd.append("-ot")
                cmd.append(config.get("override_tensor"))
            
            yield f"data: {json.dumps({'status': 'starting', 'progress': 25, 'message': 'Starting llama-server process...'})}\n\n"
            
            # Start the server process
            self.server_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            yield f"data: {json.dumps({'status': 'loading', 'progress': 30, 'message': 'Server process started, loading model...'})}\n\n"
            
            # Read server output in real-time
            progress = 30
            server_ready = False
            
            # Use a separate thread to monitor server output
            import threading
            import queue
            output_queue = queue.Queue()
            
            def read_output():
                try:
                    for line in iter(self.server_process.stdout.readline, ''):
                        if line.strip():
                            output_queue.put(('output', line.strip()))
                        if self.server_process.poll() is not None:
                            break
                    output_queue.put(('done', None))
                except Exception as e:
                    output_queue.put(('error', str(e)))
            
            output_thread = threading.Thread(target=read_output)
            output_thread.daemon = True
            output_thread.start()
            
            # Monitor output and health check
            max_wait_time = 90
            start_time = time.time()
            last_health_check = 0
            last_progress_update = 0
            
            while time.time() - start_time < max_wait_time:
                try:
                    # Check for new output
                    try:
                        msg_type, content = output_queue.get(timeout=1)
                        if msg_type == 'output':
                            progress = min(progress + 1, 85)
                            last_progress_update = time.time()
                            # Truncate long messages
                            display_content = content[:100] + "..." if len(content) > 100 else content
                            yield f"data: {json.dumps({'status': 'loading', 'progress': progress, 'message': f'Server: {display_content}'})}\n\n"
                            
                            # Check if server is ready after seeing "listening" message
                            if "listening on" in content.lower() or "server is listening" in content.lower():
                                # Give server more time to fully initialize API endpoints
                                print("Server is listening, waiting for API endpoints to initialize...")
                                time.sleep(5)  # Increased from 2 to 5 seconds
                                # Full health check with inference test when server first starts
                                if self.health_check(test_inference=True):
                                    server_ready = True
                                    break
                                    
                        elif msg_type == 'done':
                            break
                        elif msg_type == 'error':
                            yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': f'Server output error: {content}'})}\n\n"
                            return
                    except queue.Empty:
                        pass
                    
                    # Periodic health check (only if no recent output)
                    current_time = time.time()
                    if current_time - last_health_check > 5 and current_time - last_progress_update > 3:  # Check every 5 seconds, but only if no recent output
                        last_health_check = current_time
                        # Use simplified health check for periodic checks during startup
                        if self.health_check(test_inference=False):
                            server_ready = True
                            break
                        else:
                            # Check if process is still running
                            if self.server_process.poll() is not None:
                                yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': 'Server process terminated unexpectedly'})}\n\n"
                                return
                            
                            elapsed = int(current_time - start_time)
                            # Only show waiting message if we haven't had recent progress
                            if current_time - last_progress_update > 10:
                                yield f"data: {json.dumps({'status': 'loading', 'progress': progress, 'message': f'Waiting for server to respond... ({elapsed}s)'})}\n\n"
                
                except Exception as e:
                    yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': f'Error during startup: {str(e)}'})}\n\n"
                    return
            
            if not server_ready:
                yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': 'Server failed to start or is not responding within timeout'})}\n\n"
                return
            
            # Server is ready
            logger.info("Health check passed, server is ready. Sending finalizing message...")
            yield f"data: {json.dumps({'status': 'finalizing', 'progress': 90, 'message': 'Server is responding, finalizing setup...'})}\n\n"
            
            # CRITICAL FIX: Instead of closing stdout pipe (which can hang), 
            # we'll just set it to None to prevent further monitoring
            # The pipe will be cleaned up when the process terminates
            try:
                logger.info("Detaching from stdout pipe to prevent buffer overflow...")
                if self.server_process and self.server_process.stdout:
                    # Don't close the pipe as it can hang - just stop monitoring it
                    self.server_process.stdout = None
                    logger.info("Successfully detached from stdout pipe")
                else:
                    logger.info("No stdout pipe to detach from")
            except Exception as e:
                logger.warning(f"Failed to detach from stdout pipe: {e}")
                # Continue anyway - this is not critical for functionality
            
            logger.info("Sending optimization message...")
            yield f"data: {json.dumps({'status': 'finalizing', 'progress': 95, 'message': 'Optimizing server configuration...'})}\n\n"
            
            # Server is now available and configured
            logger.info("Setting server configuration...")
            self.current_config = config
            self.current_config["model"] = model_path  # Store the resolved absolute path
            self.is_server_running = True
            
            logger.info("Sending success message...")
            yield f"data: {json.dumps({'status': 'success', 'progress': 100, 'message': f'Model loaded successfully! Server running at {self.server_url}'})}\n\n"
            logger.info("Model loading stream completed successfully!")
            
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': f'Error: {str(e)}'})}\n\n"
    
    def stop_server(self):
        """Stop the llama-server"""
        if self.server_process:
            self.server_process.terminate()
            self.server_process.wait()
            self.server_process = None
        self.is_server_running = False
    
    def wait_for_server(self, max_wait_seconds=90):
        """Wait for server to become available with incremental health checks"""
        print(f"Waiting for server to start at {self.server_url}...")

        total_waited = 0
        check_interval = 2  # Start with 2-second intervals

        while total_waited < max_wait_seconds:
            # Use simplified health check without inference test for periodic checks
            if self.health_check(test_inference=False):
                print(f"Server started successfully after {total_waited} seconds")
                return True

            remaining_time = max_wait_seconds - total_waited
            wait_time = min(check_interval, remaining_time)

            # Adjust interval after some time has passed
            if total_waited > 10:
                check_interval = 5  # Increase to 5-second intervals after 10 seconds
            if total_waited > 60:
                check_interval = 10  # Increase to 10-second intervals after 60 seconds

            print(f"Server not yet available. Waiting {wait_time} more seconds... ({total_waited}/{max_wait_seconds} seconds elapsed)")
            time.sleep(wait_time)
            total_waited += wait_time

        return False

    def health_check(self, test_inference=True):
        """Check if server is responding and model is ready for inference
        
        Args:
            test_inference: If True, test if model is ready for inference with a chat completion.
                           If False, only check if server is responding to basic HTTP requests.
        """
        import socket
        
        try:
            # First, check if the port is open with a socket connection
            print(f"Health check: Testing socket connection to {self.server_host}:{self.server_port}")
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(3)
            result = sock.connect_ex((self.server_host, self.server_port))
            sock.close()
            
            if result != 0:
                print(f"Health check: Socket connection failed (error {result})")
                return False
            
            print("Health check: Socket connection successful, testing HTTP endpoints")
            
            # Try the models endpoint first to see if server is responding
            server_responding = False
            try:
                print(f"Health check: Trying GET {self.server_url}/v1/models")
                response = requests.get(f"{self.server_url}/v1/models", timeout=5)
                print(f"Health check: Models endpoint returned status {response.status_code}")
                if response.status_code == 200:
                    print("Health check: Models endpoint successful")
                    server_responding = True
            except Exception as e:
                print(f"Health check: Models endpoint failed: {e}")
            
            # If models endpoint failed, try root endpoint
            if not server_responding:
                try:
                    print(f"Health check: Trying GET {self.server_url}/")
                    response = requests.get(f"{self.server_url}/", timeout=5)
                    print(f"Health check: Root endpoint returned status {response.status_code}")
                    if response.status_code in [200, 404]:  # 404 is also fine, means server is responding
                        print("Health check: Root endpoint successful")
                        server_responding = True
                except Exception as e:
                    print(f"Health check: Root endpoint failed: {e}")
            
            if not server_responding:
                print("Health check: Server not responding to basic HTTP requests")
                return False
            
            # For routine checks, we can skip the chat completion test
            if not test_inference:
                print("Health check: Server is responding to basic HTTP requests, skipping inference test")
                return True
            
            # Now test if the model is actually loaded and ready for inference
            print("Health check: Server responding, testing if model is ready for inference...")
            try:
                test_data = {
                    "messages": [{"role": "user", "content": "test"}],
                    "stream": False,
                    "max_tokens": 1,
                    "temperature": 0.1
                }
                
                print(f"Health check: Testing POST {self.server_url}/v1/chat/completions")
                response = requests.post(f"{self.server_url}/v1/chat/completions", 
                                       json=test_data, timeout=10)
                print(f"Health check: Chat completions test returned status {response.status_code}")
                
                if response.status_code == 200:
                    print("Health check: Model is ready for inference!")
                    return True
                elif response.status_code == 503:
                    # Check if it's specifically a "Loading model" error
                    try:
                        error_data = response.json()
                        if "Loading model" in str(error_data):
                            print("Health check: Model is still loading, not ready yet")
                            return False
                    except:
                        pass
                    print(f"Health check: Server returned 503, model may still be loading")
                    return False
                else:
                    print(f"Health check: Unexpected response from chat completions: {response.status_code}")
                    # For other errors, we'll consider the server ready but there might be other issues
                    return True
                    
            except Exception as e:
                print(f"Health check: Chat completions test failed: {e}")
                # If we can't test chat completions, fall back to basic server health
                return server_responding
            
        except Exception as e:
            print(f"Health check error: {e}")
            return False

    def server_health_check(self):
        """Check if the llama-server is healthy and responding"""
        try:
            # First try to connect to the server regardless of internal state
            response = requests.get(f"{self.server_url}/v1/models", timeout=5)
            if response.status_code == 200:
                # If server is responding but we didn't know it was running, update our state
                if not self.is_server_running:
                    print("Detected externally running server, updating internal state")
                    self.is_server_running = True
                return True, "Server is healthy"
            else:
                return False, f"Server returned status {response.status_code}"
        except requests.exceptions.ConnectionError:
            # If we thought the server was running but it's not responding, update state
            if self.is_server_running:
                print("Server marked as running but not responding, updating state")
                self.is_server_running = False
            return False, "Connection refused - server may have crashed"
        except requests.exceptions.Timeout:
            return False, "Server timeout - may be overloaded"
        except Exception as e:
            return False, f"Health check failed: {str(e)}"

    def chat_completion(self, messages, config):
        """Send chat completion request with proper HTTP/1.1 chunked encoding handling"""
        # Check if server is actually running by trying to connect
        healthy, health_msg = self.server_health_check()
        if not healthy:
            return False, f"Server not available: {health_msg}"
        
        # Prepare the request data
        data = {
            "messages": messages,
            "stream": True,
            "max_tokens": config.get("n_predict", 512),
            "temperature": config.get("temperature", 0.8),
            "top_p": config.get("top_p", 0.95),
            "top_k": config.get("top_k", 40),
            "repeat_penalty": config.get("repeat_penalty", 1.1),
            "stop": [],
            "frequency_penalty": 0.0,
            "presence_penalty": 0.0
        }
        
        # Headers for proper HTTP/1.1 streaming with SSE
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'User-Agent': 'llama-server-manager/1.0'
        }
        
        try:
            # Use standard requests with HTTP/1.1 for proper chunked encoding support
            # No custom adapters that might interfere with chunked encoding
            response = requests.post(
                f"{self.server_url}/v1/chat/completions",
                json=data,
                headers=headers,
                stream=True,
                timeout=(30, 300),  # Increased timeouts: 30s connect, 5min read
                verify=False
            )
            
            if response.status_code == 200:
                return True, response
            else:
                return False, f"Server error: {response.status_code}"
                
        except requests.exceptions.Timeout as e:
            return False, f"Request timeout: {str(e)}"
        except requests.exceptions.ConnectionError as e:
            return False, f"Connection error: {str(e)}"
        except Exception as e:
            return False, f"Request error: {str(e)}"

    def get_models(self):
        """Get available models from server"""
        if not self.is_server_running:
            return False, "Server not running"
        
        try:
            response = requests.get(f"{self.server_url}/v1/models", timeout=10)
            if response.status_code == 200:
                return True, response.json()
            else:
                return False, f"Server error: {response.status_code}"
        except Exception as e:
            return False, str(e)
    
    def get_server_info(self):
        """Get server information and status"""
        if not self.is_server_running:
            return {
                "status": "stopped",
                "url": None,
                "model": None
            }
        
        return {
            "status": "running",
            "url": self.server_url,
            "model": self.current_config.get("model", "").split("/")[-1] if self.current_config else None,
            "config": self.current_config
        }

# Global instance
llama_server = LlamaServerManager()

@app.route('/')
def index():
    """Serve the main HTML page"""
    return send_from_directory('.', 'index.html')



@app.route('/api/clone-repository', methods=['POST'])
def clone_repository():
    try:
        # Define the repository URL and target directory - create ik_llama.cpp in current directory
        repo_url = "https://github.com/ggerganov/llama.cpp.git"
        target_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ik_llama.cpp")
        
        # Check if directory already exists
        if os.path.exists(target_dir):
            return jsonify({"message": "Repository directory already exists. Using existing repository."}), 200
        
        # Clone the repository
        result = subprocess.run(
            ["git", "clone", repo_url, target_dir],
            capture_output=True,
            text=True,
            check=True
        )
        
        return jsonify({"message": "Repository cloned successfully", "details": result.stdout}), 200
    except subprocess.CalledProcessError as e:
        return jsonify({"message": "Failed to clone repository", "error": e.stderr}), 500
    except Exception as e:
        return jsonify({"message": "An error occurred", "error": str(e)}), 500

@app.route('/api/build-stream')
def build_stream():
    """Stream build progress in real-time using Server-Sent Events"""
    global build_in_progress
    
    # Get build options from request args BEFORE the generator function
    options = {
        'repo_option': request.args.get('repo_option', 'existing'),
        'cuda_support': request.args.get('cuda_support', 'false').lower() == 'true',
        'opencl_support': request.args.get('opencl_support', 'false').lower() == 'true',
        'metal_support': request.args.get('metal_support', 'false').lower() == 'true'
    }
    
    def generate():
        global build_in_progress
        try:
            # Set build in progress
            build_in_progress = True
            
            # Define the repository directory
            repo_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ik_llama.cpp")
            
            # Send initial status
            yield f"data: {json.dumps({'status': 'starting', 'progress': 0, 'message': 'Initializing build process...'})}\n\n"
            
            # Check if repository option is to clone
            if options.get("repo_option") == "clone":
                yield f"data: {json.dumps({'status': 'cloning', 'progress': 5, 'message': 'Preparing to clone repository...'})}\n\n"
                
                # Remove existing directory if it exists
                if os.path.exists(repo_dir):
                    yield f"data: {json.dumps({'status': 'cloning', 'progress': 10, 'message': 'Removing existing repository...'})}\n\n"
                    shutil.rmtree(repo_dir)
                
                # Clone the repository with progress
                yield f"data: {json.dumps({'status': 'cloning', 'progress': 15, 'message': 'Cloning llama.cpp repository...'})}\n\n"
                
                clone_process = subprocess.Popen(
                    ["git", "clone", "--progress", "https://github.com/ggerganov/llama.cpp.git", repo_dir],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True
                )
                
                clone_progress = 15
                for line in iter(clone_process.stdout.readline, ''):
                    if line.strip():
                        # Parse git clone progress
                        if "Receiving objects:" in line or "Resolving deltas:" in line:
                            clone_progress = min(clone_progress + 2, 35)
                            yield f"data: {json.dumps({'status': 'cloning', 'progress': clone_progress, 'message': f'Cloning: {line.strip()}'})}\n\n"
                
                clone_process.wait()
                if clone_process.returncode != 0:
                    build_in_progress = False
                    yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': 'Failed to clone repository'})}\n\n"
                    return
                
                yield f"data: {json.dumps({'status': 'cloning', 'progress': 40, 'message': 'Repository cloned successfully'})}\n\n"
            
            # Check if directory exists
            if not os.path.exists(repo_dir):
                build_in_progress = False
                yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': 'Repository directory does not exist'})}\n\n"
                return
            
            # Prepare build command
            yield f"data: {json.dumps({'status': 'configuring', 'progress': 45, 'message': 'Preparing build configuration...'})}\n\n"
            
            build_cmd = ["cmake", "-B", "build"]
            
            # Add options based on user selection
            if options.get("cuda_support", False):
                build_cmd.extend(["-DGGML_CUDA=ON", "-DLLAMA_CUDA=OFF", "-DLLAMA_CURL=OFF"])
                yield f"data: {json.dumps({'status': 'configuring', 'progress': 50, 'message': 'Configuring CUDA support...'})}\n\n"
                
                # Add CUDA paths for Linux (since we're in WSL)
                if platform.system() == "Linux":
                    linux_cuda_paths = ['/usr/local/cuda', '/opt/cuda']
                    for cuda_path in linux_cuda_paths:
                        if os.path.exists(cuda_path) and os.path.exists(os.path.join(cuda_path, 'bin', 'nvcc')):
                            build_cmd.extend([
                                f"-DCUDAToolkit_ROOT={cuda_path}",
                                f"-DCUDA_TOOLKIT_ROOT_DIR={cuda_path}",
                                f"-DCMAKE_CUDA_COMPILER={os.path.join(cuda_path, 'bin', 'nvcc')}"
                            ])
                            break
            
            if options.get("opencl_support", False):
                build_cmd.append("-DLLAMA_OPENCL=ON")
                yield f"data: {json.dumps({'status': 'configuring', 'progress': 52, 'message': 'Configuring OpenCL support...'})}\n\n"
            
            if options.get("metal_support", False) and platform.system() == "Darwin":
                build_cmd.append("-DLLAMA_METAL=ON")
                yield f"data: {json.dumps({'status': 'configuring', 'progress': 54, 'message': 'Configuring Metal support...'})}\n\n"
            
            # Change to repository directory
            os.chdir(repo_dir)
            
            # Set up environment
            env = os.environ.copy()
            if platform.system() == "Linux":
                for cuda_path in ['/usr/local/cuda', '/opt/cuda']:
                    if os.path.exists(cuda_path):
                        env['CUDA_PATH'] = cuda_path
                        env['PATH'] = f"{os.path.join(cuda_path, 'bin')}:{env.get('PATH', '')}"
                        break
            
            # Run CMake configuration
            yield f"data: {json.dumps({'status': 'configuring', 'progress': 55, 'message': 'Running CMake configuration...'})}\n\n"
            
            cmake_process = subprocess.Popen(
                build_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
                env=env
            )
            
            config_progress = 55
            for line in iter(cmake_process.stdout.readline, ''):
                if line.strip():
                    config_progress = min(config_progress + 1, 70)
                    yield f"data: {json.dumps({'status': 'configuring', 'progress': config_progress, 'message': f'CMake: {line.strip()[:100]}'})}\n\n"
            
            cmake_process.wait()
            if cmake_process.returncode != 0:
                build_in_progress = False
                yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': 'CMake configuration failed'})}\n\n"
                return
            
            yield f"data: {json.dumps({'status': 'building', 'progress': 75, 'message': 'Starting compilation...'})}\n\n"
            
            # Run the actual build
            build_process = subprocess.Popen(
                ["cmake", "--build", "build", "--parallel"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
                env=env
            )
            
            build_progress = 75
            for line in iter(build_process.stdout.readline, ''):
                if line.strip():
                    # Parse build progress from output
                    if "[" in line and "]" in line:
                        try:
                            # Extract percentage from build output like "[50%] Building..."
                            percent_match = re.search(r'\[(\d+)%\]', line)
                            if percent_match:
                                build_percent = int(percent_match.group(1))
                                build_progress = 75 + (build_percent * 0.24)  # Scale to 75-99%
                        except:
                            build_progress = min(build_progress + 0.5, 99)
                    else:
                        build_progress = min(build_progress + 0.2, 99)
                    
                    yield f"data: {json.dumps({'status': 'building', 'progress': int(build_progress), 'message': f'Building: {line.strip()[:100]}'})}\n\n"
            
            build_process.wait()
            if build_process.returncode == 0:
                build_in_progress = False
                # Write success message to build log for status endpoint
                build_log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_log.txt")
                with open(build_log_path, 'a') as f:
                    f.write("\nBuild completed successfully at " + time.strftime("%Y-%m-%d %H:%M:%S") + "\n")
                yield f"data: {json.dumps({'status': 'success', 'progress': 100, 'message': 'Build completed successfully!'})}\n\n"
            else:
                build_in_progress = False
                # Write failure message to build log for status endpoint
                build_log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_log.txt")
                with open(build_log_path, 'a') as f:
                    f.write("\nBuild failed at " + time.strftime("%Y-%m-%d %H:%M:%S") + "\n")
                yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': 'Build failed during compilation'})}\n\n"
                
        except Exception as e:
            build_in_progress = False
            yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': f'Build error: {str(e)}'})}\n\n"
    
    return Response(generate(), mimetype='text/event-stream')

@app.route('/api/build', methods=['POST'])
def build():
    """Start the build process and store options in session"""
    try:
        # Store build options in session for the stream endpoint
        options = request.json
        session['build_options'] = options
        
        return jsonify({"message": "Build process ready to start"}), 200
    except Exception as e:
        return jsonify({"message": "An error occurred", "error": str(e)}), 500

@app.route('/api/build-project', methods=['POST'])
def build_project():
    try:
        # Get build options from request
        options = request.json
        
        # Define the repository directory - create ik_llama.cpp in current directory
        repo_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ik_llama.cpp")
        
        # Check if directory exists
        if not os.path.exists(repo_dir):
            return jsonify({"message": "Repository directory does not exist. Please clone the repository first."}), 400
        
        # Prepare build command
        build_cmd = ["cmake", "-B", "build"]
        
        # Add options based on user selection
        if options.get("cuda", False):
            # Use GGML_CUDA instead of deprecated LLAMA_CUDA
            build_cmd.append("-DGGML_CUDA=ON")
            # Explicitly disable the deprecated LLAMA_CUDA to avoid warnings
            build_cmd.append("-DLLAMA_CUDA=OFF")
            # Disable CURL dependency which is causing build errors
            build_cmd.append("-DLLAMA_CURL=OFF")
            
            # Add additional CMake flags to help find CUDA
            if platform.system() == "Windows":
                # Try to detect CUDA installation for CMake configuration
                program_files = os.environ.get('PROGRAMFILES', 'C:\\Program Files')
                cuda_base = os.path.join(program_files, 'NVIDIA GPU Computing Toolkit', 'CUDA')
                
                if os.path.exists(cuda_base):
                    # Find all CUDA versions
                    cuda_versions = []
                    for item in os.listdir(cuda_base):
                        cuda_version_path = os.path.join(cuda_base, item)
                        if os.path.isdir(cuda_version_path) and item.startswith('v'):
                            cuda_versions.append(cuda_version_path)
                    
                    # Use the latest version found
                    if cuda_versions:
                        cuda_versions.sort(reverse=True)
                        latest_cuda = cuda_versions[0]
                        
                        # Add CMake flags to help find CUDA
                        build_cmd.append(f"-DCUDAToolkit_ROOT={latest_cuda}")
                        build_cmd.append(f"-DCUDA_TOOLKIT_ROOT_DIR={latest_cuda}")
                        
                        # Set the CUDA compiler path explicitly
                        nvcc_path = os.path.join(latest_cuda, 'bin', 'nvcc.exe')
                        if os.path.exists(nvcc_path):
                            build_cmd.append(f"-DCMAKE_CUDA_COMPILER={nvcc_path}")
            
            elif platform.system() == "Linux":
                # Check common Linux CUDA installation paths
                linux_cuda_paths = ['/usr/local/cuda', '/opt/cuda']
                
                # Also check versioned paths
                for base_path in ['/usr/local', '/opt']:
                    if os.path.exists(base_path):
                        for item in os.listdir(base_path):
                            if item.startswith('cuda-'):
                                cuda_version_path = os.path.join(base_path, item)
                                if os.path.isdir(cuda_version_path):
                                    linux_cuda_paths.append(cuda_version_path)
                
                # Find the first valid CUDA installation
                for cuda_path in linux_cuda_paths:
                    nvcc_path = os.path.join(cuda_path, 'bin', 'nvcc')
                    if os.path.exists(cuda_path) and os.path.exists(nvcc_path):
                        build_cmd.append(f"-DCUDAToolkit_ROOT={cuda_path}")
                        build_cmd.append(f"-DCUDA_TOOLKIT_ROOT_DIR={cuda_path}")
                        build_cmd.append(f"-DCMAKE_CUDA_COMPILER={nvcc_path}")
                        break
        
        if options.get("opencl", False):
            build_cmd.append("-DLLAMA_OPENCL=ON")
        
        if options.get("metal", False) and platform.system() == "Darwin":
            build_cmd.append("-DLLAMA_METAL=ON")
        
        # Start the build process in a separate thread
        thread = threading.Thread(target=run_build, args=(repo_dir, build_cmd))
        thread.daemon = True
        thread.start()
        
        return jsonify({"message": "Build process started"}), 200
    except Exception as e:
        return jsonify({"message": "An error occurred", "error": str(e)}), 500

@app.route('/api/build-status', methods=['GET'])
def get_build_status():
    # Check if build log exists and read its content
    build_log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_log.txt")
    
    if not os.path.exists(build_log_path):
        return jsonify({"status": "Not Started", "log": ""}), 200
    
    with open(build_log_path, 'r') as f:
        log_content = f.read()
    
    # Check if build is complete
    if "Build completed successfully" in log_content:
        status = "Success"
    elif "Build failed" in log_content:
        status = "Failed"
    else:
        status = "In Progress"
    
    return jsonify({"status": status, "log": log_content}), 200

@app.route('/api/clear-logs', methods=['POST'])
def clear_logs():
    try:
        # Define the build log path
        build_log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_log.txt")
        
        # Check if file exists
        if os.path.exists(build_log_path):
            # Clear the file
            with open(build_log_path, 'w') as f:
                f.write("Logs cleared at " + time.strftime("%Y-%m-%d %H:%M:%S") + "\n")
            
            return jsonify({"message": "Logs cleared successfully"}), 200
        else:
            return jsonify({"message": "No logs file found"}), 200
    except Exception as e:
        return jsonify({"message": "An error occurred", "error": str(e)}), 500

def run_build(repo_dir, build_cmd):
    try:
        # Create or clear the build log file
        build_log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_log.txt")
        with open(build_log_path, 'w') as f:
            f.write("Build started at " + time.strftime("%Y-%m-%d %H:%M:%S") + "\n")
            f.write("Build command: " + " ".join(build_cmd) + "\n\n")
        
        # Check if CMake is available
        try:
            cmake_check = subprocess.run(["cmake", "--version"], capture_output=True, text=True)
            if cmake_check.returncode != 0:
                with open(build_log_path, 'a') as f:
                    f.write("ERROR: CMake is not installed or not in PATH.\n")
                    f.write("Please install CMake from https://cmake.org/download/\n")
                    f.write("Or install via Visual Studio Installer, Chocolatey, or winget.\n")
                    f.write("Build failed - CMake not found\n")
                return
        except FileNotFoundError:
            with open(build_log_path, 'a') as f:
                f.write("ERROR: CMake is not installed or not in PATH.\n")
                f.write("Please install CMake from https://cmake.org/download/\n")
                f.write("Installation options:\n")
                f.write("1. Download from https://cmake.org/download/\n")
                f.write("2. Via Visual Studio Installer (C++ CMake tools)\n")
                f.write("3. Via Chocolatey: choco install cmake\n")
                f.write("4. Via winget: winget install Kitware.CMake\n")
                f.write("Build failed - CMake not found\n")
            return
        
        # Check if repository directory exists
        if not os.path.exists(repo_dir):
            with open(build_log_path, 'a') as f:
                f.write(f"ERROR: Repository directory does not exist: {repo_dir}\n")
                f.write("Please clone the llama.cpp repository first.\n")
                f.write("Build failed - Repository not found\n")
            return
        
        # Change to repository directory
        os.chdir(repo_dir)
        
        # Set up environment for CUDA detection
        env = os.environ.copy()
        
        # Try to detect CUDA installation paths
        cuda_paths = []
        
        # Windows CUDA paths
        if platform.system() == "Windows":
            # Check common Windows CUDA installation paths
            program_files = os.environ.get('PROGRAMFILES', 'C:\\Program Files')
            cuda_base = os.path.join(program_files, 'NVIDIA GPU Computing Toolkit', 'CUDA')
            
            if os.path.exists(cuda_base):
                # Find all CUDA versions
                for item in os.listdir(cuda_base):
                    cuda_version_path = os.path.join(cuda_base, item)
                    if os.path.isdir(cuda_version_path) and item.startswith('v'):
                        cuda_paths.append(cuda_version_path)
                
                # Use the latest version found
                if cuda_paths:
                    cuda_paths.sort(reverse=True)  # Sort to get latest version first
                    latest_cuda = cuda_paths[0]
                    
                    # Set CUDA environment variables
                    env['CUDA_PATH'] = latest_cuda
                    env['CUDA_TOOLKIT_ROOT_DIR'] = latest_cuda
                    
                    # Set MSBuild-specific CUDA toolkit directory
                    env['CudaToolkitDir'] = latest_cuda
                    
                    # Add CUDA bin to PATH if not already there
                    cuda_bin = os.path.join(latest_cuda, 'bin')
                    if cuda_bin not in env.get('PATH', ''):
                        env['PATH'] = cuda_bin + os.pathsep + env.get('PATH', '')
                    
                    with open(build_log_path, 'a') as f:
                        f.write(f"Detected CUDA installation at: {latest_cuda}\n")
                        f.write(f"Added CUDA bin to PATH: {cuda_bin}\n")
                        f.write(f"Set CudaToolkitDir environment variable: {latest_cuda}\n\n")
        
        # Linux CUDA paths
        elif platform.system() == "Linux":
            # Check common Linux CUDA installation paths
            linux_cuda_paths = ['/usr/local/cuda', '/opt/cuda']
            
            # Also check versioned paths
            for base_path in ['/usr/local', '/opt']:
                if os.path.exists(base_path):
                    for item in os.listdir(base_path):
                        if item.startswith('cuda-'):
                            cuda_version_path = os.path.join(base_path, item)
                            if os.path.isdir(cuda_version_path):
                                linux_cuda_paths.append(cuda_version_path)
            
            # Find the first valid CUDA installation
            for cuda_path in linux_cuda_paths:
                if os.path.exists(cuda_path) and os.path.exists(os.path.join(cuda_path, 'bin', 'nvcc')):
                    env['CUDA_PATH'] = cuda_path
                    env['CUDA_TOOLKIT_ROOT_DIR'] = cuda_path
                    
                    # Add CUDA bin to PATH if not already there
                    cuda_bin = os.path.join(cuda_path, 'bin')
                    if cuda_bin not in env.get('PATH', ''):
                        env['PATH'] = cuda_bin + ':' + env.get('PATH', '')
                    
                    with open(build_log_path, 'a') as f:
                        f.write(f"Detected CUDA installation at: {cuda_path}\n")
                        f.write(f"Added CUDA bin to PATH: {cuda_bin}\n\n")
                    break
        
        # Run CMake configuration
        with open(build_log_path, 'a') as f:
            f.write("Running CMake configuration...\n")
            f.write(f"Environment CUDA_PATH: {env.get('CUDA_PATH', 'Not set')}\n")
            f.write(f"Environment PATH: {env.get('PATH', 'Not set')[:200]}...\n\n")
        
        cmake_process = subprocess.run(
            build_cmd,
            capture_output=True,
            text=True,
            env=env
        )
        
        with open(build_log_path, 'a') as f:
            f.write(cmake_process.stdout + "\n")
            if cmake_process.stderr:
                f.write("Errors:\n" + cmake_process.stderr + "\n")
        
        if cmake_process.returncode != 0:
            with open(build_log_path, 'a') as f:
                f.write("Build failed at CMake configuration step\n")
            return
        
        # Run the actual build
        with open(build_log_path, 'a') as f:
            f.write("\nRunning build...\n")
        
        build_process = subprocess.run(
            ["cmake", "--build", "build", "--parallel"],
            capture_output=True,
            text=True,
            env=env
        )
        
        with open(build_log_path, 'a') as f:
            f.write(build_process.stdout + "\n")
            if build_process.stderr:
                f.write("Errors:\n" + build_process.stderr + "\n")
        
        if build_process.returncode == 0:
            with open(build_log_path, 'a') as f:
                f.write("\nBuild completed successfully at " + time.strftime("%Y-%m-%d %H:%M:%S") + "\n")
        else:
            with open(build_log_path, 'a') as f:
                f.write("\nBuild failed at " + time.strftime("%Y-%m-%d %H:%M:%S") + "\n")
    
    except Exception as e:
        with open(build_log_path, 'a') as f:
            f.write("\nBuild failed with exception: " + str(e) + "\n")

@app.route('/api/package-info', methods=['GET'])
def get_package_info():
    """Get package.json information for version checking"""
    try:
        package_path = os.path.join(os.path.dirname(__file__), 'package.json')
        if os.path.exists(package_path):
            with open(package_path, 'r') as f:
                package_data = json.load(f)
            return jsonify({
                'success': True,
                'version': package_data.get('version', '1.0.0'),
                'name': package_data.get('name', 'ik_fe')
            })
        else:
            return jsonify({
                'success': True,
                'version': '1.0.0',
                'name': 'ik_fe'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files"""
    return send_from_directory('.', filename)

@app.route('/api/load_model_stream')
def load_model_stream():
    """Stream model loading progress"""
    # Capture session data before entering the generator function
    model_path = session.get('model_path')
    config = session.get('model_config', {})
    
    def generate():
        try:
            if not model_path:
                yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': 'No model path provided'})}\n\n"
                return
            
            # Add model path to config
            config['model'] = model_path
            
            # Use the streaming method
            for chunk in llama_server.start_server_stream(config):
                yield chunk
                
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': f'Stream error: {str(e)}'})}\n\n"
    
    return Response(generate(), mimetype='text/event-stream')

@app.route('/api/load_model', methods=['POST'])
def load_model():
    """Store config in session for streaming endpoint"""
    try:
        data = request.json
        model_path = data.get('model_path')
        config = data.get('config', {})
        
        # Store config in session for the stream endpoint
        session['model_config'] = config
        session['model_path'] = model_path
        
        return jsonify({
            'success': True,
            'message': 'Configuration saved, ready for streaming'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/unload_model', methods=['POST'])
def unload_model():
    """Stop server and unload model"""
    try:
        llama_server.stop_server()
        return jsonify({
            'success': True,
            'message': 'Model unloaded successfully',
            'error': None
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/discover_models', methods=['GET'])
def discover_models():
    """Discover .gguf models in the models directory and subdirectories"""
    try:
        models_dir = os.path.join(os.path.dirname(__file__), 'models')
        models = []
        
        # Ensure models directory exists
        if not os.path.exists(models_dir):
            os.makedirs(models_dir)
            print(f"Created models directory: {models_dir}")
        
        # Search for .gguf files recursively in models directory and subdirectories
        gguf_files = glob.glob(os.path.join(models_dir, '**', '*.gguf'), recursive=True)
        
        for model_path in gguf_files:
            model_name = os.path.basename(model_path)
            model_size = os.path.getsize(model_path)
            model_size_mb = round(model_size / (1024 * 1024), 1)
            model_size_gb = round(model_size / (1024 * 1024 * 1024), 2)
            
            # Get relative path from the web frontend directory
            relative_path = os.path.relpath(model_path, os.path.dirname(__file__))
            
            # Create a display name that includes the parent directory if it's in a subdirectory
            parent_dir = os.path.basename(os.path.dirname(model_path))
            if parent_dir != 'models':
                display_name = f"{parent_dir}/{model_name}"
            else:
                display_name = model_name
            
            # Format size display
            if model_size_gb >= 1:
                size_display = f"{model_size_gb} GB"
            else:
                size_display = f"{model_size_mb} MB"
            
            print(f"Found model: {model_name} at {relative_path} (display: {display_name}, size: {size_display})")
            
            models.append({
                'name': model_name,
                'display_name': display_name,
                'path': relative_path,
                'absolute_path': model_path,
                'size': model_size,
                'size_mb': model_size_mb,
                'size_gb': model_size_gb,
                'size_display': size_display,
                'parent_dir': parent_dir
            })
        
        # Sort models by display name for better organization
        models.sort(key=lambda x: x['display_name'])
        
        return jsonify({
            'success': True,
            'models': models,
            'models_dir': models_dir,
            'models_count': len(models)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({'status': 'ok', 'timestamp': time.time()})

@app.route('/api/server-health', methods=['GET'])
def server_health():
    """Check llama-server health"""
    try:
        if not llama_server.is_server_running:
            return jsonify({'healthy': False, 'error': 'Server not running'})
        
        # Try to ping the llama-server
        response = requests.get(f"{llama_server.server_url}/health", timeout=5)
        if response.status_code == 200:
            return jsonify({'healthy': True, 'server_url': llama_server.server_url})
        else:
            return jsonify({'healthy': False, 'error': f'Server returned status {response.status_code}'})
    except Exception as e:
        return jsonify({'healthy': False, 'error': str(e)})

@app.route('/api/chat', methods=['POST'])
def chat():
    """Chat endpoint with streaming response using queue-based system"""
    try:
        data = request.json
        message = data['message']
        history = data.get('history', [])
        config = data['config']
        
        # Generate a unique request ID
        request_id = f"req_{int(time.time() * 1000)}_{threading.get_ident()}"
        
        # Create a log file for debugging
        import datetime
        log_file = f"streaming_debug_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        
        def log_to_file(message):
            with open(log_file, 'a', encoding='utf-8') as f:
                timestamp = datetime.datetime.now().strftime('%H:%M:%S.%f')[:-3]
                f.write(f"[{timestamp}] {message}\n")
                f.flush()
        
        # Build messages array from conversation history
        messages = []
        if config.get('system_prompt'):
            messages.append({"role": "system", "content": config['system_prompt']})
        
        # Add conversation history (filtered to exclude thinking tags)
        for msg in history:
            messages.append({
                "role": msg['role'],
                "content": msg['content']
            })
        
        # Add the current user message
        messages.append({"role": "user", "content": message})
        
        # Create a new request in the streaming manager
        if not streaming_manager.create_request(request_id):
            return jsonify({'error': 'Failed to create streaming request'}), 500
        
        # Start the LLM request in a background thread
        def start_llm_request():
            max_retries = 3
            retry_delay = 2  # seconds
            
            for attempt in range(max_retries):
                try:
                    log_to_file(f"Starting chat completion attempt {attempt + 1}/{max_retries}")
                    log_to_file(f"Messages: {messages}")
                    log_to_file(f"Config: {config}")
                    
                    # Check server health before making request
                    healthy, health_msg = llama_server.server_health_check()
                    if not healthy:
                        log_to_file(f"Server health check failed: {health_msg}")
                        if attempt < max_retries - 1:
                            log_to_file(f"Retrying in {retry_delay} seconds...")
                            time.sleep(retry_delay)
                            continue
                        else:
                            queue_obj = streaming_manager.get_queue(request_id)
                            if queue_obj:
                                queue_obj.put({'error': f'Server health check failed: {health_msg}'})
                            streaming_manager.mark_complete(request_id)
                            return
                    
                    success, response = llama_server.chat_completion(messages, config)
                    if not success:
                        log_to_file(f"Chat completion failed: {response}")
                        
                        # Check if it's a server error that might be recoverable
                        if "503" in str(response) or "Connection" in str(response):
                            if attempt < max_retries - 1:
                                log_to_file(f"Server error, retrying in {retry_delay} seconds...")
                                time.sleep(retry_delay)
                                retry_delay *= 2  # Exponential backoff
                                continue
                        
                        queue_obj = streaming_manager.get_queue(request_id)
                        if queue_obj:
                            queue_obj.put({'error': response})
                        streaming_manager.mark_complete(request_id)
                        return
                    
                    log_to_file(f"Chat completion successful, response status: {response.status_code}")
                    log_to_file(f"Response headers: {dict(response.headers)}")
                    
                    # Process the response in a separate thread
                    process_llm_response(streaming_manager, request_id, response, log_file)
                    return  # Success, exit retry loop
                    
                except Exception as e:
                    log_to_file(f"Error in chat completion attempt {attempt + 1}: {e}")
                    if attempt < max_retries - 1:
                        log_to_file(f"Retrying in {retry_delay} seconds...")
                        time.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                    else:
                        # Final attempt failed
                        queue_obj = streaming_manager.get_queue(request_id)
                        if queue_obj:
                            queue_obj.put({'error': f'Request failed after {max_retries} attempts: {str(e)}'})
                        streaming_manager.mark_complete(request_id)
        
        # Start the background thread
        threading.Thread(target=start_llm_request, daemon=True).start()
        
        # Define the generator function to stream from the queue
        @stream_with_context
        def generate():
            queue_obj = streaming_manager.get_queue(request_id)
            if not queue_obj:
                yield f"{json.dumps({'error': 'Queue not found'})}\n"
                return
            
            # Stream from the queue until we get a completion signal
            import queue as queue_module  # Rename to avoid conflict with the queue variable
            while streaming_manager.is_active(request_id):
                try:
                    # Get with timeout to allow for checking if the request is still active
                    item = queue_obj.get(timeout=1.0)
                    yield f"{json.dumps(item)}\n"
                    
                    # If we got a completion signal, exit
                    if 'done' in item or 'error' in item:
                        break
                        
                except queue_module.Empty:
                    # Queue is empty but request is still active, continue waiting
                    continue
                except Exception as e:
                    log_to_file(f"Error in generate: {e}")
                    yield f"{json.dumps({'error': str(e)})}\n"
                    break
            
            # Ensure we mark the request as complete when we're done streaming
            if streaming_manager.is_active(request_id):
                streaming_manager.mark_complete(request_id)
        
        # Create response with proper Server-Sent Events headers
        response = Response(generate(), mimetype='text/event-stream')
        response.headers['Cache-Control'] = 'no-cache'
        response.headers['Connection'] = 'keep-alive'
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['X-Accel-Buffering'] = 'no'  # Disable nginx buffering
        return response
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stop', methods=['POST'])
def stop_generation():
    """Stop current generation"""
    try:
        data = request.json
        request_id = data.get('request_id')
        
        if request_id and streaming_manager.is_active(request_id):
            # Mark the request as complete to stop streaming
            streaming_manager.mark_complete(request_id)
            return jsonify({'success': True, 'message': f'Generation for request {request_id} stopped'})
        else:
            # If no request_id provided or not found, return a generic success
            return jsonify({'success': True, 'message': 'No active generation found to stop'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/version', methods=['GET'])
def get_version():
    """Get llama-server version information"""
    try:
        success, version_info = llama_server.get_version()
        return jsonify({
            'success': success,
            'version': version_info if success else None,
            'error': None if success else version_info
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current status"""
    global build_in_progress
    
    info = llama_server.get_server_info()
    
    # Check build status using the global variable
    if build_in_progress:
        build_status = "In Progress"
    else:
        # Check build log for final status
        build_log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_log.txt")
        build_status = "Not Started"
        
        if os.path.exists(build_log_path):
            with open(build_log_path, 'r') as f:
                log_content = f.read()
            
            if "Build completed successfully" in log_content:
                build_status = "Success"
            elif "Build failed" in log_content:
                build_status = "Failed"
            else:
                build_status = "Not Started"
    
    # Check if repository exists - create ik_llama.cpp in current directory
    repo_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ik_llama.cpp")
    repo_exists = os.path.exists(repo_dir)
    
    # Check if model is actually loaded by making a simple API call to the server
    model_loaded = llama_server.is_server_running  # Default to server running status
    model_name = info.get('model', '')
    if llama_server.is_server_running:
        try:
            # Try to get model info from the server
            response = requests.get(f"{llama_server.server_url}/v1/models", timeout=2)
            if response.status_code == 200:
                model_data = response.json()
                if model_data and isinstance(model_data, list) and len(model_data) > 0:
                    model_loaded = True
                    model_name = model_data[0].get('id', info.get('model', ''))
                # If the API returns successfully but no models, we keep the default value
                # This ensures compatibility with the UI which expects model_loaded to be true when server is running
        except Exception as e:
            logger.warning(f"Error checking model status: {e}")
            # We already set the default values above, so no need to do anything here
    
    return jsonify({
        'is_loaded': model_loaded,
        'is_generating': False,  # We'll implement this later
        'current_model': info.get('model', ''),
        'server_status': info['status'],
        'server_url': info['url'],
        'server_running': llama_server.is_server_running,
        'model_loaded': model_loaded,
        'model_name': model_name,
        'build_status': build_status,
        'repo_exists': repo_exists
    })

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully"""
    print("\nShutting down...")
    llama_server.stop_server()
    sys.exit(0)

if __name__ == '__main__':
    signal.signal(signal.SIGINT, signal_handler)
    
    print("Starting ik_llama.cpp Web Interface...")
    print("Open your browser and go to: http://localhost:5000")
    print("Press Ctrl+C to stop")
    
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)