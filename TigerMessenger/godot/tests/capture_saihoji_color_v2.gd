extends SceneTree
var directory: String
func _initialize() -> void: call_deferred("run")
func run() -> void:
    directory = OS.get_cmdline_user_args()[0]
    root.size = Vector2i(1100,750)
    var world = load("res://scenes/saihoji_battle_world.tscn").instantiate()
    root.add_child(world)
    await physics_frame
    await physics_frame
    world.set_physics_process(false)
    world.music.set_muted(true)
    var report: Dictionary = {"scope":"Actual battle natural SOCCO disembarkation; color revision only, not full battle acceptance", "captured":false}
    if not world.load_error.is_empty():
        report["load_error"] = world.load_error
    else:
        world.begin_battle()
        for i in range(60*360):
            world._physics_process(1.0/60.0)
            if i%120 == 0: await physics_frame
            if world.heavies.any(func(h):return h.kind=="hauler" and h.state=="walking_out" and h.path_step==1 and world.crafts[h.vehicle].node.to_local(h.node.position).z < -3.4):
                var craft: Node3D = world.crafts[0].node
                world.camera.position = craft.global_transform*Vector3(4,2,-10)
                world.camera.look_at(craft.global_transform*Vector3(0,-1.2,-3.5),craft.global_basis.y.normalized())
                for frame in 3: await process_frame
                await RenderingServer.frame_post_draw
                root.get_texture().get_image().save_png(directory.path_join("godot-actual-disembarkation.png"))
                report["captured"] = true
                report["simulation_seconds"] = float(i)/60
                report["evidence"] = world.evidence()
                break
    FileAccess.open(directory.path_join("godot-report.json"),FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print("COLOR_BATTLE_CAPTURE ",report.captured)
    world.queue_free()
    await process_frame
    quit(0 if report.captured else 1)
