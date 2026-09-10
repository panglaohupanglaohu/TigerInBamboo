extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1280,800)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);w.set_physics_process(false)
    await w._start_traversal("gladius")
    var milestones=[0,80,160,246];var captured:=0
    for frame in range(60*300):
        w._physics_process(1.0/60.0)
        if captured<milestones.size() and w.traversal.completed_steps>=milestones[captured]:
            await RenderingServer.frame_post_draw
            root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-entry/traversal-%d.png"%milestones[captured]);captured+=1
        if w.traversal.phase in ["arrived","blocked"]:break
    var evidence=w.traversal.evidence();evidence.captured_milestones=milestones.slice(0,captured)
    FileAccess.open("res://../artifacts/pipeline/citadel-entry/traversal-capture.json",FileAccess.WRITE).store_string(JSON.stringify(evidence,"  "))
    print(JSON.stringify(evidence));w._reset_traversal();w.queue_free();await process_frame;quit(0 if evidence.phase=="arrived" and captured==4 else 1)
