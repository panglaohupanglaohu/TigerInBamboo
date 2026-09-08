extends SceneTree
var failures: Array[String] = []
func _initialize() -> void: call_deferred("run")
func run() -> void:
    root.size = Vector2i(1440,960)
    var scene = load("res://scenes/original_world.tscn").instantiate()
    root.add_child(scene)
    await process_frame
    var adapter = scene.tiger_adapter
    if not adapter.original or not adapter.candidate:
        push_error("Tiger world deployment missing: "+adapter.last_error)
        quit(1)
        return
    var original_transform: Transform3D = adapter.original.global_transform
    if not adapter.candidate_root.global_transform.is_equal_approx(original_transform): failures.append("Candidate world transform differs")
    scene.focus_tiger()
    var focus: Vector3 = adapter.focus_position()
    var local_basis: Basis = adapter.original.global_basis.orthonormalized()
    scene.camera.position=focus+local_basis*Vector3(2.4,1.0,3.6)
    scene.camera.look_at(focus,local_basis.y)
    for enabled in [false,true,false,true]:
        if not adapter.set_enabled(enabled): failures.append(adapter.last_error)
        if enabled and adapter.original.visible: failures.append("Duplicate original visible")
        if adapter.candidate.visible != enabled: failures.append("Candidate visibility mismatch")
        if not adapter.original.global_transform.is_equal_approx(original_transform): failures.append("Source transform modified")
        if scene.tiger_toggle: scene.tiger_toggle.set_pressed_no_signal(enabled)
        await process_frame
        await RenderingServer.frame_post_draw
        if DisplayServer.get_name()!="headless": root.get_texture().get_image().save_png("res://../artifacts/pipeline/tiger-anatomy-v3/world-%s.png" % ("after" if enabled else "before"))
    var report := {"passed":failures.is_empty(),"failures":failures,"sourcePath":adapter.SOURCE_PATH,"sameWorldTransform":adapter.candidate_root.global_transform.is_equal_approx(original_transform),"scope":"Original swamp location static visual deployment; roaming, dialog and rescue quest not ported"}
    var f:=FileAccess.open("res://../artifacts/pipeline/tiger-anatomy-v3/world-validation.json", FileAccess.WRITE)
    f.store_string(JSON.stringify(report,"  "))
    print("TIGER_WORLD ", JSON.stringify(report))
    scene.queue_free()
    await process_frame
    quit(0 if failures.is_empty() else 1)
