/*******************************************************************************
 * ✨ SHADE IT - WEBGPU OVERLAY RENDERER
 * ---------------------------------------------------------------------------
 * Creates animated shader effects on web pages using WebGPU.
 ******************************************************************************/

/*=============================================================================
 * CANVAS & WEBGPU SETUP
 * Basic WebGPU initialization and render pipeline setup
 *============================================================================*/

/** @type {GPUDevice} WebGPU device instance */
let device = null;
/** @type {GPUCanvasContext} WebGPU canvas context */
let context = null;

/**
 * Creates a canvas element that covers the entire viewport
 * @returns {HTMLCanvasElement} The created overlay canvas
 */
function createOverlayCanvas() {
    // Make a new canvas element to draw on
    const overlay = document.createElement('canvas');
    overlay.id = 'shade-overlay';
    // Add the canvas to the webpage
    document.body.appendChild(overlay);
    return overlay;
}

/**
 * Initialize WebGPU adapter and device
 * @returns {Promise<{adapter: GPUAdapter, device: GPUDevice}>} WebGPU objects
 */
async function getWebGPUDevice() {
    // Check if WebGPU is supported
    if (!navigator.gpu) {
        throw new Error('WebGPU not supported in this browser');
    }

    // Request GPU adapter (like asking for graphics card access)
    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
    });

    if (!adapter) {
        throw new Error('No appropriate GPUAdapter found');
    }

    // Request device (like opening connection to graphics card)
    const device = await adapter.requestDevice({
        requiredFeatures: [],
        requiredLimits: {}
    });

    return device;
}

/**
 * Setup WebGPU canvas context and configure surface
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {GPUDevice} device - WebGPU device
 * @returns {GPUCanvasContext} Configured canvas context
 */
function setupWebGPUContext(canvas, device) {
    // Get WebGPU context from canvas
    const context = canvas.getContext('webgpu');
    if (!context) {
        throw new Error('Failed to get WebGPU context');
    }

    // Configure the canvas surface
    context.configure({
        device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied'
    });

    return context;
}

/*=============================================================================
 * WGSL SHADER DEFINITIONS
 * All shader source code in WGSL format
 *============================================================================*/


/**
 * Load shader sources from external WGSL files
 * @param {string} shaderType - Type of shader (flames, clouds, smoke)
 * @returns {Promise<{vertex: string, fragment: string}>} WGSL shader code
 */
async function loadShaderSources(shaderType) {
    try {
        const [vertexSource, fragmentSource] = await Promise.all([
            fetch(chrome.runtime.getURL('overlay/shaders/vertex.wgsl')).then(r => r.text()),
            fetch(chrome.runtime.getURL(`overlay/shaders/${shaderType}/fragment.wgsl`)).then(r => r.text())
        ]);
        return { vertex: vertexSource, fragment: fragmentSource };
    } catch (error) {
        console.warn(`⚠️ Failed to load ${shaderType} shader.`, error);
    }
}



/*=============================================================================
 * RENDERING & ANIMATION
 * Canvas resizing and WebGPU render loop management
 *============================================================================*/

/** @type {number|null} Used to prevent too many resize events */
let resizeTimeoutId = null;

/** @type {Function|null} Resize handler for cleanup */
let handleResize = null;

/**
 * Handles canvas resizing when window size changes
 * @param {GPUCanvasContext} context - WebGPU canvas context
 * @param {HTMLCanvasElement} overlay - Canvas element to resize
 */
function setupCanvasResize(context, overlay) {
    handleResize = function resizeCanvas() {
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
                // WebGPU context will automatically handle the resize
            }
        }, 16); // About 60 times per second max
    };

    // Resize once when we start
    handleResize();
    // Resize whenever the window changes size
    window.addEventListener('resize', handleResize);
}

/**
 * Main WebGPU render loop that runs continuously
 * Uses global variables that can be updated during shader switching
 * @param {GPUDevice} device - WebGPU device
 * @param {GPUCanvasContext} context - WebGPU canvas context
 */
