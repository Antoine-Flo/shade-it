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
 * Update shader selection dropdown
 * @param {string} shaderType - Current shader type
 */
function updateShaderSelection(shaderType) {
  const shaderSelect = document.getElementById('shaderSelect');
  shaderSelect.value = shaderType;
}

/**
 * Get current state and update UI
 */
async function initPopupState() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'GET_STATE'
    });

    if (response && response.success) {
      updateButtonState(response.data.enabled);
      updateShaderSelection(response.data.shaderType);
    } else {
      console.error('❌ Failed to get initial state');
      updateButtonState(false);
      updateShaderSelection('flames');
    }
  } catch (error) {
    console.error('💥 Error getting initial state:', error);
    updateButtonState(false);
    updateShaderSelection('flames');
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
      // Update UI with real state (in case of mismatch)
      updateButtonState(response.data.enabled);
      updateShaderSelection(response.data.shaderType);
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

/**
 * Handle shader selection change
 */
async function handleShaderChange() {
  const shaderSelect = document.getElementById('shaderSelect');
  const selectedShader = shaderSelect.value;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'CHANGE_SHADER',
      data: { shaderType: selectedShader }
    });

    if (response && response.success) {
      console.log('Shader changed to:', selectedShader);
    } else {
      console.error('❌ Failed to change shader:', response ? response.error : 'No response');
    }
  } catch (error) {
    console.error('💥 Error changing shader:', error);
  }
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', () => {
  initPopupState();
  document.getElementById('toggleOverlay').addEventListener('click', toggleOverlay);
  document.getElementById('shaderSelect').addEventListener('change', handleShaderChange);
});