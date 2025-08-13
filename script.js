// Centralized Chat State Management
class ChatState {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.isGenerating = false;
        this.isStreaming = false;
        this.isModelLoaded = false;
        this.isServerRunning = false;
        this.currentAbortController = null;
        this.loadingStates = {
            model: false,
            build: false,
            status: false
        };
    }

    // Central method to update chat input state
    updateChatInputState() {
        const canChat = this.isServerRunning && this.isModelLoaded && !this.isGenerating && !this.loadingStates.model;
        
        if (this.dashboard.userInput) {
            this.dashboard.userInput.disabled = !canChat;
            
            if (!this.isServerRunning) {
                this.dashboard.userInput.placeholder = 'Server not running...';
            } else if (!this.isModelLoaded) {
                this.dashboard.userInput.placeholder = this.loadingStates.model ? 'Loading model...' : 'No model loaded...';
            } else if (this.isGenerating) {
                this.dashboard.userInput.placeholder = 'Generating response...';
            } else {
                this.dashboard.userInput.placeholder = 'Type your message...';
            }
        }
        
        if (this.dashboard.sendMessageBtn) {
            this.dashboard.sendMessageBtn.disabled = !canChat;
        }
    }

    // Set server status
    setServerStatus(isRunning) {
        this.isServerRunning = isRunning;
        this.updateChatInputState();
    }

    // Set model status
    setModelStatus(isLoaded) {
        this.isModelLoaded = isLoaded;
        this.updateChatInputState();
    }

    // Set generation state
    setGenerating(isGenerating) {
        this.isGenerating = isGenerating;
        this.updateChatInputState();
        
        // Show/hide stop button
        if (this.dashboard.stopGenerationBtn) {
            this.dashboard.stopGenerationBtn.style.display = isGenerating ? 'block' : 'none';
        }
        
        // Pause/resume status updates during generation
        if (isGenerating) {
            this.dashboard.pauseStatusUpdates();
        } else {
            this.dashboard.resumeStatusUpdates();
        }
    }

    // Set streaming state
    setStreaming(isStreaming, abortController = null) {
        this.isStreaming = isStreaming;
        this.currentAbortController = abortController;
        this.updateChatInputState();
    }

    // Set loading state for specific operations
    setLoadingState(operation, isLoading) {
        this.loadingStates[operation] = isLoading;
        this.updateChatInputState();
    }

    // Stop current stream if active
    stopCurrentStream() {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
        this.setStreaming(false);
        this.setGenerating(false);
    }

    // Check if a specific operation is loading
    isLoading(operation) {
        return this.loadingStates[operation] || false;
    }

    // Get current state summary
    getState() {
        return {
            isGenerating: this.isGenerating,
            isStreaming: this.isStreaming,
            isModelLoaded: this.isModelLoaded,
            isServerRunning: this.isServerRunning,
            loadingStates: { ...this.loadingStates }
        };
    }
}

class IkLlamaDashboard {
    constructor() {
        this.config = {};
        this.buildEventSource = null;
        this.isBuildInProgress = false;
        this.conversationHistory = [];
        this.maxHistoryLength = 20;
        
        // Initialize centralized chat state
        this.chatState = new ChatState(this);
        
        this.init();
    }

    init() {
        this.initializeElements();
        this.loadConfig();
        this.setupEventListeners();
        this.loadInitialData();
        this.startStatusUpdates();
        this.setupTheme();
        // Load saved chat history at startup
        this.loadChatHistory();
    }

    initializeElements() {
        // Navigation Elements
        this.navItems = document.querySelectorAll('.nav-item');
        this.contentSections = document.querySelectorAll('.content-section');
        this.pageTitle = document.getElementById('page-title');
        
        // Status Elements
        this.statusDot = document.getElementById('status-dot');
        this.statusText = document.getElementById('status-text');
        this.repoStatusIcon = document.getElementById('repo-status-icon');
        this.repoStatusText = document.getElementById('repo-status-text');
        this.buildStatusIcon = document.getElementById('build-status-icon');
        this.buildStatusText = document.getElementById('build-status-text');
        this.modelStatusIcon = document.getElementById('model-status-icon');
        this.modelStatusText = document.getElementById('model-status-text');
        
        // Welcome Section Elements
        this.startSetupBtn = document.getElementById('start-setup');
        this.quickStartBtn = document.getElementById('quick-start');
        
        // Setup Section Elements
        this.setupSteps = document.querySelectorAll('.step');
        this.nextStep1Btn = document.getElementById('next-step-1');
        this.prevStep2Btn = document.getElementById('prev-step-2');
        this.nextStep2Btn = document.getElementById('next-step-2');
        this.prevStep3Btn = document.getElementById('prev-step-3');
        this.startBuildBtn = document.getElementById('start-build');
        // Version indicator (removed - not essential)
        this.versionStatus = document.getElementById('version-status');
        this.repoOptions = document.getElementsByName('repo-option');
        this.cudaSupport = document.getElementById('cuda-support');
        this.openclSupport = document.getElementById('opencl-support');
        this.metalSupport = document.getElementById('metal-support');
        this.summaryRepo = document.getElementById('summary-repo');
        this.summaryCuda = document.getElementById('summary-cuda');
        this.summaryOpencl = document.getElementById('summary-opencl');
        this.summaryMetal = document.getElementById('summary-metal');
        
        // Models Section Elements
        this.modelDropdown = document.getElementById('model-dropdown');
        this.modelPath = document.getElementById('model-path');
        this.browseModelBtn = document.getElementById('browse-model');
        this.scanModelsBtn = document.getElementById('scan-models');
        this.downloadModelBtn = document.getElementById('download-model');
        this.modelInfoCard = document.getElementById('model-info-card');
        this.modelName = document.getElementById('model-name');
        this.modelSize = document.getElementById('model-size');
        this.modelType = document.getElementById('model-type');
        this.modelQuant = document.getElementById('model-quant');
        this.loadModelBtn = document.getElementById('load-model');
        
        // Models Page Status Elements
        this.modelsPageStatusIcon = document.getElementById('models-page-status-icon');
        this.modelsPageStatusText = document.getElementById('models-page-status-text');
        this.modelsPageStatusDetails = document.getElementById('models-page-status-details');
        this.modelsPageLoading = document.getElementById('models-page-loading');
        this.refreshModelStatusBtn = document.getElementById('refresh-model-status');
        this.unloadModelBtn = document.getElementById('unload-model');
        this.forceUnloadModelBtn = document.getElementById('force-unload-model');
        

        
        // Chat Section Elements
        this.chatModelSelect = document.getElementById('chat-model-select');
        this.currentModelDisplay = document.getElementById('current-model-display');
        this.temperature = document.getElementById('temperature');
        this.tempValue = document.getElementById('temp-value');
        this.topP = document.getElementById('top-p');
        this.topPValue = document.getElementById('top-p-value');
        this.systemPrompt = document.getElementById('system-prompt');
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendMessageBtn = document.getElementById('send-message');
        this.clearChatBtn = document.getElementById('clear-chat');
        this.stopGenerationBtn = document.getElementById('stop-generation');

        // Benchmark Section Elements (removed - not implemented)
        
        // Settings Section Elements
        this.settingsTabs = document.querySelectorAll('.settings-tabs .tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');
        this.ctxSize = document.getElementById('ctx-size');
        this.nPredict = document.getElementById('n-predict');
        this.ctk = document.getElementById('ctk');
        this.topK = document.getElementById('top-k');
        this.mlaAttn = document.getElementById('mla-attn');
        this.amb = document.getElementById('amb');
        this.flashAttn = document.getElementById('flash-attn');
        this.fmoe = document.getElementById('fmoe');
        this.mmap = document.getElementById('mmap');
        this.threads = document.getElementById('threads');
        this.nGpuLayers = document.getElementById('n-gpu-layers');
        this.nGpuLayersValue = document.getElementById('n-gpu-layers-value');
        
        // Override Tensor Pattern Elements
        this.overrideTensorEnabled = document.getElementById('override-tensor-enabled');
        this.overrideTensorOptions = document.getElementById('override-tensor-options');
        this.tensorPatternExperts = document.getElementById('tensor-pattern-experts');
        this.tensorPatternCustom = document.getElementById('tensor-pattern-custom');
        this.customTensorPattern = document.getElementById('custom-tensor-pattern');
        
        this.resetSettingsBtn = document.getElementById('reset-settings');
        this.saveSettingsBtn = document.getElementById('save-settings');
        
        // Logs Modal Elements
        this.viewLogsBtn = document.getElementById('view-logs');
        this.logsModal = document.getElementById('logs-modal');
        this.closeLogsBtn = document.getElementById('close-logs');
        this.logsContent = document.getElementById('logs-content');
        this.clearLogsBtn = document.getElementById('clear-logs');
        this.downloadLogsBtn = document.getElementById('download-logs');
        
        // Theme Elements
        this.themeToggle = document.getElementById('theme-toggle');
        
        // Setup range displays
        this.setupRangeDisplays();
    }

