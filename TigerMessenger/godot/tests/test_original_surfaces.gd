extends SceneTree
func _initialize() -> void: call_deferred("run")
func settle() -> void:
    for i in range(10): await process_frame
    await RenderingServer.frame_post_draw
func run() -> void:
    var model: Node3D=load("res://assets/world-source/original-world-v1.glb").instantiate();root.add_child(model)
    var tram: Node3D
    for node in model.find_children("*","Node3D",true,false):
        if node.get_meta("extras",{}).get("sourcePath","")=="christchurch-tram-system[62]/heritage-tram-red-11[1768]": tram=node
    assert(tram!=null)
    var bounds:=AABB();var first:=true
    for node in model.find_children("*","MeshInstance3D",true,false):
        if tram.is_ancestor_of(node):
            var box: AABB=node.global_transform*node.mesh.get_aabb();bounds=box if first else bounds.merge(box);first=false
        else:node.visible=false
    var camera:=Camera3D.new();root.add_child(camera);camera.current=true;camera.far=1400
    var center:=bounds.get_center();var up:=center.normalized();var east:=Vector3.UP.cross(up).normalized()
    camera.position=center+(up*0.65+east+up.cross(east)*0.7).normalized()*bounds.size.length()*1.2;camera.look_at(center,up)
    var sun:=DirectionalLight3D.new();root.add_child(sun);sun.rotation_degrees=Vector3(-45,-30,0)
    var env:=WorldEnvironment.new();root.add_child(env);env.environment=Environment.new();env.environment.background_mode=Environment.BG_COLOR;env.environment.background_color=Color("91b6ce");env.environment.ambient_light_source=Environment.AMBIENT_SOURCE_COLOR;env.environment.ambient_light_energy=0.8
    await settle()
    var before:=root.get_texture().get_image()
    var report:Dictionary={"before_calls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),"before_primitives":Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)}
    var adapter=load("res://scripts/original_surface_adapter.gd").new();report.compaction=adapter.apply(model)
    var position_error:=0.0;var normal_error:=0.0;var uv_error:=0.0;var topology:=true;var material_ok:=true
    for change in adapter.changes:
        var arrays:Array=change.node.mesh.surface_get_arrays(0)
        var offset := 0
        for surface in range(6):
            var old:Array=change.mesh.surface_get_arrays(surface)
            for i in old[Mesh.ARRAY_VERTEX].size():
                position_error=maxf(position_error,old[Mesh.ARRAY_VERTEX][i].distance_to(arrays[Mesh.ARRAY_VERTEX][offset+i]))
                if old[Mesh.ARRAY_NORMAL]!=null:normal_error=maxf(normal_error,old[Mesh.ARRAY_NORMAL][i].distance_to(arrays[Mesh.ARRAY_NORMAL][offset+i]))
                if old[Mesh.ARRAY_TEX_UV]!=null:uv_error=maxf(uv_error,old[Mesh.ARRAY_TEX_UV][i].distance_to(arrays[Mesh.ARRAY_TEX_UV][offset+i]))
            for i in range(6):topology=topology and old[Mesh.ARRAY_INDEX][i]+offset==arrays[Mesh.ARRAY_INDEX][surface*6+i]
            material_ok=material_ok and change.node.get_active_material(0)==change.mesh.surface_get_material(surface)
            offset+=old[Mesh.ARRAY_VERTEX].size()
    report.position_error=position_error;report.normal_error=normal_error;report.uv_error=uv_error;report.topology_preserved=topology;report.materials_preserved=material_ok
    report.idempotent=adapter.apply(model).nodes==0
    await settle()
    var after:=root.get_texture().get_image()
    report.after_calls=Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME);report.after_primitives=Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)
    var a:=before.get_data();var b:=after.get_data();var max_error:=0;var changed:=0
    for i in a.size():
        var error:=absi(int(a[i])-int(b[i]));max_error=maxi(max_error,error)
        if error>1:changed+=1
    report.pixel_max_byte_error=max_error;report.pixel_changed_fraction=float(changed)/a.size()
    report.scope="Full eligible original box geometry check plus isolated actual red tram GPU; no full battlefield FPS claim"
    report.passed=report.compaction.nodes>1800 and position_error<0.000001 and normal_error<0.0001 and uv_error<0.000001 and topology and material_ok and max_error<=1 and report.idempotent
    adapter.restore();report.restored=adapter.changes.is_empty()
    var directory:=OS.get_cmdline_user_args()[0];before.save_png(directory.path_join("tram-before.png"));after.save_png(directory.path_join("tram-after.png"))
    var file:=FileAccess.open(directory.path_join("report.json"),FileAccess.WRITE);file.store_string(JSON.stringify(report,"  "));file.close();print("SURFACE_REPORT ",JSON.stringify(report))
    model.queue_free();await process_frame;quit(0 if report.passed else 1)