function renderLoop(device, context) {
    // Remember when we started for time uniforms
    const startTime = performance.now() / 1000;
    let lastFrameTime = startTime;

    // This function runs once for each frame of animation
    function render(currentTimeMs) {
        // Check if we should stop animation
        if (shouldStopAnimation) {
            return;
        }

        // Skip rendering if we don't have shader manager or resources
        if (!shaderManager || !shaderManager.currentPipeline) {
            animationFrameId = requestAnimationFrame(render);
            return;
        }

        const currentTime = currentTimeMs / 1000;
        const deltaTime = currentTime - lastFrameTime;

        // Don't draw if it's too soon (keeps smooth 60fps)
        if (deltaTime < 1 / 60) {
            animationFrameId = requestAnimationFrame(render);
            return;
        }

        lastFrameTime = currentTime;
        // How much time has passed since we started
        const elapsedTime = currentTime - startTime;

        // Update time uniform using shader manager
        if (shaderManager) {
            shaderManager.updateTime(elapsedTime);
        }

        // Create command encoder for this frame
        const commandEncoder = device.createCommandEncoder({
            label: 'Render Commands'
        });

        // Get current canvas texture
        const textureView = context.getCurrentTexture().createView();

        // Create render pass
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0, g: 0, b: 0, a: 0 }, // Transparent background
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });

        // Get resources from shader manager
        const resources = shaderManager.getRenderResources();
        renderPass.setPipeline(resources.pipeline);
        renderPass.setVertexBuffer(0, resources.vertexBuffer);
        renderPass.setBindGroup(0, resources.bindGroup);
        renderPass.draw(6); // Draw 6 vertices (2 triangles = fullscreen quad)
        renderPass.end();

        // Submit commands to GPU
        device.queue.submit([commandEncoder.finish()]);

        // Schedule the next frame
        animationFrameId = requestAnimationFrame(render);
    }

    // Start the animation
    animationFrameId = requestAnimationFrame(render);
}

/*=============================================================================
 * CLEANUP & RESOURCE MANAGEMENT
 * Cleanup functions for proper WebGPU resource disposal
 *============================================================================*/

/** @type {number|null} Animation frame ID for cleanup */
let animationFrameId = null;

/** @type {boolean} Flag to stop animation loop */
let shouldStopAnimation = false;

/**
 * Clean up WebGPU resources and remove overlay
 */
function cleanupOverlay() {
    console.log('🧹 Cleaning up overlay...');

    // Stop animation
    shouldStopAnimation = true;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // Remove listeners
    if (handleResize) {
        window.removeEventListener('resize', handleResize);
        handleResize = null;
    }
    if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
        resizeTimeoutId = null;
    }

    // Clean up WebGPU
    if (shaderManager) {
        shaderManager.destroy();
        shaderManager = null;
    }
    if (device) {
        device.destroy();
        device = null;
    }

    // Reset globals
    context = null;
    currentShaderType = 'flames';
    shouldStopAnimation = false;

    // Remove DOM element
    const overlay = document.getElementById('shade-overlay');
    if (overlay) overlay.remove();
}

/*=============================================================================
 * SHADER MANAGEMENT
 *============================================================================*/

/** @type {string} Current shader type */
let currentShaderType = 'flames';

/**
 * Main initialization function that sets up WebGPU overlay
 * @param {string} shaderType - Type of shader to initialize with
 * @returns {Promise<void>}
 */
async function initializeWebGPU(shaderType = 'flames') {
    try {
        currentShaderType = shaderType;

        // Create the canvas to draw on
        const overlay = createOverlayCanvas();

        // Initialize WebGPU adapter and device
        const gpuDevice = await getWebGPUDevice();

        // Store device globally for cleanup
        device = gpuDevice;

        // Setup WebGPU canvas context
        const canvasContext = setupWebGPUContext(overlay, device);

        // Store context globally
        context = canvasContext;

        // Create shader manager if not exists
        if (!shaderManager) {
            shaderManager = new ShaderManager(device);
            shaderManager.createSharedResources();
        }

        // Load shader code from external files
        const { vertex: vertexCode, fragment: fragmentCode } = await loadShaderSources(shaderType);

        // Create pipeline using shader manager
        shaderManager.createPipeline(shaderType, vertexCode, fragmentCode);

        // Set as current pipeline
        shaderManager.setCurrentPipeline(shaderType);

        // Set up window resizing
        setupCanvasResize(context, overlay);

        // Start the render loop (uses global variables)
        renderLoop(device, context);

        console.log(`🚀 WebGPU ${shaderType} shader ready!`);

    } catch (error) {
        console.error('💥 Failed to initialize WebGPU:', error);
        throw error;
    }
}

