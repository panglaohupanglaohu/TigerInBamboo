extends RefCounted
## Bounded adaptation of the bookshop's Web two-pixel toon gradient.
## Only runtime surface overrides are authored; GLB meshes/materials stay intact.
const SHADER = preload("res://shaders/bookshop_toon.gdshader")
const BINDINGS_KEY := "bookshop_toon_bindings"

static func set_enabled(bookshop: Node3D, enabled: bool = true) -> void:
	if not bookshop.has_meta(BINDINGS_KEY):
		var bindings: Array = []
		var cache: Dictionary = {}
		var shaders: Dictionary = {BaseMaterial3D.CULL_BACK: SHADER}
		var building := bookshop.find_child("hard-to-find-bookshop", true, false)
		for node in building.find_children("*", "MeshInstance3D", true, false):
			var mesh := node as MeshInstance3D
			# The sign text is an unlit transparent canvas texture in the Web
			# original. Do not force it through an opaque lighting shader.
			if mesh.name == "bookshop-sign-text": continue
			for surface in range(mesh.mesh.get_surface_count()):
				var source := mesh.get_active_material(surface) as StandardMaterial3D
				if source == null or source.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED: continue
				var key := source.get_instance_id()
				if not cache.has(key):
					# v3's added window joinery is explicitly double-sided. Keep
					# that state; forcing back-face culling would erase its inward
					# wound front surfaces even though the albedo was preserved.
					if not shaders.has(source.cull_mode):
						var variant := Shader.new()
						var mode := "cull_disabled" if source.cull_mode == BaseMaterial3D.CULL_DISABLED else "cull_front"
						variant.code = SHADER.code.replace("cull_back", mode)
						shaders[source.cull_mode] = variant
					var toon := ShaderMaterial.new()
					toon.shader = shaders[source.cull_mode]
					toon.set_meta("source_cull_mode", source.cull_mode)
					toon.resource_name = "BookshopTwoBand_" + source.resource_name
					toon.set_shader_parameter("source_albedo", source.albedo_color)
					toon.set_shader_parameter("has_texture", source.albedo_texture != null)
					if source.albedo_texture: toon.set_shader_parameter("source_texture", source.albedo_texture)
					toon.set_shader_parameter("source_uv_scale", Vector2(source.uv1_scale.x, source.uv1_scale.y))
					toon.set_shader_parameter("source_uv_offset", Vector2(source.uv1_offset.x, source.uv1_offset.y))
					cache[key] = toon
				bindings.append({"mesh": mesh, "surface": surface, "source": source, "toon": cache[key]})
		bookshop.set_meta(BINDINGS_KEY, bindings)
		bookshop.set_meta("bookshop_toon_unique_materials", cache.size())
	for binding in bookshop.get_meta(BINDINGS_KEY):
		binding.mesh.set_surface_override_material(binding.surface, binding.toon if enabled else binding.source)
	bookshop.set_meta("bookshop_toon_enabled", enabled)
