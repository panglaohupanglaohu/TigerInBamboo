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
    w.camera.global_position=frame*Vector3(-24,29,124)
    w.camera.look_at(frame*Vector3(-12,2,81),frame.basis.y.normalized())
    w.camera.fov=43
    w.window_lights.set_enabled(true)
    var terrains:Array=[]
    for m in w.model.find_children("*","MeshInstance3D",true,false):
        if m.is_visible_in_tree() and str(m.name) in ["citadel-oskar-grid-mountain-surface","citadel-coastal-cliff-seal","highland-ravine-wall-west"]:terrains.append(m)
    for variant in ["normal-debug","color-display"]:
        for m in terrains:
            if variant=="current":continue
            var mat=ShaderMaterial.new();var sh=Shader.new()
            sh.code="shader_type spatial; render_mode unshaded,cull_disabled; void fragment(){ ALBEDO="+("NORMAL*.5+.5" if variant=="normal-debug" else "pow(COLOR.rgb,vec3(1.0/2.2))")+";}"
            mat.shader=sh
            m.material_override=mat
        await process_frame
        await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-terrain-render/"+variant+".png")
    w.queue_free();await process_frame;quit()
