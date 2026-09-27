extends SceneTree
func _initialize():call_deferred("run")
func run():
    root.size=Vector2i(1400,900)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    w.set_process(false);w.set_physics_process(false)
    var city=w.castle_adapter.original.find_child("highland-west-city",true,false)
    var matches=w.castle_adapter.original.find_children("integrated-upper-landing-support","MeshInstance3D",true,false).filter(func(n):return n.is_visible_in_tree())
    var minimum=Vector3(INF,INF,INF);var maximum=Vector3(-INF,-INF,-INF);var triangles=0
    for m in matches:
        for i in range(m.mesh.get_surface_count()):
            var a=m.mesh.surface_get_arrays(i);var vertices=a[Mesh.ARRAY_VERTEX];var indices=a[Mesh.ARRAY_INDEX]
            triangles+=int((indices.size() if indices!=null and not indices.is_empty() else vertices.size())/3)
            for v in vertices:
                var p=city.to_local(m.to_global(v));minimum=minimum.min(p);maximum=maximum.max(p)
    var expected=JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/pipeline/citadel-landing-support/check.json"))
    var lo=Vector3(expected.bounds.min[0],expected.bounds.min[1],expected.bounds.min[2]);var hi=Vector3(expected.bounds.max[0],expected.bounds.max[1],expected.bounds.max[2])
    var error=maxf(minimum.distance_to(lo),maximum.distance_to(hi))
    var passed=matches.size()==1 and triangles==int(expected.triangles) and error<.003
    var report={"passed":passed,"visible_groups":matches.size(),"triangles":triangles,"bounds_error":error,"scope":"Actual Godot support bounds and triangle inventory against Web; route collision checked separately."}
    FileAccess.open("res://../artifacts/pipeline/citadel-landing-support/godot.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
    w.assault_route.set_visible(false);w.window_lights.set_enabled(true)
    w.camera.global_position=city.to_global(Vector3(84,10,111));w.camera.look_at(city.to_global(Vector3(64,1,89)),city.global_basis.y.normalized());w.camera.fov=52
    await process_frame;await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-landing-support/godot.png")
    print(JSON.stringify(report));w.free();quit(0 if passed else 1)
