extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    var report=w.assault_evidence()
    report.passed=report.route.get("loaded",false) and report.route.get("floors",0)==5 and report.landmarks.values().all(func(v):return v.found)
    for label in w.landmarks:w._focus_landmark(label)
    w._focus_approach();w.assault_route.set_visible(true)
    report.camera_finite=w.camera.position.is_finite()
    report.passed=report.passed and report.camera_finite
    FileAccess.open("res://../artifacts/pipeline/citadel-entry/report.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));w.queue_free();await process_frame;quit(0 if report.passed else 1)
