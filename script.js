class IkLlamaDashboard {
    constructor() {
        this.serverStatus = 'offline';
        this.currentModel = null;
        this.buildProgress = null;
        this.config = {};
        this.buildEventSource = null;
        this.isBuildInProgress = false;
        this.init();
    }

    init() {
        this.initializeElements();
        this.loadConfig();
        this.setupEventListeners();
        this.loadInitialData();
        this.startStatusUpdates();
        this.setupTheme();
        this.checkVersion();
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
        this.versionIndicator = document.getElementById('version-indicator');
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
        
        // Chat Section Elements
        this.temperature = document.getElementById('temperature');
        this.tempValue = document.getElementById('temp-value');
        this.topP = document.getElementById('top-p');
        this.topPValue = document.getElementById('top-p-value');
        this.systemPrompt = document.getElementById('system-prompt');
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendMessageBtn = document.getElementById('send-message');
        
        // Benchmark Section Elements
        this.benchmarkType = document.getElementById('benchmark-type');
        this.benchmarkIterations = document.getElementById('benchmark-iterations');
        this.runBenchmarkBtn = document.getElementById('run-benchmark');
        this.benchmarkResults = document.getElementById('benchmark-results');
        this.resultsContainer = document.getElementById('results-container');
        
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
        
        if (this.userInput) {
            this.userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
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

        // Show progress section
        const progressSection = document.getElementById('build-progress-section');
        const progressBar = document.getElementById('build-progress-bar');
        const progressPercent = document.getElementById('build-progress-percent');
        const progressStatus = document.getElementById('build-progress-status');
        const cancelBtn = document.getElementById('cancel-build-btn');
        const viewLogsBtn = document.getElementById('view-logs-btn');

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
        const progressBar = document.getElementById('build-progress-bar');
        const progressPercent = document.getElementById('build-progress-percent');
        const progressStatus = document.getElementById('build-progress-status');

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
        
        const cancelBtn = document.getElementById('cancel-build-btn');
        const viewLogsBtn = document.getElementById('view-logs-btn');
        
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
        
        // Hide progress section
        const progressSection = document.getElementById('build-progress-section');
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

    scanForModels() {
        if (this.modelDropdown) {
            // Clear current options
            this.modelDropdown.innerHTML = '<option value="">Scanning...</option>';
            
            // Request models from server
            fetch('/api/discover_models')
                .then(response => response.json())
                .then(data => {
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
                            option.textContent = model.name;
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
                })
                .catch(error => {
                    console.error('Error scanning for models:', error);
                    this.modelDropdown.innerHTML = '<option value="">Error scanning models</option>';
                });
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

    loadModel() {
        const modelPath = this.modelDropdown.value || this.modelPath.value;
        
        if (!modelPath) {
            alert('Please select or enter a model path');
            return;
        }
        
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
        
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Model loading progress:', data);
                
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
            eventSource.close();
            
            // Only treat as error if we haven't already completed successfully
            if (!isCompleted) {
                this.finalizeModelLoadingProgress(false, 'Stream connection error');
            }
        };
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

    finalizeModelLoadingProgress(success, message) {
        const progressModal = document.getElementById('model-loading-progress-modal');
        
        if (success) {
            // Update model status
            if (this.modelStatusIcon) {
                this.modelStatusIcon.textContent = '✅';
            }
            
            if (this.modelStatusText) {
                this.modelStatusText.textContent = 'Model loaded';
            }
            
            // Enable chat input
            if (this.userInput) {
                this.userInput.disabled = false;
                this.userInput.placeholder = 'Type your message...';
            }
            
            if (this.sendMessageBtn) {
                this.sendMessageBtn.disabled = false;
            }
            
            // Navigate to chat section
            this.navigateTo('chat');
            
            // Hide progress modal after a short delay
            setTimeout(() => {
                if (progressModal) {
                    progressModal.classList.remove('active');
                }
            }, 2000);
        } else {
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
        // Check repository status
        this.checkRepoStatus();
        
        // Scan for models
        this.scanForModels();
    }

    checkRepoStatus() {
        fetch('/api/status')
            .then(response => response.json())
            .then(data => {
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
                
                // Update model status
                if (this.modelStatusIcon && this.modelStatusText) {
                    // Don't overwrite "Model loaded" status unless the API explicitly says the model is loaded
                    // This prevents the status from being reset after a successful model load
                    const currentStatus = this.modelStatusText.textContent;
                    console.log('checkRepoStatus - Current status:', currentStatus, 'API model_loaded:', data.model_loaded); // Debug log
                    
                    if (data.model_loaded) {
                        this.modelStatusIcon.textContent = '✅';
                        this.modelStatusText.textContent = data.model_name || 'Model loaded';
                        console.log('Updated status to:', this.modelStatusText.textContent); // Debug log
                    } else if (currentStatus !== 'Model loaded') {
                        // Only update to "No model loaded" if we're not currently showing "Model loaded"
                        // This preserves the status set by the model loading process
                        this.modelStatusIcon.textContent = '❓';
                        this.modelStatusText.textContent = 'No model loaded';
                        console.log('Updated status to: No model loaded'); // Debug log
                    } else {
                        console.log('Preserving "Model loaded" status despite API saying model_loaded=false'); // Debug log
                    }
                    // If currentStatus is "Model loaded" and data.model_loaded is false,
                    // we keep the current status to avoid overwriting a successful load
                }
                
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
                
                // Update status to show error
                if (this.statusDot && this.statusText) {
                    this.statusDot.classList.add('error');
                    this.statusText.textContent = 'Error';
                }
            });
    }

    startStatusUpdates() {
        // Check status every 5 seconds
        this.statusInterval = setInterval(() => {
            // Only check status if not currently streaming
            if (!this.isStreaming) {
                this.checkRepoStatus();
            }
        }, 5000);
    }
    
    // Pause status updates during streaming
    pauseStatusUpdates() {
        this.isStreaming = true;
        console.log('Status updates paused during streaming');
    }
    
    // Resume status updates after streaming
    resumeStatusUpdates() {
        this.isStreaming = false;
        console.log('Status updates resumed');
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
    
    async checkVersion() {
        if (!this.versionIndicator || !this.versionStatus) return;
        
        try {
            // Set checking state
            this.versionIndicator.className = 'version-indicator checking';
            this.versionStatus.textContent = '⏳';
            this.versionIndicator.title = 'Checking for updates...';
            
            // Get current version from our API
            const packageResponse = await fetch('/api/package-info');
            const packageData = await packageResponse.json();
            
            if (!packageData.success) {
                throw new Error('Failed to get package info');
            }
            
            const currentVersion = packageData.version;
            
            // Check GitHub for latest release
            const githubResponse = await fetch('https://api.github.com/repos/ggerganov/llama.cpp/releases/latest');
            const releaseData = await githubResponse.json();
            
            if (!releaseData.tag_name) {
                throw new Error('Failed to get latest release info');
            }
            
            const latestVersion = releaseData.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
            
            // Compare versions
            const comparison = this.compareVersions(currentVersion, latestVersion);
            
            if (comparison === 0) {
                // Up to date
                this.versionIndicator.className = 'version-indicator up-to-date';
                this.versionStatus.textContent = '✅';
                this.versionIndicator.title = `Up to date (v${currentVersion})`;
            } else if (comparison < 0) {
                // Update available
                this.versionIndicator.className = 'version-indicator update-available';
                this.versionStatus.textContent = '🔄';
                this.versionIndicator.title = `Update available: v${latestVersion} (current: v${currentVersion})`;
            } else {
                // Ahead of latest (development version)
                this.versionIndicator.className = 'version-indicator development';
                this.versionStatus.textContent = '🚀';
                this.versionIndicator.title = `Development version (v${currentVersion}, latest stable: v${latestVersion})`;
            }
            
        } catch (error) {
            console.error('Error checking version:', error);
            // Error state
            this.versionIndicator.className = 'version-indicator error';
            this.versionStatus.textContent = '❌';
            this.versionIndicator.title = 'Error checking for updates';
        }
    }
    
    compareVersions(version1, version2) {
        // Simple version comparison (assumes semantic versioning)
        const v1parts = version1.split('.').map(Number);
        const v2parts = version2.split('.').map(Number);
        
        const maxLength = Math.max(v1parts.length, v2parts.length);
        
        for (let i = 0; i < maxLength; i++) {
            const v1part = v1parts[i] || 0;
            const v2part = v2parts[i] || 0;
            
            if (v1part < v2part) return -1;
            if (v1part > v2part) return 1;
        }
        
        return 0;
    }
    
    async sendMessage() {
        if (!this.userInput || !this.chatMessages) return;
        
        const message = this.userInput.value.trim();
        if (!message) return;
        
        // First check server status to ensure we have the latest model status
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            console.log('Server status check:', data);
            
            if (!data.server_running) {
                this.addMessage('system', 'The server is not running. Please start the server first.');
                return;
            }
            
            if (!data.model_loaded) {
                this.addMessage('system', 'No model is loaded. Please load a model first.');
                return;
            }
            
            // Update model status display with the latest info
            if (this.modelStatusIcon && this.modelStatusText) {
                this.modelStatusIcon.textContent = '✅';
                this.modelStatusText.textContent = data.model_name || 'Model loaded';
            }
        } catch (error) {
            console.error('Error checking server status:', error);
            // Fall back to UI-based check if API call fails
            
            // Check if model is loaded based on UI
            const modelStatus = this.modelStatusText?.textContent;
            console.log('Current model status (UI):', modelStatus);
            
            // Check if model is loaded - accept "Model loaded" or any model name (not error states)
            const isModelLoaded = modelStatus && 
                modelStatus !== 'No model loaded' && 
                modelStatus !== 'Loading model...' && 
                modelStatus !== 'Model loading failed' &&
                !modelStatus.includes('failed') &&
                !modelStatus.includes('error');
                
            if (!isModelLoaded) {
                this.addMessage('system', `Please load a model first. Current status: "${modelStatus}"`);
                return;
            }
        }
        
        // Clear input and add user message
        this.userInput.value = '';
        this.addMessage('user', message);
        
        // Disable send button during generation
        if (this.sendMessageBtn) {
            this.sendMessageBtn.disabled = true;
        }
        
        console.log('Sending message to /api/chat:', message);
        
        // Robust streaming with retry logic
        await this.streamWithRetry(message, 3); // Max 3 retries
    }
    
    async streamWithRetry(message, maxRetries = 3) {
        let retryCount = 0;
        let assistantMessage = null;
        let fullResponse = '';
        
        // Pause status updates before streaming starts
        this.pauseStatusUpdates();
        
        try {
            while (retryCount <= maxRetries) {
                try {
                    const result = await this.performStreamRequest(message, assistantMessage, fullResponse, retryCount);
                    
                    if (result.success) {
                        // Streaming completed successfully
                        if (result.assistantMessage) {
                            this.updateStreamingMessage(result.assistantMessage, result.fullResponse, true);
                        }
                        return;
                    } else {
                        // Partial success - continue from where we left off
                        assistantMessage = result.assistantMessage;
                        fullResponse = result.fullResponse;
                        retryCount++;
                        
                        if (retryCount <= maxRetries) {
                            console.log(`Retrying stream request (attempt ${retryCount + 1}/${maxRetries + 1})...`);
                            // Exponential backoff: 1s, 2s, 4s
                            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000));
                        }
                    }
                } catch (error) {
                    console.error(`Stream attempt ${retryCount + 1} failed:`, error);
                    retryCount++;
                    
                    if (retryCount <= maxRetries) {
                        console.log(`Retrying after error (attempt ${retryCount + 1}/${maxRetries + 1})...`);
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000));
                    } else {
                        // All retries exhausted
                        if (assistantMessage && fullResponse) {
                            // We have partial content, show it
                            this.updateStreamingMessage(assistantMessage, fullResponse + '\n\n[Connection lost - partial response shown]', true);
                        } else {
                            // No content received
                            this.addMessage('system', `Error: ${error.message}. Please try again.`);
                        }
                        break;
                    }
                }
            }
        } finally {
            // Resume status updates after streaming ends (success or failure)
            this.resumeStatusUpdates();
            
            // Re-enable send button
            if (this.sendMessageBtn) {
                this.sendMessageBtn.disabled = false;
            }
        }
    }
    
    async performStreamRequest(message, existingMessage = null, existingResponse = '', retryAttempt = 0) {
        const config = this.getConfig();
        console.log(`Stream request attempt ${retryAttempt + 1}, Config:`, config);
        
        // Create AbortController for timeout management
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('Request timeout, aborting...');
            controller.abort();
        }, 60000); // 60 second timeout
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
                body: JSON.stringify({
                    message: message,
                    config: config
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            console.log('Response status:', response.status, response.statusText);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Ensure we have a message element
            let assistantMessage = existingMessage;
            if (!assistantMessage) {
                assistantMessage = this.addMessage('assistant', '');
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            let fullResponse = existingResponse;
            let buffer = '';
            let lastActivityTime = Date.now();
            const ACTIVITY_TIMEOUT = 30000; // 30 seconds without data
            
            console.log('Starting to read response stream...');
            
            while (true) {
                // Check for activity timeout
                if (Date.now() - lastActivityTime > ACTIVITY_TIMEOUT) {
                    console.log('Activity timeout - no data received for 30 seconds');
                    throw new Error('Stream timeout - no data received');
                }
                
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('Stream finished successfully');
                    return {
                        success: true,
                        assistantMessage,
                        fullResponse
                    };
                }
                
                lastActivityTime = Date.now();
                
                // Decode chunk and add to buffer
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                console.log('Received chunk:', chunk);
                
                // Process complete lines from buffer
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;
                    
                    try {
                        const data = JSON.parse(trimmedLine);
                        console.log('Parsed data:', data);
                        
                        if (data.error) {
                            console.error('Server error:', data.error);
                            
                            // Check if it's a connection error that we can retry
                            if (data.error.includes('Connection interrupted') || 
                                data.error.includes('timeout') ||
                                data.error.includes('connection reset')) {
                                return {
                                    success: false,
                                    assistantMessage,
                                    fullResponse
                                };
                            }
                            
                            throw new Error(`Server error: ${data.error}`);
                        }
                        
                        if (data.token) {
                            fullResponse += data.token;
                            this.updateStreamingMessage(assistantMessage, fullResponse);
                            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                        }
                        
                        if (data.done) {
                            console.log('Received done signal');
                            return {
                                success: true,
                                assistantMessage,
                                fullResponse
                            };
                        }
                    } catch (parseError) {
                        console.log('JSON parse error:', parseError, 'for line:', line);
                        
                        // Check if the line contains connection error indicators
                        if (line.includes('Connection interrupted') || 
                            line.includes('connection reset') ||
                            line.includes('timeout')) {
                            console.log('Connection error detected in response');
                            return {
                                success: false,
                                assistantMessage,
                                fullResponse
                            };
                        }
                        
                        // For other parse errors, continue processing
                        continue;
                    }
                }
            }
        } catch (error) {
            clearTimeout(timeoutId);
            
            // Check if it's an abort error (timeout)
            if (error.name === 'AbortError') {
                console.log('Request was aborted due to timeout');
                return {
                    success: false,
                    assistantMessage: existingMessage,
                    fullResponse: existingResponse
                };
            }
            
            // Check if it's a network error that might be recoverable
            if (error.name === 'NetworkError' || 
                error.message.includes('network') ||
                error.message.includes('fetch')) {
                console.log('Network error detected, marking for retry');
                return {
                    success: false,
                    assistantMessage: existingMessage,
                    fullResponse: existingResponse
                };
            }
            
            throw error;
        }
    }
    
    updateStreamingMessage(messageElement, content, isComplete = false) {
        if (!messageElement) return;
        
        const parsed = this.parseStreamingThinking(content);
        messageElement.innerHTML = parsed.html;
        
        // Auto-collapse thinking sections when message is complete
        if (isComplete) {
            this.collapseThinkingSections(messageElement);
        }
    }
    
    parseStreamingThinking(content) {
        let html = '';
        let position = 0;
        let inThinking = false;
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
                                <span class="thinking-arrow">▼</span>
                            </div>
                            <div class="thinking-content">`;
                    
                    inThinking = true;
                    position = thinkStart + 7; // Skip <think>
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
            const arrow = section.querySelector('.thinking-arrow');
            if (arrow) arrow.textContent = '▶';
        });
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    addMessage(type, content) {
        if (!this.chatMessages) return null;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        if (type === 'assistant' && content.includes('<think>')) {
            // Parse thinking tags for assistant messages
            const parsed = this.parseStreamingThinking(content);
            messageDiv.innerHTML = parsed.html;
        } else {
            messageDiv.textContent = content;
        }
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        return messageDiv;
    }
}

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new IkLlamaDashboard();
});