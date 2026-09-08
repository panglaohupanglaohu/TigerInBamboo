extends SceneTree
var failures: Array[String] = []
func _initialize() -> void: call_deferred("run")
func run() -> void:
    root.size = Vector2i(1200, 1000)
    var scene = load("res://scenes/roman_grip_blue.tscn").instantiate()
    root.add_child(scene)
    await process_frame
    scene.set_process(false)
    var rows: Array = []
    for color in ["blue", "red"]:
        scene.load_variant(color)
        for mode in [0, 1, 2]:
            scene.pose_mode = mode
            scene.apply_pose(0.8)
            if scene.runtime.get_grip_error() > 0.00001: failures.append("Candidate pose lost grip")
            rows.append({"variant":color,"pose":mode,"gripError":scene.runtime.get_grip_error()})
    scene.load_variant("blue")
    scene.pose_mode = 0
    scene.apply_pose(0.0)
    for enabled in [false, true]:
        scene.set_correction(enabled)
        scene.find_child("GripToggle", true, false).set_pressed_no_signal(enabled)
        await process_frame
        await RenderingServer.frame_post_draw
        if DisplayServer.get_name() != "headless":
            root.get_texture().get_image().save_png("res://../artifacts/pipeline/romanSoldier/grip-%s.png" % ("after" if enabled else "before"))
        if enabled and scene.runtime.get_grip_error() > 0.00001: failures.append("Toggle on lost grip")
        if not enabled and not scene.sword.transform.is_equal_approx(scene.sword_rest): failures.append("Toggle off did not restore original")
    var report := {"passed":failures.is_empty(),"failures":failures,"poses":rows,"scope":"reversible candidate grip only; fixture poses, no combat AI or complete animation migration"}
    var f := FileAccess.open("res://../artifacts/pipeline/romanSoldier/grip-candidate-validation.json", FileAccess.WRITE)
    f.store_string(JSON.stringify(report, "  "))
    print("ROMAN_GRIP_CANDIDATE ",JSON.stringify(report))
    scene.queue_free()
    await process_frame
    quit(0 if failures.is_empty() else 1)
