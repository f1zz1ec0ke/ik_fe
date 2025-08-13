import os
import json
import subprocess
import threading
import time
import requests
import socket
import logging
import atexit
import os
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
from server_manager import LlamaServerManager


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


@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')





# Global instances
llama_server = LlamaServerManager()



@app.route('/api/clone-repository', methods=['POST'])
def clone_repository():
    try:
        # Define the repository URL and target directory - create ik_llama.cpp in current directory
        repo_url = "https://github.com/ikawrakow/ik_llama.cpp.git"
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
                yield f"data: {json.dumps({'status': 'cloning', 'progress': 15, 'message': 'Cloning ik_llama.cpp repository...'})}\n\n"
                
                clone_process = subprocess.Popen(
                    ["git", "clone", "--progress", "https://github.com/ikawrakow/ik_llama.cpp.git", repo_dir],
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
                
                # Record the commit hash after cloning
                try:
                    os.chdir(repo_dir)
                    commit_result = subprocess.run(
                        ["git", "rev-parse", "HEAD"],
                        capture_output=True,
                        text=True,
                        timeout=10
                    )
                    if commit_result.returncode == 0:
                        commit_hash = commit_result.stdout.strip()
                        # Save commit info to a tracking file
                        tracking_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_info.json")
                        build_info = {
                            "last_build_commit": commit_hash,
                            "last_build_time": time.strftime("%Y-%m-%d %H:%M:%S"),
                            "build_type": "fresh_clone"
                        }
                        with open(tracking_file, 'w') as f:
                            json.dump(build_info, f, indent=2)
                        yield f"data: {json.dumps({'status': 'cloning', 'progress': 42, 'message': f'Recorded commit: {commit_hash[:8]}'})}\n\n"

                    os.chdir(os.path.dirname(os.path.abspath(__file__)))
                except Exception as e:
                    logger.debug(f"Could not record commit hash: {e}")
                    yield f"data: {json.dumps({'status': 'cloning', 'progress': 42, 'message': 'Could not record commit info'})}\n\n"
            
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
                f.write("Please clone the ik_llama.cpp repository first.\n")

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
                'version': 'e082df47',
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
            
            # Use the unified method with streaming enabled
            for chunk in llama_server.start_server(config, stream_progress=True):
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
    """Stop server and unload model with enhanced validation and feedback"""
    try:
        data = request.json or {}
        force = data.get('force', False)
        
        logger.info(f"Attempting to {'force ' if force else ''}unload model and stop server...")
        
        # Check if server is actually running
        if not llama_server.is_server_running:
            logger.warning("Unload requested but server is not running")
            return jsonify({
                'success': True,
                'message': 'No model was loaded (server not running)',
                'error': None
            })
        
        # Check server health before shutdown
        server_responsive = True
        try:
            response = requests.get(f"{llama_server.server_url}/health", timeout=2)
            server_responsive = response.status_code == 200
        except:
            server_responsive = False
            logger.warning("Server not responding to health check before unload")
        
        # Check for active requests if not forcing
        active_requests = False
        if not force and server_responsive:
            try:
                response = requests.get(f"{llama_server.server_url}/slots", timeout=2)
                if response.status_code == 200:
                    slots = response.json()
                    active_requests = any(s.get('state') == 'processing' for s in slots)
                    if active_requests:
                        logger.info("Active requests detected during unload attempt")
            except:
                pass
        
        # Log the unload attempt with context
        if force:
            logger.info(f"Force unloading model (server_responsive: {server_responsive})...")
        else:
            logger.info(f"Unloading model (server_responsive: {server_responsive}, active_requests: {active_requests})...")
        
        # Attempt to stop the server
        success = llama_server.stop_server(force=force)
        
        if success:
            # Enhanced success message with context
            if force:
                message = "Model force unloaded successfully"
            elif active_requests:
                message = "Model unloaded successfully (had active requests)"
            elif not server_responsive:
                message = "Model unloaded successfully (server was unresponsive)"
            else:
                message = "Model unloaded successfully"
            
            logger.info(message)
            # Clear the model status cache
            global _model_status_cache, _model_status_last_update
            _model_status_cache = None
            _model_status_last_update = 0
            
            # Clear session data to prevent stale model configuration
            session.pop('model_path', None)
            session.pop('model_config', None)
            logger.debug("Cleared session model data after successful unload")
            
            return jsonify({
                'success': True,
                'message': message,
                'error': None,
                'context': {
                    'was_forced': force,
                    'had_active_requests': active_requests,
                    'server_was_responsive': server_responsive
                }
            })
        else:
            error_msg = "Failed to force unload model" if force else "Failed to unload model"
            logger.error(error_msg)
            return jsonify({
                'success': False,
                'error': error_msg,
                'context': {
                    'was_forced': force,
                    'server_was_responsive': server_responsive
                }
            }), 500
            
    except Exception as e:
        logger.error(f"Error during model unload: {str(e)}")
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
    """Chat endpoint with streaming response"""
    try:
        data = request.json
        message = data['message']
        history = data.get('history', [])
        config = data['config']
        
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
        
        # Note: The current user message is already included in the history
        # from the frontend, so we don't need to add it again here
        
        def generate():
            success, response = llama_server.chat_completion(messages, config)
            if not success:
                yield f"data: {json.dumps({'error': response})}\n\n"
                return
            
            # Parse streaming response
            try:
                for line in response.iter_lines():
                    if line:
                        line = line.decode('utf-8')
                        if line.startswith('data: '):
                            data_content = line[6:]
                            if data_content.strip() == '[DONE]':
                                break
                            
                            try:
                                chunk_data = json.loads(data_content)
                                if 'choices' in chunk_data and chunk_data['choices']:
                                    delta = chunk_data['choices'][0].get('delta', {})
                                    if 'content' in delta:
                                        yield f"data: {json.dumps({'token': delta['content']})}\n\n"
                            except json.JSONDecodeError:
                                continue
                
                yield f"data: {json.dumps({'done': True})}\n\n"
                
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        
        return Response(generate(), mimetype='text/event-stream')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@app.route('/api/version', methods=['GET'])
def get_version():
    """Get comprehensive version information including current and latest versions"""
    try:
        # Get current version from llama-server
        success, version_info = llama_server.get_version()
        
        # Get current git commit if repository exists
        current_commit = None
        current_commit_short = None
        repo_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ik_llama.cpp")
        build_info_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_info.json")
        
        # First try to read from build_info.json
        if os.path.exists(build_info_file):
            try:
                with open(build_info_file, 'r') as f:
                    build_info = json.load(f)
                    current_commit = build_info.get('last_build_commit')
                    if current_commit:
                        current_commit_short = current_commit[:8]
            except Exception as e:
                logger.debug(f"Could not read build info: {e}")
        
        # If no build info or repo exists, get current commit and update build info
        if not current_commit and os.path.exists(os.path.join(repo_dir, ".git")):
            try:
                result = subprocess.run(
                    ["git", "rev-parse", "HEAD"],
                    cwd=repo_dir,
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if result.returncode == 0:
                    current_commit = result.stdout.strip()
                    current_commit_short = current_commit[:8]
                    
                    # Update build_info.json with current commit
                    build_info = {
                        "last_build_commit": current_commit,
                        "last_build_time": time.strftime("%Y-%m-%d %H:%M:%S"),
                        "build_type": "existing_repo"
                    }
                    with open(build_info_file, 'w') as f:
                        json.dump(build_info, f, indent=2)
            except Exception as e:
                logger.debug(f"Could not get current commit: {e}")
        
        # Get latest commit from GitHub API
        latest_commit = None
        latest_commit_short = None
        update_available = False
        
        try:
            import requests
            response = requests.get(
                "https://api.github.com/repos/ikawrakow/ik_llama.cpp/commits/main",
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                latest_commit = data['sha']
                latest_commit_short = latest_commit[:8]
                
                # Check if update is available
                if current_commit and latest_commit:
                    update_available = current_commit != latest_commit
        except Exception as e:
            logger.debug(f"Could not fetch latest version: {e}")
        
        return jsonify({
            'success': success,
            'version_info': version_info if success else None,
            'current_commit': current_commit,
            'current_commit_short': current_commit_short,
            'latest_commit': latest_commit,
            'latest_commit_short': latest_commit_short,
            'update_available': update_available,
            'repo_exists': os.path.exists(repo_dir),
            'error': None if success else version_info
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/update-repo', methods=['POST'])
def update_repo():
    """Update the repository to the latest version"""
    try:
        repo_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ik_llama.cpp")
        
        if not os.path.exists(repo_dir):
            return jsonify({
                'success': False,
                'error': 'Repository not found. Please clone it first.'
            }), 400
        
        # Check if it's a git repository
        if not os.path.exists(os.path.join(repo_dir, ".git")):
            return jsonify({
                'success': False,
                'error': 'Directory exists but is not a git repository.'
            }), 400
        
        # Fetch latest changes
        fetch_result = subprocess.run(
            ["git", "fetch", "origin"],
            cwd=repo_dir,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if fetch_result.returncode != 0:
            return jsonify({
                'success': False,
                'error': f'Failed to fetch updates: {fetch_result.stderr}'
            }), 500
        
        # Reset to latest origin/main
        reset_result = subprocess.run(
            ["git", "reset", "--hard", "origin/main"],
            cwd=repo_dir,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if reset_result.returncode != 0:
            return jsonify({
                'success': False,
                'error': f'Failed to reset to latest version: {reset_result.stderr}'
            }), 500
        
        # Get the new commit hash
        commit_result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=repo_dir,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        new_commit_full = commit_result.stdout.strip() if commit_result.returncode == 0 else None
        new_commit = new_commit_full[:8] if new_commit_full else "unknown"
        
        # Update build_info.json with new commit
        if new_commit_full:
            try:
                build_info_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_info.json")
                build_info = {
                    "last_build_commit": new_commit_full,
                    "last_build_time": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "build_type": "repository_update"
                }
                with open(build_info_file, 'w') as f:
                    json.dump(build_info, f, indent=2)
            except Exception as e:
                logger.debug(f"Could not update build info: {e}")
        
        return jsonify({
            'success': True,
            'message': f'Repository updated successfully to commit {new_commit}',
            'new_commit': new_commit
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({
            'success': False,
            'error': 'Update operation timed out'
        }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

_model_status_cache = None
_model_status_last_update = 0

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current status"""
    global build_in_progress
    global _model_status_cache
    global _model_status_last_update

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
        if time.time() - _model_status_last_update < 60 and _model_status_cache:
             model_loaded = _model_status_cache['model_loaded']
             model_name = _model_status_cache['model_name']
        else:
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
                    _model_status_cache = {
                        'model_loaded': model_loaded,
                        'model_name': model_name
                    }
                    _model_status_last_update = time.time()
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