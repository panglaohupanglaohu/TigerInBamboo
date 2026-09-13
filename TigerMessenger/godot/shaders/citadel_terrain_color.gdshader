shader_type spatial;
render_mode cull_disabled;
// GLB COLOR_0 is linear. Compatibility performs lighting in sRGB space.
vec3 linear_to_display(vec3 value) {
    return mix(value*12.92,1.055*pow(max(value,vec3(0.0)),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),value));
}
void fragment() {
    ALBEDO=OUTPUT_IS_SRGB?linear_to_display(COLOR.rgb):COLOR.rgb;
    // Three.js flatShading is not represented by glTF material properties.
    // Reconstruct the geometric face normal in view space without changing mesh/collision data.
    vec3 face_normal=normalize(cross(dFdx(VERTEX),dFdy(VERTEX)));
    NORMAL=face_normal* (dot(face_normal,VIEW)<0.0?-1.0:1.0);
    ROUGHNESS=0.98;
}
