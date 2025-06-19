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
 * TAB TRACKING
 * Track active tab and manage shader switching between tabs
 *============================================================================*/

/** @type {number|null} ID of the tab that currently has the shader active */
let currentShaderTabId = null;

// Listen for tab activation changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await handleTabSwitch(activeInfo.tabId);
});

/**
 * Handle active tab change - move shader from old tab to new tab
 * @param {number} newActiveTabId - ID of newly active tab
 */
async function handleTabSwitch(newActiveTabId) {
    const state = await getState();

    // Only do something if shader is enabled
    if (!state.enabled) {
        return;
    }

    // Store old tab ID for cleanup
    const oldTabId = currentShaderTabId;

    // Activate on new tab first
    currentShaderTabId = newActiveTabId;
    await activateTabShader(newActiveTabId, state);

    // Then clean up old tab if there was one
    if (oldTabId && oldTabId !== newActiveTabId) {
        await cleanupTabShader(oldTabId);
    }
}

/**
 * Clean up shader from a specific tab
 * @param {number} tabId - Tab ID to clean up
 */
async function cleanupTabShader(tabId) {
    try {
        await chrome.tabs.sendMessage(tabId, {
            type: 'CLEANUP_SHADER'
        });
    } catch (error) {
        // Tab might be closed or not have content script, that's ok
        console.log(`Tab ${tabId} cleanup failed (probably closed):`, error.message);
    }
}

/**
 * Activate shader on a specific tab
 * @param {number} tabId - Tab ID to activate shader on
 * @param {Object} state - Current shader state
 */
async function activateTabShader(tabId, state) {
    try {
        await chrome.tabs.sendMessage(tabId, {
            type: 'SHADER_STATE_CHANGED',
            data: state
        });
    } catch (error) {
        console.log(`Tab ${tabId} activation failed:`, error.message);
    }
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
 * Utility to update shader state and manage tabs
 * @param {Function} stateUpdater - Function that updates the state and returns new state or null
 * @returns {Promise<Object>} Response object with result
 */
async function updateShaderState(stateUpdater) {
    const newState = await stateUpdater();

    if (newState === null) {
        return { success: false, error: 'Failed to update state' };
    }

    // Handle shader disable - cleanup current tab
    if (!newState.enabled && currentShaderTabId) {
        await cleanupTabShader(currentShaderTabId);
        currentShaderTabId = null;
        return { success: true, data: newState };
    }

    // Handle shader enable - activate on current tab
    if (newState.enabled) {
        const activeTab = await getActiveTab();
        if (activeTab) {
            currentShaderTabId = activeTab.id;
            await activateTabShader(activeTab.id, newState);
        }
    }

    return { success: true, data: newState };
}

/**
 * Handle set state request
 * @param {boolean} enabled - New shader state
 * @returns {Promise<Object>} Response object with result
 */
async function handleSetState(enabled) {
    return await updateShaderState(async () => {
        const success = await setState(enabled);
        if (!success) {
            return null;
        }
        return await getState();
    });
}

/**
 * Handle toggle state request
 * @returns {Promise<Object>} Response object with new state
 */
async function handleToggleState() {
    return await updateShaderState(async () => {
        return await toggleState();
    });
}

/**
 * Handle change shader request
 * @param {string} shaderType - New shader type
 * @returns {Promise<Object>} Response object with result
 */
async function handleChangeShader(shaderType) {
    return await updateShaderState(async () => {
        const currentState = await getState();
        const success = await setState(currentState.enabled, shaderType);
        if (!success) {
            return null;
        }

        const newState = { enabled: currentState.enabled, shaderType };

        // Send change shader message if enabled and we have active tab
        if (newState.enabled && currentShaderTabId) {
            await chrome.tabs.sendMessage(currentShaderTabId, {
                type: 'CHANGE_SHADER',
                data: newState
            });
        }

        return newState;
    });
}

/**
 * Get the currently active tab
 * @returns {Promise<chrome.tabs.Tab|null>} Active tab or null if not found
 */
async function getActiveTab() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs.length > 0 ? tabs[0] : null;
    } catch (error) {
        console.error('❌ Get active tab error:', error);
        return null;
    }
}