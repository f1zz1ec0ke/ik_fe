class LlamaWebInterface {
    constructor() {
        this.isModelLoaded = false;
        this.isGenerating = false;
        this.currentStream = null;
        this.tokenCount = 0;
        this.conversationHistory = [];
        this.maxHistoryLength = 20; // Max number of messages to keep in history
        this.currentModelName = null; // Track current model for persistent storage
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupRangeUpdaters();
        this.loadAvailableModels();
        this.checkExistingServerStatus();
    }

    initializeElements() {
        // Configuration elements
        this.modelDropdown = document.getElementById('model-dropdown');
        this.modelPath = document.getElementById('model-path');
        this.toggleCustomPathBtn = document.getElementById('toggle-custom-path');
        this.browseModelBtn = document.getElementById('browse-model');
        this.loadModelBtn = document.getElementById('load-model');
        this.unloadModelBtn = document.getElementById('unload-model');
        
        // Basic Configuration
        this.ctxSize = document.getElementById('ctx-size');
        this.nPredict = document.getElementById('n-predict');
        this.systemPrompt = document.getElementById('system-prompt');
        
        // Generation Parameters
        this.temperature = document.getElementById('temperature');
        this.topP = document.getElementById('top-p');
        this.topK = document.getElementById('top-k');
        this.repeatPenalty = document.getElementById('repeat-penalty');
        
        // ik_llama.cpp Specific Parameters
        this.ctk = document.getElementById('ctk');
        this.mla = document.getElementById('mla');
        this.amb = document.getElementById('amb');
        this.flashAttn = document.getElementById('flash-attn');
        this.fmoe = document.getElementById('fmoe');
        this.ser = document.getElementById('ser');
        this.rtr = document.getElementById('rtr');
        
        // Configuration Presets
        this.presets = document.getElementById('presets');
        
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
        this.statusTextElement = document.getElementById('status-text');
        this.indicatorDotElement = document.getElementById('indicator-dot');
        this.currentModelElement = document.getElementById('current-model');
        this.serverUrlElement = document.getElementById('server-url');
        this.modelFileElement = document.getElementById('model-file');
        this.lastUpdatedElement = document.getElementById('last-updated');
        this.tokenCountElement = document.getElementById('token-count');
        
        // Configuration display elements
        this.configDisplayElement = document.getElementById('config-display');
        this.configCtxSizeElement = document.getElementById('config-ctx-size');
        this.configNPredictElement = document.getElementById('config-n-predict');
        this.configTemperatureElement = document.getElementById('config-temperature');
        this.configTopPElement = document.getElementById('config-top-p');
        this.configCtkElement = document.getElementById('config-ctk');
        this.configMlaElement = document.getElementById('config-mla');
        this.configFlashAttnElement = document.getElementById('config-flash-attn');
        this.configGpuLayersElement = document.getElementById('config-gpu-layers');
        
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
        if (this.advancedToggle) {
            this.advancedToggle.addEventListener('click', () => this.toggleAdvancedSettings());
        }
        
        // Enter key to send message
        if (this.userInput) {
            this.userInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    }

    setupRangeUpdaters() {
        if (this.temperature && this.tempValue) {
            this.temperature.addEventListener('input', (e) => {
                this.tempValue.textContent = e.target.value;
            });
        }

        if (this.topP && this.topPValue) {
            this.topP.addEventListener('input', (e) => {
                this.topPValue.textContent = e.target.value;
            });
        }

        if (this.repeatPenalty && this.repeatPenaltyValue) {
            this.repeatPenalty.addEventListener('input', (e) => {
                this.repeatPenaltyValue.textContent = e.target.value;
            });
        }

        if (this.nGpuLayers && this.nGpuLayersValue) {
            this.nGpuLayers.addEventListener('input', (e) => {
                this.nGpuLayersValue.textContent = e.target.value;
            });
        }

        if (this.mla && this.mlaValue) {
            this.mla.addEventListener('input', (e) => {
                this.mlaValue.textContent = e.target.value;
            });
        }
    }

    async loadModel() {
        if (this.isGenerating) {
            this.addMessage('system', 'Cannot load model while generating. Please stop generation first.');
            return;
        }

        this.updateStatusDisplay('loading', 'Loading model...');
        if (this.loadModelBtn) {
            this.loadModelBtn.disabled = true;
            this.loadModelBtn.innerHTML = '<span class="loading"></span> Loading...';
        }

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
                this.updateStatusDisplay('running', 'Model loaded successfully');
                
                const modelName = config.model.split('/').pop();
                this.currentModelName = modelName;
                
                if (this.currentModelElement) {
                    this.currentModelElement.textContent = modelName;
                }
                if (this.modelFileElement) {
                    this.modelFileElement.textContent = modelName;
                }
                if (this.serverUrlElement) {
                    this.serverUrlElement.textContent = 'http://127.0.0.1:8080';
                }
                
                if (this.sendBtn) this.sendBtn.disabled = false;
                if (this.unloadModelBtn) this.unloadModelBtn.disabled = false;
                this.addMessage('system', `Model loaded: ${modelName}`);
                
                // Save the configuration for this model
                this.saveModelConfiguration(modelName, config);
                
                // Display the configuration used to load the model
                this.displayConfiguration(config);
                
                // Verify server status before enabling chat mode
                this.verifyServerStatus();
                this.updateLastUpdatedTime();
            } else {
                this.updateStatusDisplay('stopped', 'Failed to load model');
                this.addMessage('system', `Error: ${result.error}`);
            }
        } catch (error) {
            this.setStatus('Failed to load model');
            this.addMessage('system', `Error: ${error.message}`);
        } finally {
            if (this.loadModelBtn) {
                this.loadModelBtn.disabled = false;
                this.loadModelBtn.textContent = 'Load Model';
            }
        }
    }

    async unloadModel() {
        if (this.isGenerating) {
            this.addMessage('system', 'Cannot unload model while generating. Please stop generation first.');
            return;
        }

        this.setStatus('Unloading model...');
        if (this.unloadModelBtn) {
            this.unloadModelBtn.disabled = true;
            this.unloadModelBtn.innerHTML = '<span class="loading"></span> Unloading...';
        }

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
                this.updateStatusDisplay('stopped', 'Model unloaded');
                
                if (this.currentModelElement) {
                    this.currentModelElement.textContent = 'None';
                }
                if (this.modelFileElement) {
                    this.modelFileElement.textContent = 'None';
                }
                if (this.serverUrlElement) {
                    this.serverUrlElement.textContent = 'Not running';
                }
                
                if (this.sendBtn) this.sendBtn.disabled = true;
                if (this.unloadModelBtn) this.unloadModelBtn.disabled = true;
                if (this.loadModelBtn) this.loadModelBtn.disabled = false;
                if (this.enterChatBtn) this.enterChatBtn.disabled = true;
                this.addMessage('system', 'Model unloaded successfully');
                this.hideConfiguration();
                this.updateLastUpdatedTime();
            } else {
                this.updateStatusDisplay('stopped', 'Failed to unload model');
                this.addMessage('system', `Error: ${result.error}`);
            }
        } catch (error) {
            this.setStatus('Failed to unload model');
            this.addMessage('system', `Error: ${error.message}`);
        } finally {
            if (this.unloadModelBtn) {
                this.unloadModelBtn.textContent = 'Unload Model';
            }
        }
    }

    async loadAvailableModels() {
        try {
            console.log('Loading available models...');
            const response = await fetch('/api/discover_models');
            const result = await response.json();
            
            console.log('Models API response:', result);
            
            if (result.success) {
                console.log('Found models:', result.models);
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
        console.log('Populating dropdown with models:', models);
        this.modelDropdown.innerHTML = '';
        
        if (models.length === 0) {
            console.log('No models found');
            this.modelDropdown.innerHTML = '<option value="">No models found in models/ directory</option>';
            return;
        }
        
        // Add default option
        this.modelDropdown.innerHTML = '<option value="">Select a model...</option>';
        
        // Add discovered models
        models.forEach(model => {
            console.log('Adding model to dropdown:', model);
            const option = document.createElement('option');
            option.value = model.path;
            option.textContent = `${model.display_name} (${model.size_mb} MB)`;
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
            console.log('Auto-selected model:', models[0].path);
        }
    }

    onModelDropdownChange() {
        const selected = this.modelDropdown.value;
        if (selected === 'custom') {
            this.toggleCustomPath(true);
        } else {
            this.toggleCustomPath(false);
            
            // Load saved configuration for this model
            if (selected) {
                const modelName = selected.split('/').pop();
                const savedConfig = this.loadModelConfiguration(modelName);
                if (savedConfig) {
                    this.applyConfigurationToUI(savedConfig);
                    this.addMessage('system', `Loaded saved configuration for ${modelName}`);
                }
            }
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

    async enterChatMode() {
        if (!this.isModelLoaded) {
            alert('Please load a model first before entering chat mode.');
            return;
        }
        
        // Verify model is actually loaded on server before proceeding
        try {
            const response = await fetch('/api/status');
            const status = await response.json();
            
            if (!status.is_loaded || status.server_status !== 'running') {
                alert('Model is not properly loaded on server. Please try reloading the model.');
                this.isModelLoaded = false;
                if (this.enterChatBtn) this.enterChatBtn.disabled = true;
                this.setStatus('Model not loaded on server');
                return;
            }
            
            // Store current configuration in localStorage for the chat page
            const config = this.getConfiguration();
            config.serverStatus = status; // Include server status
            localStorage.setItem('llamaWebConfig', JSON.stringify(config));
            
            // Redirect to chat page
            window.location.href = 'chat.html';
        } catch (error) {
            alert('Failed to verify model status. Please try reloading the model.');
            console.error('Error checking model status:', error);
        }
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
        // Return early if no chat interface exists (e.g., on landing page)
        if (!this.chatMessages) {
            console.log(`Message not displayed (no chat interface): [${type}] ${content}`);
            // For system messages on landing page, show in status instead
            if (type === 'system' && this.statusElement) {
                this.statusElement.textContent = content;
            }
            return null;
        }
        
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

    async verifyServerStatus() {
        try {
            const response = await fetch('/api/status');
            const status = await response.json();
            
            if (status.is_loaded && status.server_status === 'running') {
                if (this.enterChatBtn) this.enterChatBtn.disabled = false;
                this.setStatus('Model loaded and ready for chat');
            } else {
                if (this.enterChatBtn) this.enterChatBtn.disabled = true;
                this.setStatus('Model loading failed - server not responding');
                this.isModelLoaded = false;
            }
        } catch (error) {
            if (this.enterChatBtn) this.enterChatBtn.disabled = true;
            this.setStatus('Failed to verify model status');
            console.error('Error verifying server status:', error);
        }
    }

    async checkExistingServerStatus() {
        try {
            this.updateStatusDisplay('loading', 'Checking server status...');
            
            const response = await fetch('/api/status');
            const status = await response.json();
            
            if (status.is_loaded && status.server_status === 'running') {
                this.isModelLoaded = true;
                this.updateStatusDisplay('running', 'Model loaded and ready');
                
                const modelName = status.current_model || 'Unknown';
                this.currentModelName = modelName;
                
                // Update detailed status
                if (this.currentModelElement) {
                    this.currentModelElement.textContent = modelName;
                }
                if (this.serverUrlElement) {
                    this.serverUrlElement.textContent = status.server_url || 'Unknown';
                }
                if (this.modelFileElement) {
                    this.modelFileElement.textContent = modelName;
                }
                
                // Load and display saved configuration for this model
                const savedConfig = this.loadModelConfiguration(modelName);
                if (savedConfig) {
                    this.displayConfiguration(savedConfig);
                }
                
                // Enable buttons
                if (this.sendBtn) this.sendBtn.disabled = false;
                if (this.enterChatBtn) this.enterChatBtn.disabled = false;
                if (this.unloadModelBtn) this.unloadModelBtn.disabled = false;
                if (this.loadModelBtn) this.loadModelBtn.disabled = false;
            } else {
                this.updateStatusDisplay('stopped', 'No model loaded');
                if (this.currentModelElement) {
                    this.currentModelElement.textContent = 'None';
                }
                if (this.serverUrlElement) {
                    this.serverUrlElement.textContent = 'Not running';
                }
                if (this.modelFileElement) {
                    this.modelFileElement.textContent = 'None';
                }
            }
            
            this.updateLastUpdatedTime();
        } catch (error) {
            console.error('Error checking existing server status:', error);
            this.updateStatusDisplay('stopped', 'Unable to check server status');
        }
    }

    updateStatusDisplay(state, message) {
        // Update status text
        if (this.statusTextElement) {
            this.statusTextElement.textContent = message;
        }
        
        // Update status element (backwards compatibility)
        if (this.statusElement) {
            this.statusElement.textContent = message;
        }
        
        // Update indicator dot
        if (this.indicatorDotElement) {
            this.indicatorDotElement.className = `indicator-dot ${state}`;
        }
    }
    
    updateLastUpdatedTime() {
        if (this.lastUpdatedElement) {
            const now = new Date();
            this.lastUpdatedElement.textContent = now.toLocaleTimeString();
        }
    }

    displayConfiguration(config) {
        if (this.configDisplayElement) {
            this.configDisplayElement.style.display = 'block';
        }
        
        // Update configuration display
        if (this.configCtxSizeElement) {
            this.configCtxSizeElement.textContent = config.ctx_size || 'Default';
        }
        if (this.configNPredictElement) {
            this.configNPredictElement.textContent = config.n_predict || 'Default';
        }
        if (this.configTemperatureElement) {
            this.configTemperatureElement.textContent = config.temperature || 'Default';
        }
        if (this.configTopPElement) {
            this.configTopPElement.textContent = config.top_p || 'Default';
        }
        if (this.configCtkElement) {
            this.configCtkElement.textContent = config.ctk || 'f16';
        }
        if (this.configMlaElement) {
            this.configMlaElement.textContent = config.mla || '0';
        }
        if (this.configFlashAttnElement) {
            this.configFlashAttnElement.textContent = config.flash_attn ? 'Yes' : 'No';
        }
        if (this.configGpuLayersElement) {
            this.configGpuLayersElement.textContent = config.n_gpu_layers || '0';
        }
    }
    
    hideConfiguration() {
        if (this.configDisplayElement) {
            this.configDisplayElement.style.display = 'none';
        }
    }

    saveModelConfiguration(modelName, config) {
        const configKey = `modelConfig_${modelName}`;
        const configData = {
            modelName,
            config,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem(configKey, JSON.stringify(configData));
        
        // Also save to global config history
        this.saveToConfigHistory(configData);
    }
    
    loadModelConfiguration(modelName) {
        const configKey = `modelConfig_${modelName}`;
        const savedData = localStorage.getItem(configKey);
        if (savedData) {
            try {
                const configData = JSON.parse(savedData);
                return configData.config;
            } catch (error) {
                console.error('Error loading model configuration:', error);
                return null;
            }
        }
        return null;
    }
    
    saveToConfigHistory(configData) {
        const historyKey = 'configHistory';
        let history = [];
        try {
            const existingHistory = localStorage.getItem(historyKey);
            if (existingHistory) {
                history = JSON.parse(existingHistory);
            }
        } catch (error) {
            console.error('Error loading config history:', error);
        }
        
        // Add new config to history (limit to last 10)
        history.unshift(configData);
        history = history.slice(0, 10);
        
        localStorage.setItem(historyKey, JSON.stringify(history));
    }
    
    loadConfigurationFromUI() {
        // Load configuration from saved model settings when model is selected
        const modelPath = this.modelDropdown.value;
        if (modelPath) {
            const modelName = modelPath.split('/').pop();
            const savedConfig = this.loadModelConfiguration(modelName);
            if (savedConfig) {
                this.applyConfigurationToUI(savedConfig);
            }
        }
    }
    
    applyConfigurationToUI(config) {
        // Apply saved configuration to UI elements
        if (config.ctx_size && this.ctxSize) this.ctxSize.value = config.ctx_size;
        if (config.n_predict && this.nPredict) this.nPredict.value = config.n_predict;
        if (config.temperature && this.temperature) {
            this.temperature.value = config.temperature;
            if (this.tempValue) this.tempValue.textContent = config.temperature;
        }
        if (config.top_p && this.topP) {
            this.topP.value = config.top_p;
            if (this.topPValue) this.topPValue.textContent = config.top_p;
        }
        if (config.top_k && this.topK) this.topK.value = config.top_k;
        if (config.repeat_penalty && this.repeatPenalty) {
            this.repeatPenalty.value = config.repeat_penalty;
            if (this.repeatPenaltyValue) this.repeatPenaltyValue.textContent = config.repeat_penalty;
        }
        if (config.system_prompt && this.systemPrompt) this.systemPrompt.value = config.system_prompt;
        if (config.threads && this.threads) this.threads.value = config.threads;
        if (config.n_gpu_layers && this.nGpuLayers) {
            this.nGpuLayers.value = config.n_gpu_layers;
            if (this.nGpuLayersValue) this.nGpuLayersValue.textContent = config.n_gpu_layers;
        }
        if (config.ctk && this.ctk) this.ctk.value = config.ctk;
        if (config.mla && this.mla) {
            this.mla.value = config.mla;
            if (this.mlaValue) this.mlaValue.textContent = config.mla;
        }
        if (config.amb && this.amb) this.amb.value = config.amb;
        if (config.flash_attn !== undefined && this.flashAttn) this.flashAttn.checked = config.flash_attn;
        if (config.fmoe !== undefined && this.fmoe) this.fmoe.checked = config.fmoe;
        if (config.ser !== undefined && this.ser) this.ser.checked = config.ser;
        if (config.rtr !== undefined && this.rtr) this.rtr.checked = config.rtr;
    }

    setStatus(status) {
        this.updateStatusDisplay('stopped', status);
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
        const modelPath = this.modelPath && this.modelPath.style.display === 'none' 
            ? (this.modelDropdown ? this.modelDropdown.value : '')
            : (this.modelPath ? this.modelPath.value : '');
            
        return {
            model: modelPath,
            n_predict: this.nPredict ? parseInt(this.nPredict.value) : 512,
            ctx_size: this.ctxSize ? parseInt(this.ctxSize.value) : 2048,
            temperature: this.temperature ? parseFloat(this.temperature.value) : 0.8,
            top_p: this.topP ? parseFloat(this.topP.value) : 0.95,
            top_k: this.topK ? parseInt(this.topK.value) : 40,
            repeat_penalty: this.repeatPenalty ? parseFloat(this.repeatPenalty.value) : 1.1,
            system_prompt: this.systemPrompt ? this.systemPrompt.value : '',
            
            // Hardware configuration
            threads: this.threads ? parseInt(this.threads.value) : 8,
            n_gpu_layers: this.nGpuLayers ? parseInt(this.nGpuLayers.value) : 0,
            
            // ik_llama.cpp specific parameters
            ctk: this.ctk && this.ctk.value !== 'f16' ? this.ctk.value : null,
            mla: this.mla ? parseInt(this.mla.value) || 0 : 0,
            flash_attn: this.flashAttn ? this.flashAttn.checked : false,
            amb: this.amb ? parseInt(this.amb.value) || 512 : 512,
            fmoe: this.fmoe ? this.fmoe.checked : false,
            ser: this.ser ? this.ser.checked : false,
            rtr: this.rtr ? this.rtr.checked : false
        };
    }
}

// Initialize the interface when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new LlamaWebInterface();
});