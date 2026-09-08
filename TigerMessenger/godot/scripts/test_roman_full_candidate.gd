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
        if not scene.armor_runtime.is_bound() or not scene.armor_runtime.enabled: failures.append("Armor not enabled " + color)
        for mode in [0, 1, 2]:
            scene.pose_mode = mode
            scene.apply_pose(0.8)
            var sword_error: float = scene.runtime.get_grip_error()
            var shield_error: float = scene.shield_runtime.get_grip_error()
            if maxf(sword_error, shield_error) > 0.00001: failures.append("Candidate pose lost grip")
            rows.append({"variant":color,"pose":mode,"swordError":sword_error,"shieldError":shield_error})
        scene.pose_mode = 0
        scene.apply_pose(0.0)
        for view in [0, 1, 2, 3]:
            scene.set_view(view)
            for enabled in [false, true]:
                scene.set_all_corrections(enabled)
                await process_frame
                await RenderingServer.frame_post_draw
                if DisplayServer.get_name() != "headless":
                    root.get_texture().get_image().save_png("res://../artifacts/pipeline/romanSoldier/full-%s-view%d-%s.png" % [color,view,"after" if enabled else "before"])
        scene.set_all_corrections(true)
    var whale = load("res://assets/supplemental/leviathanIsland.glb").instantiate()
    if not whale is Node3D: failures.append("Kun cannot instantiate")
    else:
        root.add_child(whale)
        whale.queue_free()
    var report := {"passed":failures.is_empty(),"failures":failures,"poses":rows,"kunInstantiated":true,"scope":"Red/blue soldier candidate UI, armor/handgrip integration, four review cameras; fixture poses, not world combat"}
    var f := FileAccess.open("res://../artifacts/pipeline/romanSoldier/full-candidate-validation.json", FileAccess.WRITE)
    f.store_string(JSON.stringify(report, "  "))
    print("ROMAN_FULL_CANDIDATE ",JSON.stringify(report))
    scene.queue_free()
    await process_frame
    quit(0 if failures.is_empty() else 1)
