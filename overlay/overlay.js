// This file creates a WebGL overlay that shows animated effects on web pages

// Canvas setup - creates the drawing area
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

// WebGL setup functions - these help create shaders (graphics programs)

// Creates a single shader from source code
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

// Links two shaders together to make a complete graphics program
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

// Sets up the shape we want to draw (a rectangle covering the whole screen)
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

// Used to prevent too many resize events
let resizeTimeoutId = null;

// Handles when the window size changes
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

// The main animation loop - this runs over and over to create movement
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

// Main setup function - this starts everything
async function initWebGL() {
    console.log('Initializing WebGL overlay...');

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
    const vertexSource = await fetch(chrome.runtime.getURL('overlay/shaders/flames/vertex.glsl')).then(r => r.text());
    const fragmentSource = await fetch(chrome.runtime.getURL('overlay/shaders/flames/fragment.glsl')).then(r => r.text());

    // Create both types of shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

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

// Start everything when the page is ready
if (document.readyState === 'loading') {
    // Page is still loading, wait for it to finish
    document.addEventListener('DOMContentLoaded', initWebGL);
} else {
    // Page is already loaded, start right away
    initWebGL();
}