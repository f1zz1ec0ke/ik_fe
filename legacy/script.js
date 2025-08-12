class IkLlamaDashboard {
    constructor() {
        this.serverStatus = 'offline';
        this.currentModel = null;
        this.buildProgress = null;
        this.config = {}; // Initialize as empty object first
        this.init();
    }

    init() {
        this.initializeElements();
        this.config = this.loadConfig(); // Load config after elements are initialized
        this.setupEventListeners();
        this.loadInitialData();
        this.startStatusUpdates();
        this.setupTheme();
    }

    initializeElements() {
        // Project Management Elements
        this.repoStatusElement = document.getElementById('repo-status');
        this.buildStatusElement = document.getElementById('build-status');
        this.setupWizardBtn = document.getElementById('setup-wizard');
        this.viewLogsBtn = document.getElementById('view-logs');
        this.cloneRepoBtn = document.getElementById('clone-repo');
        this.buildProjectBtn = document.getElementById('build-project');
        this.updateRepoBtn = document.getElementById('update-repo');

        // Model Management Elements
        this.modelSelect = document.getElementById('model-dropdown');
        this.modelPath = document.getElementById('model-path');
        this.browseModelBtn = document.getElementById('browse-model');
        this.toggleCustomPathBtn = document.getElementById('toggle-custom-path');
        this.modelInfo = document.getElementById('model-info');

        // Configuration Elements
        this.configTabs = document.querySelectorAll('.tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        // Basic Config
        this.contextSize = document.getElementById('context-size');
        this.maxTokens = document.getElementById('max-tokens');
        this.systemPrompt = document.getElementById('system-prompt');
        this.temperature = document.getElementById('temperature');
        this.topP = document.getElementById('top-p');
        this.topK = document.getElementById('top-k');
        this.repeatPenalty = document.getElementById('repeat-penalty');

        // Hardware Config
        this.cpuThreads = document.getElementById('cpu-threads');
        this.gpuLayers = document.getElementById('gpu-layers');

        // Advanced Config
        this.kvCacheType = document.getElementById('kv-cache-type');
        this.multiLayerAttention = document.getElementById('multi-layer-attention');
        this.attentionMaxBatch = document.getElementById('attention-max-batch');
        this.flashAttention = document.getElementById('flash-attention');
        this.fusedMoe = document.getElementById('fused-moe');
        this.smartExpertReduction = document.getElementById('smart-expert-reduction');
        this.runtimeTensorRepacking = document.getElementById('runtime-tensor-repacking');

        // Action Elements
        this.loadModelBtn = document.getElementById('load-model');
        this.chatBtn = document.getElementById('chat-btn');
        this.benchmarkBtn = document.getElementById('benchmark-btn');
        this.completionBtn = document.getElementById('completion-btn');

        // Status Elements
        this.serverStatusElement = document.getElementById('server-status');
        this.modelStatusElement = document.getElementById('model-status');
        this.memoryUsageElement = document.getElementById('memory-usage');
        this.gpuUsageElement = document.getElementById('gpu-usage');
        this.performanceMetrics = document.getElementById('performance-metrics');

        // Modal Elements
        this.setupModal = document.getElementById('setup-modal');
        this.logsModal = document.getElementById('logs-modal');
        this.logsContainer = document.getElementById('logs-container');
        this.closeModalBtns = document.querySelectorAll('.close-btn');

        // Theme Elements
        this.themeToggle = document.getElementById('theme-toggle');
        this.settingsBtn = document.getElementById('settings-btn');

        // Range value displays
        this.setupRangeDisplays();
    }

    setupRangeDisplays() {
        const ranges = [
            { input: this.temperature, display: 'temperature-value' },
            { input: this.topP, display: 'top-p-value' },
            { input: this.topK, display: 'top-k-value' },
            { input: this.repeatPenalty, display: 'repeat-penalty-value' }
        ];

        ranges.forEach(({ input, display }) => {
            if (input) {
                const displayElement = document.getElementById(display);
                if (displayElement) {
                    input.addEventListener('input', () => {
                        displayElement.textContent = input.value;
                    });
                    displayElement.textContent = input.value;
                }
            }
        });
    }

    setupEventListeners() {
        // Project Management
        if (this.cloneRepoBtn) {
            this.cloneRepoBtn.addEventListener('click', () => this.cloneRepository());
        }
        if (this.buildProjectBtn) {
            this.buildProjectBtn.addEventListener('click', () => this.buildProject());
        }
        if (this.updateRepoBtn) {
            this.updateRepoBtn.addEventListener('click', () => this.updateRepository());
        }
        if (this.setupWizardBtn) {
            this.setupWizardBtn.addEventListener('click', () => this.showSetupWizard());
        }
        if (this.viewLogsBtn) {
            this.viewLogsBtn.addEventListener('click', () => this.showLogsModal());
        }
        
        // Modal Close Buttons
        const closeSetupBtn = document.getElementById('close-setup');
        if (closeSetupBtn) {
            closeSetupBtn.addEventListener('click', () => this.closeSetupWizard());
        }
        
        const closeLogsBtn = document.getElementById('close-logs');
        if (closeLogsBtn) {
            closeLogsBtn.addEventListener('click', () => this.closeLogsModal());
        }
        
        // Logs Modal Buttons
        const clearLogsBtn = document.getElementById('clear-logs');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => this.clearLogs());
        }
        
        const downloadLogsBtn = document.getElementById('download-logs');
        if (downloadLogsBtn) {
            downloadLogsBtn.addEventListener('click', () => this.downloadLogs());
        }
        
        // Setup Wizard Navigation
        const nextStepBtn = document.getElementById('next-step');
        if (nextStepBtn) {
            nextStepBtn.addEventListener('click', () => this.nextStep());
        }
        
        const prevStepBtn = document.getElementById('prev-step');
        if (prevStepBtn) {
            prevStepBtn.addEventListener('click', () => this.prevStep());
        }
        
        const startBuildBtn = document.getElementById('start-build');
        if (startBuildBtn) {
            startBuildBtn.addEventListener('click', () => this.startBuild());
        }

        // Model Management
        if (this.loadModelBtn) {
            this.loadModelBtn.addEventListener('click', () => this.loadModel());
        }
        if (this.browseModelBtn) {
            this.browseModelBtn.addEventListener('click', () => this.browseModel());
        }
        if (this.modelSelect) {
            this.modelSelect.addEventListener('change', () => this.onModelSelectChange());
        }

        // Configuration Tabs
        this.configTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Actions
        if (this.chatBtn) {
            this.chatBtn.addEventListener('click', () => this.openChat());
        }
        if (this.benchmarkBtn) {
            this.benchmarkBtn.addEventListener('click', () => this.runBenchmark());
        }
        if (this.completionBtn) {
            this.completionBtn.addEventListener('click', () => this.testCompletion());
        }

        // Modal close buttons
        this.closeModalBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Theme toggle
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Configuration change listeners
        const configElements = [
            this.contextSize, this.maxTokens, this.systemPrompt,
            this.temperature, this.topP, this.topK, this.repeatPenalty,
            this.cpuThreads, this.gpuLayers,
            this.kvCacheType, this.multiLayerAttention, this.attentionMaxBatch,
            this.flashAttention, this.fusedMoe, this.smartExpertReduction,
            this.runtimeTensorRepacking
        ];

        configElements.forEach(element => {
            if (element) {
                element.addEventListener('change', () => this.saveConfig());
            }
        });
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
    
    loadConfig() {
        try {
            const savedConfig = localStorage.getItem('ik_llama_config');
            return savedConfig ? JSON.parse(savedConfig) : this.getDefaultConfig();
        } catch (error) {
            console.error('Error loading configuration:', error);
            return this.getDefaultConfig();
        }
    }
    
    saveConfig() {
        try {
            const config = this.getConfiguration();
            localStorage.setItem('ik_llama_config', JSON.stringify(config));
            console.log('Configuration saved');
            
            // Also save model-specific configuration if a model is selected
            const modelPath = this.modelSelect.value;
            if (modelPath) {
                const modelName = modelPath.split('/').pop();
                this.saveModelConfiguration(modelName, config);
            }
        } catch (error) {
            console.error('Error saving configuration:', error);
        }
    }
    
    getDefaultConfig() {
        return {
            context_size: 2048,
            max_tokens: 512,
            system_prompt: 'You are a helpful assistant.',
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            cpu_threads: 4,
            gpu_layers: 0,
            kv_cache_type: 'f16',
            multi_layer_attention: false,
            attention_max_batch: 512,
            flash_attention: false,
            fused_moe: false,
            smart_expert_reduction: false,
            runtime_tensor_repacking: false
        };
    }
    
    getConfiguration() {
        return {
            model_path: this.modelSelect ? this.modelSelect.value : '',
            context_size: this.contextSize ? parseInt(this.contextSize.value) : 2048,
            max_tokens: this.maxTokens ? parseInt(this.maxTokens.value) : 512,
            system_prompt: this.systemPrompt ? this.systemPrompt.value : '',
            temperature: this.temperature ? parseFloat(this.temperature.value) : 0.7,
            top_p: this.topP ? parseFloat(this.topP.value) : 0.9,
            top_k: this.topK ? parseInt(this.topK.value) : 40,
            repeat_penalty: this.repeatPenalty ? parseFloat(this.repeatPenalty.value) : 1.1,
            cpu_threads: this.cpuThreads ? parseInt(this.cpuThreads.value) : 4,
            gpu_layers: this.gpuLayers ? parseInt(this.gpuLayers.value) : 0,
            kv_cache_type: this.kvCacheType ? this.kvCacheType.value : 'f16',
            multi_layer_attention: this.multiLayerAttention ? this.multiLayerAttention.checked : false,
            attention_max_batch: this.attentionMaxBatch ? parseInt(this.attentionMaxBatch.value) : 512,
            flash_attention: this.flashAttention ? this.flashAttention.checked : false,
            fused_moe: this.fusedMoe ? this.fusedMoe.checked : false,
            smart_expert_reduction: this.smartExpertReduction ? this.smartExpertReduction.checked : false,
            runtime_tensor_repacking: this.runtimeTensorRepacking ? this.runtimeTensorRepacking.checked : false
        };
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">×</button>
            </div>
        `;
        
        // Add to document
        document.body.appendChild(notification);
        
        // Add close button functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.classList.add('notification-hide');
            setTimeout(() => {
                notification.remove();
            }, 300);
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.classList.add('notification-hide');
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }
    
    setupTheme() {
        // Get theme toggle button
        this.themeToggle = document.getElementById('theme-toggle');
        
        // Check for saved theme preference or use system preference
        const savedTheme = localStorage.getItem('ik-llama-theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Set initial theme
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else if (prefersDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
        
        // Update toggle button icon based on current theme
        this.updateThemeIcon();
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Update theme
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('ik-llama-theme', newTheme);
        
        // Update toggle button icon
        this.updateThemeIcon();
        
        // Show notification
        this.showNotification(`Switched to ${newTheme} theme`, 'info');
    }
    
    updateThemeIcon() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (this.themeToggle) {
            this.themeToggle.innerHTML = currentTheme === 'dark' 
                ? '<i class="fas fa-sun"></i>' 
                : '<i class="fas fa-moon"></i>';
        }
    }

    async loadInitialData() {
        // Load available models
        await this.loadAvailableModels();
        
        // Check project status
        await this.checkProjectStatus();
        
        // Check server status
        await this.checkServerStatus();
        
        // Apply saved configuration
        this.applyConfigToUI(this.config);
    }

    async loadAvailableModels() {
        try {
            const response = await fetch('/api/models/available');
            const models = await response.json();
            
            if (models && models.length > 0) {
                // Clear existing options
                this.modelSelect.innerHTML = '<option value="">Select a model...</option>';
                
                // Add models to select
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.path;
                    option.textContent = model.name;
                    this.modelSelect.appendChild(option);
                });
            } else {
                this.modelSelect.innerHTML = '<option value="">No models found</option>';
            }
        } catch (error) {
            console.error('Error loading models:', error);
            this.modelSelect.innerHTML = '<option value="">Error loading models</option>';
        }
    }

    async checkProjectStatus() {
        try {
            const response = await fetch('/api/status');
            const status = await response.json();
            
            // Update repository status
            const repoStatusText = document.getElementById('repo-status-text');
            const repoStatusIcon = document.getElementById('repo-status-icon');
            
            if (status.repository) {
                if (status.repository.status === 'found') {
                    if (repoStatusText) repoStatusText.textContent = 'Repository Found';
                    if (repoStatusIcon) repoStatusIcon.textContent = '✅';
                    this.updateRepoBtn.disabled = false;
                    this.cloneRepoBtn.disabled = true;
                } else if (status.repository.status === 'found_no_git') {
                    if (repoStatusText) repoStatusText.textContent = 'Found (No Git)';
                    if (repoStatusIcon) repoStatusIcon.textContent = '⚠️';
                    this.updateRepoBtn.disabled = true;
                    this.cloneRepoBtn.disabled = false;
                } else {
                    if (repoStatusText) repoStatusText.textContent = 'Not Found';
                    if (repoStatusIcon) repoStatusIcon.textContent = '❌';
                    this.updateRepoBtn.disabled = true;
                    this.cloneRepoBtn.disabled = false;
                }
            }
            
            // Update build status
            const buildStatusText = document.getElementById('build-status-text');
            const buildStatusIcon = document.getElementById('build-status-icon');
            
            if (status.build) {
                if (status.build.status === 'built') {
                    if (buildStatusText) buildStatusText.textContent = 'Built';
                    if (buildStatusIcon) buildStatusIcon.textContent = '✅';
                    this.buildProjectBtn.disabled = false;
                    this.buildProjectBtn.textContent = 'Rebuild';
                } else {
                    if (buildStatusText) buildStatusText.textContent = 'Not Built';
                    if (buildStatusIcon) buildStatusIcon.textContent = '❌';
                    this.buildProjectBtn.disabled = false;
                    this.buildProjectBtn.textContent = 'Build';
                }
            }
        } catch (error) {
            console.error('Error checking project status:', error);
            const repoStatusText = document.getElementById('repo-status-text');
            const buildStatusText = document.getElementById('build-status-text');
            const repoStatusIcon = document.getElementById('repo-status-icon');
            const buildStatusIcon = document.getElementById('build-status-icon');
            
            if (repoStatusText) repoStatusText.textContent = 'Error';
            if (buildStatusText) buildStatusText.textContent = 'Error';
            if (repoStatusIcon) repoStatusIcon.textContent = '❌';
            if (buildStatusIcon) buildStatusIcon.textContent = '❌';
        }
    }

    async checkServerStatus() {
        try {
            const response = await fetch('/api/status');
            const status = await response.json();
            
            // Update server status
            if (status.server) {
                if (status.server.online) {
                    this.serverStatusElement.innerHTML = '<span class="status-badge success">Online</span>';
                    this.serverStatus = 'online';
                } else {
                    this.serverStatusElement.innerHTML = '<span class="status-badge error">Offline</span>';
                    this.serverStatus = 'offline';
                }
            }
            
            // Update model status
            if (status.model) {
                if (status.model.loaded) {
                    this.modelStatusElement.innerHTML = `<span class="status-badge success">${status.model.name || 'Loaded'}</span>`;
                    this.currentModel = status.model.name;
                } else {
                    this.modelStatusElement.innerHTML = '<span class="status-badge warning">Not Loaded</span>';
                    this.currentModel = null;
                }
            }
            
            // Update system info
            if (status.system) {
                if (status.system.memory) {
                    const memPercent = status.system.memory.percent;
                    this.memoryUsageElement.innerHTML = `<div class="progress-bar">
                        <div class="progress" style="width: ${memPercent}%"></div>
                        <span>${memPercent}%</span>
                    </div>`;
                }
                
                if (status.system.gpu) {
                    const gpuPercent = status.system.gpu.usage;
                    this.gpuUsageElement.innerHTML = `<div class="progress-bar">
                        <div class="progress" style="width: ${gpuPercent}%"></div>
                        <span>${gpuPercent}%</span>
                    </div>`;
                }
            }
            
            // Update performance metrics
            if (status.performance) {
                this.performanceMetrics.innerHTML = `
                    <div>Tokens/sec: ${status.performance.tokens_per_second || 'N/A'}</div>
                    <div>Total tokens: ${status.performance.total_tokens || 'N/A'}</div>
                `;
            }
            
            // Update configuration
            if (status.configuration) {
                this.config = status.configuration;
                this.applyConfigToUI(this.config);
            }
        } catch (error) {
            console.error('Error checking server status:', error);
            this.serverStatusElement.innerHTML = '<span class="status-badge error">Error</span>';
        }
    }

    startStatusUpdates() {
        // Update status every 5 seconds
        this.statusInterval = setInterval(() => {
            this.checkServerStatus();
            
            // If build is in progress, check build progress
            if (this.buildProgress && !this.buildProgress.completed) {
                this.checkBuildProgress();
            }
        }, 5000);
    }

    applyConfigToUI(config) {
        if (!config) return;
        
        // Basic config
        if (config.context_size && this.contextSize) this.contextSize.value = config.context_size;
        if (config.max_tokens && this.maxTokens) this.maxTokens.value = config.max_tokens;
        if (config.system_prompt && this.systemPrompt) this.systemPrompt.value = config.system_prompt;
        if (config.temperature && this.temperature) this.temperature.value = config.temperature;
        if (config.top_p && this.topP) this.topP.value = config.top_p;
        if (config.top_k && this.topK) this.topK.value = config.top_k;
        if (config.repeat_penalty && this.repeatPenalty) this.repeatPenalty.value = config.repeat_penalty;
        
        // Hardware config
        if (config.cpu_threads && this.cpuThreads) this.cpuThreads.value = config.cpu_threads;
        if (config.gpu_layers && this.gpuLayers) this.gpuLayers.value = config.gpu_layers;
        
        // Advanced config
        if (config.kv_cache_type && this.kvCacheType) this.kvCacheType.value = config.kv_cache_type;
        if (this.multiLayerAttention) this.multiLayerAttention.checked = !!config.multi_layer_attention;
        if (config.attention_max_batch && this.attentionMaxBatch) this.attentionMaxBatch.value = config.attention_max_batch;
        if (this.flashAttention) this.flashAttention.checked = !!config.flash_attention;
        if (this.fusedMoe) this.fusedMoe.checked = !!config.fused_moe;
        if (this.smartExpertReduction) this.smartExpertReduction.checked = !!config.smart_expert_reduction;
        if (this.runtimeTensorRepacking) this.runtimeTensorRepacking.checked = !!config.runtime_tensor_repacking;
        
        // Update range displays
        this.setupRangeDisplays();
    }

    async loadModel() {
        if (this.serverStatus === 'loading') {
            this.showNotification('Model is already loading', 'warning');
            return;
        }

        // Update UI
        this.serverStatusElement.innerHTML = '<span class="status-badge loading">Loading...</span>';
        this.loadModelBtn.disabled = true;
        this.loadModelBtn.innerHTML = '<span class="loading-spinner"></span> Loading...';

        try {
            const config = this.getConfiguration();
            const response = await fetch('/api/model/load', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(config)
            });

            const result = await response.json();
            
            if (result.success) {
                this.serverStatus = 'online';
                this.currentModel = config.model_path.split(/[\\\/]/).pop();
                this.serverStatusElement.innerHTML = '<span class="status-badge success">Online</span>';
                this.modelStatusElement.innerHTML = `<span class="status-badge success">${this.currentModel}</span>`;
                
                // Save configuration
                this.saveConfig();
                
                // Show success notification
                this.showNotification('Model loaded successfully', 'success');
                
                // Enable action buttons
                this.chatBtn.disabled = false;
                this.benchmarkBtn.disabled = false;
                this.completionBtn.disabled = false;
            } else {
                this.serverStatusElement.innerHTML = '<span class="status-badge error">Error</span>';
                this.showNotification(`Failed to load model: ${result.message || result.error}`, 'error');
            }
        } catch (error) {
            this.serverStatusElement.innerHTML = '<span class="status-badge error">Error</span>';
            this.showNotification(`Error: ${error.message}`, 'error');
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
                if (this.modelSelect) {
                    this.modelSelect.innerHTML = '<option value="">Error loading models</option>';
                }
            }
        } catch (error) {
            console.error('Error loading models:', error);
            if (this.modelSelect) {
                this.modelSelect.innerHTML = '<option value="">Error loading models</option>';
            }
        }
    }

    populateModelDropdown(models) {
        console.log('Populating dropdown with models:', models);
        if (!this.modelSelect) {
            console.error('Model select element not found');
            return;
        }
        
        this.modelSelect.innerHTML = '';
        
        if (models.length === 0) {
            console.log('No models found');
            this.modelSelect.innerHTML = '<option value="">No models found in models/ directory</option>';
            return;
        }
        
        // Add default option
        this.modelSelect.innerHTML = '<option value="">Select a model...</option>';
        
        // Add discovered models
        models.forEach(model => {
            console.log('Adding model to dropdown:', model);
            const option = document.createElement('option');
            option.value = model.path;
            option.textContent = `${model.display_name} (${model.size_mb} MB)`;
            this.modelSelect.appendChild(option);
        });
        
        // Add custom path option
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = 'Custom path...';
        this.modelSelect.appendChild(customOption);
        
        // Auto-select first model if available
        if (models.length > 0) {
            this.modelSelect.value = models[0].path;
            console.log('Auto-selected model:', models[0].path);
        }
    }

    onModelDropdownChange() {
        const selected = this.modelSelect.value;
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
            this.modelSelect.style.display = 'none';
        } else {
            this.modelPath.style.display = 'none';
            this.browseModelBtn.style.display = 'none';
            this.toggleCustomPathBtn.textContent = 'Custom Path';
            this.modelSelect.style.display = 'block';
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
        const modelPath = this.modelSelect.value;
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
    
    // Setup Wizard Functions
    showSetupWizard() {
        // Get the setup modal element
        const setupModal = document.getElementById('setup-modal');
        if (setupModal) {
            setupModal.style.display = 'flex';
            
            // Initialize the setup wizard
            this.initSetupWizard();
        }
    }
    
    initSetupWizard() {
        // Get the setup wizard elements
        this.setupModal = document.getElementById('setup-modal');
        this.closeSetupBtn = document.getElementById('close-setup');
        this.nextStepBtn = document.getElementById('next-step');
        this.prevStepBtn = document.getElementById('prev-step');
        this.startBuildBtn = document.getElementById('start-build');
        this.setupSteps = document.querySelectorAll('.setup-step');
        this.repoOptions = document.getElementsByName('repo-option');
        this.cudaSupport = document.getElementById('cuda-support');
        this.openclSupport = document.getElementById('opencl-support');
        this.metalSupport = document.getElementById('metal-support');
        
        // Set up event listeners
        if (this.closeSetupBtn) {
            this.closeSetupBtn.addEventListener('click', () => this.closeSetupWizard());
        }
        
        if (this.nextStepBtn) {
            this.nextStepBtn.addEventListener('click', () => this.nextStep());
        }
        
        if (this.prevStepBtn) {
            this.prevStepBtn.addEventListener('click', () => this.prevStep());
        }
        
        if (this.startBuildBtn) {
            this.startBuildBtn.addEventListener('click', () => this.startBuild());
        }
    }
    
    closeSetupWizard() {
        if (this.setupModal) {
            this.setupModal.style.display = 'none';
        }
    }
    
    nextStep() {
        // Find the active step
        const activeStep = document.querySelector('.setup-step.active');
        if (activeStep && activeStep.nextElementSibling && activeStep.nextElementSibling.classList.contains('setup-step')) {
            // Hide the active step
            activeStep.classList.remove('active');
            // Show the next step
            activeStep.nextElementSibling.classList.add('active');
        }
    }
    
    prevStep() {
        // Find the active step
        const activeStep = document.querySelector('.setup-step.active');
        if (activeStep && activeStep.previousElementSibling && activeStep.previousElementSibling.classList.contains('setup-step')) {
            // Hide the active step
            activeStep.classList.remove('active');
            // Show the previous step
            activeStep.previousElementSibling.classList.add('active');
        }
    }
    
    startBuild() {
        // Get the selected repository option
        let repoOption = 'clone';
        for (const option of this.repoOptions) {
            if (option.checked) {
                repoOption = option.value;
                break;
            }
        }
        
        // Get the build options
        const buildOptions = {
            cuda: this.cudaSupport ? this.cudaSupport.checked : false,
            opencl: this.openclSupport ? this.openclSupport.checked : false,
            metal: this.metalSupport ? this.metalSupport.checked : false
        };
        
        // Close the setup wizard
        this.closeSetupWizard();
        
        // Show the logs modal
        this.showLogsModal();
        
        // Start the build process
        if (repoOption === 'clone') {
            this.cloneRepository().then(() => {
                this.buildProject(buildOptions);
            }).catch(error => {
                this.appendLog(`Error cloning repository: ${error.message}`);
            });
        } else {
            this.buildProject(buildOptions);
        }
    }
    
    async cloneRepository() {
        this.appendLog('Cloning ik_llama.cpp repository...');
        try {
            const response = await fetch('/api/clone-repository', {
                method: 'POST'
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to clone repository');
            }
            
            const result = await response.json();
            this.appendLog(result.message || 'Repository cloned successfully');
            return result;
        } catch (error) {
            this.appendLog(`Error: ${error.message}`);
            throw error;
        }
    }
    
    async buildProject(options) {
        this.appendLog('Building ik_llama.cpp...');
        this.appendLog(`Build options: ${JSON.stringify(options)}`);
        
        try {
            const response = await fetch('/api/build-project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(options)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to build project');
            }
            
            const result = await response.json();
            this.appendLog(result.message || 'Project built successfully');
            
            // Update the build status
            this.updateBuildStatus();
            
            return result;
        } catch (error) {
            this.appendLog(`Error: ${error.message}`);
            throw error;
        }
    }
    
    showLogsModal() {
        const logsModal = document.getElementById('logs-modal');
        if (logsModal) {
            logsModal.style.display = 'flex';
            this.loadLogs();
        }
    }
    
    closeLogsModal() {
        const logsModal = document.getElementById('logs-modal');
        if (logsModal) {
            logsModal.style.display = 'none';
        }
    }
    
    async loadLogs() {
        try {
            const response = await fetch('/api/build-status');
            if (!response.ok) {
                throw new Error('Failed to get build logs');
            }
            
            const data = await response.json();
            const logsContent = document.getElementById('logs-content');
            
            if (logsContent) {
                if (data.log && data.log.trim() !== '') {
                    logsContent.textContent = data.log;
                } else {
                    logsContent.textContent = 'No logs available';
                }
            }
        } catch (error) {
            console.error('Error loading logs:', error);
            const logsContent = document.getElementById('logs-content');
            if (logsContent) {
                logsContent.textContent = 'Error loading logs: ' + error.message;
            }
        }
    }
    
    async clearLogs() {
        try {
            const response = await fetch('/api/clear-logs', {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error('Failed to clear logs');
            }
            
            const logsContent = document.getElementById('logs-content');
            if (logsContent) {
                logsContent.textContent = 'Logs cleared';
            }
        } catch (error) {
            console.error('Error clearing logs:', error);
            alert('Error clearing logs: ' + error.message);
        }
    }
    
    downloadLogs() {
        const logsContent = document.getElementById('logs-content');
        if (!logsContent || logsContent.textContent === 'No logs available') {
            alert('No logs available to download');
            return;
        }
        
        const blob = new Blob([logsContent.textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ik_llama_build_log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    appendLog(message) {
        const logsContent = document.getElementById('logs-content');
        if (logsContent) {
            const logLine = document.createElement('div');
            logLine.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logsContent.appendChild(logLine);
            logsContent.scrollTop = logsContent.scrollHeight;
        }
    }
    
    async updateBuildStatus() {
        try {
            const response = await fetch('/api/build-status');
            if (!response.ok) {
                throw new Error('Failed to get build status');
            }
            
            const status = await response.json();
            const buildStatusElement = document.getElementById('build-status');
            
            if (buildStatusElement) {
                buildStatusElement.textContent = status.status || 'Unknown';
                buildStatusElement.className = `status-indicator ${status.status.toLowerCase()}`;
            }
        } catch (error) {
            console.error('Error updating build status:', error);
        }
    }

    loadConfig() {
        // Load configuration from localStorage
        try {
            const savedConfig = localStorage.getItem('ik_llama_config');
            if (savedConfig) {
                return JSON.parse(savedConfig);
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
        }
        
        // Return default configuration
        return {
            model_path: '',
            context_size: 2048,
            max_tokens: 512,
            system_prompt: '',
            temperature: 0.8,
            top_p: 0.95,
            top_k: 40,
            repeat_penalty: 1.1,
            cpu_threads: 8,
            gpu_layers: 0,
            kv_cache_type: 'f16',
            multi_layer_attention: false,
            attention_max_batch: 512,
            flash_attention: false,
            fused_moe: false,
            smart_expert_reduction: false,
            runtime_tensor_repacking: false
        };
    }

    saveConfig() {
        // Save current configuration to localStorage
        try {
            const config = this.getConfiguration();
            localStorage.setItem('ik_llama_config', JSON.stringify(config));
        } catch (error) {
            console.error('Error saving configuration:', error);
        }
    }

    getConfiguration() {
        // Get model path from dropdown or custom input
        const modelPath = this.modelPath ? this.modelPath.value : '';
            
        return {
            model_path: modelPath,
            context_size: this.contextSize ? parseInt(this.contextSize.value) : 2048,
            max_tokens: this.maxTokens ? parseInt(this.maxTokens.value) : 512,
            system_prompt: this.systemPrompt ? this.systemPrompt.value : '',
            temperature: this.temperature ? parseFloat(this.temperature.value) : 0.8,
            top_p: this.topP ? parseFloat(this.topP.value) : 0.95,
            top_k: this.topK ? parseInt(this.topK.value) : 40,
            repeat_penalty: this.repeatPenalty ? parseFloat(this.repeatPenalty.value) : 1.1,
            
            // Hardware configuration
            cpu_threads: this.cpuThreads ? parseInt(this.cpuThreads.value) : 8,
            gpu_layers: this.gpuLayers ? parseInt(this.gpuLayers.value) : 0,
            
            // ik_llama.cpp specific parameters
            kv_cache_type: this.kvCacheType ? this.kvCacheType.value : 'f16',
            multi_layer_attention: this.multiLayerAttention ? this.multiLayerAttention.checked : false,
            attention_max_batch: this.attentionMaxBatch ? parseInt(this.attentionMaxBatch.value) : 512,
            flash_attention: this.flashAttention ? this.flashAttention.checked : false,
            fused_moe: this.fusedMoe ? this.fusedMoe.checked : false,
            smart_expert_reduction: this.smartExpertReduction ? this.smartExpertReduction.checked : false,
            runtime_tensor_repacking: this.runtimeTensorRepacking ? this.runtimeTensorRepacking.checked : false
        };
    }
}

// Add notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new IkLlamaDashboard();
});