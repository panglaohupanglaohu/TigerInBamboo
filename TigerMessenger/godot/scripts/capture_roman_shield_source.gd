extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
    root.size = Vector2i(1200, 1000)
    var scene = load("res://scenes/roman_grip_blue.tscn").instantiate()
    root.add_child(scene)
    await process_frame
    scene.set_process(false)
    scene.pose_mode = 0
    scene.apply_pose(0.0)
    scene.camera.position = Vector3(2.1, 1.4, 2.8)
    scene.camera.look_at(Vector3(0, 0.55, 0))
    for child in scene.get_children():
        if child is CanvasLayer: child.visible = false
    await process_frame
    await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png("res://../artifacts/pipeline/romanSoldier/shield-source.png")
    scene.queue_free()
    await process_frame
    quit()
