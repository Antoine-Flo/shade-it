/*******************************************************************************
 * ✨ SHADE IT - WEBGL OVERLAY RENDERER
 * ---------------------------------------------------------------------------
 * Creates animated shader effects on web pages using WebGL2.
 ******************************************************************************/

/*=============================================================================
 * CANVAS & WEBGL SETUP
 * Basic WebGL initialization and shader compilation
 *============================================================================*/

/**
 * Creates a canvas element that covers the entire viewport
 * @returns {HTMLCanvasElement} The created overlay canvas
 */
function createOverlayCanvas() {
    // Make a new canvas element to draw on
    const overlay = document.createElement('canvas');
    overlay.id = 'shade-overlay';
    // Set the canvas size to match the window size
    overlay.width = window.innerWidth;
    overlay.height = window.innerHeight;
    // Add the canvas to the webpage
    document.body.appendChild(overlay);
    return overlay;
}

/**
 * Creates a single shader from source code
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {number} type - Shader type (VERTEX_SHADER or FRAGMENT_SHADER)
 * @param {string} source - Shader source code
 * @returns {WebGLShader|null} Compiled shader or null if failed
 */
function createShader(gl, type, source) {
    // Make a new shader object
    const shader = gl.createShader(type);
    // Give it the shader code
    gl.shaderSource(shader, source);
    // Turn the code into something the graphics card can use
    gl.compileShader(shader);

    // Check if the shader compiled correctly
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

/**
 * Links two shaders together to make a complete graphics program
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {WebGLShader} vertexShader - Compiled vertex shader
 * @param {WebGLShader} fragmentShader - Compiled fragment shader
 * @returns {WebGLProgram|null} Linked program or null if failed
 */
function createProgram(gl, vertexShader, fragmentShader) {
    // Create a new program to hold both shaders
    const program = gl.createProgram();
    // Attach both shaders to the program
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    // Connect everything together
    gl.linkProgram(program);

    // Check if linking worked
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

/**
 * Sets up vertex buffer with a fullscreen quad
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {WebGLProgram} program - Shader program
 */
function setupVertexBuffer(gl, program) {
    // Four corners of a rectangle that covers the screen
    // -1 to 1 in both x and y directions
    const vertices = new Float32Array([
        -1, -1,  // bottom left
        1, -1,   // bottom right
        1, 1,    // top right
        -1, 1    // top left
    ]);

    // Create a buffer to hold our shape data
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    // Put our rectangle data into the buffer
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Tell the shader where to find the position data
    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    // Each position has 2 numbers (x and y)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
}

/*=============================================================================
 * RENDERING & ANIMATION
 * Canvas resizing and render loop management
 *============================================================================*/

/** @type {number|null} Used to prevent too many resize events */
let resizeTimeoutId = null;

/**
 * Handles canvas resizing when window size changes
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {HTMLCanvasElement} overlay - Canvas element to resize
 */
function setupCanvasResize(gl, overlay) {
    function resizeCanvas() {
        // Cancel any pending resize to avoid doing it too often
        if (resizeTimeoutId) {
            clearTimeout(resizeTimeoutId);
        }

        // Wait a bit before actually resizing (smooth performance)
        resizeTimeoutId = setTimeout(() => {
            const width = window.innerWidth;
            const height = window.innerHeight;

            // Only resize if the size actually changed
            if (overlay.width !== width || overlay.height !== height) {
                overlay.width = width;
                overlay.height = height;
                // Tell WebGL about the new size
                gl.viewport(0, 0, width, height);
                console.log('Canvas resized to:', width, 'x', height);
            }
        }, 16); // About 60 times per second max
    }

    // Resize once when we start
    resizeCanvas();
    // Resize whenever the window changes size
    window.addEventListener('resize', resizeCanvas);
}

/**
 * Main animation loop that runs continuously
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {WebGLProgram} program - Shader program to render
 */
function renderLoop(gl, program) {
    // Get the location where we can send time info to the shader
    const timeLocation = gl.getUniformLocation(program, 'time');
    // Remember when we started
    const startTime = performance.now() / 1000; // Convert to seconds
    let lastFrameTime = startTime;

    // This function runs once for each frame of animation
    function render(currentTimeMs) {
        const currentTime = currentTimeMs / 1000; // Convert to seconds
        const deltaTime = currentTime - lastFrameTime;

        // Don't draw if it's too soon (keeps smooth 60fps)
        if (deltaTime < 1 / 60) {
            requestAnimationFrame(render);
            return;
        }

        lastFrameTime = currentTime;
        // How much time has passed since we started
        const elapsedTime = currentTime - startTime;

        // Clear the screen with transparent background
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Use our shader program
        gl.useProgram(program);
        // Send the current time to the shader (for animation)
        gl.uniform1f(timeLocation, elapsedTime);
        // Draw our rectangle (4 corners connected as a fan)
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

        // Schedule the next frame
        requestAnimationFrame(render);
    }

    console.log('Starting render loop');
    // Start the animation
    requestAnimationFrame(render);
}

/*=============================================================================
 * SHADER MANAGEMENT
 * Shader loading, switching and overlay control
 *============================================================================*/

/** @type {string} Current shader type */
let currentShaderType = 'flames';

/**
 * Load shader files for a specific shader type
 * @param {string} shaderType - Type of shader (flames, clouds, etc.)
 * @returns {Promise<{vertex: string, fragment: string}>} Shader source code
 */
async function loadShaderSources(shaderType) {
    const vertexSource = await fetch(chrome.runtime.getURL(`overlay/shaders/${shaderType}/vertex.glsl`)).then(r => r.text());
    const fragmentSource = await fetch(chrome.runtime.getURL(`overlay/shaders/${shaderType}/fragment.glsl`)).then(r => r.text());
    return { vertex: vertexSource, fragment: fragmentSource };
}

/**
 * Main initialization function that sets up WebGL overlay
 * @param {string} shaderType - Type of shader to initialize with
 * @returns {Promise<void>}
 */
async function initWebGL(shaderType = 'flames') {
    currentShaderType = shaderType;

    // Create the canvas to draw on
    const overlay = createOverlayCanvas();
    // Get WebGL context (the drawing interface)
    const gl = overlay.getContext('webgl2', {
        alpha: true,                    // Allow transparency
        premultipliedAlpha: false,      // Handle transparency our way
        antialias: true,                // Smooth edges
        preserveDrawingBuffer: false    // Don't keep old frames in memory
    });

    // Check if WebGL is available
    if (!gl) {
        console.error('WebGL2 not supported');
        return;
    }

    console.log('WebGL2 context created successfully');

    // Enable blending so transparency works correctly
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Set up window resizing
    setupCanvasResize(gl, overlay);

    // Load the shader files from the extension
    const shaderSources = await loadShaderSources(shaderType);

    // Create both types of shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, shaderSources.vertex);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, shaderSources.fragment);

    // Make sure both shaders were created successfully
    if (!vertexShader || !fragmentShader) {
        console.error('Failed to create shaders');
        return;
    }

    // Combine the shaders into a complete program
    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) {
        console.error('Failed to create program');
        return;
    }

    console.log('Shaders compiled and program linked successfully');

    // Set up the rectangle shape we'll draw
    setupVertexBuffer(gl, program);
    // Start the animation loop
    renderLoop(gl, program);

    console.log('WebGL overlay initialized successfully');
}

/**
 * Toggle overlay visibility
 * @param {boolean} enabled - Whether to show the overlay
 */
function toggleOverlayVisibility(enabled) {
    const overlay = document.getElementById('shade-overlay');

    if (overlay) {
        overlay.style.display = enabled ? 'block' : 'none';
    } else if (enabled) {
        // If overlay doesn't exist but should be enabled, create it
        initWebGL(currentShaderType);
    }
}

/**
 * Change shader type dynamically
 * @param {string} shaderType - New shader type to load
 */
async function changeShader(shaderType) {
    if (shaderType === currentShaderType) {
        return;
    }

    // Remove existing overlay
    const existingOverlay = document.getElementById('shade-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // Initialize with new shader type
    currentShaderType = shaderType;
    await initWebGL(shaderType);
}

/*=============================================================================
 * MESSAGE HANDLING & INITIALIZATION
 * Extension message listeners and startup logic
 *============================================================================*/

/**
 * Check initial shader state and init WebGL accordingly
 */
async function checkInitialState() {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'GET_STATE'
        });

        if (response && response.success) {
            if (response.data.enabled) {
                await initWebGL(response.data.shaderType);
            }
        }
    } catch (error) {
        console.error('💥 Error getting initial state:', error);
    }
}

/**
 * Listen for messages from StateManager
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SHADER_STATE_CHANGED') {
        toggleOverlayVisibility(message.data.enabled);

        // Send response to acknowledge receipt
        sendResponse({ received: true });
        return true; // Indicate async response
    }

    if (message.type === 'CHANGE_SHADER') {
        if (message.data.enabled) {
            changeShader(message.data.shaderType);
        }

        // Send response to acknowledge receipt
        sendResponse({ received: true });
        return true; // Indicate async response
    }

    // Don't return true for unhandled messages
    return false;
});

// Start everything when the page is ready
if (document.readyState === 'loading') {
    // Page is still loading, wait for it to finish
    document.addEventListener('DOMContentLoaded', checkInitialState);
} else {
    // Page is already loaded, start right away
    checkInitialState();
}