extends Node3D
## Six actual Web corridor trees, not a new scatter or a generic tree factory.
const SOURCE_PATH := "res://data/bookshop-surroundings.json"
const LEGACY_RADIUS := 14.0
const TOON = preload("res://shaders/bookshop_toon.gdshader")
const INK = preload("res://shaders/bookshop_brush_ink.gdshader")
var world: Node3D
var bookshop: Node3D
var source: Dictionary
var ready_for_play := false
var tree_records: Array = []

static func load_source() -> Dictionary:
	if "--bookshop-legacy-context" in OS.get_cmdline_user_args(): return {}
	if not FileAccess.file_exists(SOURCE_PATH): return {}
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(SOURCE_PATH))
	if not parsed is Dictionary or parsed.get("version") != 1 or not parsed.get("trees") is Array:
		push_warning("Bookshop surroundings unavailable; keeping legacy context")
		return {}
	for tree in parsed.trees:
		if not tree.has_all(["id", "localPosition", "scale", "yaw", "surfaces", "ink", "colliderRadius"]): return {}
		for surface in tree.surfaces:
			if surface.vertices.size() % 9 != 0 or surface.vertices.size() != surface.normals.size(): return {}
		for ink in tree.ink:
			if ink.vertices.size() % 9 != 0 or ink.uv.size() * 3 != ink.vertices.size() * 2: return {}
	return parsed if not parsed.trees.is_empty() else {}

static func should_skip_legacy(shop: Node3D, point: Vector3) -> bool:
	return shop.global_position.distance_to(point) <= LEGACY_RADIUS

func _ready() -> void:
	# Terrain's rendered mesh and its trimesh collider are registered before
	# the two waits. Ground queries use that exact collider, not height noise.
	await get_tree().physics_frame
	await get_tree().physics_frame
	_build()

func _build() -> void:
	var terrain := world.get_node("Terrain_Visual_And_Collision")
	var excluded: Array[RID] = []
	for body in world.find_children("*", "CollisionObject3D", true, false):
		if not terrain.is_ancestor_of(body): excluded.append(body.get_rid())
	var surfaces: Dictionary = {}
	var inks: Dictionary = {}
	for tree in source.trees:
		var flat := Vector3(tree.localPosition[0], 0, tree.localPosition[2])
		var ray := PhysicsRayQueryParameters3D.create(bookshop.to_global(flat + Vector3.UP * 18), bookshop.to_global(flat - Vector3.UP * 25))
		ray.exclude = excluded
		var hit: Dictionary = world.get_world_3d().direct_space_state.intersect_ray(ray)
		if hit.is_empty():
			push_error("Original corridor tree has no terrain hit: " + str(tree.id))
			return
		var point: Vector3 = hit.position
		var up := point.normalized()
		var forward := (bookshop.global_basis * Vector3(sin(tree.yaw), 0, cos(tree.yaw))).slide(up).normalized()
		var orientation := Basis(up.cross(forward), up, forward).orthonormalized()
		var scale_value := Vector3(tree.scale[0], tree.scale[1], tree.scale[2])
		var tree_transform := Transform3D(orientation * Basis.from_scale(scale_value), point)
		var local_transform := global_transform.affine_inverse() * tree_transform
		var normal_matrix := local_transform.basis.inverse().transposed()
		var height := 0.0
		var triangles := 0
		var bounds := AABB(point, Vector3.ZERO)
		for part in tree.surfaces:
			var key := str(part.color)
			if not surfaces.has(key):
				var st := SurfaceTool.new()
				st.begin(Mesh.PRIMITIVE_TRIANGLES)
				var material := ShaderMaterial.new()
				material.shader = TOON
				# Exported Three.Color channels are LINEAR. Godot source_color
				# parameters receive sRGB, so convert exactly once at this boundary.
				var linear := Color(part.color[0], part.color[1], part.color[2])
				material.set_shader_parameter("source_albedo", linear.linear_to_srgb())
				material.set_meta("original_linear_color", linear)
				st.set_material(material)
				surfaces[key] = st
			var st: SurfaceTool = surfaces[key]
			for triangle in range(0, part.vertices.size(), 9):
				# Three/glTF CCW -> Godot CW. Normals keep their authored direction.
				for corner in [0, 2, 1]:
					var i: int = triangle + corner * 3
					var p := Vector3(part.vertices[i], part.vertices[i + 1], part.vertices[i + 2])
					var n := Vector3(part.normals[i], part.normals[i + 1], part.normals[i + 2])
					height = maxf(height, p.y * scale_value.y)
					bounds = bounds.expand(tree_transform * p)
					st.set_normal((normal_matrix * n).normalized())
					st.add_vertex(local_transform * p)
				triangles += 1
		for part in tree.ink:
			var key := str(part.dry)
			if not inks.has(key):
				var st := SurfaceTool.new()
				st.begin(Mesh.PRIMITIVE_TRIANGLES)
				var material := ShaderMaterial.new()
				material.shader = INK
				material.set_shader_parameter("dry", part.dry)
				material.set_shader_parameter("ink_color", Color(source.inkColor[0], source.inkColor[1], source.inkColor[2]))
				st.set_material(material)
				inks[key] = st
			var st: SurfaceTool = inks[key]
			for triangle in range(0, part.vertices.size(), 9):
				for corner in [0, 2, 1]:
					var i: int = triangle + corner * 3
					var uv_i: int = (triangle / 3 + corner) * 2
					st.set_uv(Vector2(part.uv[uv_i], part.uv[uv_i + 1]))
					st.add_vertex(local_transform * Vector3(part.vertices[i], part.vertices[i + 1], part.vertices[i + 2]))
		var body := StaticBody3D.new()
		body.name = tree.id
		add_child(body)
		body.global_transform = Transform3D(orientation, point)
		var cylinder := CylinderShape3D.new()
		cylinder.radius = tree.colliderRadius
		cylinder.height = height
		var collision := CollisionShape3D.new()
		collision.shape = cylinder
		collision.position.y = height * .5
		body.add_child(collision)
		var projected := bookshop.to_local(point)
		tree_records.append({"id": tree.id, "corridor": tree.corridor, "source_xz": [flat.x, flat.z], "native_xz": [projected.x, projected.z], "position": [point.x, point.y, point.z], "yaw": tree.yaw, "scale": tree.scale, "collider_radius": tree.colliderRadius, "triangles": triangles, "terrain_collider": str(hit.collider.get_path()), "height": height, "bounds_min": [bounds.position.x, bounds.position.y, bounds.position.z], "bounds_size": [bounds.size.x, bounds.size.y, bounds.size.z]})
	_build_batch("Original_Corridor_Forest", surfaces, true)
	_build_batch("Original_Corridor_Ink", inks, false)
	ready_for_play = true
	world.set_meta("bookshop_context_ready", true)
	world.set_meta("bookshop_context_trees", tree_records)
	print("BOOKSHOP_CONTEXT_READY: ", tree_records.size(), " original trees, ", surfaces.size(), " colour surfaces + ", inks.size(), " ink surfaces")

func _build_batch(label: String, tools_by_material: Dictionary, shadows: bool) -> void:
	var mesh := ArrayMesh.new()
	for st in tools_by_material.values(): st.commit(mesh)
	var instance := MeshInstance3D.new()
	instance.name = label
	instance.mesh = mesh
	if not shadows:
		instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		instance.gi_mode = GeometryInstance3D.GI_MODE_DISABLED
	add_child(instance)
