extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
    var directory: String = OS.get_cmdline_user_args()[0]
    root.size = Vector2i(1100,750)
    var world = load("res://scenes/saihoji_battle_world.tscn").instantiate()
    root.add_child(world)
    await physics_frame
    await physics_frame
    world.set_physics_process(false)
    world.music.set_muted(true)
    var report := {"scope":"Actual original Saihoji world, natural ship departure; boarding route and complete battle NOT accepted", "captured":false, "load_error":world.load_error}
    if world.load_error.is_empty():
        world.begin_battle()
        for i in range(60*60):
            world._physics_process(1.0/60.0)
            if i%120==0: await physics_frame
            if not world.ships.is_empty() and world.ships[0].u > 0.12:
                var row: Dictionary = world.ships[0]
                var ship: Node3D = row.node
                report["revision"] = ship.get_meta("warship_revision", "missing")
                report["rowers"] = row.visual.ids["n220"].get_child_count()
                report["simulation_seconds"] = float(i)/60
                report["pose_frame"] = row.visual.last_frame
                var headings: Array = []
                var saved: Transform3D = ship.transform
                for outbound in [true,false]:
                    for u in [0.01,0.2,0.43,0.6,0.8,0.99]:
                        world._orient_ship(ship,u,outbound)
                        var expected: Vector3 = (world._route(u+0.001)-world._route(u-0.001)).slide(ship.position.normalized()).normalized()
                        if not outbound: expected = -expected
                        headings.append(ship.basis.x.normalized().dot(expected))
                ship.transform = saved
                report["route_heading_dots"] = headings
                world.camera.position = ship.global_transform*Vector3(6,4,7)
                world.camera.look_at(ship.global_transform*Vector3(0,0.5,0),ship.global_basis.y.normalized())
                for frame in 3: await process_frame
                await RenderingServer.frame_post_draw
                root.get_texture().get_image().save_png(directory.path_join("godot-v6-actual-sailing.png"))
                report["captured"] = true
                report["runtime"] = world.warship_visual.report.duplicate(true)
                world.reset_battle()
                report["reset_ship_count"] = world.ships.size()
                report["reset_visual_count"] = world.warship_visual.report.instances
                break
    FileAccess.open(directory.path_join("godot-world-report.json"),FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report))
    world.queue_free()
    await process_frame
    quit(0 if report.captured else 1)
