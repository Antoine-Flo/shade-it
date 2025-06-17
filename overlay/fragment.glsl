#version 300 es
precision highp float;
in vec2 uv;
out vec4 fragColor;
uniform float time;

void main() {
    // Create dramatic animated effects
    vec2 center = vec2(0.5, 0.5);
    vec2 pos = uv - center;
    float dist = length(pos);
    
    // Multiple wave patterns
    float wave1 = sin(dist * 20.0 - time * 8.0) * 0.5 + 0.5;
    float wave2 = cos(dist * 15.0 + time * 6.0) * 0.5 + 0.5;
    float wave3 = sin(uv.x * 10.0 + time * 4.0) * cos(uv.y * 10.0 + time * 3.0);
    
    // Color cycling with dramatic intensity
    float colorCycle = time * 2.0;
    vec3 color1 = vec3(1.0, 0.2, 0.8); // Hot pink
    vec3 color2 = vec3(0.2, 0.8, 1.0); // Cyan
    vec3 color3 = vec3(1.0, 0.8, 0.2); // Gold
    
    // Interpolate between colors based on waves
    vec3 baseColor = mix(color1, color2, wave1);
    baseColor = mix(baseColor, color3, wave2);
    
    // Dramatic pulsing intensity
    float pulse = 0.4 + 0.6 * sin(time * 3.0);
    float intensity = pulse * (0.8 + 0.4 * wave3);
    
    // Add radial gradient for more drama
    float radialGradient = 1.0 - smoothstep(0.0, 0.8, dist);
    intensity *= (0.5 + 0.5 * radialGradient);
    
    // Combine all effects
    vec3 finalColor = baseColor * intensity;
    
    // Add some edge effects
    float edge = smoothstep(0.0, 0.1, uv.x) * smoothstep(0.0, 0.1, uv.y) * 
                 smoothstep(0.0, 0.1, 1.0 - uv.x) * smoothstep(0.0, 0.1, 1.0 - uv.y);
    
    // Higher alpha for more dramatic visibility
    float alpha = 0.7 * intensity * edge;
    
    fragColor = vec4(finalColor, alpha);
}