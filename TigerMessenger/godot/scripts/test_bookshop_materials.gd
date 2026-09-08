extends "res://scripts/test_bookshop_integration.gd"
## Independent evidence destination; reuses only the existing walk/check helpers.
const Materials = preload("res://scripts/bookshop_materials.gd")

func _run() -> void:
	evidence_dir = "bookshop-materials"
	root.size = Vector2i(1280, 800)
	var world = load("res://scenes/main.tscn").instantiate()
	root.add_child(world)
	await process_frame
	world.begin()
	for i in range(100): await physics_frame
	var bindings: Array = world.bookshop.get_meta(Materials.BINDINGS_KEY)
	var mesh_ids: Dictionary = {}
	for binding in bindings: mesh_ids[binding.mesh.get_instance_id()] = true
	check(mesh_ids.size() == 76, "26 original solid parts and 50 window-frame meshes should receive two-band lighting")
	check(bindings.size() == 181, "All 181 opaque GLB primitive surfaces should be adapted, excluding the sign text")
	for binding in bindings:
		check(binding.toon.get_shader_parameter("source_albedo") == binding.source.albedo_color, "Imported surface colour must be preserved exactly")
		check(binding.toon.get_meta("source_cull_mode") == binding.source.cull_mode, "Original material culling must be preserved, including double-sided joinery")
		check(binding.mesh.mesh.surface_get_material(binding.surface) == binding.source, "Original GLB material resource must remain unchanged")
		check(binding.mesh.get_active_material(binding.surface) == binding.toon, "Default actual game must enable the bookshop toon override")
	var sign := world.bookshop.find_child("bookshop-sign-text", true, false) as MeshInstance3D
	var sign_material := sign.get_active_material(0)
	check(sign_material is StandardMaterial3D and sign_material.albedo_texture != null, "Original textured sign must stay outside the opaque toon shader")
	var garden := world.bookshop.find_child("Curved garden ground", true, false) as MeshInstance3D
	var garden_material := garden.get_active_material(0)
	var ink := world.bookshop.get_node("Bookshop_Brush_Ink") as MeshInstance3D
	var ink_material := ink.material_override
	check(ink.visible and ink.get_meta("source_parts") == 26, "Existing brush ink must remain enabled")
	check(world.player.is_on_floor(), "Player must settle on real terrain")
	check(await walk(world, world.beacons[0].position, .8), "Player must walk to bookshop waypoint")
	check(await walk(world, world.bookshop.to_global(Vector3(0, .2, 3.8)), .35), "Player must walk onto the entrance path")
	check(world.player.is_on_floor(), "Player must remain grounded at entrance")
	world.player.heading = (world.bookshop.global_position - world.player.position).slide(world.player.position.normalized()).normalized()
	for i in range(30): await physics_frame
	var ray := PhysicsRayQueryParameters3D.create(world.bookshop.to_global(Vector3(0, 1, 4)), world.bookshop.to_global(Vector3(0, 1, 0)))
	ray.exclude = [world.player.get_rid()]
	var wall_hit: Dictionary = world.get_world_3d().direct_space_state.intersect_ray(ray)
	check(not wall_hit.is_empty(), "Original wall collision must still block the facade")
	var press := InputEventKey.new()
	press.physical_keycode = KEY_R
	press.keycode = KEY_R
	press.pressed = true
	Input.parse_input_event(press)
	for i in range(2): await process_frame
	var release := press.duplicate()
	release.pressed = false
	Input.parse_input_event(release)
	for i in range(2): await process_frame
	check(world.chapter == 1, "R input must still complete the first delivery")
	var paths: Array = []
	for node in world.bookshop.get_children():
		if not str(node.name).begins_with("Entrance path"): continue
		var material: Material = node.get_active_material(0)
		check(material is StandardMaterial3D, "This material batch must not change entrance stones")
		paths.append({"name": str(node.name), "local_position": str(node.position), "visible_in_tree": node.is_visible_in_tree(), "cull_mode": material.cull_mode, "projected_center": str(world.player.camera.unproject_position(node.global_position))})
	check(paths.size() == 4, "Actual default main must include the four Blender entrance stones")
	world.set_process(false)
	world.player.set_physics_process(false)
	var images: Array[Image] = []
	if DisplayServer.get_name() != "headless":
		for enabled in [false, true]:
			Materials.set_enabled(world.bookshop, enabled)
			check(sign.get_active_material(0) == sign_material, "Material toggle must preserve original sign")
			check(garden.get_active_material(0) == garden_material, "Material toggle must preserve garden material")
			check(ink.material_override == ink_material, "Material toggle must preserve brush shader")
			for i in range(10): await process_frame
			await RenderingServer.frame_post_draw
			var suffix := "after" if enabled else "before"
			var image := root.get_texture().get_image()
			image.save_png(ProjectSettings.globalize_path("res://../artifacts/bookshop-materials/godot-%s.png" % suffix))
			images.append(image)
			report["draw_calls_" + suffix] = Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
			report["primitives_" + suffix] = Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)
			report.capture_size = str(image.get_size())
		var changed := 0
		var first := images[0].get_size()
		var last := Vector2i.ZERO
		for y in range(images[0].get_height()):
			for x in range(images[0].get_width()):
				var a := images[0].get_pixel(x, y)
				var b := images[1].get_pixel(x, y)
				if maxf(absf(a.r - b.r), maxf(absf(a.g - b.g), absf(a.b - b.b))) < 1.0 / 255: continue
				changed += 1
				first = first.min(Vector2i(x, y))
				last = last.max(Vector2i(x, y))
		report.changed_pixels = changed
		report.changed_bounds = [str(first), str(last)]
		check(changed > 100, "Two-band lighting must produce a visible actual-game difference")
		check(report.draw_calls_before == report.draw_calls_after, "Surface lighting change should not add render passes")
	report.surfaces = bindings.size()
	report.meshes = mesh_ids.size()
	report.unique_toon_materials = world.bookshop.get_meta("bookshop_toon_unique_materials")
	report.albedo_preserved = true
	report.path_nodes = paths
	report.chapter_after_r = world.chapter
	report.facade_collision = str(wall_hit.get("position", "missing"))
	report.failures = failures
	report.passed = failures.is_empty()
	var file := FileAccess.open("res://../artifacts/bookshop-materials/godot-validation.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  "))
	print("BOOKSHOP_MATERIALS_", "OK" if failures.is_empty() else "FAILED", ": ", JSON.stringify(report))
	world.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
