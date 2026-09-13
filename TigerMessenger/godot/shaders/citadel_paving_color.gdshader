shader_type spatial;
// The original Web stones export linear COLOR_0. Compatibility lighting expects
// display-space albedo, just as for the existing citadel terrain adapter.
vec3 linear_to_display(vec3 c) {
    return mix(c*12.92,1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));
}
void fragment() {
    ALBEDO=OUTPUT_IS_SRGB?linear_to_display(COLOR.rgb):COLOR.rgb;
    ROUGHNESS=0.94;
}