/**
 * Toggle overlay visibility
 * @param {boolean} enabled - Whether to show the overlay
 * @param {string} shaderType - Type of shader to use when enabling
 */
function toggleOverlayVisibility(enabled, shaderType = 'flames') {
    if (enabled) {
        // Update current shader type
        currentShaderType = shaderType;
        // If should be enabled, create/recreate overlay
        const overlay = document.getElementById('shade-overlay');
        if (!overlay) {
            initializeWebGPU(shaderType);
        }
    } else {
        // If should be disabled, clean up properly
        cleanupOverlay();
    }
}

/**
 * Change shader type dynamically using shader manager
 * @param {string} shaderType - New shader type to load
 */
async function changeShader(shaderType) {
    if (shaderType === currentShaderType) {
        return;
    }

    if (!shaderManager || !device) {
        console.error('💥 No shader manager or device available');
        return;
    }

    console.log(`🔄 Switching to ${shaderType} shader...`);

    // Load shader sources and create pipeline
    const { vertex: vertexCode, fragment: fragmentCode } = await loadShaderSources(shaderType);
    shaderManager.createPipeline(shaderType, vertexCode, fragmentCode);
    shaderManager.setCurrentPipeline(shaderType);

    currentShaderType = shaderType;
    console.log(`✅ Switched to ${shaderType} shader!`);
}

/*=============================================================================
 * MESSAGE HANDLING
 *============================================================================*/

/**
 * Check initial shader state and init WebGPU accordingly
 */
async function checkInitialState() {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'GET_STATE'
        });

        if (response && response.success) {
            if (response.data.enabled) {
                await initializeWebGPU(response.data.shaderType);
            }
        }
    } catch (error) {
        console.error('💥 Error getting initial state:', error);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, data } = message;

    if (type === 'SHADER_STATE_CHANGED') {
        toggleOverlayVisibility(data.enabled, data.shaderType);
    } else if (type === 'CHANGE_SHADER' && data.enabled) {
        changeShader(data.shaderType);
    } else if (type === 'CLEANUP_SHADER') {
        cleanupOverlay();
    } else {
        return false;
    }

    sendResponse({ received: true });
    return true;
});

// Initialize when page is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkInitialState);
} else {
    checkInitialState();
}

/*=============================================================================
 * SHADER PIPELINE SYSTEM
 *============================================================================*/
class ShaderManager {
    constructor(device) {
        this.device = device;
        this.pipelines = new Map(); // Cache for created pipelines
        this.currentPipeline = null;
        this.resources = {
            vertexBuffer: null,
            uniformBuffer: null,
            bindGroup: null
        };
    }

    /**
     * Create shared resources used by all shaders
     */
    createSharedResources() {
        // Create vertex buffer for fullscreen quad (shared by all shaders)
        this.resources.vertexBuffer = this.createVertexBuffer();

        // Create uniform buffer (shared by all shaders)
        this.resources.uniformBuffer = this.createUniformBuffer();
    }

