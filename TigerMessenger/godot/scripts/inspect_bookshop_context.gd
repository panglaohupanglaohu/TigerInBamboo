extends SceneTree
func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var world = load("res://scenes/main.tscn").instantiate()
	root.add_child(world)
	await process_frame
	var nearby: Array = []
	var counts := {"12": {}, "14": {}, "16": {}}
	for node in world.find_children("*", "Node3D", true, false):
		var path: String = node.scene_file_path
		if path not in ["res://assets/house.glb", "res://assets/tower.glb", "res://assets/pine.glb"]: continue
		var kind := path.get_file().get_basename()
		var distance: float = node.global_position.distance_to(world.bookshop.global_position)
		var local: Vector3 = world.bookshop.to_local(node.global_position)
		var protected: bool = node.get_parent() != world
		if distance < 20:
			nearby.append({"kind": kind, "distance": distance, "bookshop_local": [local.x, local.y, local.z], "chapter_landmark_protected": protected, "colliders": node.find_children("*", "CollisionShape3D", true, false).size()})
		if protected: continue
		for radius in counts:
			if distance <= float(radius): counts[radius][kind] = counts[radius].get(kind, 0) + 1
	var waypoints: Array = []
	for i in range(world.beacons.size()):
		waypoints.append({"chapter": i, "distance_to_bookshop": world.beacons[i].global_position.distance_to(world.bookshop.global_position)})
	var report := {"nearby_legacy_roots": nearby, "exclusion_counts_by_chord_radius": counts, "waypoints": waypoints, "scope": "read-only inspection; no generation changed"}
	var file := FileAccess.open("res://../artifacts/bookshop-context/godot-preflight.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  "))
	print(JSON.stringify(report))
	world.queue_free()
	await process_frame
	quit()
