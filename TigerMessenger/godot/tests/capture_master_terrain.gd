extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1600,1000)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    var patch=preload("res://tests/master_terrain_fixture.gd").mount(w)
    var plaza=OS.get_cmdline_user_args().has("--placement-r03") or OS.get_cmdline_user_args().has("--placement-r04")
    w.set_process(false);w.set_physics_process(false)
    for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
    w.assault_route.set_visible(false)
    await w._start_traversal("gladius",true,false,false,true)
    w.set_physics_process(false)
    assert(w.traversal!=null)
    assert(w.traversal.evidence().route_points==15)
    print("Production horse-platform traversal entry loaded 15 route points")
    var frame:Transform3D=w.castle_adapter.original.find_child("highland-west-city",true,false).global_transform
    w.camera.global_position=frame*Vector3(96,31,117)
    w.camera.look_at(frame*Vector3(60,13,61),frame.basis.y.normalized())
    w.camera.fov=59
    var paving=w.castle_adapter.original.find_child("west-city-plaza-paving-ring",true,false)
    if plaza:paving=patch.find_child("west-city-plaza-paving-ring",true,false)
    assert(paving is MeshInstance3D)
    var triangles=0
    for surface in range(paving.mesh.get_surface_count()):
        var arrays=paving.mesh.surface_get_arrays(surface)
        triangles+=(arrays[Mesh.ARRAY_INDEX].size() if arrays[Mesh.ARRAY_INDEX]!=null and arrays[Mesh.ARRAY_INDEX].size()>0 else arrays[Mesh.ARRAY_VERTEX].size())/3
    assert(triangles>0 if plaza else triangles==5323)
    print("Native new plaza paving triangles: ",triangles)
    var city=w.castle_adapter.original.find_child("highland-west-city",true,false)
    assert(city.find_child("citadel-new-main-gate",true,false).position.distance_to(Vector3(60,16,23))<0.001)
    assert(w.window_lights.points[0].position.distance_to(Vector3(60,23,33))<0.001)
    assert(city.find_child("new-city-rock-shoulder",true,false)!=null)
    var statue=city.find_child("citadel-plaza-hero-statue",true,false)
    var horse=w.castle_adapter.trojan_horse
    var statue_local=city.to_local(statue.global_position)
    var horse_local=city.to_local(horse.global_position)
    assert(statue_local.distance_to(Vector3(65,4,76))<0.001)
    assert(horse_local.distance_to(Vector3(85 if plaza else 81,5.8,72.5))<0.001)
    assert(w.window_lights.points[1].position.distance_to(Vector3(65,8,70))<0.001)
    print(JSON.stringify({"statue":str(statue_local),"original_horse":str(horse_local),"plaza_light":str(w.window_lights.points[1].position)}))
    var pads:Array=[];var foundations:Array=[]
    for n in w.castle_adapter.original.find_children("*","MeshInstance3D",true,false):
        if n.name=="contour-step-0":pads.append({"path":str(n.get_path()),"layers":n.layers})
        if n.name=="highland-town-foundation-platform":foundations.append({"path":str(n.get_path()),"visible":n.is_visible_in_tree()})
    print(JSON.stringify({"foundation_rendering":foundations,"edit_pad_rendering":pads}))
    var out="res://../artifacts/pipeline/citadel-master-terrain/"
    var tag="placement-r01" if OS.get_cmdline_user_args().has("--placement-r01") else "r"+preload("res://tests/master_terrain_fixture.gd").revision()
    if OS.get_cmdline_user_args().has("--placement-r02"):tag="placement-r02"
    if plaza:tag="placement-r03"
    if OS.get_cmdline_user_args().has("--placement-r04"):tag="placement-r04"
    for night in [false,true]:
        w.window_lights.set_enabled(night)
        await process_frame
        await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png(out+tag+("-godot-after-night.png" if night else "-godot-after-day.png"))
    print("Captured actual citadel world, production day/night toggle, same castle-local camera")
    w.queue_free();await process_frame;quit()
