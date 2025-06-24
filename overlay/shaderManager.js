/*******************************************************************************
 * 🎨 SHADER MANAGER
 * ---------------------------------------------------------------------------
 * Manages WebGPU shader pipelines, resources, and switching
 ******************************************************************************/

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