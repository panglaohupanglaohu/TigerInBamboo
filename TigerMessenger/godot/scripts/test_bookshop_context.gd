extends "res://scripts/test_bookshop_integration.gd"
const Surroundings = preload("res://scripts/bookshop_surroundings.gd")

func fingerprint(node: Node3D) -> String:
	var values: Array = []
	for v in [node.global_basis.x, node.global_basis.y, node.global_basis.z, node.global_position]:
		for number in [v.x, v.y, v.z]: values.append("%.5f" % number)
	return node.scene_file_path + ":" + ",".join(values)

func bounds_of(node: Node3D) -> AABB:
	var bounds := AABB(node.global_position, Vector3.ZERO)
	for child in node.find_children("*", "MeshInstance3D", true, false):
		bounds = bounds.merge(child.global_transform * child.get_aabb())
	return bounds

func _run() -> void:
	var before := "--bookshop-legacy-context" in OS.get_cmdline_user_args()
	var suffix := "before" if before else "after"
	root.size = Vector2i(1280, 800)
	var world = load("res://scenes/main.tscn").instantiate()
	root.add_child(world)
	await process_frame
	world.begin()
	for i in range(100): await physics_frame
	check(world.get_meta("bookshop_context_enabled") != before, "Explicit legacy fallback / default original context should match run mode")
	var records: Array = world.get_meta("bookshop_context_trees", [])
	if not before:
		check(world.get_meta("bookshop_context_ready", false), "Original context must finish loading against actual terrain")
		check(records.size() == 6, "All six captured original trees must be present")
		var triangles := 0
		for record in records:
			triangles += record.triangles
			check(Vector2(record.source_xz[0], record.source_xz[1]).distance_to(Vector2(record.native_xz[0], record.native_xz[1])) < .0001, "Tree XZ spacing must not shrink when adapting terrain")
			check(str(record.terrain_collider).contains("Terrain_Visual_And_Collision"), "Every trunk must use the shared rendered/physics terrain")
		check(triangles == 3876, "The complete captured surface triangles must be retained")
		var context: Node3D = world.get_node("Bookshop_Original_Surroundings")
		check(context.get_node("Original_Corridor_Forest").mesh.get_surface_count() == 7, "Original tree colours should batch into seven surfaces")
		var forest_mesh: ArrayMesh = context.get_node("Original_Corridor_Forest").mesh
		for s in range(forest_mesh.get_surface_count()):
			var mat: ShaderMaterial = forest_mesh.surface_get_material(s)
			var actual_linear: Color = mat.get_shader_parameter("source_albedo").srgb_to_linear()
			var original_linear: Color = mat.get_meta("original_linear_color")
			check(absf(actual_linear.r - original_linear.r) + absf(actual_linear.g - original_linear.g) + absf(actual_linear.b - original_linear.b) < .00001, "Original linear palette must survive exactly one colour-space conversion")
		check(context.get_node("Original_Corridor_Ink").mesh.get_surface_count() == 2, "Original dry-brush ink should batch into its two dry values")
		check(context.find_children("*", "CollisionShape3D", true, false).size() == 6, "Each source tree should have one original-radius collision proxy")
	var legacy: Array = []
	var overlaps: Array = []
	var near_counts: Dictionary = {}
	for node in world.find_children("*", "Node3D", true, false):
		if node.scene_file_path not in ["res://assets/house.glb", "res://assets/tower.glb", "res://assets/pine.glb"]: continue
		var kind: String = node.scene_file_path.get_file().get_basename()
		var position: Vector3 = node.global_position
		var protected: bool = node.get_parent() != world
		var near: bool = not protected and Surroundings.should_skip_legacy(world.bookshop, position)
		if near: near_counts[kind] = near_counts.get(kind, 0) + 1
		legacy.append({"fingerprint": fingerprint(node), "kind": kind, "position": [position.x, position.y, position.z], "protected_chapter": protected, "distance": position.distance_to(world.bookshop.global_position), "expected_excluded": near})
		if before or protected or kind != "pine": continue
		var old_bounds := bounds_of(node)
		for record in records:
			var pos: Array = record.bounds_min
			var size: Array = record.bounds_size
			var new_bounds := AABB(Vector3(pos[0], pos[1], pos[2]), Vector3(size[0], size[1], size[2]))
			if old_bounds.intersects(new_bounds):
				overlaps.append({"legacy_position": [position.x, position.y, position.z], "legacy_local": str(world.bookshop.to_local(position)), "distance": position.distance_to(world.bookshop.global_position), "source_id": record.id, "aabb_overlap": str(old_bounds.intersection(new_bounds))})
	if before:
		check(near_counts.get("house", 0) == 6 and near_counts.get("tower", 0) == 2 and near_counts.get("pine", 0) == 12, "Fallback must reproduce the inspected 14m legacy baseline")
	else:
		check(near_counts.is_empty(), "No old decorative models should remain within the scoped exclusion")
		var previous = JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/bookshop-context/godot-before.json"))
		var expected: Array = []
		for item in previous.legacy:
			var p := Vector3(item.position[0], item.position[1], item.position[2])
			if item.protected_chapter or not Surroundings.should_skip_legacy(world.bookshop, p): expected.append(item.fingerprint)
		var actual: Array = legacy.map(func(item): return item.fingerprint)
		expected.sort(); actual.sort()
		check(actual == expected, "All outside-scope legacy roots and chapter landmarks must keep exact transforms and scales")
	check(world.player.is_on_floor(), "Player must settle on terrain")
	check(await walk(world, world.beacons[0].position, .8), "Player must walk spawn to bookshop waypoint")
	check(await walk(world, world.bookshop.to_global(Vector3(0, .2, 3.8)), .35), "Player must walk onto original bookshop entrance path")
	check(world.player.is_on_floor(), "Player must remain grounded at the entrance")
	world.player.heading = (world.bookshop.global_position - world.player.position).slide(world.player.position.normalized()).normalized()
	for i in range(30): await physics_frame
	var press := InputEventKey.new(); press.keycode = KEY_R; press.physical_keycode = KEY_R; press.pressed = true
	Input.parse_input_event(press)
	for i in range(2): await process_frame
	var release := press.duplicate(); release.pressed = false; Input.parse_input_event(release)
	for i in range(2): await process_frame
	check(world.chapter == 1, "R must deliver the first letter with the new surroundings")
	world.set_process(false); world.player.set_physics_process(false)
	if DisplayServer.get_name() != "headless":
		for i in range(10): await process_frame
		await RenderingServer.frame_post_draw
		var image := root.get_texture().get_image()
		image.save_png(ProjectSettings.globalize_path("res://../artifacts/bookshop-context/godot-%s.png" % suffix))
		report.capture_size = str(image.get_size())
		report.draw_calls = Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
		report.primitives = Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)
		# Supplemental actual player turn towards the source forest; the primary
		# frontal pair remains untouched. No substitute review camera or lighting.
		world.player.heading = world.player.heading.rotated(world.player.position.normalized(), 1.15)
		var up: Vector3 = world.player.position.normalized()
		world.player.global_basis = Basis(world.player.heading.cross(up), up, -world.player.heading).orthonormalized()
		for i in range(10): await physics_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(ProjectSettings.globalize_path("res://../artifacts/bookshop-context/godot-forest-%s.png" % suffix))
		report.forest_camera_transform = str(world.player.camera.global_transform)
	report.mode = suffix
	report.legacy = legacy
	report.near_legacy = near_counts
	report.skipped = world.get_meta("bookshop_context_skipped")
	report.original_trees = records
	report.boundary_overlaps = overlaps
	report.chapter_after_r = world.chapter
	report.failures = failures
	report.passed = failures.is_empty()
	var file := FileAccess.open("res://../artifacts/bookshop-context/godot-%s.json" % suffix, FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  "))
	print("BOOKSHOP_CONTEXT_", suffix, "_", "OK" if failures.is_empty() else "FAILED", ": near=", near_counts, " source=", records.size(), " overlaps=", overlaps)
	world.queue_free(); await process_frame
	quit(0 if failures.is_empty() else 1)
