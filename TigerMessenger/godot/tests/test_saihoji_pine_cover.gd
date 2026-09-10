extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
    var world = load("res://scenes/saihoji_battle_world.tscn").instantiate()
    root.add_child(world)
    while not world.ready_for_battle and world.load_error.is_empty(): await physics_frame
    world.set_physics_process(false)
    var spacing := float(OS.get_environment("PINE_GRID_SPACING")) if OS.has_environment("PINE_GRID_SPACING") else 1.0
    world.landing_planner.build(world.get_world_3d(), world.landing, 30.0, spacing)
    var cover = load("res://scripts/saihoji_pine_cover.gd").new()
    var report: Dictionary = cover.build(world.concealment_visual.node, world.kun, world.landing_planner.available)
    report.grid_spacing = spacing
    report.positions = cover.candidates.map(func(row): return {"position": [row.position.x, row.position.y, row.position.z], "tree": row.tree})
    report.load_error = world.load_error
    report.all_on_connected_ground = cover.candidates.all(func(row): return world.landing_planner.available.has(row.position))
    report.all_outside_moving_kun = not world.kun.is_ancestor_of(world.concealment_visual.node)
    var selected: Array[Vector3] = []
    for i in range(50):
        var point: Vector3 = cover.reserve(world.landing * 160.8)
        if point != Vector3.ZERO: selected.append(point)
    report.actual_reserved = selected.size()
    report.selected_positions = selected.map(func(v): return [v.x,v.y,v.z])
    report.distinct = true
    for i in range(selected.size()):
        for j in range(i):
            if selected[i].distance_to(selected[j]) < 1.0: report.distinct = false
    var exhausted := 0
    for i in range(100):
        if cover.reserve(world.landing * 160.8) != Vector3.ZERO: exhausted += 1
    report.exhaustion_returns_zero = cover.reserve(world.landing * 160.8) == Vector3.ZERO
    report.total_reservable = selected.size() + exhausted
    var rejected = load("res://scripts/saihoji_pine_cover.gd").new()
    report.moving_garden_rejected = rejected.build(world.garden, world.kun, world.landing_planner.available).has("error")
    var output := "res://../artifacts/pipeline/saihoji-pine-cover"
    DirAccess.make_dir_recursive_absolute(output)
    FileAccess.open(output + "/report.json", FileAccess.WRITE).store_string(JSON.stringify(report, "  "))
    print(JSON.stringify(report))
    world.queue_free(); await process_frame
    quit(0 if report.all_on_connected_ground and report.all_outside_moving_kun and report.distinct and report.moving_garden_rejected and report.exhaustion_returns_zero else 1)
