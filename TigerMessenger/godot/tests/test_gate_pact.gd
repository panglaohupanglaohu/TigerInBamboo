extends SceneTree
const Adapter = preload("res://scripts/gate_target_adapter.gd")
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func check(ok: bool, message: String) -> void:
	if not ok: failures.append(message)

func _run() -> void:
	var world := load("res://assets/world-source/original-world-v1.glb").instantiate() as Node3D
	root.add_child(world)
	var adapter := Adapter.new()
	check(adapter.bind(world), "Gate adapter failed")
	var pact = adapter.pact
	if not is_instance_valid(pact) or not pact.last_error.is_empty():
		check(false, "Exact imported hero binding failed")
	else:
		pact.set_process(false)
		check(pact.heroes.size() == 2 and pact.rest.size() == 6, "Must bind both heroes and all six original pivots")
		check(not pact.interact(), "Premature request accepted")
		var courier := Node3D.new()
		adapter.candidate.add_child(courier)
		check(pact.begin_chapter_test(courier), "Explicit chapter fixture could not start")
		courier.global_position = pact.meeting.global_position + adapter.seat.global_basis.x * 9.1
		check(not pact.interact() and pact.chapter == 1 and pact.elapsed == -1, "Out-of-range request altered chapter")
		courier.global_position = pact.meeting.global_position + adapter.seat.global_basis.x * 2
		check(pact.interact() and pact.chapter == 2 and pact.stage == "receiving", "Nearby letter delivery did not begin receiving")
		check(not pact.interact() and pact.accepted_count == 1, "Repeated interaction restarted pact")
		var od: Dictionary = pact.heroes.odysseus
		var ach: Dictionary = pact.heroes.achilles
		var right_rest: Transform3D = pact.rest[od.armR]
		check(od.armR.basis.is_equal_approx(right_rest.basis * Basis(Vector3.RIGHT, 0.20)), "Receiving right arm differs from Web +.20 rad")
		check(od.armL.basis.is_equal_approx(pact.rest[od.armL].basis * Basis(Vector3.RIGHT, 0.12)), "Receiving left arm differs from Web +.12 rad")
		pact.advance(1.0)
		check(pact.stage == "reading", "At 1 second must enter reading")
		check(od.armR.basis.is_equal_approx(right_rest.basis * Basis(Vector3.RIGHT, -0.08)), "Reading reach differs from Web")
		for parts in [od, ach]: check(parts.head.basis.is_equal_approx(pact.rest[parts.head].basis * Basis(Vector3.RIGHT, 0.13)), "Reading head tilt differs from Web")
		pact.advance(2.5)
		check(pact.stage == "acknowledging", "At 3.5 seconds must acknowledge")
		pact.advance(0.5)
		check(ach.armR.basis.is_equal_approx(pact.rest[ach.armR].basis * Basis(Vector3.RIGHT, -0.09)), "Achilles acknowledgment differs from Web")
		check(od.armL.basis.is_equal_approx(pact.rest[od.armL].basis * Basis(Vector3.BACK, -0.08)), "Odysseus acknowledgment differs from Web")
		pact.advance(0.5)
		check(pact.stage == "waiting" and pact.elapsed == -1, "At 4.5 seconds must return to waiting")
		for node in pact.rest: check(node.transform.is_equal_approx(pact.rest[node]), "Final pose drifted")
		check(not pact.interact() and pact.accepted_count == 1, "Completed pact may not repeat")
		pact.set_stage("reading", 2.0)
		var stable: Transform3D = od.armR.transform
		for i in 20: pact.set_stage("reading", 2.0)
		check(od.armR.transform.is_equal_approx(stable), "Repeated stage accumulated rotation")
		pact.reset()
		for node in pact.rest: check(node.transform.is_equal_approx(pact.rest[node]), "Reset failed to restore authored transform")
		check(pact.chapter == 0 and not pact.started and not pact.interact(), "Reset accidentally grants letter progress")
		check(pact.begin_chapter_test(courier) and pact.interact(), "Chapter reset cannot be replayed")
		pact.advance(10.0)
		check(pact.stage == "waiting" and pact.chapter == 2, "Long frame skipped final rest or advanced extra chapters")
		var light := adapter.candidate.get_node("GateLighting")
		light.set_phase(0.75)
		check(is_equal_approx(light.bounce.light_energy, 1.5), "Pact altered native dusk interface")
		light.set_phase(0.5)
		check(is_zero_approx(light.bounce.light_energy), "Pact altered native noon interface")
	adapter.unbind()
	world.free()
	print(JSON.stringify({"test": "gate_pact", "passed": failures.is_empty(), "failures": failures, "scope": "Native gate chapter only; no full rescue campaign migration"}))
	quit(0 if failures.is_empty() else 1)
