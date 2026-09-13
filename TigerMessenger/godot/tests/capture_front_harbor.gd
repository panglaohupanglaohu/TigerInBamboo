extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1280,720)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    w.set_process(false);w.set_physics_process(false)
    for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
    w.assault_route.set_visible(false)
    var frame:Transform3D=w.castle_adapter.original.global_transform
    w.camera.global_position=frame*Vector3(-70,36,150)
    w.camera.look_at(frame*Vector3(-10,-3,76),frame.basis.y.normalized())
    w.camera.fov=55
    var pads:Array=[];var foundations:Array=[]
    for n in w.castle_adapter.original.find_children("*","MeshInstance3D",true,false):
        if n.name=="contour-step-0":pads.append({"path":str(n.get_path()),"layers":n.layers})
        if n.name=="highland-town-foundation-platform":foundations.append({"path":str(n.get_path()),"visible":n.is_visible_in_tree()})
    print(JSON.stringify({"foundation_rendering":foundations,"edit_pad_rendering":pads}))
    var out="res://../artifacts/pipeline/citadel-front-harbor/"
    for night in [false,true]:
        w.window_lights.set_enabled(night)
        await process_frame
        await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png(out+("godot-current-night.png" if night else "godot-current-day.png"))
    print("Captured actual citadel world, production day/night toggle, same castle-local camera")
    w.queue_free();await process_frame;quit()
