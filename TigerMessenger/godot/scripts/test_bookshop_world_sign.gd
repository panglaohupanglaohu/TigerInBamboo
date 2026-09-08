extends SceneTree
var failures: Array[String] = []
var output := ""
var report := {"passed": false, "scope": "Original-world bookshop sign only; no complete region gameplay claim"}

func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--output="): output = arg.trim_prefix("--output=")
	if DisplayServer.get_name() != "headless":
		root.unfocusable = true
		root.hide()
	call_deferred("run")

func check(value: bool, message: String) -> void:
	if not value: failures.append(message)

func capture(view: SubViewport, filename: String) -> void:
	for i in range(4): await process_frame
	RenderingServer.force_draw(false)
	await RenderingServer.frame_post_draw
	var image := view.get_texture().get_image()
	check(image != null and image.get_width() == 1280, "Real render image available")
	if image: image.save_png(output.path_join(filename + ".png"))

func fingerprint(model: Node) -> Dictionary:
	var result := {}
	for node in model.find_children("*", "Node3D", true, false):
		var path := str(node.get_meta("extras", {}).get("sourcePath", ""))
		if path.is_empty(): continue
		result[path] = {"id": node.get_instance_id(), "parent": node.get_parent().get_instance_id(), "transform": str(node.transform), "visible": node.visible}
	return result

func run() -> void:
	var viewport := SubViewport.new()
	viewport.size = Vector2i(1280,800)
	viewport.own_world_3d = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(viewport)
	var world = load("res://scenes/original_world.tscn").instantiate()
	viewport.add_child(world)
	await process_frame
	# Pause moving tails before exact before/after identity/transform comparison.
	world.process_mode = Node.PROCESS_MODE_DISABLED
	var adapter = world.bookshop_adapter
	check(adapter.enabled, "Default real original_world hook enables sign repair")
	check(adapter.sign != null, "Exactly one original source sign binds")
	if adapter.sign == null:
		report.failures = failures
		report.adapter_error = adapter.last_error
		FileAccess.open(output.path_join("validation.json"), FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
		quit(1)
		return
	var sign: MeshInstance3D = adapter.sign
	var source: StandardMaterial3D = sign.mesh.surface_get_material(0)
	var material: StandardMaterial3D = sign.get_active_material(0)
	var baseline := fingerprint(world.model)
	var adapted_id := material.get_instance_id()
	check(source.shading_mode != BaseMaterial3D.SHADING_MODE_UNSHADED, "Source regression is present: original exported sign is lit")
	check(material.shading_mode == BaseMaterial3D.SHADING_MODE_UNSHADED, "Repair matches actual Web MeshBasicMaterial")
	for property in ["albedo_texture", "albedo_color", "transparency", "cull_mode", "depth_draw_mode", "uv1_scale", "uv1_offset", "texture_filter", "texture_repeat"]:
		check(material.get(property) == source.get(property), "Preserved source " + property)
	for i in range(6):
		adapter.set_enabled(false)
		check(sign.get_active_material(0) == source and sign.get_surface_override_material(0) == null, "Exact source fallback")
		adapter.set_enabled(true)
		check(sign.get_active_material(0).get_instance_id() == adapted_id, "Toggles reuse one material")
	check(baseline == fingerprint(world.model), "Every source node identity, parent, transform and visibility unchanged")
	# Duplicate identity must fail closed; a name-only sign is not accepted.
	var duplicate_root := Node3D.new()
	for i in range(2):
		var copy := MeshInstance3D.new()
		copy.set_meta("extras", {"sourcePath": adapter.SIGN_PATH})
		duplicate_root.add_child(copy)
	var reject = load("res://scripts/bookshop_world_adapter.gd").new()
	check(not reject.bind(duplicate_root), "Ambiguous duplicate identities rejected")
	duplicate_root.free()
	var sign_path: String = str(sign.get_meta("extras").sourcePath)
	var sign_world := sign.global_transform
	if DisplayServer.get_name() != "headless":
		for layer in world.find_children("*", "CanvasLayer", true, false): layer.hide()
		world.camera.near = .02
		world.camera.fov = 40
		world.camera.global_position = sign.global_position + sign.global_basis.z.normalized() * 2.7
		world.camera.look_at(sign.global_position, sign.global_basis.y.normalized())
		for enabled in [false, true]:
			adapter.set_enabled(enabled)
			await capture(viewport, "sign-after" if enabled else "sign-before")
		var env: Environment
		for node in world.get_children():
			if node is WorldEnvironment: env = node.environment
		var old_ambient := env.ambient_light_energy
		env.ambient_light_energy = 0.0
		var light_state := {}
		for light in world.find_children("*", "Light3D", true, false):
			light_state[light] = light.light_energy
			light.light_energy = 0.0
		for enabled in [false, true]:
			adapter.set_enabled(enabled)
			await capture(viewport, "sign-dark-after" if enabled else "sign-dark-before")
		env.ambient_light_energy = old_ambient
		for light in light_state: light.light_energy = light_state[light]
		var shop: Node3D = sign.get_parent().get_parent()
		world.camera.global_position = shop.to_global(Vector3(9,7,17))
		world.camera.look_at(shop.to_global(Vector3(0,2,0)), shop.global_basis.y.normalized())
		await capture(viewport, "bookshop-original-context")
		report.screenshots = ["sign-before.png", "sign-after.png", "sign-dark-before.png", "sign-dark-after.png", "bookshop-original-context.png"]
		report.capture = {"scene": "res://scenes/original_world.tscn", "viewport": [1280,800], "temporary_changes": ["Paused animations", "Hidden UI layer", "Camera focused on actual source sign", "Diagnostic dark pair sets ambient and light energy to zero, then restores"], "terrain_or_props_replaced": false}
	adapter.unbind()
	check(sign.get_active_material(0) == source and sign.global_transform.is_equal_approx(sign_world), "Unbind restores original material and world transform")
	check(adapter.bind(world.model) and adapter.set_enabled(true), "Fresh rebind succeeds")
	report.merge({"passed": failures.is_empty(), "failures": failures, "sourcePath": sign_path, "source_node_count_preserved": baseline.size(), "toggle_cycles": 6, "source_material_mode": source.shading_mode, "adapted_material_mode": material.shading_mode, "texture_instance_preserved": material.albedo_texture == source.albedo_texture, "alpha_mode_preserved": material.transparency == source.transparency, "default_enabled": true}, true)
	FileAccess.open(output.path_join("validation.json"), FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print("BOOKSHOP_WORLD_SIGN ", JSON.stringify(report))
	world.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
