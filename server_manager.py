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
import signal
import psutil

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
        
        # Progressive timeout strategy for enhanced shutdown
        self._shutdown_timeouts = {
            'graceful': 5,    # Wait for graceful shutdown
            'terminate': 5,   # Wait after SIGTERM
            'kill': 2         # Wait after SIGKILL
        }
        
        # Process monitoring
        self._monitor_thread = None
        self._monitor_active = False
        # Removed auto-restart functionality - monitoring is now passive only
        
        # Build integration
        self._build_version = None
        self._last_build_check = 0
        
        # Server output capture
        self._server_output_lines = []
        self._reading_startup_output = False
        
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

    def start_server(self, config, stream_progress=False):
        """Start llama-server with given configuration
        
        Args:
            config: Server configuration dictionary
            stream_progress: If True, yields progress updates; if False, returns boolean result
        """
        def _progress_update(status, progress, message):
            """Helper to handle progress updates"""
            if stream_progress:
                return f"data: {json.dumps({'status': status, 'progress': progress, 'message': message})}\\n\\n"
            else:
                print(f"[{progress}%] {message}")
                return None
        
        # Generator function for streaming
        def _start_server_internal():
            with self._state_lock:
                # Check for build changes
                if self._check_build_changes() and self.is_server_running:
                    update = _progress_update('preparing', 2, 'Build changed, restarting server...')
                    if update: yield update
                    self._stop_server_internal(force=False)
                
                # Stop existing server if running
                if self.server_process:
                    # Check if process is actually alive before attempting graceful shutdown
                    if self.server_process.poll() is None:
                        # Process is alive, attempt graceful shutdown
                        self._stop_server_internal(force=False)
                        update = _progress_update('preparing', 5, 'Stopping existing server...')
                        if update: yield update
                    else:
                        # Process is already dead, just clean up
                        logger.info(f"Existing server process (PID: {self.server_process.pid}) is already dead, cleaning up...")
                        self._cleanup_server_resources()
                        self.server_process = None
                        self.is_server_running = False
                        update = _progress_update('preparing', 5, 'Cleaning up dead server process...')
                        if update: yield update
            
            try:
                # Handle model path - support both relative and absolute paths
                model_path = config["model"]
                
                update = _progress_update('preparing', 10, 'Resolving model path...')
                if update: yield update
                
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
                    error_msg = f'Model file not found: {model_path}'
                    update = _progress_update('error', 0, error_msg)
                    if update: 
                        yield update
                        return
                    else:
                        raise FileNotFoundError(error_msg)
                
                update = _progress_update('preparing', 15, f'Found model: {os.path.basename(model_path)}')
                if update: yield update
                
                print(f"Using model path: {model_path}")
                
                # Find llama-server executable
                executable = self.find_llama_server()
                if not executable:
                    error_msg = 'llama-server executable not found. Please build ik_llama.cpp first.'
                    update = _progress_update('error', 0, error_msg)
                    if update:
                        yield update
                        return
                    else:
                        raise FileNotFoundError(error_msg)
                
                update = _progress_update('preparing', 20, 'Found llama-server executable')
                if update: yield update
                
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
                
                update = _progress_update('starting', 25, 'Starting llama-server process...')
                if update: yield update
                
                print(f"Starting llama-server with command: {' '.join(cmd)}")
                
                # Start the server process with enhanced monitoring and process group
                # Create new process group on Unix-like systems for better process management
                if platform.system() != "Windows":
                    preexec_fn = os.setsid
                else:
                    preexec_fn = None
                
                # Always capture stdout/stderr for error reporting
                self.server_process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    preexec_fn=preexec_fn,
                    universal_newlines=True
                )
                
                # Store server output for error reporting
                self._server_output_lines = []
                
                # Start monitoring thread after successful process creation
                if self.server_process:
                    self._monitor_active = True
                    self._monitor_thread = threading.Thread(target=self._monitor_server_process, daemon=True)
                    self._monitor_thread.start()
                
                update = _progress_update('loading', 30, 'Server process started, loading model...')
                if update: yield update
                
                # Simple wait for server to start listening
                progress = 30
                server_ready = False
                
                update = _progress_update('loading', 50, 'Waiting for server to start listening...')
                if update: yield update
                
                # Monitor server output and wait for it to be ready
                max_wait_time = self._startup_timeout
                start_time = time.time()
                output_thread = None
                
                # Flag to control output reading
                self._reading_startup_output = True
                
                # Start a thread to read server output during startup only
                def read_startup_output():
                    try:
                        while self.server_process and self.server_process.poll() is None and self._reading_startup_output:
                            line = self.server_process.stdout.readline()
                            if line:
                                line = line.strip()
                                self._server_output_lines.append(line)
                                # Print important messages to console for debugging
                                if any(keyword in line.lower() for keyword in ['loading model', 'error', 'failed', 'cuda', 'system info']):
                                    print(f"Server startup: {line}")
                            else:
                                break
                    except Exception as e:
                        print(f"Error reading server startup output: {e}")
                
                output_thread = threading.Thread(target=read_startup_output, daemon=True)
                output_thread.start()
                
                while time.time() - start_time < max_wait_time:
                    # Check if process died
                    if self.server_process.poll() is not None:
                        # Process terminated - check if it was due to an error
                        error_lines = []
                        for line in self._server_output_lines[-20:]:  # Get last 20 lines
                            if any(keyword in line.lower() for keyword in ['error', 'failed', 'exception', 'invalid']):
                                error_lines.append(line)
                        
                        if error_lines:
                            error_msg = f'Model loading failed: {error_lines[-1]}'
                        else:
                            error_msg = 'Server process terminated unexpectedly'
                        
                        # Reset server state on failure
                        self.is_server_running = False
                        self.current_config = None
                        self._reading_startup_output = False
                        
                        update = _progress_update('error', 0, error_msg)
                        if update:
                            yield update
                            return
                        else:
                            raise RuntimeError(error_msg)
                    
                    # Simple socket check to see if server is listening
                    if self.health_check():
                        server_ready = True
                        break
                    
                    # Update progress with server output if available
                    elapsed = int(time.time() - start_time)
                    progress = min(50 + (elapsed * 2), 85)  # Gradually increase progress
                    
                    # Show recent server output in progress message
                    recent_output = ""
                    if self._server_output_lines:
                        # Get the most recent interesting line
                        for line in reversed(self._server_output_lines[-5:]):
                            if any(keyword in line.lower() for keyword in ['loading', 'model', 'cuda', 'system']):
                                recent_output = f" - {line[:60]}..." if len(line) > 60 else f" - {line}"
                                break
                    
                    message = f'Starting server... ({elapsed}s){recent_output}'
                    update = _progress_update('loading', progress, message)
                    if update: yield update
                    time.sleep(2)
                
                if not server_ready:
                    # Include server output in timeout error
                    error_lines = []
                    for line in self._server_output_lines[-10:]:  # Get last 10 lines
                        if any(keyword in line.lower() for keyword in ['error', 'failed', 'exception', 'invalid', 'timeout']):
                            error_lines.append(line)
                    
                    if error_lines:
                        error_msg = f'Server startup timeout. Last error: {error_lines[-1]}'
                    else:
                        error_msg = f'Server failed to start within {max_wait_time}s timeout'
                    
                    # Reset server state on timeout
                    self.is_server_running = False
                    self.current_config = None
                    self._reading_startup_output = False
                    
                    update = _progress_update('error', 0, error_msg)
                    if update:
                        yield update
                        return
                    else:
                        self._stop_server_internal(force=True)
                        raise TimeoutError(error_msg)
                
                # Server is ready - stop reading startup output
                self._reading_startup_output = False
                
                update = _progress_update('finalizing', 90, 'Server is responding, finalizing setup...')
                if update: yield update
                
                # Clean up stdout pipe to prevent buffer overflow (only for streaming mode)
                if stream_progress:
                    try:
                        if self.server_process and self.server_process.stdout:
                            self.server_process.stdout = None
                    except Exception as e:
                        print(f"Warning: Failed to detach from stdout pipe: {e}")
                
                update = _progress_update('finalizing', 95, 'Optimizing server configuration...')
                if update: yield update
                
                # Server is now available and configured
                self.current_config = config
                self.current_config["model"] = model_path  # Store the resolved absolute path
                self.is_server_running = True
                
                success_msg = f'Model loaded successfully! Server running at {self.server_url}'
                update = _progress_update('success', 100, success_msg)
                if update: 
                    yield update
                    time.sleep(0.5)  # Ensure message is sent before stream closes
                else:
                    print("Server started successfully")
                    
            except Exception as e:
                error_msg = f'Server start failed: {str(e)}'
                update = _progress_update('error', 0, error_msg)
                if update:
                    yield update
                else:
                    print(f"Error: {error_msg}")
                
                if self.server_process:
                    self._stop_server_internal(force=True)
                
                if not stream_progress:
                    raise
        
        # Execute the internal function
        if stream_progress:
            # Return generator for streaming
            return _start_server_internal()
        else:
            # Execute and return boolean result
            try:
                list(_start_server_internal())  # Consume the generator
                return True, f"Server started successfully at {self.server_url}"
            except Exception as e:
                return False, str(e)

    def start_server_stream(self, config):
        """Start llama-server with streaming output for real-time feedback
        
        This method is deprecated. Use start_server(config, stream_progress=True) instead.
        """
        return self.start_server(config, stream_progress=True)
    
    def stop_server(self, force=False):
        """Stop the llama-server"""
        return self._stop_server_internal(force=force)
    
    def _cleanup_on_exit(self):
        """Cleanup handler called on exit"""
        try:
            if self.server_process and self.server_process.poll() is None:
                logger.info("Cleaning up server process on exit...")
                self._stop_server_internal(force=True)
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
    
    def _has_active_requests(self):
        """Check if server has active requests before shutdown"""
        try:
            response = requests.get(f"{self.server_url}/slots", timeout=2)
            if response.status_code == 200:
                slots = response.json()
                active_slots = [s for s in slots if s.get('state') == 'processing']
                return len(active_slots) > 0
        except:
            # If we can't check, assume no active requests
            return False
        return False
    
    def _terminate_remaining_processes(self):
        """Terminate any remaining llama-server processes"""
        try:
            terminated_count = 0
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    # Check if this is a llama-server process
                    if (proc.info['name'] and 'llama-server' in proc.info['name'].lower()) or \
                       (proc.info['cmdline'] and any('llama-server' in str(arg).lower() for arg in proc.info['cmdline'])):
                        logger.info(f"Terminating remaining llama-server process (PID: {proc.info['pid']})")
                        proc.terminate()
                        terminated_count += 1
                        
                        # Wait a bit then force kill if still alive
                        try:
                            proc.wait(timeout=2)
                        except psutil.TimeoutExpired:
                            logger.info(f"Force killing stubborn process (PID: {proc.info['pid']})")
                            proc.kill()
                            
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    # Process already gone or we don't have permission
                    continue
                    
            if terminated_count > 0:
                logger.info(f"Terminated {terminated_count} remaining llama-server processes")
                
        except Exception as e:
            logger.warning(f"Error during process cleanup: {e}")
    
    def _wait_for_port_release(self, max_wait_seconds=10):
        """Wait for the server port to be fully released after shutdown"""
        start_time = time.time()
        
        while time.time() - start_time < max_wait_seconds:
            try:
                # Try to bind to the port to see if it's available
                test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                test_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                test_socket.bind((self.server_host, self.server_port))
                test_socket.close()
                
                elapsed = time.time() - start_time
                logger.info(f"Port {self.server_port} is available after {elapsed:.2f}s")
                return True
                
            except OSError as e:
                # Port is still in use, wait a bit more
                if "Address already in use" in str(e) or "Only one usage" in str(e):
                    time.sleep(0.5)
                    continue
                else:
                    # Some other error, log it but don't wait
                    logger.warning(f"Unexpected error checking port availability: {e}")
                    return False
            except Exception as e:
                logger.warning(f"Error checking port availability: {e}")
                return False
        
        elapsed = time.time() - start_time
        logger.warning(f"Port {self.server_port} still not available after {elapsed:.2f}s, proceeding anyway")
        return False
    
    def _cleanup_server_resources(self):
        """Clean up server resources after shutdown"""
        try:
            # Stop monitoring thread first to prevent restart attempts
            self._monitor_active = False
            if self._monitor_thread and self._monitor_thread.is_alive():
                self._monitor_thread.join(timeout=2)
                logger.debug("Monitoring thread stopped during cleanup")
            
            # Reset server state
            self.current_config = None
            self._last_health_check = 0
            
            # Clear server output from previous runs
            self._server_output_lines = []
            
            # Terminate any remaining processes as a safety measure
            self._terminate_remaining_processes()
            
            logger.debug("Server resources cleaned up")
        except Exception as e:
            logger.warning(f"Error during resource cleanup: {e}")
    
    def _stop_server_internal(self, force=False):
        """Internal method to stop server with enhanced progressive control"""
        shutdown_start_time = time.time()
        shutdown_method = "force" if force else "graceful"
        
        logger.info(f"Starting {shutdown_method} server shutdown (PID: {self.server_process.pid if self.server_process else 'None'})")
        
        with self._state_lock:
            if not self.server_process:
                logger.info("No server process to stop")
                self.is_server_running = False
                return True
            
            try:
                # Stop monitoring first
                logger.debug("Stopping server monitoring thread...")
                self._monitor_active = False
                if self._monitor_thread and self._monitor_thread.is_alive():
                    self._monitor_thread.join(timeout=2)
                    logger.debug("Monitoring thread stopped")
                
                # Check for active requests if not forcing
                active_requests_detected = False
                if not force and self._has_active_requests():
                    active_requests_detected = True
                    logger.warning("Server has active requests, but proceeding with shutdown")
                
                # Progressive shutdown strategy
                if not force and self.server_process.poll() is None:
                    # Step 1: Graceful shutdown attempt
                    step_start = time.time()
                    logger.info(f"Step 1: Attempting graceful shutdown (timeout: {self._shutdown_timeouts['graceful']}s)...")
                    self.server_process.terminate()
                    
                    try:
                        self.server_process.wait(timeout=self._shutdown_timeouts['graceful'])
                        elapsed = time.time() - step_start
                        logger.info(f"Server shut down gracefully in {elapsed:.2f}s")
                        self._cleanup_server_resources()
                        self.server_process = None
                        self.is_server_running = False
                        
                        total_time = time.time() - shutdown_start_time
                        logger.info(f"Total shutdown time: {total_time:.2f}s")
                        return True
                    except subprocess.TimeoutExpired:
                        elapsed = time.time() - step_start
                        logger.info(f"Graceful shutdown timed out after {elapsed:.2f}s, escalating to SIGTERM")
                
                # Step 2: SIGTERM if graceful failed or force requested
                if self.server_process and self.server_process.poll() is None:
                    step_start = time.time()
                    logger.info(f"Step 2: Sending SIGTERM (timeout: {self._shutdown_timeouts['terminate']}s)...")
                    self.server_process.terminate()
                    
                    try:
                        self.server_process.wait(timeout=self._shutdown_timeouts['terminate'])
                        elapsed = time.time() - step_start
                        logger.info(f"Server terminated successfully in {elapsed:.2f}s")
                        self._cleanup_server_resources()
                        self.server_process = None
                        self.is_server_running = False
                        
                        total_time = time.time() - shutdown_start_time
                        logger.info(f"Total shutdown time: {total_time:.2f}s")
                        return True
                    except subprocess.TimeoutExpired:
                        elapsed = time.time() - step_start
                        logger.warning(f"SIGTERM timed out after {elapsed:.2f}s, escalating to SIGKILL")
                
                # Step 3: SIGKILL as last resort, including child processes
                if self.server_process and self.server_process.poll() is None:
                    step_start = time.time()
                    logger.info(f"Step 3: Force killing with SIGKILL (timeout: {self._shutdown_timeouts['kill']}s)...")
                    
                    # Kill process group if available (Unix-like systems)
                    if platform.system() != "Windows":
                        try:
                            pgid = os.getpgid(self.server_process.pid)
                            os.killpg(pgid, signal.SIGKILL)
                            logger.info(f"Killed entire process group (PGID: {pgid})")
                        except (OSError, ProcessLookupError) as e:
                            logger.warning(f"Failed to kill process group: {e}, falling back to single process")
                            self.server_process.kill()
                    else:
                        self.server_process.kill()
                        logger.info("Sent SIGKILL to process (Windows)")
                    
                    try:
                        self.server_process.wait(timeout=self._shutdown_timeouts['kill'])
                        elapsed = time.time() - step_start
                        logger.info(f"Server killed successfully in {elapsed:.2f}s")
                    except subprocess.TimeoutExpired:
                        elapsed = time.time() - step_start
                        logger.error(f"Failed to kill server process even with SIGKILL after {elapsed:.2f}s")
                        return False
                
                # Final cleanup
                logger.debug("Performing final cleanup...")
                self._cleanup_server_resources()
                self.server_process = None
                self.is_server_running = False
                
                # Wait for port to be fully released after force shutdown
                if force:
                    logger.info("Waiting for port to be released after force shutdown...")
                    self._wait_for_port_release()
                
                total_time = time.time() - shutdown_start_time
                context_info = []
                if force:
                    context_info.append("forced")
                if active_requests_detected:
                    context_info.append("had active requests")
                
                context_str = f" ({', '.join(context_info)})" if context_info else ""
                logger.info(f"Server stopped successfully in {total_time:.2f}s{context_str}")
                return True
                
            except Exception as e:
                total_time = time.time() - shutdown_start_time
                logger.error(f"Error stopping server after {total_time:.2f}s: {e}")
                return False
    
    def _monitor_server_process(self):
        """Monitor server process for status reporting (no auto-restart)"""
        while self._monitor_active and self.server_process:
            try:
                # Check if process is still alive
                if self.server_process.poll() is not None:
                    logger.warning("Server process died unexpectedly")
                    
                    with self._state_lock:
                        self.is_server_running = False
                        logger.info("Server marked as not running. Manual restart required.")
                        break
                
                # Periodic health check (passive monitoring only)
                current_time = time.time()
                if current_time - self._last_health_check > self._health_check_interval:
                    if not self.health_check(test_inference=False):
                        logger.warning("Health check failed - server may be unresponsive")
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
        """Wait for server to become available with simple socket checks"""
        print(f"Waiting for server to start at {self.server_url}...")

        start_time = time.time()
        
        while time.time() - start_time < max_wait_seconds:
            if not self.server_process or self.server_process.poll() is not None:
                print("Server process has terminated")
                return False
            
            if self.health_check():
                elapsed = int(time.time() - start_time)
                print(f"Server is ready after {elapsed} seconds!")
                return True
            
            time.sleep(2)
        
        elapsed = int(time.time() - start_time)
        print(f"Timeout waiting for server after {elapsed}s")
        return False

    def health_check(self, test_inference=False):
        """Simple health check - just verify server is responding
        
        Args:
            test_inference: Ignored for simplicity - we only do basic checks
        """
        import socket
        
        try:
            # Simple socket check
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex((self.server_host, self.server_port))
            sock.close()
            
            return result == 0
                
        except Exception:
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