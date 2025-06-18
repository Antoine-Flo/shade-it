/**
 * 🔥 Shade It - Service Worker Background Script
 * Manages global shader state for all tabs
 */

const STORAGE_KEY = 'shader_enabled';

/**
 * Get current shader state from chrome storage
 * @returns {Promise<boolean>} Current shader enabled state
 */
async function getState() {
    try {
        const stored = await chrome.storage.local.get([STORAGE_KEY]);
        return stored[STORAGE_KEY] || false;
    } catch (error) {
        console.error('❌ Storage read error:', error);
        return false;
    }
}

/**
 * Set shader state and save to chrome storage
 * @param {boolean} enabled - New shader state
 * @returns {Promise<boolean>} Success status
 */
async function setState(enabled) {
    try {
        await chrome.storage.local.set({ [STORAGE_KEY]: enabled });
        return true;
    } catch (error) {
        console.error('❌ Storage save error:', error);
        return false;
    }
}

/**
 * Toggle current shader state
 * @returns {Promise<boolean|null>} New state or null if failed
 */
async function toggleState() {
    const currentState = await getState();
    const newState = !currentState;
    const success = await setState(newState);
    if (!success) {
        console.error('💥 Toggle failed!');
        return null;
    }
    return newState;
}

/**
 * Send message to all open tabs
 * @param {Object} message - Message object to broadcast
 */
async function broadcastToAllTabs(message) {
    try {
        const tabs = await chrome.tabs.query({});
        console.log(`📢 Broadcasting to ${tabs.length} tabs:`, message);

        const promises = tabs.map(async (tab) => {
            try {
                await chrome.tabs.sendMessage(tab.id, message);
            } catch (error) {
                // Ignore tabs that cannot receive messages
            }
        });

        await Promise.all(promises);
        console.log('✅ Broadcast completed');
    } catch (error) {
        console.error('❌ Broadcast error:', error);
    }
}

/**
 * Handle get state request
 * @returns {Promise<Object>} Response object with current state
 */
async function handleGetState() {
    const state = await getState();
    console.log('📖 State sent:', state);
    return { success: true, data: { enabled: state } };
}

/**
 * Handle set state request
 * @param {boolean} enabled - New shader state
 * @returns {Promise<Object>} Response object with result
 */
async function handleSetState(enabled) {
    const success = await setState(enabled);
    if (success) {
        await broadcastToAllTabs({
            type: 'SHADER_STATE_CHANGED',
            data: { enabled }
        });
        console.log('✅ State changed and broadcasted:', enabled);
        return { success: true, data: { enabled } };
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
        await broadcastToAllTabs({
            type: 'SHADER_STATE_CHANGED',
            data: { enabled: newState }
        });
        console.log('🔀 Toggle successful and broadcasted:', newState);
        return { success: true, data: { enabled: newState } };
    } else {
        return { success: false, error: 'Failed to toggle state' };
    }
}

/**
 * Main message handler for chrome extension
 * Processes messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    try {
        let response;

        if (message.action === 'GET_STATE') {
            response = await handleGetState();
        }
        if (message.action === 'SET_STATE') {
            response = await handleSetState(message.data.enabled);
        }
        if (message.action === 'TOGGLE_STATE') {
            response = await handleToggleState();
        }
        if (!response) {
            response = { success: false, error: 'Unknown action' };
        }

        sendResponse(response);
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }

    return true;
});
