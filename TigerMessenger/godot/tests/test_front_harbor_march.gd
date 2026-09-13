extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    await w._start_traversal("gladius",true,true)
    w.set_physics_process(false)
    if w.traversal==null:w.free();quit(1);return
    var walker=w.traversal
    var start:Vector3=walker.actor.global_position
    for i in range(60*400):
        walker.tick(1.0/60.0)
        if walker.phase in ["arrived","blocked"]:break
    var result:Dictionary=walker.evidence()
    result["distance_from_start"]=walker.actor.global_position.distance_to(start)
    result["front_landmark"]=is_instance_valid(w.landmarks.get("前港登陆口"))
    result["passed"]=walker.phase=="arrived" and result.distance_from_start>20 and result.front_landmark
    result["scope"]="Actual citadel scene, approved gladius mesh and production collision-guarded controller from new front quay through watergate and switchbacks to plaza; no ship boarding or combat."
    FileAccess.open("res://../artifacts/pipeline/citadel-common-frame/godot-full-scene-front-march.json" if OS.get_cmdline_user_args().has("--common-frame") else "res://../artifacts/pipeline/citadel-front-harbor/godot-march.json",FileAccess.WRITE).store_string(JSON.stringify(result,"  "))
    print(JSON.stringify(result));w.free();quit(0 if result.passed else 1)
