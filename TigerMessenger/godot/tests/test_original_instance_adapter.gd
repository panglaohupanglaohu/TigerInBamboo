extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
    var model: Node3D = load("res://assets/world-source/original-world-v1.glb").instantiate()
    root.add_child(model)
    var adapter = load("res://scripts/original_instance_adapter.gd").new()
    var manifest: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://assets/world-source/original-instance-map.json"))
    var report: Dictionary = adapter.apply(model,manifest)
    var all_transforms := true
    var all_materials := true
    for batch in adapter.batches:
        var multi: MultiMesh = batch.instance.multimesh
        for i in batch.originals.size():
            all_transforms = all_transforms and multi.get_instance_transform(i).is_equal_approx(batch.originals[i].transform)
        for surface in multi.mesh.get_surface_count():
            all_materials = all_materials and multi.mesh.surface_get_material(surface) == batch.originals[0].get_active_material(surface)
    report.transforms_preserved = all_transforms;report.materials_preserved = all_materials
    report.idempotent = adapter.apply(model,manifest).groups == 0
    var count: int = adapter.batches.size()
    adapter.restore()
    report.restored = adapter.batches.is_empty() and count > 0
    report.passed = report.groups == 71 and report.instances == 8503 and all_transforms and all_materials and report.restored and report.idempotent
    print("INSTANCE_RESTORE_REPORT ",JSON.stringify(report))
    var args := OS.get_cmdline_user_args()
    if not args.is_empty():
        var file := FileAccess.open(args[0],FileAccess.WRITE);file.store_string(JSON.stringify(report,"  "));file.close()
    model.queue_free();await process_frame;await process_frame
    quit(0 if report.passed else 1)
