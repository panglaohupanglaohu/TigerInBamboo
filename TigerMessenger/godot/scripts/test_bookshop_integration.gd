extends SceneTree
## Exercises the real main scene, its player physics, input and first delivery.
var failures: Array[String] = []
var report := {"scene": "res://scenes/main.tscn", "asset": "res://assets/art-pilots/bookshop-art-v3.glb"}
var evidence_dir := "bookshop-integration"
var ink_comparison := false

func _initialize() -> void:
	ink_comparison = "--ink-comparison" in OS.get_cmdline_user_args()
	if ink_comparison: evidence_dir = "bookshop-refinement"
	call_deferred("_run")

func check(ok: bool, message: String) -> void:
	if not ok:
		failures.append(message)
		push_error(message)

func walk(world: Node3D, destination: Vector3, tolerance: float = .4) -> bool:
	var elapsed := 0.0
	while elapsed < 14:
		var toward: Vector3 = destination - world.player.position
		var tangent := toward.slide(world.player.position.normalized())
		if tangent.length() < tolerance:
			Input.action_release("forward")
			for i in range(25): await physics_frame
			return true
		world.player.heading = tangent.normalized()
		Input.action_press("forward")
		await physics_frame
		elapsed += 1.0 / Engine.physics_ticks_per_second
	Input.action_release("forward")
	print("WALK_BLOCKED local=", world.bookshop.to_local(world.player.position), " destination=", world.bookshop.to_local(destination))
	return false

func _run() -> void:
	root.size = Vector2i(1280, 800)
	var world = load("res://scenes/main.tscn").instantiate()
	root.add_child(world)
	await process_frame
	world.begin()
	for i in range(100): await physics_frame
	check(world.bookshop.get_meta("runtime_asset") == report.asset, "Main must load the optimized Blender GLB")
	check(world.bookshop.scale.is_equal_approx(Vector3.ONE), "Source bookshop scale must be preserved")
	var sign := world.bookshop.find_child("bookshop-sign-text", true, false) as MeshInstance3D
	check(sign != null and sign.get_active_material(0).albedo_texture != null, "Original sign texture must remain connected")
	var garden := world.bookshop.find_child("Curved garden ground", true, false) as MeshInstance3D
	check(garden != null and garden.get_child_count() > 0, "Garden must have matching collision")
	var wall := world.bookshop.find_child("n9*", true, false) as MeshInstance3D
	check(wall != null and wall.get_child_count() > 0, "Full-height imported wall must block movement")
	if wall:
		report.wall_dimensions = str(wall.get_aabb().size)
		check(wall.get_aabb().size.y > 6.9, "Bookshop is the original tall model, not the old small kit")
	var rim_error := 0.0
	for s in range(garden.mesh.get_surface_count()):
		var vertices: PackedVector3Array = garden.mesh.surface_get_arrays(s)[Mesh.ARRAY_VERTEX]
		for v in vertices:
			if Vector2(v.x, v.z).length() < 6.39: continue
			var p: Vector3 = garden.to_global(v)
			rim_error = maxf(rim_error, p.distance_to(world.surface(p.normalized())))
	report.garden_rim_max_distance = rim_error
	check(rim_error < .09, "Garden outer rim should meet spherical terrain")
	report.spawn_grounded = world.player.is_on_floor()
	check(report.spawn_grounded, "Player should settle on the real terrain")
	var arrived := await walk(world, world.beacons[0].position, .8)
	check(arrived, "Player must walk from spawn to the bookshop waypoint")
	var forecourt: Vector3 = world.bookshop.to_global(Vector3(0, .2, 3.8))
	arrived = await walk(world, forecourt, .35)
	check(arrived, "Player must walk from waypoint onto the bookshop entrance path")
	report.forecourt_grounded = world.player.is_on_floor()
	check(report.forecourt_grounded, "Player must stand on the bookshop approach")
	world.player.heading = (world.bookshop.global_position - world.player.position).slide(world.player.position.normalized()).normalized()
	for i in range(30): await physics_frame
	# Query the actual physics wall in the real scene, from the accessible entrance.
	var query := PhysicsRayQueryParameters3D.create(world.bookshop.to_global(Vector3(0, 1, 4)), world.bookshop.to_global(Vector3(0, 1, 0)))
	query.exclude = [world.player.get_rid()]
	var hit: Dictionary = world.get_world_3d().direct_space_state.intersect_ray(query)
	check(not hit.is_empty(), "Approaching the facade must hit solid physics geometry")
	report.facade_collision = str(hit.get("position", "missing"))
	var key := InputEventKey.new()
	key.physical_keycode = KEY_R
	key.keycode = KEY_R
	key.pressed = true
	Input.parse_input_event(key)
	await process_frame
	var release := key.duplicate()
	release.pressed = false
	Input.parse_input_event(release)
	await process_frame
	await process_frame
	check(world.chapter == 1, "R input beside the bookshop must complete the first delivery")
	report.chapter_after_r = world.chapter
	if ink_comparison:
		var ink := world.bookshop.get_node("Bookshop_Brush_Ink") as MeshInstance3D
		check(ink.get_meta("source_parts") == 26, "Only the 26 original solid bookshop parts receive brush ink")
		check(ink.mesh.get_surface_count() == 1, "Brush ink must batch into one surface")
		check(ink.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF, "Brush ink must not cast shadows")
		check(ink.get_child_count() == 0, "Brush ink must have no collision or picking children")
		check(ink.get_meta("local_expansion_min") >= .015 * .65 and ink.get_meta("local_expansion_max") <= .025 * 1.25, "Ink expansion must remain in the original local-unit range")
		report.ink_parts = ink.get_meta("source_parts")
		report.ink_triangles = ink.get_meta("triangles")
		report.ink_surfaces = ink.mesh.get_surface_count()
		report.ink_expansion = [ink.get_meta("local_expansion_min"), ink.get_meta("local_expansion_max")]
		# Freeze the actual gameplay only after the input/physics checks. Both
		# captures use the same player camera, lighting, HUD and actor transforms.
		world.set_process(false)
		world.player.set_physics_process(false)
		if DisplayServer.get_name() != "headless":
			for enabled in [false, true]:
				ink.visible = enabled
				for i in range(8): await process_frame
				await RenderingServer.frame_post_draw
				var suffix := "on" if enabled else "off"
				var capture_image := root.get_texture().get_image()
				capture_image.save_png(ProjectSettings.globalize_path("res://../artifacts/%s/godot-ink-%s.png" % [evidence_dir, suffix]))
				report["draw_calls_ink_" + suffix] = Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
				report["primitives_ink_" + suffix] = Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)
				report.capture_size = str(capture_image.get_size())
	if DisplayServer.get_name() != "headless":
		for i in range(8): await process_frame
		await RenderingServer.frame_post_draw
		var image := root.get_texture().get_image()
		image.save_png(ProjectSettings.globalize_path("res://../artifacts/%s/godot-gameplay.png" % evidence_dir))
		report.capture = "godot-gameplay.png"
	report.failures = failures
	report.passed = failures.is_empty()
	var file := FileAccess.open("res://../artifacts/%s/godot-integration.json" % evidence_dir, FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  "))
	print("BOOKSHOP_MAIN_INTEGRATION_", "OK" if failures.is_empty() else "FAILED", ": ", JSON.stringify(report))
	world.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
