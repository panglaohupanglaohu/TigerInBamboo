extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);w.set_physics_process(false)
    await w._start_traversal("gladius")
    var actor=w.traversal.actor
    for i in range(180):w._physics_process(1.0/60.0)
    var moved:bool=w.traversal.completed_steps>0
    w.shell_toggle.button_pressed=false
    await process_frame
    var stopped:bool=w.traversal==null and not is_instance_valid(actor)
    await w._start_traversal("spear")
    var restarted:bool=w.traversal!=null and w.traversal.index==0 and w.shell_toggle.button_pressed
    w._reset_traversal();await process_frame
    var reset:bool=w.traversal==null
    var report={"moved":moved,"structural_toggle_stops_actor":stopped,"restart":restarted,"reset":reset,"passed":moved and stopped and restarted and reset}
    FileAccess.open("res://../artifacts/pipeline/citadel-entry/traversal-ui.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));w.queue_free();await process_frame;quit(0 if report.passed else 1)