    setupRangeDisplays() {
        const ranges = [
            { input: this.temperature, display: this.tempValue },
            { input: this.topP, display: this.topPValue },
            { input: this.nGpuLayers, display: this.nGpuLayersValue }
        ];

        ranges.forEach(({ input, display }) => {
            if (input && display) {
                // Set initial value
                display.textContent = input.value;
                
                // Update on input change
                input.addEventListener('input', () => {
                    display.textContent = input.value;
                });
            }
        });
    }

    setupEventListeners() {
        // Navigation
        this.navItems.forEach(item => {
            item.addEventListener('click', () => {
                this.navigateTo(item.dataset.section);
            });
        });
        
        // Welcome Section
        if (this.startSetupBtn) {
            this.startSetupBtn.addEventListener('click', () => {
                this.navigateTo('setup');
            });
        }
        
        // Setup Section
        if (this.nextStep1Btn) {
            this.nextStep1Btn.addEventListener('click', () => {
                this.goToStep(2);
            });
        }
        
        if (this.prevStep2Btn) {
            this.prevStep2Btn.addEventListener('click', () => {
                this.goToStep(1);
            });
        }
        
        if (this.nextStep2Btn) {
            this.nextStep2Btn.addEventListener('click', () => {
                this.updateBuildSummary();
                this.goToStep(3);
            });
        }
        
        if (this.prevStep3Btn) {
            this.prevStep3Btn.addEventListener('click', () => {
                this.goToStep(2);
            });
        }
        
        if (this.startBuildBtn) {
            this.startBuildBtn.addEventListener('click', () => {
                this.startBuild();
            });
        }
        
        // Update build summary when options change
        if (this.repoOptions) {
            this.repoOptions.forEach(option => {
                option.addEventListener('change', () => {
                    this.updateBuildSummary();
                });
            });
        }
        
        if (this.cudaSupport) {
            this.cudaSupport.addEventListener('change', () => {
                this.updateBuildSummary();
            });
        }
        
        if (this.openclSupport) {
            this.openclSupport.addEventListener('change', () => {
                this.updateBuildSummary();
            });
        }
        
        if (this.metalSupport) {
            this.metalSupport.addEventListener('change', () => {
                this.updateBuildSummary();
            });
        }
        
        // Models Section
        if (this.scanModelsBtn) {
            this.scanModelsBtn.addEventListener('click', () => {
                this.scanForModels();
            });
        }
        
        if (this.modelDropdown) {
            this.modelDropdown.addEventListener('change', () => {
                this.updateModelInfo();
            });
        }
        
        if (this.loadModelBtn) {
            this.loadModelBtn.addEventListener('click', () => {
                this.loadModel();
            });
        }
        
        // Models Page Status Buttons
        if (this.refreshModelStatusBtn) {
            this.refreshModelStatusBtn.addEventListener('click', () => {
                this.refreshModelStatus();
            });
        }
        
        if (this.unloadModelBtn) {
            this.unloadModelBtn.addEventListener('click', () => {
                this.unloadModel();
            });
        }
        
        if (this.forceUnloadModelBtn) {
            this.forceUnloadModelBtn.addEventListener('click', () => {
                this.forceUnloadModel();
            });
        }
        

        
        // Settings Section
        this.settingsTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchSettingsTab(tab.dataset.tab);
            });
        });
        
        if (this.saveSettingsBtn) {
            this.saveSettingsBtn.addEventListener('click', () => {
                this.saveSettings();
            });
        }
        
        if (this.resetSettingsBtn) {
            this.resetSettingsBtn.addEventListener('click', () => {
                this.resetSettings();
            });
        }
        
        // Logs Modal
        if (this.viewLogsBtn) {
            this.viewLogsBtn.addEventListener('click', () => {
                this.showLogsModal();
            });
        }
        
        if (this.closeLogsBtn) {
            this.closeLogsBtn.addEventListener('click', () => {
                this.closeLogsModal();
            });
        }
        
        if (this.clearLogsBtn) {
            this.clearLogsBtn.addEventListener('click', () => {
                this.clearLogs();
            });
        }
        
        if (this.downloadLogsBtn) {
            this.downloadLogsBtn.addEventListener('click', () => {
                this.downloadLogs();
            });
        }
        
        // Chat Section
        if (this.sendMessageBtn) {
            this.sendMessageBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }
        
        if (this.stopGenerationBtn) {
            this.stopGenerationBtn.addEventListener('click', () => {
                this.stopGeneration();
            });
        }
        
        if (this.clearChatBtn) {
            this.clearChatBtn.addEventListener('click', () => {
                this.clearChatWithConfirmation();
            });
        }
        
        if (this.userInput) {
            this.userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
        
        if (this.clearChatBtn) {
            this.clearChatBtn.addEventListener('click', () => {
                this.clearConversation();
            });
        }
        
        // Theme Toggle
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
        
        // Override Tensor Pattern
        if (this.overrideTensorEnabled) {
            this.overrideTensorEnabled.addEventListener('change', () => {
                this.toggleOverrideTensorOptions();
            });
        }
        
        if (this.tensorPatternCustom) {
            this.tensorPatternCustom.addEventListener('change', () => {
                this.toggleCustomTensorInput();
            });
        }
    }

    // Centralized API call helper method
    async apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(endpoint, options);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error calling ${endpoint}:`, error);
            throw error;
        }
    }

    navigateTo(section) {
        // Update navigation items
        this.navItems.forEach(item => {
            if (item.dataset.section === section) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // Update content sections
        this.contentSections.forEach(content => {
            if (content.id === `${section}-section`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
        
        // Update page title
        if (this.pageTitle) {
            this.pageTitle.textContent = section.charAt(0).toUpperCase() + section.slice(1);
        }
    }

    goToStep(stepNumber) {
        this.setupSteps.forEach((step, index) => {
            if (index + 1 === stepNumber) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
    }

    updateBuildSummary() {
        // Update repository option
        let repoOption = 'Clone fresh repository';
        this.repoOptions.forEach(option => {
            if (option.checked && option.value === 'existing') {
                repoOption = 'Use existing repository';
            }
        });
        
        if (this.summaryRepo) {
            this.summaryRepo.textContent = repoOption;
        }
        
        // Update CUDA support
        if (this.summaryCuda) {
            this.summaryCuda.textContent = this.cudaSupport && this.cudaSupport.checked ? 'Enabled' : 'Disabled';
        }
        
        // Update OpenCL support
        if (this.summaryOpencl) {
            this.summaryOpencl.textContent = this.openclSupport && this.openclSupport.checked ? 'Enabled' : 'Disabled';
        }
        
        // Update Metal support
        if (this.summaryMetal) {
            this.summaryMetal.textContent = this.metalSupport && this.metalSupport.checked ? 'Enabled' : 'Disabled';
        }
    }

    startBuild() {
        // Get build options
        const repoOption = Array.from(this.repoOptions).find(option => option.checked)?.value || 'clone';
        const cudaEnabled = this.cudaSupport && this.cudaSupport.checked;
        const openclEnabled = this.openclSupport && this.openclSupport.checked;
        const metalEnabled = this.metalSupport && this.metalSupport.checked;
        
        // Update UI to show build in progress
        if (this.buildStatusIcon) {
            this.buildStatusIcon.textContent = '🔄';
        }
        
        if (this.buildStatusText) {
            this.buildStatusText.textContent = 'Building...';
        }
        
        // Disable start build button
        if (this.startBuildBtn) {
            this.startBuildBtn.disabled = true;
            this.startBuildBtn.textContent = 'Building...';
        }
        
        // Directly start the SSE stream (no need for the /api/build endpoint anymore)
        this.startBuildStream();
    }

    startBuildStream() {
        if (this.buildEventSource) {
            this.buildEventSource.close();
        }

        // Get build options
        const repoOption = Array.from(this.repoOptions).find(option => option.checked)?.value || 'clone';
        const buildOptions = {
            repo_option: repoOption,
            cuda_support: document.getElementById('cuda-support').checked,
            opencl_support: document.getElementById('opencl-support').checked,
            metal_support: document.getElementById('metal-support').checked
        };

        // Show progress section (using main build-progress section)
        const progressSection = document.getElementById('build-progress');
        const progressBar = document.getElementById('progress-fill');
        const progressPercent = document.getElementById('progress-percentage');
        const progressStatus = document.getElementById('progress-status');
        const cancelBtn = document.getElementById('cancel-build');
        const viewLogsBtn = document.getElementById('view-logs');

        if (progressSection) {
            progressSection.style.display = 'block';
        }
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        if (progressPercent) {
            progressPercent.textContent = '0%';
        }
        if (progressStatus) {
            progressStatus.textContent = 'Initializing...';
        }
        if (cancelBtn) {
            cancelBtn.style.display = 'inline-block';
        }
        if (viewLogsBtn) {
            viewLogsBtn.style.display = 'none';
        }
        
        this.isBuildInProgress = true;

        // Create EventSource for SSE with build options as query parameters
        const params = new URLSearchParams(buildOptions);
        this.buildEventSource = new EventSource(`/api/build-stream?${params}`);

        this.buildEventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.updateBuildProgress(data);
            } catch (error) {
                console.error('Error parsing SSE data:', error);
            }
        };

        this.buildEventSource.onerror = (event) => {
            console.error('SSE connection error:', event);
            if (this.isBuildInProgress) {
                alert('Connection to build stream lost');
                this.finalizeBuildProgress('error', 'Connection lost');
            }
        };
    }

    updateBuildProgress(data) {
        const progressBar = document.getElementById('progress-fill');
        const progressPercent = document.getElementById('progress-percentage');
        const progressStatus = document.getElementById('progress-status');

        // Update progress bar
        if (progressBar) {
            progressBar.style.width = `${data.progress}%`;
        }
        if (progressPercent) {
            progressPercent.textContent = `${data.progress}%`;
        }
        if (progressStatus) {
            progressStatus.textContent = data.message;
        }

        // Update progress bar color based on status
        if (progressBar) {
            progressBar.className = 'progress-bar';
            if (data.status === 'error') {
                progressBar.classList.add('error');
            } else if (data.status === 'success') {
                progressBar.classList.add('success');
            } else if (data.status === 'cloning') {
                progressBar.classList.add('cloning');
            } else if (data.status === 'configuring') {
                progressBar.classList.add('configuring');
            } else if (data.status === 'building') {
                progressBar.classList.add('building');
            }
        }

        // Handle completion
        if (data.status === 'success' || data.status === 'error') {
            this.finalizeBuildProgress(data.status, data.message);
        }
    }

    finalizeBuildProgress(status, message) {
        this.isBuildInProgress = false;
        
        const cancelBtn = document.getElementById('cancel-build');
        const viewLogsBtn = document.getElementById('view-logs');
        
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }
        if (viewLogsBtn) {
            viewLogsBtn.style.display = 'inline-block';
        }

        if (this.buildEventSource) {
            this.buildEventSource.close();
            this.buildEventSource = null;
        }

        // Show notification
        if (status === 'success') {
            alert('Build completed successfully!');
            // Refresh status after successful build
            setTimeout(() => {
                this.checkRepoStatus();
            }, 1000);
        } else {
            alert(`Build failed: ${message}`);
        }
        
        // Re-enable start build button
        if (this.startBuildBtn) {
            this.startBuildBtn.disabled = false;
            this.startBuildBtn.textContent = 'Start Build';
        }
    }

    cancelBuild() {
        if (this.buildEventSource) {
            this.buildEventSource.close();
            this.buildEventSource = null;
        }
        
        this.isBuildInProgress = false;
        
        // Hide progress section (using main build-progress section)
        const progressSection = document.getElementById('build-progress');
        if (progressSection) {
            progressSection.style.display = 'none';
        }
        
        alert('Build cancelled');
        
        // Re-enable start build button
        if (this.startBuildBtn) {
            this.startBuildBtn.disabled = false;
            this.startBuildBtn.textContent = 'Start Build';
        }
    }

    viewBuildLogs() {
        this.showLogsModal();
    }

    async scanForModels() {
        if (this.modelDropdown) {
            // Clear current options
            this.modelDropdown.innerHTML = '<option value="">Scanning...</option>';
            
            try {
                const data = await this.apiCall('/api/discover_models');
                
                // Clear scanning option
                this.modelDropdown.innerHTML = '';
                
                // Add default option
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Select a model...';
                this.modelDropdown.appendChild(defaultOption);
                
                // Add models to dropdown
                if (data.models && data.models.length > 0) {
                    data.models.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.path;
                        option.textContent = model.display_name || model.name;
                        option.dataset.size = model.size;
                        option.dataset.type = model.type;
                        option.dataset.quant = model.quantization;
                        this.modelDropdown.appendChild(option);
                    });
                } else {
                    const noModelsOption = document.createElement('option');
                    noModelsOption.value = '';
                    noModelsOption.textContent = 'No models found';
                    noModelsOption.disabled = true;
                    this.modelDropdown.appendChild(noModelsOption);
                }
            } catch (error) {
                this.modelDropdown.innerHTML = '<option value="">Error scanning models</option>';
            }
        }
    }

    updateModelInfo() {
        if (this.modelDropdown && this.modelDropdown.value) {
            const selectedOption = this.modelDropdown.options[this.modelDropdown.selectedIndex];
            
            // Update model info
            if (this.modelName) {
                this.modelName.textContent = selectedOption.textContent;
            }
            
            if (this.modelSize) {
                this.modelSize.textContent = selectedOption.dataset.size || 'Unknown';
            }
            
            if (this.modelType) {
                this.modelType.textContent = selectedOption.dataset.type || 'Unknown';
            }
            
            if (this.modelQuant) {
                this.modelQuant.textContent = selectedOption.dataset.quant || 'Unknown';
            }
            
            // Show model info card
            if (this.modelInfoCard) {
                this.modelInfoCard.style.display = 'block';
            }
        } else {
            // Hide model info card if no model selected
            if (this.modelInfoCard) {
                this.modelInfoCard.style.display = 'none';
            }
        }
    }

    // Update chat model dropdown with currently loaded model
    updateChatModelDisplay(modelName = null) {
        if (this.chatModelSelect) {
            // Clear existing options
            this.chatModelSelect.innerHTML = '';
            
            if (modelName) {
                // Add the loaded model as an option
                const option = document.createElement('option');
                option.value = modelName;
                option.textContent = modelName;
                option.selected = true;
                this.chatModelSelect.appendChild(option);
            } else {
                // No model loaded
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'No model selected';
                this.chatModelSelect.appendChild(defaultOption);
            }
        }
    }

    loadModel() {
        const modelPath = this.modelDropdown.value || this.modelPath.value;
        
        if (!modelPath) {
            alert('Please select or enter a model path');
            return;
        }
        
        // Use centralized state management
        this.chatState.setLoadingState('model', true);
        this.chatState.setModelStatus(false);
        
        // Disable load button
        if (this.loadModelBtn) {
            this.loadModelBtn.disabled = true;
            this.loadModelBtn.textContent = 'Loading...';
        }
        
        // Update model status to loading
        if (this.modelStatusIcon) {
            this.modelStatusIcon.textContent = '⏳';
        }
        
        if (this.modelStatusText) {
            this.modelStatusText.textContent = 'Loading model...';
        }
        
        // Get configuration
        const config = this.getConfig();
        
        // First, check llama-server version
        fetch('/api/version')
        .then(response => response.json())
        .then(versionData => {
            console.log('llama-server version check:', versionData);
            if (!versionData.success) {
                throw new Error(`Version check failed: ${versionData.error}`);
            }
            
            // Save the config for the stream endpoint
            return fetch('/api/load_model', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model_path: modelPath,
                    config: config
                })
            });
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Start streaming the loading progress
                this.startModelLoadingStream(modelPath);
            } else {
                throw new Error(data.error || 'Failed to start model loading');
            }
        })
        .catch(error => {
            console.error('Error starting model load:', error);
            this.finalizeModelLoadingProgress(false, error.message);
        });
    }

    startModelLoadingStream(modelPath) {
        // Create progress display similar to build progress
        this.showModelLoadingProgress();
        
        const eventSource = new EventSource('/api/load_model_stream');
        let isCompleted = false;  // Track if we've received a completion status
        let hasReceivedData = false;  // Track if we've received any data
        
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Model loading progress:', data);
                hasReceivedData = true;
                
                // Update progress display
                this.updateModelLoadingProgress(data);
                
                if (data.status === 'success') {
                    isCompleted = true;
                    eventSource.close();
                    this.finalizeModelLoadingProgress(true, 'Model loaded successfully');
                } else if (data.status === 'error') {
                    isCompleted = true;
                    eventSource.close();
                    this.finalizeModelLoadingProgress(false, data.message);
                }
            } catch (error) {
                console.error('Error parsing model loading progress:', error);
            }
        };
        
        eventSource.onerror = (error) => {
            console.error('Model loading stream error:', error);
            
            // Don't immediately show error - the stream often closes after successful completion
            if (!isCompleted) {
                console.log('Stream connection closed, checking if model loaded successfully...');
                eventSource.close();
                
                // Always check server status instead of assuming error
                // Increased delay to allow backend to complete processing
                setTimeout(() => {
                    if (!isCompleted) {
                        this.checkModelLoadingStatus();
                    }
                }, 2000);
            } else {
                // If already completed, just close silently
                eventSource.close();
            }
        };
        
        // Add timeout fallback in case stream never completes
        setTimeout(() => {
            if (!isCompleted) {
                console.log('Model loading stream timeout, checking server status...');
                eventSource.close();
                this.checkModelLoadingStatus();
            }
        }, 120000); // 2 minute timeout
    }
    
    async checkModelLoadingStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            if (data.server_running && data.model_loaded) {
                // Model actually loaded successfully despite stream issues
                this.finalizeModelLoadingProgress(true, 'Model loaded successfully');
            } else {
                // Model really failed to load
                this.finalizeModelLoadingProgress(false, 'Model loading failed');
            }
        } catch (error) {
            console.error('Error checking model status:', error);
            this.finalizeModelLoadingProgress(false, 'Unable to verify model status');
        }
    }

    showModelLoadingProgress() {
        // Create or show progress modal similar to build progress
        let progressModal = document.getElementById('model-loading-progress-modal');
        if (!progressModal) {
            progressModal = document.createElement('div');
            progressModal.id = 'model-loading-progress-modal';
            progressModal.className = 'modal active';
            progressModal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Loading Model</h3>
                        <button class="close-button" onclick="document.getElementById('model-loading-progress-modal').classList.remove('active')">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" id="model-loading-progress-fill"></div>
                            </div>
                            <div class="progress-text" id="model-loading-progress-text">Starting model loading...</div>
                        </div>
                        <div class="progress-log" id="model-loading-progress-log"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(progressModal);
        } else {
            progressModal.classList.add('active');
            // Reset progress
            const progressFill = document.getElementById('model-loading-progress-fill');
            const progressText = document.getElementById('model-loading-progress-text');
            const progressLog = document.getElementById('model-loading-progress-log');
            if (progressFill) progressFill.style.width = '0%';
            if (progressText) progressText.textContent = 'Starting model loading...';
            if (progressLog) progressLog.innerHTML = '';
        }
    }

    updateModelLoadingProgress(data) {
        const progressFill = document.getElementById('model-loading-progress-fill');
        const progressText = document.getElementById('model-loading-progress-text');
        const progressLog = document.getElementById('model-loading-progress-log');
        
        if (progressFill && data.progress !== undefined) {
            progressFill.style.width = `${data.progress}%`;
        }
        
        if (progressText && data.message) {
            progressText.textContent = data.message;
        }
        
        if (progressLog && data.message) {
            const logEntry = document.createElement('div');
            logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${data.message}`;
            if (data.status === 'error') {
                logEntry.style.color = '#ff6b6b';
            }
            progressLog.appendChild(logEntry);
            // Auto-scroll to bottom
            progressLog.scrollTop = progressLog.scrollHeight;
        }
    }

    async finalizeModelLoadingProgress(success, message) {
        const progressModal = document.getElementById('model-loading-progress-modal');
        
        // Update centralized state
        this.chatState.setLoadingState('model', false);
        
        if (success) {
            // Verify server status before updating UI
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                
                if (data.server_running && data.model_loaded) {
                    // Use centralized state management
                    this.chatState.setServerStatus(true);
                    this.chatState.setModelStatus(true);
                    
                    // Update model status only after verification
                    if (this.modelStatusIcon) {
                        this.modelStatusIcon.textContent = '✅';
                    }
                    
                    if (this.modelStatusText) {
                        this.modelStatusText.textContent = data.model_name || 'Model loaded';
                    }
                    
                    // Update chat model dropdown with loaded model
                    this.updateChatModelDisplay(data.model_name || 'Model loaded');
                    
                    // Remove auto-navigation - let user decide when to go to chat
                    // this.navigateTo('chat');
                    
                    // Hide progress modal after verification
                    setTimeout(() => {
                        if (progressModal) {
                            progressModal.classList.remove('active');
                        }
                    }, 2000);
                } else {
                    // Server verification failed
                    throw new Error('Server verification failed - model may not be ready');
                }
            } catch (error) {
                console.error('Server verification failed:', error);
                
                // Use centralized state management for error state
                this.chatState.setServerStatus(false);
                this.chatState.setModelStatus(false);
                
                // Update status to show verification failed
                if (this.modelStatusIcon) {
                    this.modelStatusIcon.textContent = '⚠️';
                }
                
                if (this.modelStatusText) {
                    this.modelStatusText.textContent = 'Verification failed';
                }
                
                // Show error in progress modal
                const progressText = document.getElementById('model-loading-progress-text');
                if (progressText) {
                    progressText.textContent = `Verification failed: ${error.message}`;
                    progressText.style.color = '#ff6b6b';
                }
            }
        } else {
            // Use centralized state management for error state
            this.chatState.setServerStatus(false);
            this.chatState.setModelStatus(false);
            
            // Update model status to error
            if (this.modelStatusIcon) {
                this.modelStatusIcon.textContent = '❌';
            }
            
            if (this.modelStatusText) {
                this.modelStatusText.textContent = 'Model loading failed';
            }
            
            console.error('Model loading failed:', message);
            
            // Keep progress modal open to show error
            const progressText = document.getElementById('model-loading-progress-text');
            if (progressText) {
                progressText.textContent = `Error: ${message}`;
                progressText.style.color = '#ff6b6b';
            }
        }
        
        // Re-enable load button
        if (this.loadModelBtn) {
            this.loadModelBtn.disabled = false;
            this.loadModelBtn.textContent = 'Load Model';
        }
    }

    switchSettingsTab(tabName) {
        // Update tab buttons
        this.settingsTabs.forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Update tab content
        this.tabContents.forEach(content => {
            if (content.id === `${tabName}-tab`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    }

    getConfig() {
        return {
            // Basic settings
            ctx_size: parseInt(this.ctxSize?.value || 4096),
            n_predict: parseInt(this.nPredict?.value || 512),
            temperature: parseFloat(this.temperature?.value || 0.8),
            top_p: parseFloat(this.topP?.value || 0.95),
            system_prompt: this.systemPrompt?.value || '',
            
            // Advanced settings
            ctk: this.ctk?.value || 'f16',
            top_k: parseInt(this.topK?.value || 40),
            mla: parseInt(this.mlaAttn?.value || 0),
            amb: parseInt(this.amb?.value || 0),
            flash_attn: this.flashAttn?.checked || false,
            fmoe: this.fmoe?.checked || false,
            mmap: this.mmap?.checked !== false, // Default to true (enabled)
            
            // Hardware settings
            threads: parseInt(this.threads?.value || 8),
            n_gpu_layers: parseInt(this.nGpuLayers?.value || 0),
            override_tensor: this.getOverrideTensorValue()
        };
    }

    saveSettings() {
        const config = this.getConfig();
        
        // Add MOE experts GPU offset to config
        if (this.moeExpertsGpuOffset) {
            config.moe_experts_gpu_offset = parseInt(this.moeExpertsGpuOffset.value) || 0;
        }
        
        // Save to localStorage
        localStorage.setItem('ik_llama_config', JSON.stringify(config));
        
        // Show confirmation
        alert('Settings saved successfully!');
    }

    resetSettings() {
        // Default settings
        const defaultConfig = {
            ctx_size: 4096,
            n_predict: 512,
            temperature: 0.8,
            top_p: 0.95,
            system_prompt: '',
            ctk: 'f16',
            top_k: 40,
            mla: 0,
            amb: 0,
            flash_attn: false,
            fmoe: false,
            mmap: true,
            threads: 8,
            n_gpu_layers: 0
        };
        
        // Update UI with default values
        if (this.ctxSize) this.ctxSize.value = defaultConfig.ctx_size;
        if (this.nPredict) this.nPredict.value = defaultConfig.n_predict;
        if (this.temperature) this.temperature.value = defaultConfig.temperature;
        if (this.tempValue) this.tempValue.textContent = defaultConfig.temperature;
        if (this.topP) this.topP.value = defaultConfig.top_p;
        if (this.topPValue) this.topPValue.textContent = defaultConfig.top_p;
        if (this.systemPrompt) this.systemPrompt.value = defaultConfig.system_prompt;
        if (this.ctk) this.ctk.value = defaultConfig.ctk;
        if (this.topK) this.topK.value = defaultConfig.top_k;
        if (this.mlaAttn) this.mlaAttn.value = defaultConfig.mla;
        if (this.amb) this.amb.value = defaultConfig.amb;
        if (this.flashAttn) this.flashAttn.checked = defaultConfig.flash_attn;
        if (this.fmoe) this.fmoe.checked = defaultConfig.fmoe;
        if (this.mmap) this.mmap.checked = defaultConfig.mmap;
        if (this.threads) this.threads.value = defaultConfig.threads;
        if (this.nGpuLayers) this.nGpuLayers.value = defaultConfig.n_gpu_layers;
        if (this.nGpuLayersValue) this.nGpuLayersValue.textContent = defaultConfig.n_gpu_layers;
        
        // Save to localStorage
        localStorage.setItem('ik_llama_config', JSON.stringify(defaultConfig));
        
        // Show confirmation
        alert('Settings reset to default values!');
    }

    loadConfig() {
        // Try to load from localStorage
        const savedConfig = localStorage.getItem('ik_llama_config');
        
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                
                // Update UI with saved values
                if (this.ctxSize) this.ctxSize.value = config.ctx_size || 4096;
                if (this.nPredict) this.nPredict.value = config.n_predict || 512;
                if (this.temperature) this.temperature.value = config.temperature || 0.8;
                if (this.tempValue) this.tempValue.textContent = config.temperature || 0.8;
                if (this.topP) this.topP.value = config.top_p || 0.95;
                if (this.topPValue) this.topPValue.textContent = config.top_p || 0.95;
                if (this.systemPrompt) this.systemPrompt.value = config.system_prompt || '';
                if (this.ctk) this.ctk.value = config.ctk || 'f16';
                if (this.topK) this.topK.value = config.top_k || 40;
                if (this.mlaAttn) this.mlaAttn.value = config.mla || 0;
                if (this.amb) this.amb.value = config.amb || 0;
                if (this.flashAttn) this.flashAttn.checked = config.flash_attn || false;
                if (this.fmoe) this.fmoe.checked = config.fmoe || false;
                if (this.mmap) this.mmap.checked = config.mmap !== false; // Default to true
                if (this.threads) this.threads.value = config.threads || 8;
                if (this.nGpuLayers) this.nGpuLayers.value = config.n_gpu_layers || 0;
                if (this.nGpuLayersValue) this.nGpuLayersValue.textContent = config.n_gpu_layers || 0;
                this.setOverrideTensorValue(config.override_tensor || '');
                
                return config;
            } catch (error) {
                console.error('Error loading config:', error);
                return {};
            }
        }
        
        return {};
    }

    showLogsModal() {
        if (this.logsModal) {
            this.logsModal.classList.add('active');
            this.loadLogs();
        }
    }

    closeLogsModal() {
        if (this.logsModal) {
            this.logsModal.classList.remove('active');
        }
    }

    loadLogs() {
        fetch('/api/build-status')
            .then(response => response.json())
            .then(data => {
                if (this.logsContent) {
                    if (data.log && data.log.length > 0) {
                        this.logsContent.textContent = data.log;
                    } else {
                        this.logsContent.textContent = 'No logs available';
                    }
                }
                
                // Auto-refresh logs if build is in progress
                if (data.status === 'In Progress') {
                    setTimeout(() => this.loadLogs(), 2000);
                }
            })
            .catch(error => {
                console.error('Error loading logs:', error);
                if (this.logsContent) {
                    this.logsContent.textContent = 'Error loading logs';
                }
            });
    }

    clearLogs() {
        fetch('/api/clear-logs', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            console.log('Logs cleared:', data);
            if (this.logsContent) {
                this.logsContent.textContent = 'Logs cleared';
            }
        })
        .catch(error => {
            console.error('Error clearing logs:', error);
            alert('Failed to clear logs');
        });
    }

    downloadLogs() {
        if (this.logsContent) {
            const logsText = this.logsContent.textContent;
            const blob = new Blob([logsText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ik_llama_build_logs.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    loadInitialData() {
        // Check repository status and initialize chat state
        this.checkRepoStatus();
        
        // Scan for models
        this.scanForModels();
        
        // Ensure chat input starts disabled until model status is confirmed
        this.initializeChatState();
    }
    
    initializeChatState() {
        // Initialize chat input state using centralized management
        this.chatState.updateChatInputState();
    }

    checkRepoStatus() {
        this.chatState.setLoadingState('status', true);
        
        fetch('/api/status')
            .then(response => response.json())
            .then(data => {
                // Update centralized state
                this.chatState.setServerStatus(data.server_running);
                this.chatState.setModelStatus(data.model_loaded && data.server_running);
                
                // Update repository status
                if (this.repoStatusIcon && this.repoStatusText) {
                    if (data.repo_exists) {
                        this.repoStatusIcon.textContent = '✅';
                        this.repoStatusText.textContent = 'Repository cloned';
                    } else {
                        this.repoStatusIcon.textContent = '❌';
                        this.repoStatusText.textContent = 'Repository not found';
                    }
                }
                
                // Update build status
                if (this.buildStatusIcon && this.buildStatusText) {
                    if (data.build_status === 'Success') {
                        this.buildStatusIcon.textContent = '✅';
                        this.buildStatusText.textContent = 'Build successful';
                    } else if (data.build_status === 'In Progress') {
                        this.buildStatusIcon.textContent = '🔄';
                        this.buildStatusText.textContent = 'Build in progress';
                    } else if (data.build_status === 'Failed') {
                        this.buildStatusIcon.textContent = '❌';
                        this.buildStatusText.textContent = 'Build failed - Click to view logs';
                        // Make the build status clickable to show logs
                        this.buildStatusIcon.style.cursor = 'pointer';
                        this.buildStatusText.style.cursor = 'pointer';
                        this.buildStatusIcon.onclick = () => this.showLogsModal();
                        this.buildStatusText.onclick = () => this.showLogsModal();
                    } else {
                        this.buildStatusIcon.textContent = '❓';
                        this.buildStatusText.textContent = 'Not built';
                        // Remove click handlers for non-failed states
                        this.buildStatusIcon.style.cursor = 'default';
                        this.buildStatusText.style.cursor = 'default';
                        this.buildStatusIcon.onclick = null;
                        this.buildStatusText.onclick = null;
                    }
                }
                
                // Update model status - but don't overwrite manual states
                if (this.modelStatusIcon && this.modelStatusText) {
                    const currentStatus = this.modelStatusText.textContent;
                    
                    // Don't overwrite loading states or verification failures
                    if (currentStatus === 'Loading model...' || 
                        currentStatus === 'Verification failed' ||
                        currentStatus === 'Model loading failed') {
                        console.log('Preserving current status:', currentStatus);
                        return; // Don't update during these states
                    }
                    
                    // Only update if the API status differs from current display
                    if (data.model_loaded && data.server_running) {
                        const newStatus = data.model_name || 'Model loaded';
                        if (currentStatus !== newStatus) {
                            this.modelStatusIcon.textContent = '✅';
                            this.modelStatusText.textContent = newStatus;
                            console.log('Updated status to:', newStatus);
                            
                            // Update chat model dropdown with loaded model
                            this.updateChatModelDisplay(newStatus);
                        }
                    } else {
                        if (currentStatus !== 'No model loaded') {
                            this.modelStatusIcon.textContent = '❓';
                            this.modelStatusText.textContent = 'No model loaded';
                            console.log('Updated status to: No model loaded');
                            
                            // Update chat model dropdown to show no model
                            this.updateChatModelDisplay(null);
                        }
                    }
                }
                
                // Update models page status display
                this.updateModelsPageStatus(data);
                
                // Update server status
                if (this.statusDot && this.statusText) {
                    if (data.server_running) {
                        this.statusDot.classList.add('online');
                        this.statusText.textContent = 'Online';
                    } else {
                        this.statusDot.classList.remove('online');
                        this.statusText.textContent = 'Offline';
                    }
                }
            })
            .catch(error => {
                console.error('Error checking status:', error);
                
                // Update centralized state on error
                this.chatState.setServerStatus(false);
                this.chatState.setModelStatus(false);
                
                // Update status to show error
                if (this.statusDot && this.statusText) {
                    this.statusDot.classList.add('error');
                    this.statusText.textContent = 'Error';
                }
                
                // Update models page status to show error
                this.updateModelsPageStatus(null, 'Error checking status');
            })
            .finally(() => {
                this.chatState.setLoadingState('status', false);
            });
    }

    startStatusUpdates() {
        // Check status every 10 seconds instead of 5 to reduce API calls
        this.statusInterval = setInterval(() => {
            // Only check status if not currently streaming or loading
            if (!this.chatState.isStreaming && !this.chatState.isLoading('model')) {
                this.checkRepoStatus();
            }
        }, 10000);
    }

    pauseStatusUpdates() {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
        }
    }

    resumeStatusUpdates() {
        if (!this.statusInterval) {
            this.startStatusUpdates();
        }
    }
    


    setupTheme() {
        // Check for saved theme preference
        const savedTheme = localStorage.getItem('ik_llama_theme');
        
        if (savedTheme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            if (this.themeToggle) {
                this.themeToggle.textContent = '☀️';
            }
        } else {
            document.body.removeAttribute('data-theme');
            if (this.themeToggle) {
                this.themeToggle.textContent = '🌙';
            }
        }
    }

    toggleTheme() {
        if (document.body.getAttribute('data-theme') === 'dark') {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('ik_llama_theme', 'light');
            if (this.themeToggle) {
                this.themeToggle.textContent = '🌙';
            }
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('ik_llama_theme', 'dark');
            if (this.themeToggle) {
                this.themeToggle.textContent = '☀️';
            }
        }
    }
    
    toggleOverrideTensorOptions() {
        if (this.overrideTensorEnabled && this.overrideTensorOptions) {
            if (this.overrideTensorEnabled.checked) {
                this.overrideTensorOptions.style.display = 'block';
            } else {
                this.overrideTensorOptions.style.display = 'none';
            }
        }
    }
    
    toggleCustomTensorInput() {
        if (this.tensorPatternCustom && this.customTensorPattern) {
            if (this.tensorPatternCustom.checked) {
                this.customTensorPattern.disabled = false;
                this.customTensorPattern.focus();
            } else {
                this.customTensorPattern.disabled = true;
            }
        }
    }
    
    getOverrideTensorValue() {
        if (!this.overrideTensorEnabled || !this.overrideTensorEnabled.checked) {
            return '';
        }
        
        if (this.tensorPatternExperts && this.tensorPatternExperts.checked) {
            return 'exps=CPU';
        }
        
        if (this.tensorPatternCustom && this.tensorPatternCustom.checked && this.customTensorPattern) {
            return this.customTensorPattern.value || '';
        }
        
        return '';
    }
    
    setOverrideTensorValue(value) {
        if (!value) {
            // No override tensor pattern
            if (this.overrideTensorEnabled) this.overrideTensorEnabled.checked = false;
            this.toggleOverrideTensorOptions();
            return;
        }
        
        // Enable override tensor pattern
        if (this.overrideTensorEnabled) this.overrideTensorEnabled.checked = true;
        this.toggleOverrideTensorOptions();
        
        if (value === 'exps=CPU') {
            // Select the experts option
            if (this.tensorPatternExperts) this.tensorPatternExperts.checked = true;
            if (this.tensorPatternCustom) this.tensorPatternCustom.checked = false;
        } else {
            // Select custom option and set value
            if (this.tensorPatternCustom) this.tensorPatternCustom.checked = true;
            if (this.tensorPatternExperts) this.tensorPatternExperts.checked = false;
            if (this.customTensorPattern) this.customTensorPattern.value = value;
        }
        
        this.toggleCustomTensorInput();
    }
    
    // Version checking methods removed to reduce file size
    
    async sendMessage() {
        if (!this.userInput || !this.chatMessages) return;
        
        const message = this.userInput.value.trim();
        if (!message) return;

        // Check if we can send messages
        if (this.chatState.isGenerating) {
            console.log('Already generating, ignoring send request');
            return;
        }

        // Simple model status check
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            if (!data.server_running || !data.model_loaded) {
                this.addMessage('system', 'Please ensure the server is running and a model is loaded.');
                return;
            }
        } catch (error) {
            console.error('Status check failed:', error);
            this.addMessage('system', 'Unable to verify server status. Please check your connection.');
            return;
        }

        // Clear input and add user message
        this.userInput.value = '';
        this.addMessage('user', message);
        
        // Add to conversation history (will be saved after response completes)
        this.conversationHistory.push({ role: 'user', content: message });
        this.trimConversationHistory();

        // Set generating state
        this.chatState.setGenerating(true);

        // Start simple streaming
        await this.streamResponse(message);
    }
    
    async streamResponse(message) {
        const config = this.getConfig();
        let assistantMessage = null;
        let fullResponse = '';
        let hasStartedReceiving = false;
        let abortController = new AbortController();

        try {
            // Show typing indicator while waiting for response
            this.showTypingIndicator();

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    config: config,
                    history: this.conversationHistory
                }),
                signal: abortController.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Hide typing indicator and create assistant message element
            this.hideTypingIndicator();
            assistantMessage = this.addMessage('assistant', '');
            
            // Set streaming state with abort controller
            this.chatState.setStreaming(true, abortController);
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                // Check if generation was stopped
                if (abortController.signal.aborted) {
                    reader.cancel();
                    break;
                }

                const { done, value } = await reader.read();
                
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6).trim();
                        if (!jsonStr || jsonStr === '[DONE]') continue;

                        try {
                            const data = JSON.parse(jsonStr);
                            
                            if (data.error) {
                                throw new Error(data.error);
                            }
                            
                            if (data.token) {
                                hasStartedReceiving = true;
                                fullResponse += data.token;
                                assistantMessage.textContent = fullResponse;
                                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                            }
                            
                            if (data.done) {
                                break;
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse JSON:', parseError);
                            continue;
                        }
                    }
                }
            }

            // If we never received any tokens, show a helpful message
            if (!hasStartedReceiving && !abortController.signal.aborted) {
                assistantMessage.textContent = 'No response received. Please try again.';
                assistantMessage.className = 'message system';
                return;
            }

            // Only save to history if not aborted
            if (!abortController.signal.aborted) {
                // Clean response content and save to conversation history
                const cleanedResponse = this.cleanResponseContent(fullResponse);
                this.conversationHistory.push({ role: 'assistant', content: cleanedResponse });
                this.trimConversationHistory();
                this.saveChatHistory();
            }

        } catch (error) {
            console.error('Streaming error:', error);
            
            // Hide typing indicator on error
            this.hideTypingIndicator();
            
            // Only handle error if not aborted by user
            if (!abortController.signal.aborted) {
                // Remove user message from history if streaming failed
                if (this.conversationHistory.length > 0 && 
                    this.conversationHistory[this.conversationHistory.length - 1].role === 'user') {
                    this.conversationHistory.pop();
                }
                
                if (assistantMessage) {
                    assistantMessage.textContent = `Error: ${error.message}`;
                    assistantMessage.className = 'message system';
                } else {
                    this.addMessage('system', `Error: ${error.message}`);
                }
            }
        } finally {
            // Reset states and hide typing indicator
            this.hideTypingIndicator();
            this.chatState.setStreaming(false);
            this.chatState.setGenerating(false);
        }
    }
    
    addMessage(type, content, timestamp = null) {
        if (!this.chatMessages) return null;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = content;
        
        // Add timestamp if provided or create one
        if (timestamp || type !== 'system') {
            const timestampDiv = document.createElement('div');
            timestampDiv.className = 'message-timestamp';
            const time = timestamp || new Date();
            timestampDiv.textContent = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            messageDiv.appendChild(timestampDiv);
        }
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        return messageDiv;
    }
    
    // Show typing indicator
    showTypingIndicator() {
        // Remove any existing typing indicator
        this.hideTypingIndicator();
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typing-indicator';
        
        const typingText = document.createElement('span');
        typingText.textContent = 'AI is thinking';
        
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'typing-dots';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            dotsContainer.appendChild(dot);
        }
        
        typingDiv.appendChild(typingText);
        typingDiv.appendChild(dotsContainer);
        
        this.chatMessages.appendChild(typingDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    // Hide typing indicator
    hideTypingIndicator() {
        const existingIndicator = document.getElementById('typing-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
    }
    
    // Stop generation functionality
    stopGeneration() {
        if (this.chatState.isGenerating || this.chatState.isStreaming) {
            this.chatState.stopCurrentStream();
            this.hideTypingIndicator();
            this.addMessage('system', 'Generation stopped by user.');
            
            // Remove the last user message from history if generation was stopped
            if (this.conversationHistory.length > 0 && 
                this.conversationHistory[this.conversationHistory.length - 1].role === 'user') {
                this.conversationHistory.pop();
            }
        }
    }
    
    // Clear chat with confirmation
    clearChatWithConfirmation() {
        if (this.conversationHistory.length === 0) {
            this.addMessage('system', 'Chat is already empty.');
            return;
        }
        
        if (confirm('Are you sure you want to clear the entire conversation? This action cannot be undone.')) {
            this.clearConversation();
        }
    }
    
    // Conversation history helpers
    cleanResponseContent(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }
        
        // Remove thinking tags and their content
        let cleaned = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
        
        // Clean up any remaining whitespace issues
        cleaned = cleaned.trim();
        
        return cleaned;
    }
    
    validateHistoryEntry(entry) {
        if (!entry || typeof entry !== 'object') {
            return false;
        }
        
        if (!entry.role || !['user', 'assistant', 'system'].includes(entry.role)) {
            return false;
        }
        
        if (typeof entry.content !== 'string') {
            return false;
        }
        
        return true;
    }
    
    trimConversationHistory() {
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
        }
    }

    saveChatHistory() {
        try {
            // Validate history before saving
            const validHistory = this.conversationHistory.filter(entry => this.validateHistoryEntry(entry));
            
            if (validHistory.length !== this.conversationHistory.length) {
                console.warn('Some invalid history entries were filtered out during save');
                this.conversationHistory = validHistory;
            }
            
            localStorage.setItem('chatHistory', JSON.stringify(this.conversationHistory));
        } catch (e) {
            console.error('Failed to save chat history:', e);
            
            // If localStorage is full, try to clear old data and retry
            if (e.name === 'QuotaExceededError') {
                try {
                    // Keep only the last 10 messages and retry
                    this.conversationHistory = this.conversationHistory.slice(-10);
                    localStorage.setItem('chatHistory', JSON.stringify(this.conversationHistory));
                    console.log('Reduced history size and retried save successfully');
                } catch (retryError) {
                    console.error('Failed to save even reduced history:', retryError);
                }
            }
        }
    }

    loadChatHistory() {
        try {
            const savedHistory = localStorage.getItem('chatHistory');
            if (savedHistory) {
                const parsedHistory = JSON.parse(savedHistory);
                
                // Validate loaded history
                if (Array.isArray(parsedHistory)) {
                    this.conversationHistory = parsedHistory.filter(entry => this.validateHistoryEntry(entry));
                    
                    // Clean any thinking tags from loaded history
                    this.conversationHistory = this.conversationHistory.map(entry => ({
                        ...entry,
                        content: entry.role === 'assistant' ? this.cleanResponseContent(entry.content) : entry.content
                    }));
                    
                    this.renderSavedChatHistory();
                } else {
                    console.warn('Invalid history format in localStorage, starting fresh');
                    this.conversationHistory = [];
                }
            }
        } catch (e) {
            console.error('Failed to load chat history:', e);
            this.conversationHistory = [];
            
            // Clear corrupted data
            try {
                localStorage.removeItem('chatHistory');
            } catch (clearError) {
                console.error('Failed to clear corrupted history:', clearError);
            }
        }
    }

    renderSavedChatHistory() {
        if (!this.chatMessages) return;
        this.chatMessages.innerHTML = '';
        this.conversationHistory.forEach(msg => {
            this.addMessage(msg.role, msg.content);
        });
    }

    clearConversation() {
        this.conversationHistory = [];
        this.saveChatHistory();
        if (this.chatMessages) {
            this.chatMessages.innerHTML = '';
        }
        this.addMessage('system', 'Chat history cleared.');
    }
    
    // Models Page Status Functions
    updateModelsPageStatus(data, errorMessage = null) {
        if (!this.modelsPageStatusIcon || !this.modelsPageStatusText || !this.modelsPageStatusDetails) {
            return;
        }
        
        // Hide loading indicator
        if (this.modelsPageLoading) {
            this.modelsPageLoading.style.display = 'none';
        }
        
        if (errorMessage) {
            // Show error state
            this.modelsPageStatusIcon.textContent = '❌';
            this.modelsPageStatusIcon.className = 'status-icon error';
            this.modelsPageStatusText.textContent = 'Error';
            this.modelsPageStatusDetails.textContent = errorMessage;
            return;
        }
        
        if (!data) {
            // Show offline state
            this.modelsPageStatusIcon.textContent = '⚫';
            this.modelsPageStatusIcon.className = 'status-icon offline';
            this.modelsPageStatusText.textContent = 'Server Offline';
            this.modelsPageStatusDetails.textContent = 'Unable to connect to server';
            return;
        }
        
        // Update based on server and model status
        if (data.model_loaded && data.server_running) {
            this.modelsPageStatusIcon.textContent = '✅';
            this.modelsPageStatusIcon.className = 'status-icon success';
            this.modelsPageStatusText.textContent = 'Model Loaded';
            this.modelsPageStatusDetails.textContent = data.model_name || 'Model is ready for inference';
            
            // Show unload and force unload buttons when model is loaded
            if (this.unloadModelBtn) {
                this.unloadModelBtn.style.display = 'inline-block';
            }
            if (this.forceUnloadModelBtn) {
                this.forceUnloadModelBtn.style.display = 'inline-block';
            }
            
            // Update chat model dropdown with loaded model
            this.updateChatModelDisplay(data.model_name || 'Model loaded');
        } else if (data.server_running) {
            this.modelsPageStatusIcon.textContent = '⚠️';
            this.modelsPageStatusIcon.className = 'status-icon warning';
            this.modelsPageStatusText.textContent = 'Server Running';
            this.modelsPageStatusDetails.textContent = 'No model loaded - Select and load a model';
            
            // Hide unload and force unload buttons when no model is loaded
            if (this.unloadModelBtn) {
                this.unloadModelBtn.style.display = 'none';
            }
            if (this.forceUnloadModelBtn) {
                this.forceUnloadModelBtn.style.display = 'none';
            }
            
            // Update chat model dropdown to show no model
            this.updateChatModelDisplay(null);
        } else {
            this.modelsPageStatusIcon.textContent = '❌';
            this.modelsPageStatusIcon.className = 'status-icon error';
            this.modelsPageStatusText.textContent = 'Server Offline';
            this.modelsPageStatusDetails.textContent = 'Server is not running';
            
            // Hide unload and force unload buttons when server is offline
            if (this.unloadModelBtn) {
                this.unloadModelBtn.style.display = 'none';
            }
            if (this.forceUnloadModelBtn) {
                this.forceUnloadModelBtn.style.display = 'none';
            }
            
            // Update chat model dropdown to show no model
            this.updateChatModelDisplay(null);
        }
    }
    
    refreshModelStatus() {
        if (this.modelsPageLoading) {
            this.modelsPageLoading.style.display = 'flex';
        }
        
        // Force a status check
        this.checkRepoStatus();
    }
    
    async unloadModel(force = false) {
        if (!force && !confirm('Are you sure you want to unload the current model?')) {
            return;
        }
        
        try {
            // Show loading state
            if (this.modelsPageLoading) {
                this.modelsPageLoading.style.display = 'flex';
            }
            
            console.log(`Attempting to ${force ? 'force ' : ''}unload model...`);
            
            // Set up timeout for automatic force unload after 30 seconds
            let timeoutId;
            let forceUnloadPromise;
            
            if (!force) {
                timeoutId = setTimeout(async () => {
                    console.log('Unload timeout reached, attempting force unload...');
                    try {
                        const forceResponse = await fetch('/api/unload_model', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ force: true })
                        });
                        
                        if (forceResponse.ok) {
                            const forceData = await forceResponse.json();
                            if (forceData.success) {
                                this.handleUnloadSuccess('Model force unloaded after timeout');
                            }
                        }
                    } catch (error) {
                        console.error('Force unload after timeout failed:', error);
                    }
                }, 30000); // 30 seconds
            }
            
            const response = await fetch('/api/unload_model', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ force: force })
            });
            
            // Clear timeout if normal unload succeeds
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            console.log('Unload model response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Unload model response data:', data);
                
                if (data.success) {
                    this.handleUnloadSuccess(data.message);
                } else {
                    throw new Error(data.error || 'Failed to unload model');
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: Failed to unload model`);
            }
        } catch (error) {
            console.error('Error unloading model:', error);
            
            // Show error in UI
            this.modelsPageStatusIcon.textContent = '❌';
            this.modelsPageStatusIcon.className = 'status-icon error';
            this.modelsPageStatusText.textContent = 'Unload Failed';
            this.modelsPageStatusDetails.textContent = `Error: ${error.message}`;
            
            // Show alert to user
            alert(`Failed to unload model: ${error.message}`);
        } finally {
            if (this.modelsPageLoading) {
                this.modelsPageLoading.style.display = 'none';
            }
        }
    }
    
    handleUnloadSuccess(message) {
        // Update status immediately
        this.modelsPageStatusIcon.textContent = '⚠️';
        this.modelsPageStatusIcon.className = 'status-icon warning';
        this.modelsPageStatusText.textContent = 'Model Unloaded';
        this.modelsPageStatusDetails.textContent = message || 'Model has been unloaded successfully';
        
        // Hide unload and force unload buttons since no model is loaded
        if (this.unloadModelBtn) {
            this.unloadModelBtn.style.display = 'none';
        }
        if (this.forceUnloadModelBtn) {
            this.forceUnloadModelBtn.style.display = 'none';
        }
        
        // Also update the welcome page status
        if (this.modelStatusIcon && this.modelStatusText) {
            this.modelStatusIcon.textContent = '❓';
            this.modelStatusText.textContent = 'No model loaded';
        }
        
        // Update chat model dropdown to show no model
        this.updateChatModelDisplay(null);
        
        // Refresh status after a short delay
        setTimeout(() => {
            this.refreshModelStatus();
        }, 1000);
    }
    
    async forceUnloadModel() {
        if (!confirm('Are you sure you want to FORCE unload the current model? This will terminate the server process immediately.')) {
            return;
        }
        
        await this.unloadModel(true);
    }
}

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new IkLlamaDashboard();
});