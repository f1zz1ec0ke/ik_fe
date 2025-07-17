import os
import json
import subprocess
import threading
import time
import requests
from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
import signal
import sys
import psutil
from urllib.parse import urljoin
import glob

app = Flask(__name__)
CORS(app)

class LlamaServerManager:
    def __init__(self):
        self.server_process = None
        self.server_url = None
        self.current_config = None
        self.is_server_running = False
        self.server_port = 8080
        self.server_host = "127.0.0.1"

    def find_llama_server(self):
        """Find llama-server executable"""
        possible_paths = [
            os.path.join("..", "ik_llama.cpp", "build", "bin", "llama-server"),
            os.path.join("..", "ik_llama.cpp", "build", "bin", "llama-server.exe"),
            os.path.join("..", "ik_llama.cpp", "llama-server"),
            os.path.join("..", "ik_llama.cpp", "llama-server.exe"),
            "llama-server",
            "llama-server.exe"
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return path
        return None
    
    def start_server(self, config):
        """Start llama-server with given configuration"""
        try:
            # Stop existing server if running
            if self.server_process:
                self.stop_server()
            
            # Check if model file exists and convert to absolute path
            model_path = os.path.abspath(config["model"])
            if not os.path.exists(model_path):
                return False, f"Model file not found: {model_path}"
            
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
                "--threads", str(config.get("threads", 8))
            ]
            
            # Add ik_llama.cpp specific parameters
            if config.get("n_gpu_layers", 0) > 0:
                cmd.extend(["-ngl", str(config["n_gpu_layers"])])
            
            if config.get("ctk"):
                cmd.extend(["-ctk", config["ctk"]])
            
            if config.get("mla") is not None:
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
            
            print(f"Starting llama-server with command: {' '.join(cmd)}")
            
            # Start the server process
            self.server_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Wait for server to start
            time.sleep(3)
            
            # Check if server is running
            self.server_url = f"http://{self.server_host}:{self.server_port}"
            if self.health_check():
                self.current_config = config
                self.is_server_running = True
                return True, f"Server started successfully at {self.server_url}"
            else:
                return False, "Server failed to start or is not responding"
                
        except Exception as e:
            return False, str(e)
    
    def stop_server(self):
        """Stop the llama-server"""
        if self.server_process:
            self.server_process.terminate()
            self.server_process.wait()
            self.server_process = None
        self.is_server_running = False
        self.server_url = None
    
    def health_check(self):
        """Check if server is responding"""
        try:
            response = requests.get(f"{self.server_url}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                return data.get("status") == "ok"
            return False
        except:
            return False

    def chat_completion(self, messages, config):
        """Send chat completion request to llama-server"""
        if not self.is_server_running:
            return False, "Server not running"
        
        try:
            url = f"{self.server_url}/v1/chat/completions"
            
            data = {
                "messages": messages,
                "stream": True,
                "max_tokens": config.get("n_predict", 512),
                "temperature": config.get("temperature", 0.8),
                "top_p": config.get("top_p", 0.95),
                "top_k": config.get("top_k", 40),
                "repeat_penalty": config.get("repeat_penalty", 1.1)
            }
            
            if config.get("system_prompt"):
                # Add system message to beginning if not already present
                if not messages or messages[0]["role"] != "system":
                    messages.insert(0, {"role": "system", "content": config["system_prompt"]})
            
            response = requests.post(url, json=data, stream=True, timeout=30)
            
            if response.status_code == 200:
                return True, response
            else:
                return False, f"Server error: {response.status_code} - {response.text}"
                
        except Exception as e:
            return False, str(e)

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

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files"""
    return send_from_directory('.', filename)

@app.route('/api/load_model', methods=['POST'])
def load_model():
    """Start server with model"""
    try:
        config = request.json
        success, message = llama_server.start_server(config)
        return jsonify({
            'success': success,
            'message': message,
            'error': None if success else message
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
        
        if os.path.exists(models_dir):
            # Search for .gguf files recursively in models directory and subdirectories
            gguf_files = glob.glob(os.path.join(models_dir, '**', '*.gguf'), recursive=True)
            
            for model_path in gguf_files:
                model_name = os.path.basename(model_path)
                model_size = os.path.getsize(model_path)
                model_size_mb = round(model_size / (1024 * 1024), 1)
                
                # Get relative path from the web frontend directory
                relative_path = os.path.relpath(model_path, os.path.dirname(__file__))
                
                # Create a display name that includes the parent directory if it's in a subdirectory
                parent_dir = os.path.basename(os.path.dirname(model_path))
                if parent_dir != 'models':
                    display_name = f"{parent_dir}/{model_name}"
                else:
                    display_name = model_name
                
                models.append({
                    'name': model_name,
                    'display_name': display_name,
                    'path': relative_path,
                    'size': model_size,
                    'size_mb': model_size_mb,
                    'parent_dir': parent_dir
                })
        
        # Sort models by display name for better organization
        models.sort(key=lambda x: x['display_name'])
        
        return jsonify({
            'success': True,
            'models': models,
            'models_dir': models_dir
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

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
        
        return Response(generate(), mimetype='text/plain')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stop', methods=['POST'])
def stop_generation():
    """Stop current generation"""
    try:
        # For now, we'll implement this by restarting the server
        # In the future, we could use the /v1/chat/completions endpoint's stop functionality
        return jsonify({'success': True, 'message': 'Generation stopped'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current status"""
    info = llama_server.get_server_info()
    return jsonify({
        'is_loaded': llama_server.is_server_running,
        'is_generating': False,  # We'll implement this later
        'current_model': info.get('model', ''),
        'server_status': info['status'],
        'server_url': info['url']
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