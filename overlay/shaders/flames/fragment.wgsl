struct FragmentInput {
    @location(0) uv: vec2<f32>,
}

struct Uniforms {
    time: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

fn rand(n: vec2<f32>) -> f32 {
    return fract(sin(cos(dot(n, vec2<f32>(12.9898, 12.1414)))) * 83758.5453);
}

fn noise(n: vec2<f32>) -> f32 {
    let d = vec2<f32>(0.0, 1.0);
    let b = floor(n);
    let f = smoothstep(vec2<f32>(0.0), vec2<f32>(1.0), fract(n));
    return mix(
        mix(rand(b), rand(b + d.yx), f.x),
        mix(rand(b + d.xy), rand(b + d.yy), f.x),
        f.y
    );
}

fn fbm(n_input: vec2<f32>) -> f32 {
    var n = n_input;
    var total = 0.0;
    var amplitude = 1.0;
    for (var i = 0; i < 5; i++) {
        total += noise(n) * amplitude;
        n += n * 1.7;
        amplitude *= 0.47;
    }
    return total;
}

@fragment
fn fs_main(input: FragmentInput) -> @location(0) vec4<f32> {
    let iResolution = vec2<f32>(1.0, 1.0);
    let iTime = uniforms.time;
    let fragCoord = input.uv;

    let c1 = vec3<f32>(0.5, 0.0, 0.1);
    let c2 = vec3<f32>(0.9, 0.1, 0.0);
    let c3 = vec3<f32>(0.2, 0.1, 0.7);
    let c4 = vec3<f32>(1.0, 0.9, 0.1);
    let c5 = vec3<f32>(0.1);
    let c6 = vec3<f32>(0.9);

    let speed = vec2<f32>(0.1, 0.9);
    let shift = 1.327 + sin(iTime * 2.0) / 2.4;
    let dist = 3.5 - sin(iTime * 0.4) / 1.89;

    let uvCoord = fragCoord.xy / iResolution.xy;
    var p = fragCoord.xy * dist / iResolution.xx;
    p += sin(p.yx * 4.0 + vec2<f32>(0.2, -0.3) * iTime) * 0.04;
    p += sin(p.yx * 8.0 + vec2<f32>(0.6, 0.1) * iTime) * 0.01;

    p.x -= iTime / 1.1;
    let q = fbm(p - iTime * 0.3 + 1.0 * sin(iTime + 0.5) / 2.0);
    let qb = fbm(p - iTime * 0.4 + 0.1 * cos(iTime) / 2.0);
    let q2 = fbm(p - iTime * 0.44 - 5.0 * cos(iTime) / 2.0) - 6.0;
    let q3 = fbm(p - iTime * 0.9 - 10.0 * cos(iTime) / 15.0) - 4.0;
    let q4 = fbm(p - iTime * 1.4 - 20.0 * sin(iTime) / 14.0) + 2.0;
    let q_final = (q + qb - 0.4 * q2 - 2.0 * q3 + 0.6 * q4) / 3.8;

    let r = vec2<f32>(
        fbm(p + q_final / 2.0 + iTime * speed.x - p.x - p.y),
        fbm(p + q_final - iTime * speed.y)
    );

    let c = mix(c1, c2, fbm(p + r)) + mix(c3, c4, r.x) - mix(c5, c6, r.y);
    var color = vec3<f32>(1.0 / (pow(c + 1.61, vec3<f32>(4.0)))) * cos(shift * fragCoord.y / iResolution.y);

    color = vec3<f32>(1.0, 0.2, 0.05) / (pow((r.y + r.y) * max(0.0, p.y) + 0.1, 4.0));

    let textureApprox = vec3<f32>(noise(uvCoord * 0.6 + vec2<f32>(0.5, 0.1))) * 0.01 * pow((r.y + r.y) * 0.65, 5.0) + 0.055;
    color += textureApprox * mix(vec3<f32>(0.9, 0.4, 0.3), vec3<f32>(0.7, 0.5, 0.2), uvCoord.y);

    color = color / (1.0 + max(vec3<f32>(0.0), color));

    let luminance = dot(color, vec3<f32>(0.299, 0.587, 0.114));
    var alpha = smoothstep(0.0, 0.1, luminance);
    alpha = pow(alpha, 0.8) * 1.2;
    alpha = clamp(alpha, 0.0, 1.0);

    return vec4<f32>(color.x, color.y, color.z, alpha);
} 