// Canvas setup
function createOverlayCanvas() {
    const overlay = document.createElement('canvas');
    overlay.id = 'shade-overlay';
    // Set initial size to prevent layout shifts
    overlay.width = window.innerWidth;
    overlay.height = window.innerHeight;
    document.body.appendChild(overlay);
    return overlay;
}

// WebGL initialization and setup
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

function setupVertexBuffer(gl, program) {
    const vertices = new Float32Array([
        -1, -1,
        1, -1,
        1, 1,
        -1, 1
    ]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
}

let resizeTimeoutId = null;

function setupCanvasResize(gl, overlay) {
    function resizeCanvas() {
        // Clear any pending resize
        if (resizeTimeoutId) {
            clearTimeout(resizeTimeoutId);
        }

        // Debounce resize to prevent excessive calls
        resizeTimeoutId = setTimeout(() => {
            const width = window.innerWidth;
            const height = window.innerHeight;

            // Only resize if dimensions actually changed
            if (overlay.width !== width || overlay.height !== height) {
                overlay.width = width;
                overlay.height = height;
                gl.viewport(0, 0, width, height);
                console.log('Canvas resized to:', width, 'x', height);
            }
        }, 16); // ~60fps debounce
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

function renderLoop(gl, program) {
    const timeLocation = gl.getUniformLocation(program, 'time');
    const startTime = performance.now() / 1000; // Convert to seconds for better precision
    let lastFrameTime = startTime;

    function render(currentTimeMs) {
        const currentTime = currentTimeMs / 1000; // Convert to seconds
        const deltaTime = currentTime - lastFrameTime;

        // Skip frame if too soon (basic frame rate limiting)
        if (deltaTime < 1 / 60) {
            requestAnimationFrame(render);
            return;
        }

        lastFrameTime = currentTime;
        const elapsedTime = currentTime - startTime;

        // Clear with full transparency
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.uniform1f(timeLocation, elapsedTime); // Use elapsed time instead of absolute time
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

        requestAnimationFrame(render);
    }

    console.log('Starting render loop');
    requestAnimationFrame(render);
}

// Main initialization function
async function initWebGL() {
    console.log('Initializing WebGL overlay...');

    const overlay = createOverlayCanvas();
    const gl = overlay.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: false,
        antialias: false, // Disable antialiasing to reduce flickering
        preserveDrawingBuffer: false
    });

    if (!gl) {
        console.error('WebGL2 not supported');
        return;
    }

    console.log('WebGL2 context created successfully');

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    setupCanvasResize(gl, overlay);

    const vertexSource = await fetch(chrome.runtime.getURL('overlay/vertex.glsl')).then(r => r.text());
    const fragmentSource = await fetch(chrome.runtime.getURL('overlay/fragment.glsl')).then(r => r.text());

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
        console.error('Failed to create shaders');
        return;
    }

    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) {
        console.error('Failed to create program');
        return;
    }

    console.log('Shaders compiled and program linked successfully');

    setupVertexBuffer(gl, program);
    renderLoop(gl, program);

    console.log('WebGL overlay initialized successfully');
}

// Wait for DOM to be fully loaded before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWebGL);
} else {
    initWebGL();
}