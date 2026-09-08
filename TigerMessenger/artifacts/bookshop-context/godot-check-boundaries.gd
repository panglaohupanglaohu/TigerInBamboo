extends SceneTree
func _initialize() -> void: call_deferred("run")

func triangle_hit(a: PackedVector3Array, b: PackedVector3Array):
	var box_a := AABB(a[0], Vector3.ZERO).expand(a[1]).expand(a[2])
	var box_b := AABB(b[0], Vector3.ZERO).expand(b[1]).expand(b[2])
	if not box_a.intersects(box_b): return null
	for i in range(3):
		var hit = Geometry3D.segment_intersects_triangle(a[i], a[(i + 1) % 3], b[0], b[1], b[2])
		if hit != null: return hit
		var reverse = Geometry3D.segment_intersects_triangle(b[i], b[(i + 1) % 3], a[0], a[1], a[2])
		if reverse != null: return reverse
	return null

func run() -> void:
	var world = load("res://scenes/main.tscn").instantiate()
	root.add_child(world)
	for i in range(10): await physics_frame
	var source = JSON.parse_string(FileAccess.get_file_as_string("res://data/bookshop-surroundings.json"))
	var observations = JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/bookshop-context/godot-after.json"))
	var results: Array = []
	for item in observations.boundary_overlaps:
		var target := Vector3(item.legacy_position[0], item.legacy_position[1], item.legacy_position[2])
		var old: Node3D
		for node in world.get_children():
			if node is Node3D and node.scene_file_path == "res://assets/pine.glb" and node.global_position.distance_to(target) < .001: old = node
		if old == null: continue
		var data: Dictionary
		var record: Dictionary
		for tree in source.trees:
			if tree.id == item.source_id: data = tree
		for tree in world.get_meta("bookshop_context_trees"):
			if tree.id == item.source_id: record = tree
		var p := Vector3(record.position[0], record.position[1], record.position[2])
		var up := p.normalized()
		var forward: Vector3 = (world.bookshop.global_basis * Vector3(sin(data.yaw), 0, cos(data.yaw))).slide(up).normalized()
		var basis := Basis(up.cross(forward), up, forward).orthonormalized() * Basis.from_scale(Vector3(data.scale[0], data.scale[1], data.scale[2]))
		var transform := Transform3D(basis, p)
		var source_triangles: Array[PackedVector3Array] = []
		for surface in data.surfaces:
			for i in range(0, surface.vertices.size(), 9):
				var triangle := PackedVector3Array()
				for v in range(3):
					var j: int = i + v * 3
					triangle.append(transform * Vector3(surface.vertices[j], surface.vertices[j + 1], surface.vertices[j + 2]))
				source_triangles.append(triangle)
		var result: Dictionary = item.duplicate()
		result.exact_surface_intersection = false
		for mesh in old.find_children("*", "MeshInstance3D", true, false):
			var faces: PackedVector3Array = mesh.mesh.get_faces()
			for i in range(0, faces.size(), 3):
				var triangle := PackedVector3Array([mesh.global_transform * faces[i], mesh.global_transform * faces[i + 1], mesh.global_transform * faces[i + 2]])
				for other in source_triangles:
					var hit = triangle_hit(triangle, other)
					if hit != null:
						result.exact_surface_intersection = true
						result.intersection_point = str(hit)
						break
				if result.exact_surface_intersection: break
			if result.exact_surface_intersection: break
		results.append(result)
	var file := FileAccess.open("res://../artifacts/bookshop-context/godot-boundary-check.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(results, "  "))
	print("BOOKSHOP_BOUNDARY_SURFACES ", JSON.stringify(results))
	world.queue_free(); await process_frame; quit()
