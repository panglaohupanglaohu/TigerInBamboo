extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1200,800)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    await w._start_traversal("gladius",true,false,true)
    w.set_process(false);w.set_physics_process(false)
    for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
    w.assault_route.set_visible(false);w.window_lights.set_enabled(true)
    var walker=w.traversal;var frame:Transform3D=w.castle_adapter.original.global_transform
    for stop in [0,2,30,60,90]:
        for i in range(20000):
            if walker.completed_steps>=stop or walker.phase in ["arrived","blocked"]:break
            walker.tick(1.0/60.0)
        w.camera.global_position=walker.actor.global_position+frame.basis.x*3+frame.basis.z*4+frame.basis.y*2.8
        w.camera.look_at(walker.actor.global_position+frame.basis.y*.5,frame.basis.y.normalized());w.camera.fov=48
        await process_frame;await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-old-harbor-grade/godot-walk-%02d.png"%stop)
    var passed=walker.phase=="arrived"
    print(JSON.stringify(walker.evidence()));w.free();quit(0 if passed else 1)
