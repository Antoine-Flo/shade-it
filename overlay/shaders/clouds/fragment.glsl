#version 300 es
precision highp float;
in vec2 uv;
out vec4 fragColor;
uniform float time;

// Simple noise function inspired by classic techniques
float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float n = i.x + i.y * 57.0 + i.z * 113.0;
    return mix(
        mix(mix(fract(sin(n) * 43758.5453),
                fract(sin(n + 1.0) * 43758.5453), f.x),
            mix(fract(sin(n + 57.0) * 43758.5453),
                fract(sin(n + 58.0) * 43758.5453), f.x), f.y),
        mix(mix(fract(sin(n + 113.0) * 43758.5453),
                fract(sin(n + 114.0) * 43758.5453), f.x),
            mix(fract(sin(n + 170.0) * 43758.5453),
                fract(sin(n + 171.0) * 43758.5453), f.x), f.y), f.z);
}

// Fractional Brownian Motion for cloud-like patterns
float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise3D(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    
    return value;
}

// Simple cloud density function
float cloudDensity(vec3 pos) {
    // Move clouds from bottom to top and left to right
    vec3 cloudPos = pos - vec3(-time * 0.15, -time * 0.1, time * 0.08);
    
    // Base cloud shape with multiple octaves
    float density = fbm(cloudPos * 1.2);
    density += 0.5 * fbm(cloudPos * 2.4);
    density += 0.25 * fbm(cloudPos * 4.8);
    
    // Create cloud layers - spread across the screen
    float heightFactor = smoothstep(-1.2, 0.5, pos.y) * smoothstep(1.2, -0.5, pos.y);
    density *= heightFactor;
    
    // Make clouds more visible
    density = smoothstep(0.3, 0.8, density);
    
    return clamp(density, 0.0, 1.0);
}

// Simple raymarching for volumetric clouds
vec4 renderClouds(vec3 rayOrigin, vec3 rayDirection) {
    vec4 color = vec4(0.0);
    float t = 0.0;
    
    // Sky colors
    vec3 skyColor = vec3(0.4, 0.6, 0.9);
    vec3 cloudColor = vec3(0.9, 0.9, 0.95);
    vec3 cloudShadow = vec3(0.6, 0.65, 0.75);
    
    // Sun direction for simple lighting
    vec3 sunDir = normalize(vec3(0.3, 0.8, -0.5));
    
    // Raymarching loop
    for (int i = 0; i < 32; i++) {
        vec3 pos = rayOrigin + t * rayDirection;
        
        // Stop if we're too far or too high/low
        if (t > 5.0 || pos.y > 1.0 || pos.y < -2.0) break;
        
        float density = cloudDensity(pos);
        
        if (density > 0.01) {
            // Simple lighting - sample density offset toward sun
            float lightDensity = cloudDensity(pos + sunDir * 0.1);
            float lighting = clamp((density - lightDensity) * 6.0, 0.0, 1.0);
            
            // Mix cloud colors based on lighting
            vec3 finalCloudColor = mix(cloudShadow, cloudColor, lighting);
            
            // Add some blue tint from sky
            finalCloudColor = mix(finalCloudColor, skyColor, 0.1);
            
            // Accumulate color
            float alpha = density * 0.3;
            alpha = clamp(alpha, 0.0, 1.0);
            
            vec4 cloudContrib = vec4(finalCloudColor * alpha, alpha);
            color = color + cloudContrib * (1.0 - color.a);
            
            // Early exit if we've accumulated enough opacity
            if (color.a > 0.95) break;
        }
        
        // Adaptive step size - smaller steps when we're in clouds
        t += mix(0.08, 0.02, density);
    }
    
    return color;
}

void main() {
    // Convert UV to screen coordinates
    vec2 screenPos = (uv - 0.5) * 2.0;
    
    // Simple camera setup - look more toward the center
    vec3 rayOrigin = vec3(0.0, -0.5, -2.0);
    // Flip vertical: -screenPos.y instead of screenPos.y
    vec3 rayDirection = normalize(vec3(screenPos.x, -screenPos.y, 1.5));
    
    // Render volumetric clouds
    vec4 clouds = renderClouds(rayOrigin, rayDirection);
    
    // Sky gradient as background
    float skyGradient = smoothstep(-0.5, 1.0, screenPos.y);
    vec3 skyColor = mix(vec3(0.6, 0.8, 1.0), vec3(0.2, 0.4, 0.8), skyGradient);
    
    // Composite clouds over sky
    vec3 finalColor = mix(skyColor, clouds.rgb, clouds.a);
    
    // Output with alpha based on cloud density - more visible now
    float alpha = clouds.a * 0.9;
    fragColor = vec4(finalColor, alpha);
}