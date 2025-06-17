  // This function handles toggling the red overlay shade on/off
  const toggleOverlay = async () => {
    // Get the currently active tab in the current window
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Execute a script in the context of the active tab
    chrome.scripting.executeScript({
      // Specify which tab to run the script in
      target: { tabId: tab.id },
      
      // This function runs in the context of the web page
      function: () => {
        // Find the overlay element that was created by content.js
        const overlay = document.getElementById('shade-overlay');
        
        // If overlay exists, toggle its visibility
        if (overlay) {
          // If display is 'none', make it 'block', otherwise make it 'none'
          // This effectively toggles the overlay on/off
          overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';  
        }
      }
    });
  };

  document.getElementById('toggleOverlay').addEventListener('click', toggleOverlay);