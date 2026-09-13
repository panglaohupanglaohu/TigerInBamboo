extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    await w._start_traversal("gladius",true,false,true)
    w.set_physics_process(false)
    var walker=w.traversal
    if walker==null:w.free();quit(1);return
    for i in range(60*400):
        walker.tick(1.0/60.0)
        if walker.phase in ["arrived","blocked"]:break
    var result=walker.evidence()
    result["passed"]=walker.phase=="arrived" and w.traversal_is_old_shore
    result["production_action"]="短剑兵 · 旧港沿坡入城"
    result["scope"]="Actual old shore candidate in citadel world, original equipped gladius actor and production collision guard. Not boarding, crowd combat or final gait."
    FileAccess.open("res://../artifacts/pipeline/citadel-old-harbor-grade/godot-shore-march.json",FileAccess.WRITE).store_string(JSON.stringify(result,"  "))
    print(JSON.stringify(result));w.free();quit(0 if result.passed else 1)
