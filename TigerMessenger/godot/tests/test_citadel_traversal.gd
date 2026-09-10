extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var context=load("res://scripts/citadel_collision_context.gd").new();context.bind(w)
    await physics_frame;await physics_frame
    var results:Dictionary={}
    var requested=OS.get_environment("TM_TRAVERSAL_ROLE")
    var kinds=[requested] if requested in ["gladius","spear","longbow"] else ["gladius","spear","longbow"]
    for kind in kinds:
        var walker=load("res://scripts/citadel_roman_traversal.gd").new()
        if not walker.bind(w,kind):quit(1);return
        for frame in range(60*300):
            walker.tick(1.0/60.0)
            if walker.phase in ["arrived","blocked"]:break
        results[kind]=walker.evidence();print(JSON.stringify(results[kind]));walker.dispose()
    var blocker=StaticBody3D.new();w.add_child(blocker)
    var collision=CollisionShape3D.new();var box=BoxShape3D.new();box.size=Vector3(1.2,2.2,0.15);collision.shape=box;blocker.add_child(collision)
    blocker.global_transform=w.stair_candidate.root.global_transform*Transform3D(Basis.IDENTITY,w.stair_candidate.route[3]+Vector3.UP*1.1)
    await physics_frame;await physics_frame
    var control=load("res://scripts/citadel_roman_traversal.gd").new();control.bind(w,"gladius")
    for frame in range(600):
        control.tick(1.0/60.0)
        if control.phase=="blocked":break
    var stops:bool=control.phase=="blocked" and control.completed_steps<3
    var stop_position:Vector3=control.actor.global_position
    for frame in range(60):control.tick(1.0/60.0)
    stops=stops and control.actor.global_position.distance_to(stop_position)<0.00001
    results.blocking_control={"passed":stops,"evidence":control.evidence()};control.dispose()
    var passed:bool=kinds.all(func(kind):return results[kind].phase=="arrived" and results[kind].completed_steps==results[kind].route_points-1) and stops
    print("Traversal acceptance: "+str(passed))
    FileAccess.open("res://../artifacts/pipeline/citadel-entry/traversal%s.json"%("-"+requested if kinds.size()==1 else ""),FileAccess.WRITE).store_string(JSON.stringify(results,"  "))
    w.queue_free();await process_frame;quit(0 if passed else 1)
