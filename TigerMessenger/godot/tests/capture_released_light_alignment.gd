extends SceneTree
func _initialize():call_deferred("run")
func run():
    root.size=Vector2i(1600,1000)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    w.set_process(false);w.set_physics_process(false)
    for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
    w.assault_route.set_visible(false)
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/pipeline/citadel-master-terrain/lighting-alignment.json"))
    var frame:Transform3D=w.castle_adapter.original.global_transform
    var eye=data.camera.eye;var aim=data.camera.look
    w.camera.global_position=frame*Vector3(eye[0],eye[1],eye[2])
    w.camera.look_at(frame*Vector3(aim[0],aim[1],aim[2]),frame.basis.y.normalized());w.camera.fov=data.camera.fov
    w.window_lights.set_enabled(true)
    if OS.get_cmdline_user_args().has("--calibrate"):
        await process_frame;await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-master-terrain/light-energy-before.png")
        for light in w.window_lights.points:
            if str(light.name)=="NewCityLight_main-gate":light.light_energy=28.0
            if str(light.name)=="NewCityLight_plaza":light.light_energy=8.0
    await process_frame;await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-master-terrain/lighting-godot.png")
    if OS.get_cmdline_user_args().has("--calibrate"):
        root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-master-terrain/light-energy-after.png")
    var rows=[]
    for light in w.window_lights.points:
        var p:Vector3=w.castle_adapter.original.to_local(light.global_position)
        rows.append({"name":str(light.name),"position":[p.x,p.y,p.z],"energy":light.light_energy,"range":light.omni_range})
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/lighting-godot.json",FileAccess.WRITE).store_string(JSON.stringify(rows,"  "))
    print("Captured native released lights");w.free();quit()
