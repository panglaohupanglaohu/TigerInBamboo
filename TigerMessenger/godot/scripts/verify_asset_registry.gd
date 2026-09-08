extends SceneTree
## Separate report: never overwrites the historical 72-asset verification.
var results: Array = []
func _initialize() -> void:
	call_deferred("_run")
func _run() -> void:
	var review = load("res://scenes/asset_review.tscn").instantiate()
	root.add_child(review)
	await process_frame
	review.set_process(false)
	var failed := false
	var seen: Dictionary = {}
	for i in review.assets.size():
		var row: Dictionary = review.assets[i]
		var path: String = row.get("godot", {}).get("res", "")
		var duplicate: bool = seen.has(row.id)
		seen[row.id] = true
		review._select(i)
		await process_frame
		var meshes := 0
		if review.current:
			for child in review.current.find_children("*", "MeshInstance3D", true, false):
				if child.mesh: meshes += 1
		var passed: bool = meshes > 0 and review.current != null and not duplicate
		if not passed: failed = true
		results.append({"id": row.id, "resource": path, "sha256": FileAccess.get_sha256(path), "meshes": meshes, "instantiated": review.current != null, "duplicate": duplicate, "passed": passed})
	var registry: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/asset-registry.json"))
	var registry_ids: Dictionary = {}
	if registry is Dictionary:
		for row in registry.get("assets", []): registry_ids[row.id] = true
	var registry_matches: bool = seen.size() == registry_ids.size()
	for id in seen:
		if not registry_ids.has(id): registry_matches = false
	if not registry_matches: failed = true
	var f := FileAccess.open("res://../artifacts/supplemental-import/godot-registry-verification.json", FileAccess.WRITE)
	f.store_string(JSON.stringify({"tested": results.size(), "failed": failed, "registryMatchesGallery": registry_matches, "results": results}, "  "))
	print("ASSET_REGISTRY_TESTED ", results.size(), " FAILED ", failed)
	review.free()
	quit(1 if failed else 0)
