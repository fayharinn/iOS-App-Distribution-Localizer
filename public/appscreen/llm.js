// LLM Provider Configuration
// Centralized configuration for all AI translation providers and models

const llmProviders = {
    anthropic: {
        name: 'Anthropic (Claude)',
        keyPrefix: 'sk-ant-',
        storageKey: 'claudeApiKey',
        modelStorageKey: 'anthropicModel',
        models: [
            { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 ($)' },
            { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5 ($$)' },
            { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5 ($$$)' },
        ],
        defaultModel: 'claude-sonnet-4-5-20250929'
    },
    openai: {
        name: 'OpenAI (GPT)',
        keyPrefix: 'sk-',
        storageKey: 'openaiApiKey',
        modelStorageKey: 'openaiModel',
        models: [
            { id: 'gpt-5.1-2025-11-13', name: 'GPT-5.1 ($$$)' },
            { id: 'gpt-5-mini-2025-08-07', name: 'GPT-5 Mini ($$)' },
            { id: 'gpt-5-nano-2025-08-07', name: 'GPT-5 Nano ($)' }
        ],
        defaultModel: 'gpt-5-mini-2025-08-07'
    },
    azure: {
        name: 'Azure OpenAI',
        keyPrefix: '',
        storageKey: 'azureApiKey',
        modelStorageKey: 'azureModel',
        endpointStorageKey: 'azureEndpoint',
        models: [
            { id: 'gpt-5-nano', name: 'GPT-5 Nano ($)' },
            { id: 'gpt-5-mini', name: 'GPT-5 Mini ($$)' }
        ],
        defaultModel: 'gpt-5-nano',
        needsEndpoint: true
    },
    google: {
        name: 'Google (Gemini)',
        keyPrefix: 'AIza',
        storageKey: 'googleApiKey',
        modelStorageKey: 'googleModel',
        models: [
            { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite ($)' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash ($$)' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro ($$$)' }
        ],
        defaultModel: 'gemini-2.5-flash'
    },
    github: {
        name: 'GitHub Models',
        keyPrefix: 'ghp_',
        storageKey: 'githubApiKey',
        modelStorageKey: 'githubModel',
        models: [
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini ($)' },
            { id: 'gpt-4o', name: 'GPT-4o ($$)' },
            { id: 'gpt-4.1', name: 'GPT-4.1 ($$$)' }
        ],
        defaultModel: 'gpt-4o'
    }
};

/**
 * Get the selected model for a provider
 * @param {string} provider - Provider key (anthropic, openai, google, azure, github)
 * @returns {string} - Model ID
 */
function getSelectedModel(provider) {
    const config = llmProviders[provider];
    if (!config) return null;
    
    const savedModel = localStorage.getItem(config.modelStorageKey);
    
    // Validate that the saved model exists in this provider's model list
    if (savedModel) {
        const isValidModel = config.models.some(m => m.id === savedModel);
        if (isValidModel) {
            return savedModel;
        }
        // If saved model is invalid for this provider, clear it and use default
        console.warn(`Invalid model "${savedModel}" for provider "${provider}", using default`);
        localStorage.removeItem(config.modelStorageKey);
    }
    
    return config.defaultModel;
}

/**
 * Get the selected provider
 * @returns {string} - Provider key
 */
function getSelectedProvider() {
    return localStorage.getItem('aiProvider') || 'anthropic';
}

/**
 * Get API key for a provider
 * @param {string} provider - Provider key
 * @returns {string|null} - API key or null
 */
function getApiKey(provider) {
    const config = llmProviders[provider];
    if (!config) return null;
    return localStorage.getItem(config.storageKey);
}

/**
 * Validate API key format for a provider
 * @param {string} provider - Provider key
 * @param {string} key - API key to validate
 * @returns {boolean} - Whether key format is valid
 */
function validateApiKeyFormat(provider, key) {
    const config = llmProviders[provider];
    if (!config) return false;
    return key.startsWith(config.keyPrefix);
}

/**
 * Generate HTML options for model select dropdown
 * @param {string} provider - Provider key
 * @param {string} selectedModel - Currently selected model ID (optional)
 * @returns {string} - HTML string of option elements
 */
function generateModelOptions(provider, selectedModel = null) {
    const config = llmProviders[provider];
    if (!config) return '';

    const selected = selectedModel || getSelectedModel(provider);
    return config.models.map(model =>
        `<option value="${model.id}"${model.id === selected ? ' selected' : ''}>${model.name}</option>`
    ).join('\n');
}

// Expose functions globally for use in app.js
window.llmProviders = llmProviders;
window.getSelectedModel = getSelectedModel;
window.getSelectedProvider = getSelectedProvider;
window.getApiKey = getApiKey;
window.validateApiKeyFormat = validateApiKeyFormat;
window.generateModelOptions = generateModelOptions;
