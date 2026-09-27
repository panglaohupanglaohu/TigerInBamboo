extends SceneTree
func _initialize():call_deferred("run")
func run():
    root.size=Vector2i(1600,1000)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    var groups=[]
    for n in w.castle_adapter.original.find_children("citadel-terrace-planting","Node3D",true,false):
        if n.is_visible_in_tree():groups.append(n)
    var meshes=0;var vertices=0
    if groups.size()==1:
        for mesh in groups[0].find_children("*","MeshInstance3D",true,false):
            if not mesh.is_visible_in_tree():continue
            meshes+=1
            for surface in range(mesh.mesh.get_surface_count()):vertices+=mesh.mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX].size()
    var source=JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/pipeline/citadel-master-terrain/planting-audit.json"))
    var expected=source.rows[0]
    var report={"visible_groups":groups.size(),"meshes":meshes,"vertices":vertices,"expected_vertices":expected.vertices,"passed":groups.size()==1 and meshes==expected.meshes and vertices==expected.vertices,"scope":"Native visible merged planting matches Web mesh and vertex inventory. Not rendered appearance or collision validation."}
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/godot-planting.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    if OS.get_cmdline_user_args().has("--capture"):
        w.set_process(false);w.set_physics_process(false)
        for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
        w.assault_route.set_visible(false)
        var city=w.castle_adapter.original.find_child("highland-west-city",true,false)
        w.camera.global_position=city.to_global(Vector3(100,30,68))
        w.camera.look_at(city.to_global(Vector3(61,19,24)),city.global_basis.y.normalized());w.camera.fov=55
        w.window_lights.set_enabled(true)
        await process_frame;await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-master-terrain/upper-pines-godot.png")
    print(JSON.stringify(report));w.free();quit(0 if report.passed else 1)
