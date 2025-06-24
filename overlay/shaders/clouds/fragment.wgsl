struct FragmentInput {
    @location(0) uv: vec2<f32>,
}

struct Uniforms {
    time: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

fn noise3D(p: vec3<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let f_smooth = f * f * (3.0 - 2.0 * f);
    
    let n = i.x + i.y * 57.0 + i.z * 113.0;
    return mix(
        mix(mix(fract(sin(n) * 43758.5453),
                fract(sin(n + 1.0) * 43758.5453), f_smooth.x),
            mix(fract(sin(n + 57.0) * 43758.5453),
                fract(sin(n + 58.0) * 43758.5453), f_smooth.x), f_smooth.y),
        mix(mix(fract(sin(n + 113.0) * 43758.5453),
                fract(sin(n + 114.0) * 43758.5453), f_smooth.x),
            mix(fract(sin(n + 170.0) * 43758.5453),
                fract(sin(n + 171.0) * 43758.5453), f_smooth.x), f_smooth.y), f_smooth.z);
}

fn fbm_clouds(p_input: vec3<f32>) -> f32 {
    var p = p_input;
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    
    for (var i = 0; i < 4; i++) {
        value += amplitude * noise3D(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    
    return value;
}

fn cloudDensity(pos: vec3<f32>) -> f32 {
    let cloudPos = pos - vec3<f32>(-uniforms.time * 0.15, -uniforms.time * 0.1, uniforms.time * 0.08);
    
    var density = fbm_clouds(cloudPos * 1.2);
    density += 0.5 * fbm_clouds(cloudPos * 2.4);
    density += 0.25 * fbm_clouds(cloudPos * 4.8);
    
    let heightFactor = smoothstep(-1.2, 0.5, pos.y) * smoothstep(1.2, -0.5, pos.y);
    density *= heightFactor;
    
    density = smoothstep(0.3, 0.8, density);
    
    return clamp(density, 0.0, 1.0);
}

fn renderClouds(rayOrigin: vec3<f32>, rayDirection: vec3<f32>) -> vec4<f32> {
    var color = vec4<f32>(0.0);
    var t = 0.0;
    
    let skyColor = vec3<f32>(0.4, 0.6, 0.9);
    let cloudColor = vec3<f32>(0.9, 0.9, 0.95);
    let cloudShadow = vec3<f32>(0.6, 0.65, 0.75);
    let sunDir = normalize(vec3<f32>(0.3, 0.8, -0.5));
    
    for (var i = 0; i < 32; i++) {
        let pos = rayOrigin + t * rayDirection;
        
        if (t > 5.0 || pos.y > 1.0 || pos.y < -2.0) { break; }
        
        let density = cloudDensity(pos);
        
        if (density > 0.01) {
            let lightDensity = cloudDensity(pos + sunDir * 0.1);
            let lighting = clamp((density - lightDensity) * 6.0, 0.0, 1.0);
            
            let finalCloudColor = mix(cloudShadow, cloudColor, lighting);
            let finalCloudColorWithSky = mix(finalCloudColor, skyColor, 0.1);
            
            var alpha = density * 0.3;
            alpha = clamp(alpha, 0.0, 1.0);
            
            let cloudContrib = vec4<f32>(finalCloudColorWithSky * alpha, alpha);
            color = color + cloudContrib * (1.0 - color.a);
            
            if (color.a > 0.95) { break; }
        }
        
        t += mix(0.08, 0.02, density);
    }
    
    return color;
}

@fragment
fn fs_main(input: FragmentInput) -> @location(0) vec4<f32> {
    let screenPos = (input.uv - 0.5) * 2.0;
    
    let rayOrigin = vec3<f32>(0.0, -0.5, -2.0);
    let rayDirection = normalize(vec3<f32>(screenPos.x, -screenPos.y, 1.5));
    
    let clouds = renderClouds(rayOrigin, rayDirection);
    
    let skyGradient = smoothstep(-0.5, 1.0, screenPos.y);
    let skyColor = mix(vec3<f32>(0.6, 0.8, 1.0), vec3<f32>(0.2, 0.4, 0.8), skyGradient);
    
    let finalColor = mix(skyColor, clouds.rgb, clouds.a);
    let alpha = clouds.a * 0.9;
    
    return vec4<f32>(finalColor, alpha);
} 