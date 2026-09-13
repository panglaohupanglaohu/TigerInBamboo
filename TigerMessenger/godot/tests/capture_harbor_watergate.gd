extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    w.set_process(false);w.set_physics_process(false)
    for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
    w.assault_route.set_visible(false)
    var gates=w.castle_adapter.west_city.find_children("citadel-harbor-watergate","Node3D",true,false)
    if gates.size()!=1:w.free();quit(1);return
    var g:Node3D=gates[0]
    w.camera.global_position=g.to_global(Vector3(-10,10,-17))
    w.camera.look_at(g.to_global(Vector3(0,3.5,7)),g.global_basis.y.normalized());w.camera.fov=55
    w.window_lights.set_enabled(true)
    await process_frame
    await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-harbor-watergate/godot-quay-view.png")
    w.queue_free();await process_frame;quit()
