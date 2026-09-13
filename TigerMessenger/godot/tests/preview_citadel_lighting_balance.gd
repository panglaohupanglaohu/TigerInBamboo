extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1440,900)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    w.set_process(false);w.set_physics_process(false)
    for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
    w.assault_route.set_visible(false)
    var city=w.castle_adapter.original.find_child("highland-west-city",true,false)
    if city==null:push_error("Missing imported city");quit(1);return
    var frame:Transform3D=city.global_transform
    w.camera.global_position=frame*Vector3(100,46,85)
    w.camera.look_at(frame*Vector3(60,32,0),frame.basis.y.normalized());w.camera.fov=43
    w.window_lights.set_enabled(true)
    for energy in [28.0,70.0,140.0]:
        for point in w.window_lights.points:
            if str(point.name)=="NewCityLight_main-gate":point.light_energy=energy
        await process_frame;await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-lighting-balance/godot-candidate-"+str(int(energy))+".png")
    print("Captured native gate energy candidates")
    w.queue_free();await process_frame;quit()
