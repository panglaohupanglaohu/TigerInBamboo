extends SceneTree

func _initialize() -> void:
    call_deferred("run")

func run() -> void:
    var adapter = load("res://scripts/saihoji_gatepod_adapter.gd").new()
    var members: Array = []
    for index in 3:
        var carrier := Node3D.new()
        carrier.name = ["pod-55-2", "pod-41-7", "pod-08-9"][index]
        root.add_child(carrier)
        carrier.position = Vector3(index * 10, 2, 0)
        carrier.scale = Vector3.ONE * [0.62, 0.55, 0.58][index]
        members.append(carrier)
    var report: Dictionary = adapter.apply(members)
    assert(report.applied and report.variants.size() == 1)
    assert(adapter.pods.size() == 3)
    var checked := 0
    for frame in 61:
        var untouched: Transform3D = adapter.pods[1].ids["add:rope-anchor-left"].transform
        adapter.set_deployment(0, frame / 60.0)
        assert(adapter.pods[1].ids["add:rope-anchor-left"].transform == untouched)
        for index in 3:
            adapter.set_deployment(index, frame / 60.0)
            assert(adapter.pods[index].ids.n0.transform == Transform3D.IDENTITY)
            var left: Vector3 = adapter.rope_anchor(index, 0)
            var right: Vector3 = adapter.rope_anchor(index, 1)
            assert(left.is_finite() and right.is_finite() and left.distance_to(right) > 0.01)
            checked += 1
    adapter.reset()
    for row in adapter.pods:
        assert(row.last_frame == 0)
    report["deployment_checks"] = checked
    report["independent_instances"] = true
    report["reset_passed"] = true
    print(JSON.stringify(report))
    quit(0)
