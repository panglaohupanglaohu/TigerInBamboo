extends SceneTree
func _initialize():call_deferred("run")
func run():
    root.size=Vector2i(1600,1000)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    w.set_process(false);w.set_physics_process(false)
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-upper-foundations.json"))
    var rows=[];var passed=true
    for part in data.parts:
        var name="citadel-upper-rock-"+str(part.name)+"-"+str(int(part.ordinal))
        var matches=w.model.find_children(name,"MeshInstance3D",true,false).filter(func(m):return m.is_visible_in_tree())
        var count=0
        if matches.size()==1:
            var mesh=matches[0];var arrays=mesh.mesh.surface_get_arrays(0);var vertices=arrays[Mesh.ARRAY_VERTEX];count=vertices.size()
            var dump=[]
            for v in vertices:dump.append([v.x,v.y,v.z])
            FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/"+name+"-native-vertices.json",FileAccess.WRITE).store_string(JSON.stringify({"vertices":dump,"indices":Array(arrays[Mesh.ARRAY_INDEX])}))
        var ok=matches.size()==1 and count*3==part.rock.positions.size()
        passed=passed and ok;rows.append({"name":name,"visible_copies":matches.size(),"vertices":count,"passed":ok})
    var report={"passed":passed,"source":data.source,"parts":rows,"scope":"Actual native inventory and vertex dump; triangle geometry must pass compare_battered_foundations.py separately."}
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/battered-foundations-godot.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    if OS.get_cmdline_user_args().has("--capture"):
        for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
        w.assault_route.set_visible(false);w.window_lights.set_enabled(true)
        var city=w.castle_adapter.original.find_child("highland-west-city",true,false)
        w.camera.global_position=city.to_global(Vector3(100,30,68));w.camera.look_at(city.to_global(Vector3(61,19,24)),city.global_basis.y.normalized());w.camera.fov=55
        await process_frame;await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-master-terrain/battered-foundations-after-godot.png")
    print(JSON.stringify(report));w.free();quit(0 if passed else 1)
