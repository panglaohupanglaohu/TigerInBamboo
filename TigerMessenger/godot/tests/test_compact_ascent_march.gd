extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    await w._start_traversal("gladius",true,false)
    w.set_physics_process(false)
    if w.traversal==null:w.free();quit(1);return
    var walker=w.traversal
    var start:Vector3=walker.actor.global_position
    var tick_budget=(walker.route.size()-1)*int(ceil((0.48+PI/1.5+0.05)*60))
    for i in range(tick_budget):
        walker.tick(1.0/60.0)
        if walker.phase in ["arrived","blocked"]:break
    var result:Dictionary=walker.evidence()
    result["tick_budget"]=tick_budget
    result["distance_from_start"]=walker.actor.global_position.distance_to(start)
    result["front_landmark"]=is_instance_valid(w.landmarks.get("前港登陆口"))
    result["passed"]=walker.phase=="arrived" and result.distance_from_start>30 and result.completed_steps==result.route_points-1
    result["scope"]="Actual citadel scene, approved gladius mesh and production collision-guarded controller from plaza through the main gate, courtyard, tower stair and upper exit; no ship boarding or combat."
    FileAccess.open("res://../artifacts/pipeline/citadel-compact-ascent/godot-march.json",FileAccess.WRITE).store_string(JSON.stringify(result,"  "))
    print(JSON.stringify(result));w.free();quit(0 if result.passed else 1)
