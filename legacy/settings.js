class SettingsManager {
    constructor() {
        this.config = null;
        this.modelConfigs = {};
        this.configHistory = [];
        this.maxConfigHistoryLength = 10;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadConfig();
    }
    
    initializeElements() {
        // Settings panel elements
        this.settingsPanel = document.getElementById('settings-panel');
        this.closeSettingsBtn = document.getElementById('close-settings');
        this.saveSettingsBtn = document.getElementById('save-settings');
        
        // Model configuration elements
        this.modelSelect = document.getElementById('model-dropdown');
        this.ctxSize = document.getElementById('ctx-size');
        this.nPredict = document.getElementById('n-predict');
        this.temperature = document.getElementById('temperature');
        this.tempValue = document.getElementById('temp-value');
        this.topP = document.getElementById('top-p');
        this.topPValue = document.getElementById('top-p-value');
        this.topK = document.getElementById('top-k');
        this.repeatPenalty = document.getElementById('repeat-penalty');
        this.repeatPenaltyValue = document.getElementById('repeat-penalty-value');
        this.systemPrompt = document.getElementById('system-prompt');
        this.threads = document.getElementById('threads');
        this.nGpuLayers = document.getElementById('n-gpu-layers');
        this.nGpuLayersValue = document.getElementById('n-gpu-layers-value');
        
        // Advanced settings
        this.ctkSelect = document.getElementById('ctk');
        this.mlaSlider = document.getElementById('mla');
        this.mlaValue = document.getElementById('mla-value');
        this.attentionMaxBatchSlider = document.getElementById('attention-max-batch');
        this.attentionMaxBatchValue = document.getElementById('attention-max-batch-value');
        this.flashAttentionCheckbox = document.getElementById('flash-attention');
        this.fusedMoeCheckbox = document.getElementById('fused-moe');
        this.smartExpertReductionCheckbox = document.getElementById('smart-expert-reduction');
        this.runtimeTensorRepackingCheckbox = document.getElementById('runtime-tensor-repacking');
    }
    
    setupEventListeners() {
        if (this.closeSettingsBtn) {
            this.closeSettingsBtn.addEventListener('click', () => this.toggleSettingsPanel(false));
        }
        
        if (this.saveSettingsBtn) {
            this.saveSettingsBtn.addEventListener('click', () => this.saveConfig());
        }
        
        // Setup slider value displays
        this.setupSliderValueDisplay(this.temperature, this.tempValue);
        this.setupSliderValueDisplay(this.topP, this.topPValue);
        this.setupSliderValueDisplay(this.repeatPenalty, this.repeatPenaltyValue);
        this.setupSliderValueDisplay(this.nGpuLayers, this.nGpuLayersValue);
        this.setupSliderValueDisplay(this.mlaSlider, this.mlaValue);
        this.setupSliderValueDisplay(this.attentionMaxBatchSlider, this.attentionMaxBatchValue);
        
        // Model selection change event
        if (this.modelSelect) {
            this.modelSelect.addEventListener('change', () => this.loadConfigurationFromUI());
        }
    }
    
    setupSliderValueDisplay(slider, valueDisplay) {
        if (slider && valueDisplay) {
            slider.addEventListener('input', () => {
                valueDisplay.textContent = slider.value;
            });
        }
    }
    
    toggleSettingsPanel(show) {
        if (this.settingsPanel) {
            if (show === undefined) {
                this.settingsPanel.classList.toggle('active');
            } else {
                if (show) {
                    this.settingsPanel.classList.add('active');
                } else {
                    this.settingsPanel.classList.remove('active');
                }
            }
        }
    }
    
    loadConfig() {
        try {
            const savedConfig = localStorage.getItem('ik_llama_config');
            this.config = savedConfig ? JSON.parse(savedConfig) : this.getDefaultConfig();
            this.applyConfigurationToUI(this.config);
        } catch (error) {
            console.error('Error loading configuration:', error);
            this.config = this.getDefaultConfig();
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
            ctx_size: 2048,
            n_predict: 1024,
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            system_prompt: '',
            threads: navigator.hardwareConcurrency || 4,
            n_gpu_layers: 0,
            ctk: 'auto',
            mla: 1,
            attention_max_batch: 512,
            flash_attention: false,
            fused_moe: false,
            smart_expert_reduction: false,
            runtime_tensor_repacking: false
        };
    }
    
    getConfiguration() {
        return {
            ctx_size: this.ctxSize ? parseInt(this.ctxSize.value) : 2048,
            n_predict: this.nPredict ? parseInt(this.nPredict.value) : 1024,
            temperature: this.temperature ? parseFloat(this.temperature.value) : 0.7,
            top_p: this.topP ? parseFloat(this.topP.value) : 0.9,
            top_k: this.topK ? parseInt(this.topK.value) : 40,
            repeat_penalty: this.repeatPenalty ? parseFloat(this.repeatPenalty.value) : 1.1,
            system_prompt: this.systemPrompt ? this.systemPrompt.value : '',
            threads: this.threads ? parseInt(this.threads.value) : 4,
            n_gpu_layers: this.nGpuLayers ? parseInt(this.nGpuLayers.value) : 0,
            ctk: this.ctkSelect ? this.ctkSelect.value : 'auto',
            mla: this.mlaSlider ? parseInt(this.mlaSlider.value) : 1,
            attention_max_batch: this.attentionMaxBatchSlider ? parseInt(this.attentionMaxBatchSlider.value) : 512,
            flash_attention: this.flashAttentionCheckbox ? this.flashAttentionCheckbox.checked : false,
            fused_moe: this.fusedMoeCheckbox ? this.fusedMoeCheckbox.checked : false,
            smart_expert_reduction: this.smartExpertReductionCheckbox ? this.smartExpertReductionCheckbox.checked : false,
            runtime_tensor_repacking: this.runtimeTensorRepackingCheckbox ? this.runtimeTensorRepackingCheckbox.checked : false
        };
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
        if (config.ctk && this.ctkSelect) this.ctkSelect.value = config.ctk;
        if (config.mla && this.mlaSlider) {
            this.mlaSlider.value = config.mla;
            if (this.mlaValue) this.mlaValue.textContent = config.mla;
        }
        if (config.attention_max_batch && this.attentionMaxBatchSlider) {
            this.attentionMaxBatchSlider.value = config.attention_max_batch;
            if (this.attentionMaxBatchValue) this.attentionMaxBatchValue.textContent = config.attention_max_batch;
        }
        if (this.flashAttentionCheckbox) this.flashAttentionCheckbox.checked = !!config.flash_attention;
        if (this.fusedMoeCheckbox) this.fusedMoeCheckbox.checked = !!config.fused_moe;
        if (this.smartExpertReductionCheckbox) this.smartExpertReductionCheckbox.checked = !!config.smart_expert_reduction;
        if (this.runtimeTensorRepackingCheckbox) this.runtimeTensorRepackingCheckbox.checked = !!config.runtime_tensor_repacking;
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
    
    loadModelConfiguration(modelName) {
        try {
            const configKey = `modelConfig_${modelName}`;
            const savedConfigData = localStorage.getItem(configKey);
            if (savedConfigData) {
                const configData = JSON.parse(savedConfigData);
                return configData.config;
            }
            return null;
        } catch (error) {
            console.error(`Error loading configuration for model ${modelName}:`, error);
            return null;
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
    
    saveToConfigHistory(configData) {
        try {
            // Load existing history
            let history = [];
            const savedHistory = localStorage.getItem('configHistory');
            if (savedHistory) {
                history = JSON.parse(savedHistory);
            }
            
            // Add new config to history
            history.push(configData);
            
            // Trim history if needed
            if (history.length > this.maxConfigHistoryLength) {
                history = history.slice(-this.maxConfigHistoryLength);
            }
            
            // Save updated history
            localStorage.setItem('configHistory', JSON.stringify(history));
            this.configHistory = history;
        } catch (error) {
            console.error('Error saving to config history:', error);
        }
    }
    
    loadConfigHistory() {
        try {
            const savedHistory = localStorage.getItem('configHistory');
            if (savedHistory) {
                this.configHistory = JSON.parse(savedHistory);
            }
        } catch (error) {
            console.error('Error loading config history:', error);
            this.configHistory = [];
        }
    }
}

// Initialize settings manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
});