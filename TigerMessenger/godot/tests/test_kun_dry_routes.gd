extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var world=load("res://scenes/saihoji_battle_world.tscn").instantiate();root.add_child(world)
    while not world.ready_for_battle and world.load_error.is_empty():await physics_frame
    world.set_physics_process(false);world.music.set_muted(true)
    if not world.load_error.is_empty():push_error(world.load_error);quit(1);return
    var planner=load("res://scripts/saihoji_kun_routes.gd").new()
    planner.build(world.target_garden,world.pine_visual.entries)
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/saihoji-kun-cover-points.json"))
    var boat:Node3D=Node3D.new();world.add_child(boat);world._orient_ship(boat,1.0,true)
    var deck:Vector3=boat.global_position+boat.global_basis.y.normalized()*0.65
    var start:Vector3=world.target_garden.node.to_local(deck)
    var rows:Array=[];var reachable:=0;var ramp_distance:=INF
    for row in data.points:
        var p:=Vector3(row.localPoint[0],row.localPoint[1],row.localPoint[2])
        var path:Array[Vector3]=planner.route(start,p)
        if not path.is_empty():
            reachable+=1;ramp_distance=deck.distance_to(world.target_garden.node.to_global(path[0]))
        rows.append({"id":row.id,"reachable":not path.is_empty(),"path_points":path.size(),"trunk_blocked":planner.blocked_body(p)})
    var result:Dictionary={"passed":reachable==50 and ramp_distance<=8.0,"reachable":reachable,"total":data.points.size(),"ramp_distance":ramp_distance if is_finite(ramp_distance) else null,"deck_local":[start.x,start.y,start.z],"grid":planner.report,"rows":rows,"scope":"candidate local routes; not activated in battle"}
    FileAccess.open("res://../artifacts/pipeline/saihoji-target-integration/kun-dry-routes-report.json",FileAccess.WRITE).store_string(JSON.stringify(result,"  "))
    print(JSON.stringify({"passed":result.passed,"reachable":reachable,"ramp_distance":ramp_distance if is_finite(ramp_distance) else null,"grid":planner.report}));world.queue_free();await process_frame;quit(0 if result.passed else 1)
