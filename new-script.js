class IkLlamaDashboard {
    constructor() {
        this.serverStatus = 'offline';
        this.currentModel = null;
        this.buildProgress = null;
        this.config = {};
        this.init();
    }

    init() {
        this.initializeElements();
        this.loadConfig();
        this.setupEventListeners();
        this.loadInitialData();
        this.startStatusUpdates();
        this.setupTheme();
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
        this.flashAttn = document.getElementById('flash-attn');
        this.fmoe = document.getElementById('fmoe');
        this.threads = document.getElementById('threads');
        this.nGpuLayers = document.getElementById('n-gpu-layers');
        this.nGpuLayersValue = document.getElementById('n-gpu-layers-value');
        this.overrideTensor = document.getElementById('override-tensor');
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
        
        // Theme Toggle
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => {
                this.toggleTheme();
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
        
        // Send build request to server
        fetch('/api/build', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                repo_option: repoOption,
                cuda_support: cudaEnabled,
                opencl_support: openclEnabled,
                metal_support: metalEnabled
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Build started:', data);
            // Navigate back to welcome screen to show status
            this.navigateTo('welcome');
            // Show logs modal
            this.showLogsModal();
        })
        .catch(error => {
            console.error('Error starting build:', error);
            alert('Failed to start build. Please check the logs for details.');
            // Re-enable start build button
            if (this.startBuildBtn) {
                this.startBuildBtn.disabled = false;
                this.startBuildBtn.textContent = 'Start Build';
            }
        });
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
        
        // Get configuration
        const config = this.getConfig();
        
        // Send load model request
        fetch('/api/load_model', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model_path: modelPath,
                config: config
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Model loaded:', data);
            
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
            
            // Re-enable load button
            if (this.loadModelBtn) {
                this.loadModelBtn.disabled = false;
                this.loadModelBtn.textContent = 'Load Model';
            }
        })
        .catch(error => {
            console.error('Error loading model:', error);
            alert('Failed to load model. Please check the logs for details.');
            
            // Re-enable load button
            if (this.loadModelBtn) {
                this.loadModelBtn.disabled = false;
                this.loadModelBtn.textContent = 'Load Model';
            }
        });
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
            flash_attn: this.flashAttn?.checked || false,
            fmoe: this.fmoe?.checked || false,
            
            // Hardware settings
            threads: parseInt(this.threads?.value || 8),
            n_gpu_layers: parseInt(this.nGpuLayers?.value || 0),
            override_tensor: this.overrideTensor?.value || ''
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
            flash_attn: false,
            fmoe: false,
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
        if (this.flashAttn) this.flashAttn.checked = defaultConfig.flash_attn;
        if (this.fmoe) this.fmoe.checked = defaultConfig.fmoe;
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
                if (this.flashAttn) this.flashAttn.checked = config.flash_attn || false;
                if (this.fmoe) this.fmoe.checked = config.fmoe || false;
                if (this.threads) this.threads.value = config.threads || 8;
                if (this.nGpuLayers) this.nGpuLayers.value = config.n_gpu_layers || 0;
                if (this.nGpuLayersValue) this.nGpuLayersValue.textContent = config.n_gpu_layers || 0;
                if (this.overrideTensor) this.overrideTensor.value = config.override_tensor || "exps=CPU";
                
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
                    if (data.logs && data.logs.length > 0) {
                        this.logsContent.textContent = data.logs;
                    } else {
                        this.logsContent.textContent = 'No logs available';
                    }
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
                    if (data.build_status === 'success') {
                        this.buildStatusIcon.textContent = '✅';
                        this.buildStatusText.textContent = 'Build successful';
                    } else if (data.build_status === 'in_progress') {
                        this.buildStatusIcon.textContent = '🔄';
                        this.buildStatusText.textContent = 'Build in progress';
                    } else if (data.build_status === 'failed') {
                        this.buildStatusIcon.textContent = '❌';
                        this.buildStatusText.textContent = 'Build failed';
                    } else {
                        this.buildStatusIcon.textContent = '❓';
                        this.buildStatusText.textContent = 'Not built';
                    }
                }
                
                // Update model status
                if (this.modelStatusIcon && this.modelStatusText) {
                    if (data.model_loaded) {
                        this.modelStatusIcon.textContent = '✅';
                        this.modelStatusText.textContent = data.model_name || 'Model loaded';
                    } else {
                        this.modelStatusIcon.textContent = '❓';
                        this.modelStatusText.textContent = 'No model loaded';
                    }
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
        setInterval(() => {
            this.checkRepoStatus();
        }, 5000);
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
}

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new IkLlamaDashboard();
});