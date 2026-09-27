extends SceneTree
const Adapter = preload("res://scripts/canal_junction_target_adapter.gd")
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func check(ok: bool, message: String) -> void:
	if not ok: failures.append(message)

func _run() -> void:
	var world := load("res://assets/world-source/original-world-v1.glb").instantiate() as Node3D
	root.add_child(world)
	var sources: Dictionary = {}
	var snapshots: Dictionary = {}
	for node in world.find_children("*", "Node3D", true, false):
		var source_path := str(node.get_meta("extras", {}).get("sourcePath", ""))
		sources[source_path] = node
		snapshots[node] = [node.transform, node.visible]
	var original := sources.get(Adapter.SOURCE_PATH) as Node3D
	check(original != null, "Exact source root missing")
	if not original:
		world.free()
		_finish()
		return
	var original_global := original.global_transform
	var adapter := Adapter.new()
	check(not adapter.bind(world, "res://assets/art-pilots/missing-canal-target-for-test.glb"), "Missing asset must reject binding")
	check(original.visible == snapshots[original][1] and not world.has_meta(Adapter.META_KEY), "Missing asset changed the source")
	var duplicate := Node3D.new()
	duplicate.name = Adapter.SOURCE_NAME
	duplicate.set_meta("extras", {"sourcePath": Adapter.SOURCE_PATH})
	world.add_child(duplicate)
	check(not adapter.bind(world), "Ambiguous source identity accepted")
	duplicate.free()
	check(adapter.bind(world), "Target binding failed: " + adapter.last_error)
	if is_instance_valid(adapter.candidate):
		check(adapter.candidate.get_parent() == original.get_parent(), "New castle must share original parent")
		check(adapter.candidate.transform.is_equal_approx(original.transform), "Original local castle placement lost")
		check(adapter.candidate.global_transform.is_equal_approx(original_global), "Original world castle placement lost")
		check(not original.is_visible_in_tree(), "Old castle still visible")
		var reflection := sources.get(Adapter.SOURCE_PATH + "/canal-town-reflection[3]") as Node3D
		check(reflection != null and not reflection.is_visible_in_tree(), "Old castle reflection still visible")
		for node in snapshots:
			check(node.transform.is_equal_approx(snapshots[node][0]), "Source transform changed: " + str(node.name))
			if node != original: check(node.visible == snapshots[node][1], "Unrelated visibility changed: " + str(node.name))
		var current: Node3D = adapter.candidate
		check(adapter.bind(world) and adapter.candidate == current, "Same-adapter binding is not idempotent")
		var second := Adapter.new()
		check(not second.bind(world), "Second adapter created duplicate castle")
		check(world.find_children("CanalJunction_TargetV1", "Node3D", true, false).size() == 1, "Duplicate candidate roots")
		adapter.unbind()
		check(not is_instance_valid(current), "Candidate not freed")
		check(original.visible == snapshots[original][1], "Original visibility not restored")
		check(not world.has_meta(Adapter.META_KEY), "Stale adapter metadata")
		original.visible = false
		check(adapter.bind(world), "Could not rebind hidden original")
		adapter.unbind()
		check(not original.visible, "Unbind did not preserve preexisting hidden state")
		original.visible = snapshots[original][1]
		check(adapter.bind(world), "Final rebind failed")
		print("CANAL_JUNCTION_EVIDENCE source=", Adapter.SOURCE_PATH, " position=", adapter.candidate.global_position)
		adapter.unbind()
	world.free()
	_finish()

func _finish() -> void:
	print(JSON.stringify({"test": "canal_junction_target_adapter", "passed": failures.is_empty(), "failures": failures, "scope": "Visual castle/base replacement only; no campaign migration or visual acceptance"}))
	quit(0 if failures.is_empty() else 1)
