extends SceneTree
func _initialize():call_deferred("run")
func run():
    root.size=Vector2i(1600,1000)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    w.set_process(false);w.set_physics_process(false)
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-backdrop-forests.json"))
    var rows=[];var passed=true
    var composition=OS.get_cmdline_user_args().has("--composition")
    var roots=w.model.find_children("citadel-new-city-backdrop-range","Node3D",true,false).filter(func(n):return n.is_visible_in_tree())
    passed=roots.size()==1
    for row in data.forests:
        var groups=w.model.find_children(row.name,"Node3D",true,false).filter(func(n):return n.is_visible_in_tree())
        var error=0.0;var count=0;var missing=0
        if groups.size()==1:
            for i in range(int(row.count)):
                var nodes=groups[0].find_children(row.name+" instance "+str(i),"MeshInstance3D",true,false)
                if nodes.size()!=1:missing+=1;continue
                var q=row.positions[i];var expected=w.castle_adapter.original.to_global(Vector3(q[0],q[1],q[2]))
                if not nodes[0].get_meta("skipColliders",false):missing+=1
                error=maxf(error,expected.distance_to(nodes[0].global_position));count+=1
        var ok=groups.size()==1 and missing==0 and count==int(row.count) and error<.002
        passed=passed and ok;rows.append({"name":row.name,"count":count,"missing":missing,"max_position_error_m":error,"visible_groups":groups.size(),"passed":ok})
    var report={"passed":passed,"visible_ranges":roots.size(),"forests":rows,"scope":"All three actual native forest groups and all instance root positions compared to released Web castle frame; decorative instances excluded from collision. Does not certify every root footprint or campaign."}
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/"+("backdrop-r07-godot.json" if composition else "backdrop-forests-godot.json"),FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    if OS.get_cmdline_user_args().has("--capture"):
        for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
        w.assault_route.set_visible(false);w.window_lights.set_enabled(true)
        var city=w.castle_adapter.original.find_child("highland-west-city",true,false)
        var shots=[["upper",Vector3(100,30,68),Vector3(61,19,24),55.0]]
        if composition:shots.append(["overview",Vector3(12,42,141),Vector3(34,19,16),52.0])
        for shot in shots:
            w.camera.global_position=city.to_global(shot[1]);w.camera.look_at(city.to_global(shot[2]),city.global_basis.y.normalized());w.camera.fov=shot[3]
            await process_frame;await RenderingServer.frame_post_draw
            var file="backdrop-r07-"+shot[0]+"-godot.png" if composition else "floating-plants-after-godot.png"
            root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-master-terrain/"+file)
    print(JSON.stringify(report));w.free();quit(0 if passed else 1)
