extends SceneTree

func _initialize():
    call_deferred("run")

func run():
    root.size = Vector2i(1600, 1000)
    var world = load("res://scenes/citadel_world.tscn").instantiate()
    root.add_child(world)
    await process_frame
    world.set_process(false)
    world.set_physics_process(false)
    for ui in world.find_children("*", "CanvasLayer", true, false):
        ui.visible = false
    world.assault_route.set_visible(false)
    var city = world.castle_adapter.original.find_child("highland-west-city", true, false)
    assert(city != null)
    var frame: Transform3D = city.global_transform
    world.camera.global_position = frame * Vector3(108, 42, 140)
    world.camera.look_at(frame * Vector3(59, 14, 65), frame.basis.y.normalized())
    world.camera.fov = 55
    world.window_lights.set_enabled(true)
    await process_frame
    await RenderingServer.frame_post_draw
    var output = "front-terraces-godot.png" if OS.get_cmdline_user_args().has("--front-terraces") else "upper-foundations-godot.png"
    if OS.get_cmdline_user_args().has("--front-planting"):
        output = "front-planting-godot.png"
    if OS.get_cmdline_user_args().has("--keep-proportion"):
        output = "keep-proportion-godot.png"
    if OS.get_cmdline_user_args().has("--landing-lights"):
        output = "landing-lights-godot.png"
    var result = root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-master-terrain/" + output)
    assert(result == OK)
    print("Captured released upper foundations using shared Web authored camera")
    world.free()
    quit()
