extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1500,1000)
    var w=load("res://scenes/citadel_world.tscn").instantiate()
    root.add_child(w)
    await process_frame
    var adapter=w.front_harbor_berth_adapter
    assert(adapter.report.get("released_holding",false),"Released original ship not bound")
    assert(adapter.ship.is_visible_in_tree(),"Original ship hidden under retired port")
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-released-holding-berth.json"))
    var expected=Vector3(data.position[0],data.position[1],data.position[2])
    assert(adapter.ship.position.distance_to(expected)<0.001)
    assert(adapter.ship.get_parent()==w.castle_adapter.original)
    w.set_process(false);w.set_physics_process(false)
    for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
    w.assault_route.set_visible(false)
    var frame=w.castle_adapter.original.find_child("highland-west-city",true,false).global_transform
    var market=OS.get_cmdline_user_args().has("--market")
    var cargo=market or OS.get_cmdline_user_args().has("--cargo")
    if market:
        var market_group=w.castle_adapter.original.find_child("citadel-front-quay-market",true,false)
        assert(market_group!=null and market_group.is_visible_in_tree())
    if cargo:
        var group=w.castle_adapter.original.find_child("citadel-front-harbor-cargo",true,false)
        assert(group!=null and group.is_visible_in_tree())
        assert(group.get_child_count()==14,"Expected original 14 cargo units")
    w.camera.global_position=frame*(Vector3(77,7,134) if cargo else Vector3(98,25,151))
    w.camera.look_at(frame*(Vector3(54,-3,106) if cargo else Vector3(54,0,102)),frame.basis.y.normalized())
    w.camera.fov=55
    w.window_lights.set_enabled(true)
    await process_frame
    await RenderingServer.frame_post_draw
    var out="res://../artifacts/pipeline/citadel-master-terrain/"
    var tag="surroundings-r03" if market else ("surroundings-r02" if cargo else "surroundings-r01")
    root.get_texture().get_image().save_png(out+tag+"-godot.png")
    if market:
        w.camera.global_position=frame*Vector3(62,15,109)
        w.camera.look_at(frame*Vector3(46,4,94),frame.basis.y.normalized())
        await process_frame
        await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png(out+tag+"-godot-upper-market.png")
    if cargo:adapter.report["visible_original_cargo_units"]=14
    var file=FileAccess.open(out+tag+"-godot.json",FileAccess.WRITE)
    file.store_string(JSON.stringify(adapter.report,"  "));file.close()
    print("Released original ship visible at exported castle-local holding pose")
    w.queue_free();await process_frame;quit()
