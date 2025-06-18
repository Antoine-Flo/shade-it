/**
 * Update button appearance based on state
 * @param {boolean} enabled - Current shader state
 */
function updateButtonState(enabled) {
  const button = document.getElementById('toggleOverlay');
  const buttonText = document.getElementById('buttonText');

  if (enabled) {
    button.className = 'toggle-btn on';
    buttonText.textContent = 'ON';
  } else {
    button.className = 'toggle-btn off';
    buttonText.textContent = 'OFF';
  }
}

/**
 * Get current state and update button
 */
async function initButtonState() {
  try {

    const response = await chrome.runtime.sendMessage({
      action: 'GET_STATE'
    });

    if (response && response.success) {
      updateButtonState(response.data.enabled);
    } else {
      console.error('❌ Failed to get initial state');
      updateButtonState(false); // Default to off
    }
  } catch (error) {
    console.error('💥 Error getting initial state:', error);
    updateButtonState(false); // Default to off
  }
}

/**
 * Toggle shader state
 */
async function toggleOverlay() {
  try {
    // Get current state first for optimistic update
    const currentResponse = await chrome.runtime.sendMessage({
      action: 'GET_STATE'
    });

    if (currentResponse && currentResponse.success) {
      // Optimistically update button immediately
      const newState = !currentResponse.data.enabled;
      updateButtonState(newState);
    }

    const response = await chrome.runtime.sendMessage({
      action: 'TOGGLE_STATE'
    });

    if (response && response.success) {
      // Update button with real state (in case of mismatch)
      updateButtonState(response.data.enabled);
    } else {
      console.error('❌ Toggle failed:', response ? response.error : 'No response');
      // Revert optimistic update on failure
      if (currentResponse && currentResponse.success) {
        updateButtonState(currentResponse.data.enabled);
      }
    }
  } catch (error) {
    console.error('💥 Error toggling shader:', error);
  }
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', () => {
  initButtonState();
  document.getElementById('toggleOverlay').addEventListener('click', toggleOverlay);
});