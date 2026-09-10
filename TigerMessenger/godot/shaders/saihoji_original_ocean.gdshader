shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_always;

// Port of curvedWaterMaterial.js, officialOcean branch. Keep exported canyon geometry.
uniform vec3 water_color = vec3(0.008568126, 0.141263291, 0.258182853);
uniform float night : hint_range(0.0, 1.0) = 1.0;
varying float wave_height;
varying vec3 water_data;
varying vec3 original_view_normal;

void vertex() {
    vec3 radial = normalize(VERTEX);
    float dropped = max(0.0, 160.5 - length(VERTEX));
    water_data = vec3(clamp(0.42 + dropped / 14.0, 0.22, 1.0),
        clamp(0.2 + dropped / 18.0, 0.06, 1.0), 0.42 + max(0.0, radial.x * 0.38));
    float phase = dot(radial, vec3(1.7, 0.6, -1.1));
    wave_height = sin(phase * 8.0 + TIME * 0.9) * 0.045 + cos(phase * 13.0 - TIME * 0.57) * 0.022;
    original_view_normal = normalize(MODELVIEW_NORMAL_MATRIX * NORMAL);
    VERTEX += radial * wave_height;
}

void fragment() {
    float light = 0.66 + 0.34 * max(dot(original_view_normal, normalize(vec3(0.35, 0.8, 0.42))), 0.0);
    float crest = smoothstep(0.014, 0.052, abs(wave_height)) * (0.18 + water_data.z * 0.82);
    float foam = (1.0 - smoothstep(0.05, 0.32, water_data.y)) * smoothstep(0.008, 0.035, abs(wave_height));
    vec3 color = water_color * mix(0.64, 1.0, water_data.x) * light * mix(0.48, 1.0, night);
    color += vec3(0.02, 0.05, 0.065) * (wave_height + 0.06);
    ALBEDO = mix(color, vec3(0.42, 0.69, 0.76), clamp((crest + foam) * 0.55, 0.0, 1.0));
    ALPHA = 0.94 * mix(0.9, 1.0, water_data.x);
}
