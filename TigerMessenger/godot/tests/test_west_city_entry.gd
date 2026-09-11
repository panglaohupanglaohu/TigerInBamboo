extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    await w._start_traversal("gladius",true)
    w.set_physics_process(false)
    if w.traversal==null:quit(1);return
    for i in range(60*400):
        w.traversal.tick(1.0/60.0)
        if w.traversal.phase in ["arrived","blocked"]:break
    var report:Dictionary=w.traversal.evidence()
    report["passed"]=w.traversal.phase=="arrived"
    report["scope"]="Production citadel_world scene and actual left-city button handler; original scene collision context; not a siege or keyboard-controlled player test."
    print(JSON.stringify(report))
    FileAccess.open("res://../artifacts/pipeline/citadel-west-city/godot-march-entry.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    w._reset_traversal();w.queue_free();await process_frame
    quit(0 if report.passed else 1)