    /**
     * Create vertex buffer for fullscreen quad
     * @returns {GPUBuffer} Vertex buffer
     */
    createVertexBuffer() {
        const vertices = new Float32Array([
            -1.0, -1.0,  // bottom left
            1.0, -1.0,  // bottom right
            1.0, 1.0,  // top right
            -1.0, -1.0,  // bottom left  
            1.0, 1.0,  // top right
            -1.0, 1.0   // top left
        ]);

        const vertexBuffer = this.device.createBuffer({
            label: 'Shared Fullscreen Quad Vertices',
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        this.device.queue.writeBuffer(vertexBuffer, 0, vertices);
        return vertexBuffer;
    }

    /**
     * Create uniform buffer for time and other uniforms
     * @returns {GPUBuffer} Uniform buffer
     */
    createUniformBuffer() {
        return this.device.createBuffer({
            label: 'Shared Time Uniform Buffer',
            size: 16, // 16 bytes for alignment
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
    }

    /**
     * Create a render pipeline from WGSL shader code
     * @param {string} name - Shader name (for caching)
     * @param {string} vertexCode - WGSL vertex shader code
     * @param {string} fragmentCode - WGSL fragment shader code
     * @returns {Object} Pipeline and bind group
     */
    createPipeline(name, vertexCode, fragmentCode) {
        // Check if pipeline already exists in cache
        if (this.pipelines.has(name)) {
            return this.pipelines.get(name);
        }

        // Create shader modules
        let vertexShader, fragmentShader;
        try {
            vertexShader = this.device.createShaderModule({
                label: `${name} Vertex Shader`,
                code: vertexCode
            });

            fragmentShader = this.device.createShaderModule({
                label: `${name} Fragment Shader`,
                code: fragmentCode
            });

            console.log(`🔨 Created ${name} pipeline`);
        } catch (error) {
            console.error(`💥 Shader compilation failed for ${name}:`, error);
            throw error;
        }

        // Create bind group layout for uniforms
        const bindGroupLayout = this.device.createBindGroupLayout({
            label: `${name} Bind Group Layout`,
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' }
            }]
        });

        // Create bind group
        const bindGroup = this.device.createBindGroup({
            label: `${name} Bind Group`,
            layout: bindGroupLayout,
            entries: [{
                binding: 0,
                resource: { buffer: this.resources.uniformBuffer }
            }]
        });

        // Create pipeline layout
        const pipelineLayout = this.device.createPipelineLayout({
            label: `${name} Pipeline Layout`,
            bindGroupLayouts: [bindGroupLayout]
        });

        // Create render pipeline
        const pipeline = this.device.createRenderPipeline({
            label: `${name} Render Pipeline`,
            layout: pipelineLayout,
            vertex: {
                module: vertexShader,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 8, // 2 floats * 4 bytes
                    attributes: [{
                        format: 'float32x2',
                        offset: 0,
                        shaderLocation: 0
                    }]
                }]
            },
            fragment: {
                module: fragmentShader,
                entryPoint: 'fs_main',
                targets: [{
                    format: navigator.gpu.getPreferredCanvasFormat(),
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha'
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha'
                        }
                    }
                }]
            },
            primitive: {
                topology: 'triangle-list'
            }
        });

        const pipelineData = {
            pipeline,
            bindGroup
        };

        // Cache the pipeline
        this.pipelines.set(name, pipelineData);
        return pipelineData;
    }

    /**
     * Set current active pipeline
     * @param {string} name - Shader name
     */
    setCurrentPipeline(name) {
        if (this.pipelines.has(name)) {
            this.currentPipeline = this.pipelines.get(name);
            this.resources.bindGroup = this.currentPipeline.bindGroup;
            return true;
        }
        return false;
    }

    /**
     * Get current pipeline resources for rendering
     * @returns {Object} Render resources
     */
    getRenderResources() {
        if (!this.currentPipeline) {
            throw new Error('No active pipeline set');
        }

        return {
            pipeline: this.currentPipeline.pipeline,
            vertexBuffer: this.resources.vertexBuffer,
            uniformBuffer: this.resources.uniformBuffer,
            bindGroup: this.resources.bindGroup
        };
    }

    /**
     * Update time uniform
     * @param {number} time - Current time in seconds
     */
    updateTime(time) {
        if (this.resources.uniformBuffer) {
            const timeData = new Float32Array([time, 0.0, 0.0, 0.0]);
            this.device.queue.writeBuffer(this.resources.uniformBuffer, 0, timeData);
        }
    }

    /**
     * Clean up all resources
     */
    destroy() {
        // Destroy buffers
        if (this.resources.vertexBuffer) {
            this.resources.vertexBuffer.destroy();
        }
        if (this.resources.uniformBuffer) {
            this.resources.uniformBuffer.destroy();
        }

        // Clear caches
        this.pipelines.clear();
        this.currentPipeline = null;
        this.resources = {
            vertexBuffer: null,
            uniformBuffer: null,
            bindGroup: null
        };
    }
}

/** @type {ShaderManager} Global shader manager instance */
let shaderManager = null;

