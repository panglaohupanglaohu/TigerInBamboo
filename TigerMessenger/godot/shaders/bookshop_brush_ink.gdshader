shader_type spatial;
render_mode unshaded, cull_front, depth_draw_opaque, shadows_disabled;

// src/assets/toon.js: INK_COLOR and OUTLINE_DRY.prop. UV contains each
// original part's local X/Y, not its atlas UV or merged world position.
uniform vec3 ink_color : source_color = vec3(0.129411765, 0.117647059, 0.098039216);
uniform float dry = 0.05;

void fragment() {
	float brush_dry = fract(sin(dot(floor(UV * 36.0), vec2(12.9898, 78.233))) * 43758.5453);
	if (brush_dry < dry) discard;
	ALBEDO = ink_color;
}
