import os
import json
import subprocess
import threading
import time
import requests
import socket
import logging
import atexit
import platform
import queue

# Configure logging
logger = logging.getLogger(__name__)

class LlamaServerManager:
    def __init__(self):
        self.server_process = None
        self.current_config = None
        self.is_server_running = False
        self.server_port = 8080
        self.server_host = "127.0.0.1"
        self.server_url = f"http://{self.server_host}:{self.server_port}"
        
        # Enhanced state management
        self._state_lock = threading.Lock()
        self._last_health_check = 0
        self._health_check_interval = 30  # Increased from 5 to 30 seconds
        self._startup_timeout = 90  # seconds
        self._shutdown_timeout = 10  # seconds
        
        # Process monitoring
        self._monitor_thread = None
        self._monitor_active = False
        self._restart_attempts = 0
        self._max_restart_attempts = 3
        
        # Build integration
        self._build_version = None
        self._last_build_check = 0
        
        # Register cleanup handler
        atexit.register(self._cleanup_on_exit)

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
        with self._state_lock:
            # Check for build changes
            if self._check_build_changes() and self.is_server_running:
                logger.info("Build changed, restarting server...")
                self._stop_server_internal(force=False)
            
            # Stop existing server if running
            if self.server_process:
                self.stop_server()
        
        try:
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
                text=True,
                preexec_fn=None if platform.system() == "Windows" else os.setsid
            )
            
            # Start process monitoring
            self._monitor_active = True
            self._monitor_thread = threading.Thread(target=self._monitor_server_process, daemon=True)
            self._monitor_thread.start()
            
            # Wait for server to start (use configured timeout)
            if not self.wait_for_server(max_wait_seconds=self._startup_timeout):
                self._stop_server_internal(force=True)
                return False, "Server failed to start or is not responding"
            
            # Server is now available and configured
            self.current_config = config
            self.current_config["model"] = model_path  # Store the resolved absolute path
            self.is_server_running = True
            self._restart_attempts = 0  # Reset restart counter on successful start
            print("Server started successfully")
            return True, f"Server started successfully at {self.server_url}"
        except Exception as e:
            # Cleanup on error
            self._stop_server_internal(force=True)
            return False, str(e)

    def start_server_stream(self, config):
        """Start llama-server with streaming output for real-time feedback"""
        with self._state_lock:
            # Check for build changes
                if self._check_build_changes() and self.is_server_running:
                    yield f"data: {json.dumps({'status': 'preparing', 'progress': 2, 'message': 'Build changed, restarting server...'})}\\n\\n"
                    self._stop_server_internal(force=False)
                
                # Stop existing server if running
                if self.server_process:
                    self.stop_server()
                yield f"data: {json.dumps({'status': 'preparing', 'progress': 5, 'message': 'Stopping existing server...'})}\\n\\n"
        
        try:
            # Handle model path - support both relative and absolute paths
            model_path = config["model"]
            
            yield f"data: {json.dumps({'status': 'preparing', 'progress': 10, 'message': 'Resolving model path...'})}\\n\\n"
            
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
                yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': f'Model file not found: {model_path}'})}\\n\\n"
                return
            
            yield f"data: {json.dumps({'status': 'preparing', 'progress': 15, 'message': f'Found model: {os.path.basename(model_path)}'})}\\n\\n"
            
            # Find llama-server executable
            executable = self.find_llama_server()
            if not executable:
                yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': 'llama-server executable not found. Please build ik_llama.cpp first.'})}\\n\\n"
                return
            
            yield f"data: {json.dumps({'status': 'preparing', 'progress': 20, 'message': 'Found llama-server executable'})}\\n\\n"
            
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
            
            yield f"data: {json.dumps({'status': 'starting', 'progress': 25, 'message': 'Starting llama-server process...'})}\\n\\n"
            
            # Start the server process with enhanced monitoring
            self.server_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                preexec_fn=None if platform.system() == "Windows" else os.setsid,
                universal_newlines=True
            )
            # Start monitoring thread after successful process creation
            if self.server_process:
                self._monitor_active = True
                self._monitor_thread = threading.Thread(target=self._monitor_server_process, daemon=True)
                self._monitor_thread.start()
            yield f"data: {json.dumps({'status': 'loading', 'progress': 30, 'message': 'Server process started, loading model...'})}\\n\\n"
            
            # Read server output in real-time
            progress = 30
            server_ready = False
            
            # Use a separate thread to monitor server output
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
                            yield f"data: {json.dumps({'status': 'loading', 'progress': progress, 'message': f'Server: {display_content}'})}\\n\\n"
                            
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
                            yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': f'Server output error: {content}'})}\\n\\n"
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
                                yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': 'Server process terminated unexpectedly'})}\\n\\n"
                                return
                            
                            elapsed = int(current_time - start_time)
                            # Only show waiting message if we haven't had recent progress
                            if current_time - last_progress_update > 10:
                                yield f"data: {json.dumps({'status': 'loading', 'progress': progress, 'message': f'Waiting for server to respond... ({elapsed}s)'})}\\n\\n"
                
                except Exception as e:
                    yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': f'Error during startup: {str(e)}'})}\\n\\n"
                    return
            
            if not server_ready:
                yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': 'Server failed to start or is not responding within timeout'})}\\n\\n"
                return
            
            # Server is ready
            logger.info("Health check passed, server is ready. Sending finalizing message...")
            yield f"data: {json.dumps({'status': 'finalizing', 'progress': 90, 'message': 'Server is responding, finalizing setup...'})}\\n\\n"
            
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
            yield f"data: {json.dumps({'status': 'finalizing', 'progress': 95, 'message': 'Optimizing server configuration...'})}\\n\\n"
            
            # Server is now available and configured
            logger.info("Setting server configuration...")
            self.current_config = config
            self.current_config["model"] = model_path  # Store the resolved absolute path
            self.is_server_running = True
            
            logger.info("Sending success message...")
            yield f"data: {json.dumps({'status': 'success', 'progress': 100, 'message': f'Model loaded successfully! Server running at {self.server_url}'})}\\n\\n"
            
            # Add a small delay to ensure the success message is sent before stream closes
            time.sleep(0.5)
            logger.info("Model loading stream completed successfully!")
        
        except Exception as e:
            logger.error(f"Error in start_server_stream: {e}")
            yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': f'Server start failed: {str(e)}'})}\\n\\n"

            if self.server_process:
                self._stop_server_internal(force=True)
    
    def stop_server(self):
        """Stop the llama-server"""
        return self._stop_server_internal(force=False)
    
    def _cleanup_on_exit(self):
        """Cleanup handler called on exit"""
        try:
            if self.server_process and self.server_process.poll() is None:
                logger.info("Cleaning up server process on exit...")
                self._stop_server_internal(force=True)
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
    
    def _stop_server_internal(self, force=False):
        """Internal method to stop server with enhanced control"""
        with self._state_lock:
            if not self.server_process:
                self.is_server_running = False
                return True
            
            try:
                # Stop monitoring first
                self._monitor_active = False
                if self._monitor_thread and self._monitor_thread.is_alive():
                    self._monitor_thread.join(timeout=2)
                
                # Graceful shutdown first
                if not force and self.server_process.poll() is None:
                    logger.info("Attempting graceful server shutdown...")
                    self.server_process.terminate()
                    
                    # Wait for graceful shutdown
                    try:
                        self.server_process.wait(timeout=self._shutdown_timeout)
                        logger.info("Server shut down gracefully")
                    except subprocess.TimeoutExpired:
                        logger.warning("Graceful shutdown timed out, forcing termination")
                        force = True
                
                # Force kill if needed
                if force and self.server_process.poll() is None:
                    logger.info("Force killing server process...")
                    self.server_process.kill()
                    try:
                        self.server_process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        logger.error("Failed to kill server process")
                        return False
                
                self.server_process = None
                self.is_server_running = False
                self._restart_attempts = 0
                logger.info("Server stopped successfully")
                return True
                
            except Exception as e:
                logger.error(f"Error stopping server: {e}")
                return False
    
    def _monitor_server_process(self):
        """Monitor server process and restart if needed"""
        while self._monitor_active and self.server_process:
            try:
                # Check if process is still alive
                if self.server_process.poll() is not None:
                    logger.warning("Server process died unexpectedly")
                    
                    with self._state_lock:
                        if self._restart_attempts < self._max_restart_attempts:
                            self._restart_attempts += 1
                            logger.info(f"Attempting restart {self._restart_attempts}/{self._max_restart_attempts}")
                            
                            # Try to restart with current config
                            if self.current_config:
                                try:
                                    self.start_server(self.current_config)
                                except Exception as e:
                                    logger.error(f"Restart attempt failed: {e}")
                        else:
                            logger.error("Max restart attempts reached, giving up")
                            self.is_server_running = False
                            break
                
                # Periodic health check
                current_time = time.time()
                if current_time - self._last_health_check > self._health_check_interval:
                    if not self.health_check(test_inference=False):
                        logger.warning("Health check failed")
                    self._last_health_check = current_time
                
                time.sleep(10)  # Increased from 2 to 10 seconds to reduce monitoring frequency
                
            except Exception as e:
                logger.error(f"Error in server monitor: {e}")
                time.sleep(5)  # Wait longer on error
    
    def _get_build_version(self):
        """Get current build version/hash"""
        try:
            if os.path.exists("ik_llama.cpp/.git"):
                result = subprocess.run(
                    ["git", "rev-parse", "HEAD"],
                    cwd="ik_llama.cpp",
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if result.returncode == 0:
                    return result.stdout.strip()[:8]  # Short hash
        except Exception as e:
            logger.debug(f"Could not get build version: {e}")
        return None
    
    def _check_build_changes(self):
        """Check if build has changed since last check"""
        current_time = time.time()
        if current_time - self._last_build_check < 60:  # Check at most once per minute
            return False
        
        self._last_build_check = current_time
        current_version = self._get_build_version()
        
        if self._build_version is None:
            self._build_version = current_version
            return False
        
        if current_version != self._build_version:
            logger.info(f"Build version changed: {self._build_version} -> {current_version}")
            self._build_version = current_version
            return True
        
        return False
    
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
            # Use a lightweight GET request to /v1/models instead of a full chat completion
            # This is much less resource intensive than the previous health check
            response = requests.get(f"{self.server_url}/v1/models", timeout=3)
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
        # Prepare the request data
        data = {
            "messages": messages,
            "stream": True,
            "max_tokens": config.get("n_predict", 512),
            "temperature": config.get("temperature", 0.8),
            "top_p": config.get("top_p", 0.95),
            "top_k": config.get("top_k", 40),
            "repeat_penalty": config.get("repeat_penalty", 1.1)
        }
        
        # Headers for proper HTTP/1.1 streaming with SSE
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache'
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