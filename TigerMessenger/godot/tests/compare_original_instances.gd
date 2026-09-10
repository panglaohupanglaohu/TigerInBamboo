extends SceneTree
func _initialize() -> void: call_deferred("run")
func settle() -> void:
    for i in range(12): await process_frame
    await RenderingServer.frame_post_draw
func run() -> void:
    var model: Node3D = load("res://assets/world-source/original-world-v1.glb").instantiate();root.add_child(model)
    var camera := Camera3D.new();root.add_child(camera);camera.current = true;camera.far = 1400.0
    var target := Vector3(-62.65,77.42,-108.01)
    var up := target.normalized();var east := Vector3.UP.cross(up).normalized()
    camera.position = target + up * 45.0 + east * 65.0
    camera.look_at(target,up)
    var arguments := OS.get_cmdline_user_args()
    var birds_only := arguments.size() > 1 and arguments[1] == "birds"
    if birds_only:
        var bird_root: Node3D
        for node in model.find_children("*","Node3D",true,false):
            if node.get_meta("extras",{}).get("sourcePath","") == "bird-vortex-triple-gate[110]": bird_root=node
        assert(bird_root != null)
        var bounds := AABB();var has_bounds := false
        for node in model.find_children("*","MeshInstance3D",true,false):
            if bird_root.is_ancestor_of(node):
                var box: AABB=node.global_transform*node.mesh.get_aabb()
                bounds=bounds.merge(box) if has_bounds else box;has_bounds=true
            else:node.visible=false
        target=bounds.get_center();camera.position=target+Vector3(1,0.3,1).normalized()*bounds.size.length()*1.1;camera.look_at(target,Vector3.UP)
    var sun := DirectionalLight3D.new();root.add_child(sun);sun.rotation_degrees=Vector3(-45,-30,0)
    var environment := WorldEnvironment.new();root.add_child(environment);environment.environment=Environment.new()
    environment.environment.background_mode=Environment.BG_COLOR;environment.environment.background_color=Color("91b6ce")
    environment.environment.ambient_light_source=Environment.AMBIENT_SOURCE_COLOR;environment.environment.ambient_light_color=Color("d8e5ea");environment.environment.ambient_light_energy=0.8
    await settle()
    var before := root.get_texture().get_image()
    var report := {"before_calls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),"before_primitives":Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)}
    var adapter = load("res://scripts/original_instance_adapter.gd").new()
    report.adapter=adapter.apply(model,JSON.parse_string(FileAccess.get_file_as_string("res://assets/world-source/original-instance-map.json")))
    await settle()
    var after := root.get_texture().get_image()
    report.after_calls=Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME);report.after_primitives=Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)
    var a := before.get_data();var b := after.get_data();var max_error := 0;var changed_bytes := 0;var absolute_sum := 0
    for i in a.size():
        var error := absi(int(a[i])-int(b[i]));max_error=maxi(max_error,error);absolute_sum+=error
        if error>1:changed_bytes+=1
    report.max_byte_error=max_error;report.changed_byte_fraction=float(changed_bytes)/a.size();report.mean_byte_error=float(absolute_sum)/a.size()
    report.scope="Same source scene/camera/light, 12 settled GPU frames each; no game animation or FPS claim"
    if birds_only: report.scope="Isolated original 6000 bird instances, identical camera/light; other meshes hidden in both images, not battle acceptance"
    var directory := OS.get_cmdline_user_args()[0]
    before.save_png(directory.path_join("before.png"));after.save_png(directory.path_join("after.png"))
    var file := FileAccess.open(directory.path_join("visual-report.json"),FileAccess.WRITE);file.store_string(JSON.stringify(report,"  "));file.close()
    print("INSTANCE_VISUAL_REPORT ",JSON.stringify(report))
    model.queue_free();await process_frame;quit()
