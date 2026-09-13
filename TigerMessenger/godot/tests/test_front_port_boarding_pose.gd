extends SceneTree

func _initialize() -> void:
    call_deferred("run")

func run() -> void:
    var adapter = load("res://scripts/saihoji_warship_adapter.gd").new()
    var ship = load(adapter.MODEL).instantiate()
    root.add_child(ship)
    var row: Dictionary = adapter.bind(ship)
    assert(not row.is_empty())
    var pitch := -0.16899836166312232
    assert(adapter.pose_boarding(row, 1.0, pitch))
    var hinge: Node3D = row.ids["add:boarding-hinge"]
    var origin := Vector3(1.94, 0.664, 0.84)
    var expected := origin + Vector3(0, -sin(pitch) * 1.35, cos(pitch) * 1.35)
    var actual: Vector3 = hinge.transform * Vector3(0, 0, 1.35)
    assert(actual.distance_to(expected) < 0.00001)
    assert(not adapter.pose_boarding(row, 1.0, deg_to_rad(26)))
    for i in range(31):
        assert(adapter.pose_boarding(row, float(i)/30.0, pitch))
        assert(hinge.transform.is_finite())
    adapter.tick(row, 0.0, false)
    var stowed: Transform3D = adapter._transform(adapter.data.boarding.stowedMatrix)
    assert(hinge.transform.is_equal_approx(stowed))
    var report := {"passed":true,"deployed_tip_error":actual.distance_to(expected),"animation_samples":31,"stow_restored":true,"scope":"original asset pose only; no native berth or unloading integration"}
    var f := FileAccess.open("res://../artifacts/pipeline/citadel-front-port-berth/godot-boarding-pose.json",FileAccess.WRITE)
    f.store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report))
    ship.queue_free()
    quit(0)
