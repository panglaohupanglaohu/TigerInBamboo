extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1440,900)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    w.set_process(false);w.set_physics_process(false)
    for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
    w.assault_route.set_visible(false)
    var frame:Transform3D=w.castle_adapter.original.global_transform
    w.camera.global_position=frame*Vector3(0,34,170)
    w.camera.look_at(frame*Vector3(-6,14,42),frame.basis.y.normalized())
    w.camera.fov=52
    var pads:Array=[];var foundations:Array=[]
    for n in w.castle_adapter.original.find_children("*","MeshInstance3D",true,false):
        if n.name=="contour-step-0":pads.append({"path":str(n.get_path()),"layers":n.layers})
        if n.name=="highland-town-foundation-platform":foundations.append({"path":str(n.get_path()),"visible":n.is_visible_in_tree()})
    print(JSON.stringify({"foundation_rendering":foundations,"edit_pad_rendering":pads}))
    var candidate=Shader.new()
    candidate.code=FileAccess.get_file_as_string("res://shaders/citadel_terrain_color.gdshader").replace("void fragment() {", "void fragment() {\n    if (!FRONT_FACING) NORMAL = -NORMAL;")
    for mesh in w.model.find_children("*","MeshInstance3D",true,false):
        for surface in range(mesh.mesh.get_surface_count()):
            var mat=mesh.get_active_material(surface)
            if mat is ShaderMaterial and mat.shader.resource_path=="res://shaders/citadel_terrain_color.gdshader":
                var copy=mat.duplicate();copy.shader=candidate;mesh.set_surface_override_material(surface,copy)
    var out="res://../artifacts/pipeline/citadel-west-massif/"
    for night in [false,true]:
        w.window_lights.set_enabled(night)
        await process_frame
        await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png(out+("godot-backface-night.png" if night else "godot-backface-day.png"))
    print("Captured actual citadel world, production day/night toggle, same castle-local camera")
    w.queue_free();await process_frame;quit()
