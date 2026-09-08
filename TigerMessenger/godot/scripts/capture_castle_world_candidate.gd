extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
    root.size=Vector2i(1440,960)
    var scene=load("res://scenes/original_world.tscn").instantiate()
    root.add_child(scene)
    await process_frame
    if not scene.castle_adapter.enabled:
        push_error(scene.castle_adapter.last_error)
        quit(1)
        return
    var i:int=scene.regions.find("odysseyCitadel")
    scene._focus_region(i)
    var bounds := AABB()
    var seeded := false
    for mesh in scene.castle_adapter.candidate.find_children("*", "MeshInstance3D", true, false):
        if not mesh.is_visible_in_tree(): continue
        var box: AABB=mesh.global_transform*mesh.get_aabb()
        bounds=box if not seeded else bounds.merge(box)
        seeded=true
    scene.center=bounds.get_center()
    var up:Vector3=scene.castle_adapter.original.global_basis.y.normalized()
    var basis:Basis=scene.castle_adapter.original.global_basis.orthonormalized()
    scene.camera.position=scene.center+basis*Vector3(1,0.35,1).normalized()*bounds.size.length()*0.74
    scene.camera.look_at(scene.center,up)
    for enabled in [false,true]:
        scene.castle_adapter.set_enabled(enabled)
        scene.castle_toggle.set_pressed_no_signal(enabled)
        await process_frame
        await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png("res://../artifacts/pipeline/castle-world-v1/world-%s.png" % ("after" if enabled else "before"))
    print("CASTLE_WORLD_CAPTURE_OK")
    scene.queue_free()
    await process_frame
    quit()
