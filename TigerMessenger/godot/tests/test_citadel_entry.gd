extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    await physics_frame
    await physics_frame
    var clearance:bool=w.town_cavity.verify_geometry()
    var report=w.assault_evidence()
    report.passed=report.route.get("loaded",false) and report.route.get("floors",0)==5 and report.landmarks.values().all(func(v):return v.found)
    for label in w.landmarks:w._focus_landmark(label)
    w._focus_approach();w.assault_route.set_visible(true)
    var offset:Vector3=w.castle_adapter.OLD_CITY_OFFSET
    var tower:Node3D=w.landmarks["塔内旋梯"].get_parent()
    report.old_city_translation=w.assault_route.node.position.is_equal_approx(offset)
    report.old_city_yaw=w.assault_route.node.basis.is_equal_approx(Basis(Vector3.UP,w.castle_adapter.OLD_CITY_YAW))
    report.stair_frame_aligned=w.stair_candidate.root.global_transform.is_equal_approx(tower.global_transform)
    report.new_city_not_double_shifted=w.castle_adapter.west_city.transform.is_equal_approx(Transform3D.IDENTITY)
    report.old_candidate_translation=w.castle_adapter.candidate.position.is_equal_approx(offset)
    report.passed=report.passed and report.old_city_translation and report.old_city_yaw and report.stair_frame_aligned and report.new_city_not_double_shifted and report.old_candidate_translation
    report.camera_finite=w.camera.position.is_finite()
    report.passed=report.passed and report.camera_finite and clearance
    FileAccess.open("res://../artifacts/pipeline/citadel-entry/report.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));w.queue_free();await process_frame;quit(0 if report.passed else 1)
