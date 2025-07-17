class ChatInterface {
    constructor() {
        this.isGenerating = false;
        this.conversationHistory = [];
        this.maxHistoryLength = 20;
        this.startTime = null;
        this.tokenCount = 0;
        this.messageTokens = 0;
        this.config = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadConfiguration();
        this.applyTheme();
    }

    initializeElements() {
        // UI elements
        this.modelNameElement = document.getElementById('model-name');
        this.modelStatusElement = document.getElementById('model-status');
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.settingsBtn = document.getElementById('settings-btn');
        this.themeToggle = document.getElementById('theme-toggle');
        this.charCount = document.getElementById('char-count');
        this.tokensMetric = document.getElementById('tokens-metric');
        this.speedMetric = document.getElementById('speed-metric');
        this.loadingOverlay = document.getElementById('loading-overlay');
        
        // Settings panel elements
        this.settingsPanel = document.getElementById('settings-panel');
        this.closeSettingsBtn = document.getElementById('close-settings');
        this.temperatureSlider = document.getElementById('temperature');
        this.tempValue = document.getElementById('temp-value');
        this.maxTokensInput = document.getElementById('max-tokens');
        this.topPSlider = document.getElementById('top-p');
        this.topPValue = document.getElementById('top-p-value');
        this.topKInput = document.getElementById('top-k');
        this.repeatPenaltySlider = document.getElementById('repeat-penalty');
        this.repeatPenaltyValue = document.getElementById('repeat-penalty-value');
        this.threadsInput = document.getElementById('threads');
        this.nGpuLayersSlider = document.getElementById('n-gpu-layers');
        this.nGpuLayersValue = document.getElementById('n-gpu-layers-value');
        this.ctkSelect = document.getElementById('ctk');
        this.mlaSlider = document.getElementById('mla');
        this.mlaValue = document.getElementById('mla-value');
        this.ambInput = document.getElementById('amb');
        this.flashAttnCheckbox = document.getElementById('flash-attn');
        this.fmoeCheckbox = document.getElementById('fmoe');
        this.serCheckbox = document.getElementById('ser');
        this.rtrCheckbox = document.getElementById('rtr');
        this.systemPromptTextarea = document.getElementById('system-prompt');
        this.autoScrollCheckbox = document.getElementById('auto-scroll');
        this.showThinkingCheckbox = document.getElementById('show-thinking');
    }

    setupEventListeners() {
        // Chat functionality
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.clearBtn.addEventListener('click', () => this.clearChat());
        this.stopBtn.addEventListener('click', () => this.stopGeneration());
        
        // Input handling
        this.userInput.addEventListener('input', () => this.updateCharCount());
        this.userInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Settings panel
        this.settingsBtn.addEventListener('click', () => this.toggleSettings());
        this.closeSettingsBtn.addEventListener('click', () => this.toggleSettings());
        this.settingsPanel.addEventListener('click', (e) => {
            // Only close if clicking on the backdrop (settingsPanel itself), not on content
            if (e.target === this.settingsPanel) {
                this.toggleSettings();
            }
        });
        
        // Prevent modal from closing when clicking on settings content
        const settingsContent = this.settingsPanel.querySelector('.settings-content');
        if (settingsContent) {
            settingsContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Settings controls
        this.temperatureSlider.addEventListener('input', (e) => {
            this.tempValue.textContent = e.target.value;
        });
        
        this.topPSlider.addEventListener('input', (e) => {
            this.topPValue.textContent = e.target.value;
        });
        
        this.repeatPenaltySlider.addEventListener('input', (e) => {
            this.repeatPenaltyValue.textContent = e.target.value;
        });
        
        this.nGpuLayersSlider.addEventListener('input', (e) => {
            this.nGpuLayersValue.textContent = e.target.value;
        });
        
        this.mlaSlider.addEventListener('input', (e) => {
            this.mlaValue.textContent = e.target.value;
        });
        
        // Auto-resize textarea
        this.userInput.addEventListener('input', () => this.autoResizeTextarea());
        
        // Escape key to close settings
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.settingsPanel.classList.contains('show')) {
                this.toggleSettings();
            }
        });
    }

    async loadConfiguration() {
        try {
            // Load config from localStorage (set by landing page)
            const savedConfig = localStorage.getItem('llamaWebConfig');
            if (savedConfig) {
                this.config = JSON.parse(savedConfig);
                
                // Verify the server status is still valid
                await this.verifyServerStatus();
                
                this.modelNameElement.textContent = this.config.model?.split('/').pop() || 'Unknown Model';
                this.populateSettings();
            } else {
                throw new Error('No configuration found');
            }
        } catch (error) {
            console.error('Failed to load configuration:', error);
            this.showError('Failed to load model configuration. Please return to the main page and load a model first.');
            this.disableChat();
        } finally {
            this.hideLoading();
        }
    }

    async verifyServerStatus() {
        try {
            const response = await fetch('/api/status');
            const status = await response.json();
            
            if (!status.is_loaded || status.server_status !== 'running') {
                throw new Error('Model not loaded on server');
            }
            
            this.modelStatusElement.textContent = 'Ready';
            this.modelStatusElement.style.color = 'var(--success-color)';
        } catch (error) {
            this.modelStatusElement.textContent = 'Model Not Loaded';
            this.modelStatusElement.style.color = 'var(--danger-color)';
            throw error;
        }
    }

    disableChat() {
        this.sendBtn.disabled = true;
        this.userInput.disabled = true;
        this.userInput.placeholder = 'Model not loaded - return to main page';
    }

    populateSettings() {
        if (!this.config) return;
        
        // Populate settings with current config
        this.temperatureSlider.value = this.config.temperature || 0.8;
        this.tempValue.textContent = this.temperatureSlider.value;
        this.maxTokensInput.value = this.config.n_predict || 512;
        this.topPSlider.value = this.config.top_p || 0.95;
        this.topPValue.textContent = this.topPSlider.value;
        this.topKInput.value = this.config.top_k || 40;
        this.repeatPenaltySlider.value = this.config.repeat_penalty || 1.1;
        this.repeatPenaltyValue.textContent = this.repeatPenaltySlider.value;
        this.threadsInput.value = this.config.threads || 8;
        this.nGpuLayersSlider.value = this.config.n_gpu_layers || 0;
        this.nGpuLayersValue.textContent = this.nGpuLayersSlider.value;
        this.ctkSelect.value = this.config.ctk || 'f16';
        this.mlaSlider.value = this.config.mla || 0;
        this.mlaValue.textContent = this.mlaSlider.value;
        this.ambInput.value = this.config.amb || 512;
        this.flashAttnCheckbox.checked = this.config.flash_attn || false;
        this.fmoeCheckbox.checked = this.config.fmoe || false;
        this.serCheckbox.checked = this.config.ser || false;
        this.rtrCheckbox.checked = this.config.rtr || false;
        this.systemPromptTextarea.value = this.config.system_prompt || '';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
        this.enableInput();
    }

    enableInput() {
        this.sendBtn.disabled = false;
        this.userInput.disabled = false;
        this.userInput.focus();
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message system';
        errorDiv.textContent = message;
        this.chatMessages.appendChild(errorDiv);
        this.scrollToBottom();
    }

    handleKeyDown(e) {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Allow new line
                return;
            } else {
                e.preventDefault();
                this.sendMessage();
            }
        }
    }

    updateCharCount() {
        const length = this.userInput.value.length;
        this.charCount.textContent = `${length} / 4000`;
        
        if (length > 3800) {
            this.charCount.style.color = 'var(--danger-color)';
        } else if (length > 3000) {
            this.charCount.style.color = 'var(--warning-color)';
        } else {
            this.charCount.style.color = 'var(--text-muted)';
        }
    }

    autoResizeTextarea() {
        this.userInput.style.height = 'auto';
        this.userInput.style.height = Math.min(this.userInput.scrollHeight, 150) + 'px';
    }

    async sendMessage() {
        if (this.isGenerating) return;
        
        // Verify model is still loaded before sending
        try {
            await this.verifyServerStatus();
        } catch (error) {
            this.showError('Model is no longer loaded. Please return to the main page and reload the model.');
            return;
        }
        
        const message = this.userInput.value.trim();
        if (!message) return;

        this.userInput.value = '';
        this.updateCharCount();
        this.autoResizeTextarea();
        
        // Add user message to UI and history
        this.addMessage('user', message);
        this.conversationHistory.push({
            role: 'user',
            content: message
        });
        
        this.trimConversationHistory();
        this.setGenerating(true);
        
        // Start timing
        this.startTime = Date.now();
        this.messageTokens = 0;

        try {
            // Get current settings
            const currentConfig = this.getCurrentConfig();
            
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    history: this.conversationHistory,
                    config: currentConfig
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
                                this.updateAssistantMessage(assistantMessage, fullResponse);
                                this.messageTokens++;
                                this.updateMetrics();
                                this.scrollToBottom();
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
            this.setGenerating(false);
        }
    }

    getCurrentConfig() {
        return {
            ...this.config,
            temperature: parseFloat(this.temperatureSlider.value),
            n_predict: parseInt(this.maxTokensInput.value),
            top_p: parseFloat(this.topPSlider.value),
            top_k: parseInt(this.topKInput.value),
            repeat_penalty: parseFloat(this.repeatPenaltySlider.value),
            threads: parseInt(this.threadsInput.value),
            n_gpu_layers: parseInt(this.nGpuLayersSlider.value),
            ctk: this.ctkSelect.value,
            mla: parseInt(this.mlaSlider.value),
            amb: parseInt(this.ambInput.value),
            flash_attn: this.flashAttnCheckbox.checked,
            fmoe: this.fmoeCheckbox.checked,
            ser: this.serCheckbox.checked,
            rtr: this.rtrCheckbox.checked,
            system_prompt: this.systemPromptTextarea.value
        };
    }

    updateMetrics() {
        this.tokenCount += 1;
        this.tokensMetric.textContent = `${this.tokenCount} tokens`;
        
        if (this.startTime) {
            const elapsed = (Date.now() - this.startTime) / 1000;
            const speed = this.messageTokens / elapsed;
            this.speedMetric.textContent = `${speed.toFixed(1)} t/s`;
        }
    }

    setGenerating(generating) {
        this.isGenerating = generating;
        this.sendBtn.disabled = generating;
        this.stopBtn.disabled = !generating;
        this.userInput.disabled = generating;
        
        if (generating) {
            this.modelStatusElement.textContent = 'Generating...';
            this.modelStatusElement.style.color = 'var(--accent-color)';
        } else {
            this.modelStatusElement.textContent = 'Ready';
            this.modelStatusElement.style.color = 'var(--text-secondary)';
        }
    }

    stopGeneration() {
        if (this.isGenerating) {
            // In a real implementation, you'd cancel the fetch request
            this.setGenerating(false);
            this.addMessage('system', 'Generation stopped by user.');
        }
    }

    clearChat() {
        this.chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">💬</div>
                <h3>Welcome to ik_llama.cpp Chat</h3>
                <p>Your AI assistant is ready. Start a conversation!</p>
            </div>
        `;
        this.conversationHistory = [];
        this.tokenCount = 0;
        this.updateMetrics();
    }

    addMessage(type, content) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${type}`;
        
        if (type === "assistant") {
            // Process thinking sections first
            const parsedThinking = this.parseStreamingThinking(content);
            // Then convert remaining markdown
            const htmlContent = this.convertMarkdownToHtml(parsedThinking.cleanContent);
            messageDiv.innerHTML = parsedThinking.html.replace("<div class=\"thinking-content\">", `<div class="thinking-content">${htmlContent}`);
        } else {
            messageDiv.textContent = content;
        }
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        return messageDiv;
    }

    updateAssistantMessage(messageDiv, content) {
        if (messageDiv.classList.contains("assistant")) {
            const streamingResult = this.parseStreamingThinking(content);
            // Convert markdown for the clean content
            const htmlContent = this.convertMarkdownToHtml(streamingResult.cleanContent);
            messageDiv.innerHTML = streamingResult.html.replace("<div class=\"thinking-content\">", `<div class="thinking-content">${htmlContent}`);
        } else {
            messageDiv.textContent = content;
        }
    }

    parseStreamingThinking(content) {
        let html = '';
        let position = 0;
        let inThinking = false;
        let cleanContent = '';

        while (position < content.length) {
            if (!inThinking) {
                const thinkStart = content.indexOf('<think>', position);
                if (thinkStart !== -1) {
                    const beforeThinking = content.substring(position, thinkStart);
                    html += this.escapeHtml(beforeThinking);
                    cleanContent += beforeThinking;
                    
                    html += `
                        <div class="thinking-section expanded">
                            <div class="thinking-toggle" onclick="this.parentElement.classList.toggle('expanded')">
                                <span class="thinking-label">💭 Thinking</span>
                                <span class="thinking-arrow">▼</span>
                            </div>
                            <div class="thinking-content">`;
                    
                    inThinking = true;
                    position = thinkStart + 7;
                } else {
                    const remaining = content.substring(position);
                    html += this.escapeHtml(remaining);
                    cleanContent += remaining;
                    break;
                }
            } else {
                const thinkEnd = content.indexOf('</think>', position);
                if (thinkEnd !== -1) {
                    const thinkingContent = content.substring(position, thinkEnd);
                    html += this.escapeHtml(thinkingContent);
                    html += `</div></div>`;
                    
                    inThinking = false;
                    position = thinkEnd + 8;
                } else {
                    const thinkingContent = content.substring(position);
                    html += this.escapeHtml(thinkingContent);
                    break;
                }
            }
        }

        if (inThinking) {
            html += `</div></div>`;
        }

        return { html, cleanContent };
    }

    collapseThinkingSections(messageElement) {
        const thinkingSections = messageElement.querySelectorAll('.thinking-section.expanded');
        thinkingSections.forEach(section => {
            section.classList.remove('expanded');
            const arrow = section.querySelector('.thinking-arrow');
            if (arrow) arrow.textContent = '▶';
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    convertMarkdownToHtml(markdown) {
        if (!markdown) return '';

        // Configure marked for security and basic options
        marked.setOptions({
            breaks: true,  // Convert single newline to <br>
            sanitize: true // Sanitize HTML to prevent XSS (marked default)
        });

        try {
            return marked.parse(markdown);
        } catch (error) {
            console.error('Markdown parsing error:', error);
            // Fallback to escaped HTML if parsing fails
            const div = document.createElement('div');
            div.textContent = markdown;
            return div.innerHTML;
        }
    }

    trimConversationHistory() {
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
        }
    }

    scrollToBottom() {
        if (this.autoScrollCheckbox.checked) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    toggleSettings() {
        this.settingsPanel.classList.toggle('show');
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Update theme toggle button
        this.themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }

    applyTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }
}

// Add CSS for thinking sections
const thinkingCSS = `
.thinking-section {
    margin: 10px 0;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
}

.thinking-section:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
}

.thinking-toggle {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.12);
    cursor: pointer;
    user-select: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}

.thinking-toggle:hover {
    background: rgba(255, 255, 255, 0.18);
    transform: translateY(-1px);
}

.thinking-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-right: 8px;
}

.thinking-arrow {
    font-size: 10px;
    color: var(--text-secondary);
    transition: transform 0.2s;
}

.thinking-section.expanded .thinking-arrow {
    transform: rotate(0deg);
}

.thinking-content {
    padding: 16px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-muted);
    white-space: pre-wrap;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease-out;
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
}

.thinking-section.expanded .thinking-content {
    max-height: 500px;
    overflow-y: auto;
}
`;

// Inject thinking CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = thinkingCSS;
document.head.appendChild(styleSheet);

// Initialize chat interface when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatInterface();
});