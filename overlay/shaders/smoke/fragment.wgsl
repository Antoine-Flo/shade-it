struct FragmentInput {
    @location(0) uv: vec2<f32>,
}

struct Uniforms {
    time: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

fn rand_smoke(n: vec2<f32>) -> f32 {
    return fract(sin(dot(n, vec2<f32>(12.9898, 4.1414))) * 43758.5453);
}

fn noise_smoke(p: vec2<f32>) -> f32 {
    let ip = floor(p);
    let u = fract(p);
    let u_smooth = u * u * (3.0 - 2.0 * u);
    
    let res = mix(
        mix(rand_smoke(ip), rand_smoke(ip + vec2<f32>(1.0, 0.0)), u_smooth.x),
        mix(rand_smoke(ip + vec2<f32>(0.0, 1.0)), rand_smoke(ip + vec2<f32>(1.0, 1.0)), u_smooth.x),
        u_smooth.y);
    return res * res;
}

fn fbm_smoke(x_input: vec2<f32>) -> f32 {
    var x = x_input;
    var v = 0.0;
    var a = 0.5;
    let shift = vec2<f32>(100.0);
    
    // Rotation matrix
    let cos_val = cos(0.5);
    let sin_val = sin(0.5);
    let rot = mat2x2<f32>(cos_val, sin_val, -sin_val, cos_val);
    
    for (var i = 0; i < 5; i++) {
        v += a * noise_smoke(x);
        x = rot * x * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

@fragment
fn fs_main(input: FragmentInput) -> @location(0) vec4<f32> {
    let iResolution = vec2<f32>(800.0, 600.0);
    let fragCoord = input.uv * iResolution;
    let iTime = uniforms.time;
    
    let shake = vec2<f32>(sin(iTime * 1.5) * 0.01, cos(iTime * 2.7) * 0.01);
    
    // Matrix multiplication in WGSL
    let mat_vals = mat2x2<f32>(8.0, -6.0, 6.0, 8.0);
    let p = ((fragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5) / iResolution.y * mat_vals;
    
    var o = vec4<f32>(0.0);
    let f = 3.0 + fbm_smoke(p + vec2<f32>(iTime * 7.0, 0.0));
    
    for (var i = 0.0; i < 50.0; i += 1.0) {
        let v = p + cos(i * i + (iTime + p.x * 0.1) * 0.03 + i * vec2<f32>(11.0, 9.0)) * 5.0 + 
               vec2<f32>(sin(iTime * 4.0 + i) * 0.005, cos(iTime * 4.5 - i) * 0.005);
        
        let tailNoise = fbm_smoke(v + vec2<f32>(iTime, i)) * (1.0 - (i / 50.0));
        let currentContribution = (cos(sin(i) * vec4<f32>(1.0, 2.0, 3.0, 1.0)) + 1.0) * 
                                exp(sin(i * i + iTime)) / length(max(v, vec2<f32>(v.x * f * 0.02, v.y)));
        
        let thinnessFactor = smoothstep(0.0, 1.0, i / 50.0);
        o += currentContribution * (1.0 + tailNoise * 2.0) * thinnessFactor;
    }
    
    o = tanh(pow(o / 1e2, vec4<f32>(1.5)));
    return o;
} 