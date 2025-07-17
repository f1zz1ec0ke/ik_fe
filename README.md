# ik_llama.cpp Web Frontend

A clean, minimal web interface for ik_llama.cpp that makes it easy to interact with local LLM models.

## Features

- **Simple Configuration**: Easy-to-use form for setting model parameters
- **Real-time Chat**: Interactive chat interface with streaming responses
- **Model Management**: Load and switch between different GGUF models
- **Responsive Design**: Works on desktop and mobile devices
- **Parameter Controls**: Adjust temperature, top-p, top-k, and other sampling parameters
- **Flash Attention**: Toggle advanced attention mechanisms
- **Session Management**: Clear chat history and manage conversations

## Quick Start

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Build ik_llama.cpp** (if not already built):
   ```bash
   cd ../ik_llama.cpp
   make
   ```

3. **Start the Server**:
   ```bash
   python app.py
   ```

4. **Open Browser**:
   Go to `http://localhost:5000`

## Usage

### Loading a Model

1. Enter the path to your GGUF model file (or use the Browse button)
2. Adjust parameters as needed:
   - **Max Tokens**: Maximum number of tokens to generate
   - **Context Size**: Context window size
   - **Temperature**: Controls randomness (0.1 = focused, 2.0 = creative)
   - **Top P**: Nucleus sampling parameter
   - **Top K**: Top-k sampling parameter
   - **Repeat Penalty**: Penalty for repetitive text
3. Click "Load Model"

### Chatting

1. Type your message in the text area
2. Press Enter or click "Send"
3. Watch the response stream in real-time
4. Use "Stop" to interrupt generation
5. Use "Clear" to reset the chat history

## Configuration Parameters

| Parameter | Description | Default | Range |
|-----------|-------------|---------|-------|
| Model Path | Path to GGUF model file | - | - |
| Max Tokens | Maximum tokens to generate | 512 | 1-4096 |
| Context Size | Context window size | 2048 | 512-32768 |
| Temperature | Sampling temperature | 0.8 | 0.1-2.0 |
| Top P | Nucleus sampling | 0.95 | 0.1-1.0 |
| Top K | Top-k sampling | 40 | 1-100 |
| Repeat Penalty | Repetition penalty | 1.1 | 1.0-1.5 |
| Flash Attention | Enable flash attention | false | true/false |

## File Structure

```
llama_web_frontend/
├── index.html          # Main HTML interface
├── styles.css          # CSS styling
├── script.js           # Frontend JavaScript
├── app.py             # Python Flask backend
├── requirements.txt   # Python dependencies
└── README.md          # This file
```

## API Endpoints

- `POST /api/load_model` - Load a model with configuration
- `POST /api/chat` - Send a chat message (streaming response)
- `POST /api/stop` - Stop current generation
- `GET /api/status` - Get current status

## Browser Support

- Chrome/Chromium 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Troubleshooting

### Model Won't Load
- Check that the model file path is correct
- Ensure the model file is a valid GGUF format
- Verify ik_llama.cpp is built and executable

### Chat Not Working
- Make sure the model is loaded first
- Check browser console for errors
- Verify the backend server is running

### Performance Issues
- Reduce context size for faster responses
- Lower max tokens if generation is slow
- Enable flash attention for compatible models

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - see the original ik_llama.cpp repository for details.