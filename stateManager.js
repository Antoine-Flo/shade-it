

/*******************************************************************************
 * SERVICE WORKER BACKGROUND SCRIPT 
 * ---------------------------------------------------------------------------
 * Manages global state and coordinates between tabs.
 ******************************************************************************/

/*=============================================================================
 * STATE MANAGEMENT
 * State Setters and Getters
 *============================================================================*/

const STORAGE_KEYS = {
    enabled: 'shader_enabled',
    shaderType: 'shader_type'
};

/**
 * Get current shader state from chrome storage
 * @returns {Promise<{enabled: boolean, shaderType: string}>} Current shader state
 */
async function getState() {
    try {
        const stored = await chrome.storage.local.get([STORAGE_KEYS.enabled, STORAGE_KEYS.shaderType]);
        return {
            enabled: stored[STORAGE_KEYS.enabled] || false,
            shaderType: stored[STORAGE_KEYS.shaderType] || 'flames'
        };
    } catch (error) {
        console.error('❌ Storage read error:', error);
        return { enabled: false, shaderType: 'flames' };
    }
}

/**
 * Set shader state and save to chrome storage
 * @param {boolean} enabled - New shader state
 * @param {string} shaderType - Shader type (optional)
 * @returns {Promise<boolean>} Success status
 */
async function setState(enabled, shaderType = null) {
    try {
        const updateData = { [STORAGE_KEYS.enabled]: enabled };
        if (shaderType) {
            updateData[STORAGE_KEYS.shaderType] = shaderType;
        }
        await chrome.storage.local.set(updateData);
        return true;
    } catch (error) {
        console.error('❌ Storage save error:', error);
        return false;
    }
}

/**
 * Toggle current shader state
 * @returns {Promise<{enabled: boolean, shaderType: string}|null>} New state or null if failed
 */
async function toggleState() {
    const currentState = await getState();
    const newEnabled = !currentState.enabled;
    const success = await setState(newEnabled);
    if (!success) {
        return null;
    }
    return { enabled: newEnabled, shaderType: currentState.shaderType };
}

/*=============================================================================
 * MESSAGE HANDLER
 * Handles messages from popup and content scripts
 *============================================================================*/

/**
 * Main message handler for chrome extension
 * Processes messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        try {
            let response;

            if (message.action === 'GET_STATE') {
                response = await handleGetState();
            } else if (message.action === 'SET_STATE') {
                response = await handleSetState(message.data.enabled);
            } else if (message.action === 'TOGGLE_STATE') {
                response = await handleToggleState();
            } else if (message.action === 'CHANGE_SHADER') {
                response = await handleChangeShader(message.data.shaderType);
            } else {
                response = { success: false, error: 'Unknown action' };
            }

            sendResponse(response);
        } catch (error) {
            console.error('💥 Message handler error:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
});

/**
 * Handle get state request
 * @returns {Promise<Object>} Response object with current state
 */
async function handleGetState() {
    const state = await getState();
    return { success: true, data: state };
}

/**
 * Handle set state request
 * @param {boolean} enabled - New shader state
 * @returns {Promise<Object>} Response object with result
 */
async function handleSetState(enabled) {
    const success = await setState(enabled);
    if (success) {
        const state = await getState();
        await sendToActiveTab({
            type: 'SHADER_STATE_CHANGED',
            data: state
        });
        return { success: true, data: state };
    } else {
        return { success: false, error: 'Failed to save state' };
    }
}

/**
 * Handle toggle state request
 * @returns {Promise<Object>} Response object with new state
 */
async function handleToggleState() {
    const newState = await toggleState();
    if (newState !== null) {
        await sendToActiveTab({
            type: 'SHADER_STATE_CHANGED',
            data: newState
        });
        return { success: true, data: newState };
    } else {
        return { success: false, error: 'Failed to toggle state' };
    }
}

/**
 * Handle change shader request
 * @param {string} shaderType - New shader type
 * @returns {Promise<Object>} Response object with result
 */
async function handleChangeShader(shaderType) {
    const currentState = await getState();
    const success = await setState(currentState.enabled, shaderType);
    if (success) {
        const newState = await getState();
        await sendToActiveTab({
            type: 'CHANGE_SHADER',
            data: newState
        });
        return { success: true, data: newState };
    } else {
        return { success: false, error: 'Failed to save shader type' };
    }
}

/**
 * Send message to active tab only
 * @param {Object} message - Message object to send
 */
async function sendToActiveTab(message) {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tabs.length > 0) {
            try {
                await chrome.tabs.sendMessage(tabs[0].id, message);
            } catch (error) {
                // Ignore if tab doesn't have content script
                console.log('No content script in active tab (normal for chrome:// pages)');
            }
        }
    } catch (error) {
        console.error('❌ Send to active tab error:', error);
    }
}