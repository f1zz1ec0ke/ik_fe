class LlamaWebInterface {
    constructor() {
        this.isModelLoaded = false;
        this.isGenerating = false;
        this.currentStream = null;
        this.tokenCount = 0;
        this.conversationHistory = [];
        this.maxHistoryLength = 20; // Max number of messages to keep in history
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupRangeUpdaters();
        this.loadAvailableModels();
    }

    initializeElements() {
        // Configuration elements
        this.modelDropdown = document.getElementById('model-dropdown');
        this.modelPath = document.getElementById('model-path');
        this.toggleCustomPathBtn = document.getElementById('toggle-custom-path');
        this.nPredict = document.getElementById('n-predict');
        this.ctxSize = document.getElementById('ctx-size');
        this.temperature = document.getElementById('temperature');
        this.topP = document.getElementById('top-p');
        this.topK = document.getElementById('top-k');
        this.repeatPenalty = document.getElementById('repeat-penalty');
        this.systemPrompt = document.getElementById('system-prompt');
        this.presets = document.getElementById('presets');
        this.loadModelBtn = document.getElementById('load-model');
        this.unloadModelBtn = document.getElementById('unload-model');
        this.browseModelBtn = document.getElementById('browse-model');
        
        // Hardware configuration
        this.threads = document.getElementById('threads');
        this.nGpuLayers = document.getElementById('n-gpu-layers');
        
        // Advanced/ik_llama.cpp specific elements
        this.ctk = document.getElementById('ctk');
        this.mla = document.getElementById('mla');
        this.flashAttn = document.getElementById('flash-attn');
        this.amb = document.getElementById('amb');
        this.fmoe = document.getElementById('fmoe');
        this.ser = document.getElementById('ser');
        this.rtr = document.getElementById('rtr');
        
        // Advanced settings toggle
        this.advancedToggle = document.getElementById('advanced-toggle');
        this.advancedContent = document.getElementById('advanced-content');

        // Chat elements
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.stopBtn = document.getElementById('stop-btn');

        // Status elements
        this.statusElement = document.getElementById('status');
        this.currentModelElement = document.getElementById('current-model');
        this.tokenCountElement = document.getElementById('token-count');
        
        // Mode selection elements
        this.enterChatBtn = document.getElementById('enter-chat');

        // Range value displays
        this.tempValue = document.getElementById('temp-value');
        this.topPValue = document.getElementById('top-p-value');
        this.repeatPenaltyValue = document.getElementById('repeat-penalty-value');
        this.nGpuLayersValue = document.getElementById('n-gpu-layers-value');
        this.mlaValue = document.getElementById('mla-value');
    }

    setupEventListeners() {
        this.loadModelBtn.addEventListener('click', () => this.loadModel());
        this.unloadModelBtn.addEventListener('click', () => this.unloadModel());
        this.browseModelBtn.addEventListener('click', () => this.browseModel());
        this.toggleCustomPathBtn.addEventListener('click', () => this.toggleCustomPath());
        this.modelDropdown.addEventListener('change', () => this.onModelDropdownChange());
        if (this.enterChatBtn) {
            this.enterChatBtn.addEventListener('click', () => this.enterChatMode());
        }
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
        }
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clearChat());
        }
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => this.stopGeneration());
        }
        if (this.presets) {
            this.presets.addEventListener('change', () => this.applyPreset());
        }
        
        // Advanced settings toggle
        this.advancedToggle.addEventListener('click', () => this.toggleAdvancedSettings());
        
        // Enter key to send message
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    setupRangeUpdaters() {
        this.temperature.addEventListener('input', (e) => {
            this.tempValue.textContent = e.target.value;
        });

        this.topP.addEventListener('input', (e) => {
            this.topPValue.textContent = e.target.value;
        });

        this.repeatPenalty.addEventListener('input', (e) => {
            this.repeatPenaltyValue.textContent = e.target.value;
        });

        this.nGpuLayers.addEventListener('input', (e) => {
            this.nGpuLayersValue.textContent = e.target.value;
        });

        this.mla.addEventListener('input', (e) => {
            this.mlaValue.textContent = e.target.value;
        });
    }

    async loadModel() {
        if (this.isGenerating) {
            this.addMessage('system', 'Cannot load model while generating. Please stop generation first.');
            return;
        }

        this.setStatus('Loading model...');
        this.loadModelBtn.disabled = true;
        this.loadModelBtn.innerHTML = '<span class="loading"></span> Loading...';

        try {
            const config = this.getConfiguration();
            const response = await fetch('/api/load_model', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(config)
            });

            const result = await response.json();
            
            if (result.success) {
                this.isModelLoaded = true;
                this.setStatus('Model loaded successfully');
                this.currentModelElement.textContent = config.model.split('/').pop();
                if (this.sendBtn) this.sendBtn.disabled = false;
                if (this.enterChatBtn) this.enterChatBtn.disabled = false;
                this.unloadModelBtn.disabled = false;
                if (this.addMessage) {
                    this.addMessage('system', `Model loaded: ${config.model.split('/').pop()}`);
                }
            } else {
                this.setStatus('Failed to load model');
                this.addMessage('system', `Error: ${result.error}`);
            }
        } catch (error) {
            this.setStatus('Failed to load model');
            this.addMessage('system', `Error: ${error.message}`);
        } finally {
            this.loadModelBtn.disabled = false;
            this.loadModelBtn.textContent = 'Load Model';
        }
    }

    async unloadModel() {
        if (this.isGenerating) {
            this.addMessage('system', 'Cannot unload model while generating. Please stop generation first.');
            return;
        }

        this.setStatus('Unloading model...');
        this.unloadModelBtn.disabled = true;
        this.unloadModelBtn.innerHTML = '<span class="loading"></span> Unloading...';

        try {
            const response = await fetch('/api/unload_model', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();
            
            if (result.success) {
                this.isModelLoaded = false;
                this.setStatus('Model unloaded');
                this.currentModelElement.textContent = 'None';
                this.sendBtn.disabled = true;
                this.unloadModelBtn.disabled = true;
                this.loadModelBtn.disabled = false;
                this.addMessage('system', 'Model unloaded successfully');
            } else {
                this.setStatus('Failed to unload model');
                this.addMessage('system', `Error: ${result.error}`);
            }
        } catch (error) {
            this.setStatus('Failed to unload model');
            this.addMessage('system', `Error: ${error.message}`);
        } finally {
            this.unloadModelBtn.textContent = 'Unload Model';
        }
    }

    async loadAvailableModels() {
        try {
            const response = await fetch('/api/discover_models');
            const result = await response.json();
            
            if (result.success) {
                this.populateModelDropdown(result.models);
            } else {
                console.error('Failed to load models:', result.error);
                this.modelDropdown.innerHTML = '<option value="">Error loading models</option>';
            }
        } catch (error) {
            console.error('Error loading models:', error);
            this.modelDropdown.innerHTML = '<option value="">Error loading models</option>';
        }
    }

    populateModelDropdown(models) {
        this.modelDropdown.innerHTML = '';
        
        if (models.length === 0) {
            this.modelDropdown.innerHTML = '<option value="">No models found in models/ directory</option>';
            return;
        }
        
        // Add default option
        this.modelDropdown.innerHTML = '<option value="">Select a model...</option>';
        
        // Add discovered models
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.path;
            option.textContent = `${model.name} (${model.size_mb} MB)`;
            this.modelDropdown.appendChild(option);
        });
        
        // Add custom path option
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = 'Custom path...';
        this.modelDropdown.appendChild(customOption);
        
        // Auto-select first model if available
        if (models.length > 0) {
            this.modelDropdown.value = models[0].path;
        }
    }

    onModelDropdownChange() {
        const selected = this.modelDropdown.value;
        if (selected === 'custom') {
            this.toggleCustomPath(true);
        } else {
            this.toggleCustomPath(false);
        }
    }

    toggleCustomPath(forceShow = null) {
        const isCurrentlyHidden = this.modelPath.style.display === 'none';
        const shouldShow = forceShow !== null ? forceShow : isCurrentlyHidden;
        
        if (shouldShow) {
            this.modelPath.style.display = 'block';
            this.browseModelBtn.style.display = 'block';
            this.toggleCustomPathBtn.textContent = 'Use Dropdown';
            this.modelDropdown.style.display = 'none';
        } else {
            this.modelPath.style.display = 'none';
            this.browseModelBtn.style.display = 'none';
            this.toggleCustomPathBtn.textContent = 'Custom Path';
            this.modelDropdown.style.display = 'block';
        }
    }

    browseModel() {
        // Create file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.gguf';
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.modelPath.value = e.target.files[0].path || e.target.files[0].name;
            }
        });
        fileInput.click();
    }

    enterChatMode() {
        if (!this.isModelLoaded) {
            alert('Please load a model first before entering chat mode.');
            return;
        }
        
        // Store current configuration in localStorage for the chat page
        const config = this.getConfiguration();
        localStorage.setItem('llamaWebConfig', JSON.stringify(config));
        
        // Redirect to chat page
        window.location.href = 'chat.html';
    }

    async sendMessage() {
        if (!this.isModelLoaded) {
            this.addMessage('system', 'Please load a model first.');
            return;
        }

        if (this.isGenerating) {
            this.addMessage('system', 'Already generating. Please wait or stop the current generation.');
            return;
        }

        const message = this.userInput.value.trim();
        if (!message) return;

        this.userInput.value = '';
        this.addMessage('user', message);
        
        // Add user message to conversation history
        this.conversationHistory.push({
            role: 'user',
            content: message
        });

        // Trim conversation history if it gets too long
        this.trimConversationHistory();

        this.isGenerating = true;
        this.sendBtn.disabled = true;
        this.stopBtn.disabled = false;

        try {
            const config = this.getConfiguration();
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    history: this.conversationHistory,
                    config: config
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            let assistantMessage = this.addMessage('assistant', '');
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.token) {
                                fullResponse += data.token;
                                // Update the message with real-time thinking tags parsing
                                this.updateAssistantMessage(assistantMessage, fullResponse);
                                this.tokenCount += 1;
                                this.tokenCountElement.textContent = this.tokenCount;
                                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                            }
                            if (data.done) {
                                // Auto-collapse thinking sections when message is complete
                                this.collapseThinkingSections(assistantMessage);
                                
                                // Add assistant response to history (with thinking tags removed)
                                const streamingResult = this.parseStreamingThinking(fullResponse);
                                this.conversationHistory.push({
                                    role: 'assistant',
                                    content: streamingResult.cleanContent
                                });
                                
                                // Trim conversation history after adding assistant response
                                this.trimConversationHistory();
                                break;
                            }
                        } catch (e) {
                            // Ignore parsing errors for incomplete JSON
                        }
                    }
                }
            }
        } catch (error) {
            this.addMessage('system', `Error: ${error.message}`);
        } finally {
            this.isGenerating = false;
            this.sendBtn.disabled = false;
            this.stopBtn.disabled = true;
        }
    }

    stopGeneration() {
        if (this.isGenerating) {
            fetch('/api/stop', { method: 'POST' })
                .then(() => {
                    this.isGenerating = false;
                    this.sendBtn.disabled = false;
                    this.stopBtn.disabled = true;
                    this.addMessage('system', 'Generation stopped.');
                })
                .catch(error => {
                    this.addMessage('system', `Error stopping generation: ${error.message}`);
                });
        }
    }

    clearChat() {
        this.chatMessages.innerHTML = '';
        this.tokenCount = 0;
        this.tokenCountElement.textContent = '0';
        this.conversationHistory = [];
    }

    parseThinkingTags(content) {
        const thinkingRegex = /<think>([\s\S]*?)<\/think>/g;
        let matches = [];
        let match;
        let lastIndex = 0;
        let result = '';
        
        while ((match = thinkingRegex.exec(content)) !== null) {
            // Add text before the thinking tag
            if (match.index > lastIndex) {
                result += content.substring(lastIndex, match.index);
            }
            
            // Store thinking content for UI
            matches.push({
                thinking: match[1],
                position: result.length
            });
            
            lastIndex = match.index + match[0].length;
        }
        
        // Add remaining text after last thinking tag
        if (lastIndex < content.length) {
            result += content.substring(lastIndex);
        }
        
        return {
            cleanContent: result.trim(),
            thinkingParts: matches
        };
    }

    addMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        if (type === 'assistant') {
            const parsed = this.parseThinkingTags(content);
            
            if (parsed.thinkingParts.length > 0) {
                // Create message with thinking sections
                let htmlContent = '';
                let contentIndex = 0;
                
                for (const thinking of parsed.thinkingParts) {
                    // Add content before thinking
                    if (thinking.position > contentIndex) {
                        htmlContent += this.escapeHtml(parsed.cleanContent.substring(contentIndex, thinking.position));
                    }
                    
                    // Add collapsible thinking section (expanded by default)
                    htmlContent += `
                        <div class="thinking-section expanded">
                            <div class="thinking-toggle" onclick="this.parentElement.classList.toggle('expanded')">
                                <span class="thinking-label">💭 Thinking</span>
                                <span class="thinking-arrow">▶</span>
                            </div>
                            <div class="thinking-content">${this.escapeHtml(thinking.thinking)}</div>
                        </div>
                    `;
                    
                    contentIndex = thinking.position;
                }
                
                // Add remaining content
                if (contentIndex < parsed.cleanContent.length) {
                    htmlContent += this.escapeHtml(parsed.cleanContent.substring(contentIndex));
                }
                
                messageDiv.innerHTML = htmlContent;
            } else {
                messageDiv.textContent = content;
            }
        } else {
            messageDiv.textContent = content;
        }
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        return messageDiv;
    }

    trimConversationHistory() {
        // Keep only the last maxHistoryLength messages
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateAssistantMessage(messageDiv, content) {
        const streamingResult = this.parseStreamingThinking(content);
        messageDiv.innerHTML = streamingResult.html;
    }

    parseStreamingThinking(content) {
        let html = '';
        let position = 0;
        let inThinking = false;
        let thinkingStartPos = -1;
        let cleanContent = '';

        while (position < content.length) {
            if (!inThinking) {
                // Look for opening <think> tag
                const thinkStart = content.indexOf('<think>', position);
                if (thinkStart !== -1) {
                    // Add content before thinking
                    const beforeThinking = content.substring(position, thinkStart);
                    html += this.escapeHtml(beforeThinking);
                    cleanContent += beforeThinking;
                    
                    // Start thinking section (expanded by default)
                    html += `
                        <div class="thinking-section expanded">
                            <div class="thinking-toggle" onclick="this.parentElement.classList.toggle('expanded')">
                                <span class="thinking-label">💭 Thinking</span>
                                <span class="thinking-arrow">▶</span>
                            </div>
                            <div class="thinking-content">`;
                    
                    inThinking = true;
                    thinkingStartPos = thinkStart + 7; // Skip <think>
                    position = thinkingStartPos;
                } else {
                    // No more thinking tags, add remaining content
                    const remaining = content.substring(position);
                    html += this.escapeHtml(remaining);
                    cleanContent += remaining;
                    break;
                }
            } else {
                // Look for closing </think> tag
                const thinkEnd = content.indexOf('</think>', position);
                if (thinkEnd !== -1) {
                    // Add thinking content and close section
                    const thinkingContent = content.substring(position, thinkEnd);
                    html += this.escapeHtml(thinkingContent);
                    html += `</div></div>`;
                    
                    inThinking = false;
                    position = thinkEnd + 8; // Skip </think>
                } else {
                    // Thinking tag not closed yet, add current thinking content
                    const thinkingContent = content.substring(position);
                    html += this.escapeHtml(thinkingContent);
                    break;
                }
            }
        }

        // If we're still in thinking mode, close the section
        if (inThinking) {
            html += `</div></div>`;
        }

        return { html, cleanContent };
    }

    collapseThinkingSections(messageElement) {
        // Find all thinking sections in the message and collapse them
        const thinkingSections = messageElement.querySelectorAll('.thinking-section.expanded');
        thinkingSections.forEach(section => {
            section.classList.remove('expanded');
        });
    }

    setStatus(status) {
        this.statusElement.textContent = status;
    }

    toggleAdvancedSettings() {
        this.advancedToggle.classList.toggle('collapsed');
        this.advancedContent.classList.toggle('hidden');
    }

    applyPreset() {
        const preset = this.presets.value;
        const presets = {
            creative: {
                temperature: 1.2,
                top_p: 0.9,
                top_k: 50,
                repeat_penalty: 1.05,
                system_prompt: "You are a creative writing assistant. Be imaginative, expressive, and help with storytelling, poetry, and creative projects."
            },
            balanced: {
                temperature: 0.8,
                top_p: 0.95,
                top_k: 40,
                repeat_penalty: 1.1,
                system_prompt: "You are a helpful AI assistant. Provide balanced, informative responses while being conversational and engaging."
            },
            precise: {
                temperature: 0.3,
                top_p: 0.9,
                top_k: 20,
                repeat_penalty: 1.15,
                system_prompt: "You are a precise, factual AI assistant. Provide accurate, well-researched information with clear explanations."
            },
            coding: {
                temperature: 0.2,
                top_p: 0.85,
                top_k: 30,
                repeat_penalty: 1.2,
                system_prompt: "You are a coding assistant. Provide clear, well-commented code examples, explain programming concepts, and help debug issues."
            }
        };

        if (preset && presets[preset]) {
            const config = presets[preset];
            this.temperature.value = config.temperature;
            this.topP.value = config.top_p;
            this.topK.value = config.top_k;
            this.repeatPenalty.value = config.repeat_penalty;
            this.systemPrompt.value = config.system_prompt;
            
            // Update display values
            this.tempValue.textContent = config.temperature;
            this.topPValue.textContent = config.top_p;
            this.repeatPenaltyValue.textContent = config.repeat_penalty;
        }
    }

    getConfiguration() {
        // Get model path from dropdown or custom input
        const modelPath = this.modelPath.style.display === 'none' 
            ? this.modelDropdown.value 
            : this.modelPath.value;
            
        return {
            model: modelPath,
            n_predict: parseInt(this.nPredict.value),
            ctx_size: parseInt(this.ctxSize.value),
            temperature: parseFloat(this.temperature.value),
            top_p: parseFloat(this.topP.value),
            top_k: parseInt(this.topK.value),
            repeat_penalty: parseFloat(this.repeatPenalty.value),
            system_prompt: this.systemPrompt.value,
            
            // Hardware configuration
            threads: parseInt(this.threads.value),
            n_gpu_layers: parseInt(this.nGpuLayers.value),
            
            // ik_llama.cpp specific parameters
            ctk: this.ctk.value !== 'f16' ? this.ctk.value : null,
            mla: parseInt(this.mla.value) || null,
            flash_attn: this.flashAttn.checked,
            amb: parseInt(this.amb.value) || null,
            fmoe: this.fmoe.checked,
            ser: this.ser.checked,
            rtr: this.rtr.checked
        };
    }
}

// Initialize the interface when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new LlamaWebInterface();
});