extends SceneTree

const Adapter = preload("res://scripts/gate_target_adapter.gd")
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func check(ok: bool, message: String) -> void:
	if not ok: failures.append(message)

func _run() -> void:
	var model := load("res://assets/world-source/original-world-v1.glb").instantiate() as Node3D
	root.add_child(model)
	var sources: Dictionary = {}
	for node in model.find_children("*", "Node3D", true, false):
		sources[str(node.get_meta("extras", {}).get("sourcePath", ""))] = node
	var seat: Node3D = sources[Adapter.SEAT_PATH]
	var pods: Node3D = sources[Adapter.SEAT_PATH + "/gate-pod-squadron[7]"]
	var seat_transform := seat.global_transform
	var pod_states: Dictionary = {}
	for node in pods.find_children("*", "Node3D", true, false):
		pod_states[node] = [node.transform, node.visible]
	var adapter := Adapter.new()
	check(adapter.bind(model), "Binding failed: " + adapter.last_error)
	if is_instance_valid(adapter.candidate):
		check(adapter.original_parts.size() == 7, "Expected exactly seven retired building roots")
		check(adapter.candidate.get_parent() == seat, "Candidate must be attached to the exact original seat")
		check(adapter.candidate.transform.is_equal_approx(Transform3D.IDENTITY), "Candidate must retain local identity transform")
		check(adapter.candidate.global_transform.is_equal_approx(seat.global_transform), "Candidate lost canyon placement")
		check(is_instance_valid(adapter.site), "Missing canyon and viaduct")
		check(is_instance_valid(adapter.dressing), "Missing weathering, vegetation and distant backdrop")
		if is_instance_valid(adapter.dressing):
			check(adapter.dressing.get_parent() == adapter.candidate, "Dressing must share the gate candidate lifetime")
			check(adapter.dressing.transform.is_equal_approx(Transform3D.IDENTITY), "Dressing must use seat-local identity placement")
			check(not adapter.dressing.find_children("*", "MeshInstance3D", true, false).is_empty(), "Dressing has no imported geometry")
		if is_instance_valid(adapter.site): check(adapter.site.global_transform.is_equal_approx(seat.global_transform), "Site and gate transforms differ")
		for part in adapter.original_parts: check(not part.is_visible_in_tree(), "Old building still visible: " + str(part.name))
		var lighting := adapter.candidate.get_node("GateLighting")
		lighting.set_phase(0.75)
		check(is_equal_approx(lighting.bounce.light_energy, 1.5), "Dusk bounce missing")
		lighting.set_phase(0.92)
		check(lighting.lamps[0].light_energy > 1, "Night lamps missing")
		lighting.set_phase(0.5)
		check(is_zero_approx(lighting.bounce.light_energy), "Dusk bounce leaked into noon")
		var meeting := adapter.candidate.get_node_or_null("GateHeroMeeting") as Node3D
		check(meeting != null, "Missing hero meeting anchor")
		if meeting:
			check(meeting.get_child_count() == 2, "Both heroes must be imported")
			check(meeting.position.is_equal_approx(Vector3(-25, 3.26, -18.5)), "Heroes missed the terrace")
		check(pods.is_visible_in_tree(), "Gate pod squadron was hidden")
		for node in pod_states:
			var source_path := str(node.get_meta("extras", {}).get("sourcePath", ""))
			var suffix := source_path.get_slice("/", 3)
			if node.get_parent() == pods:
				check(Adapter.POD_BERTHS.has(suffix), "Unknown direct gate pod identity")
				check(node.position.is_equal_approx(Adapter.POD_BERTHS.get(suffix, Vector3.ZERO)), "Gate pod berth does not clear revised towers")
				check(node.basis.is_equal_approx(pod_states[node][0].basis), "Gate pod rotation or scale changed")
			else:
				check(node.transform.is_equal_approx(pod_states[node][0]), "Gate pod descendant pose changed")
			check(node.visible == pod_states[node][1], "Gate pod visibility changed")
		check(adapter.bind(model), "Repeated binding should be idempotent")
		check(seat.find_children("GateOfSighs_TargetV1", "Node3D", false, false).size() == 1, "Duplicate target architecture")
		var retired := adapter.original_parts.duplicate()
		var old_dressing: Node3D = adapter.dressing
		adapter.unbind()
		check(not is_instance_valid(adapter.dressing), "Dressing did not clear on unbind")
		check(not is_instance_valid(old_dressing), "Old dressing node was not freed")
		check(seat.global_transform.is_equal_approx(seat_transform), "Original seat did not restore")
		for node in pod_states: check(node.transform.is_equal_approx(pod_states[node][0]), "Original pod position did not restore")
		for part in retired: check(part.visible, "Original architecture did not restore")
		check(not model.has_meta("gate_target_adapter"), "Stale binding metadata")
		check(adapter.bind(model), "Rebinding after restore failed")
		print("GATE_TARGET_EVIDENCE seat=", Adapter.SEAT_PATH, " hidden_roots=", adapter.original_parts.size(), " preserved_pod_nodes=", pod_states.size(), " placement=", adapter.candidate.global_position)
		adapter.unbind()
	model.free()
	print(JSON.stringify({"test": "gate_target_adapter", "passed": failures.is_empty(), "failures": failures}))
	quit(0 if failures.is_empty() else 1)
