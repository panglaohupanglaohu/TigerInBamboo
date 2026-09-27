extends SceneTree
func _initialize():call_deferred("run")
func run():
    root.size=Vector2i(1600,1000)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    w.set_process(false);w.set_physics_process(false)
    var source=JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/pipeline/citadel-master-terrain/planting-audit.json"));var rows=[];var passed=true
    for index in [0,2]:
        var expected=source.rows[index]
        var groups=w.castle_adapter.original.find_children(expected.name,"Node3D",true,false).filter(func(n):return n.is_visible_in_tree())
        var meshes=0;var vertices=0
        if groups.size()==1:
            for m in groups[0].find_children("*","MeshInstance3D",true,false):
                if not m.is_visible_in_tree():continue
                meshes+=1
                for i in range(m.mesh.get_surface_count()):vertices+=m.mesh.surface_get_arrays(i)[Mesh.ARRAY_VERTEX].size()
        var ok=groups.size()==1 and meshes==expected.physicalMeshes and vertices==expected.physicalVertices
        passed=passed and ok;rows.append({"name":expected.name,"groups":groups.size(),"meshes":meshes,"vertices":vertices,"expected_vertices":expected.physicalVertices,"passed":ok})
    var crowns=OS.get_cmdline_user_args().has("--crowns")
    var report={"passed":passed,"parts":rows,"scope":"Actual Godot two planting groups match Web inventory, with real close-view capture; full route checked separately."}
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/"+("keep-crowns-godot.json" if crowns else "statue-garden-godot.json"),FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
    w.assault_route.set_visible(false);w.window_lights.set_enabled(true)
    var city=w.castle_adapter.original.find_child("highland-west-city",true,false)
    w.camera.global_position=city.to_global(Vector3(100,30,68) if crowns else Vector3(83,13,95));w.camera.look_at(city.to_global(Vector3(61,19,24) if crowns else Vector3(65,6.5,76)),city.global_basis.y.normalized());w.camera.fov=55 if crowns else 50
    await process_frame;await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-master-terrain/"+("keep-crowns-godot.png" if crowns else "statue-garden-godot.png"))
    print(JSON.stringify(report));w.free();quit(0 if passed else 1)
