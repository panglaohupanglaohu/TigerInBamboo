shader_type spatial;
render_mode cull_back, depth_draw_opaque, specular_disabled;

uniform vec4 source_albedo : source_color = vec4(1.0);
uniform sampler2D source_texture : source_color, filter_linear_mipmap;
uniform bool has_texture = false;
uniform vec2 source_uv_scale = vec2(1.0);
uniform vec2 source_uv_offset = vec2(0.0);

void fragment() {
	ALBEDO = source_albedo.rgb;
	if (has_texture) {
		ALBEDO *= texture(source_texture, UV * source_uv_scale + source_uv_offset).rgb;
	}
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
}

void light() {
	// src/assets/toon.js uses [110,255], nearest filtering. The actual
	// vendored Three.js maps N.L * .5 + .5 into that two-pixel texture,
	// hence the two-band boundary is N.L == 0, not an invented .5 cutoff.
	float band = dot(NORMAL, LIGHT) < 0.0 ? 110.0 / 255.0 : 1.0;
	// Godot LIGHT_COLOR includes PI. Keep real light colours and shadow /
	// distance attenuation, and let Godot apply ALBEDO and ambient lighting.
	DIFFUSE_LIGHT += band * ATTENUATION * LIGHT_COLOR / PI;
}
