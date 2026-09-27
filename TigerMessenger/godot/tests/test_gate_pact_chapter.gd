extends SceneTree
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func check(ok: bool, message: String) -> void:
	if not ok: failures.append(message)

func _run() -> void:
	var scene = load("res://scenes/gate_pact_chapter.tscn").instantiate()
	root.add_child(scene)
	if not scene.chapter_ready:
		check(false, "Chapter not ready: " + scene.chapter_error)
	else:
		scene.set_process(false)
		scene.pact_controller.set_process(false)
		check(scene.courier_actor.find_children("Courier", "Node3D", true, false).size() == 1, "Human courier asset is not present")
		check(not scene.walk_triangles.is_empty(), "No actual terrace walk triangles indexed")
		check(is_equal_approx(scene.courier_actor.position.y, scene.terrace_height(scene.courier_actor.position) + 0.02), "Courier not supported by authored terrace")
		check(not scene.interact_chapter(), "Fixture should start outside interaction radius")
		var before: Vector3 = scene.courier_actor.position
		check(not scene.move_courier(Vector3(0, 0, -1)) and scene.courier_actor.position.is_equal_approx(before), "Courier crossed parapet bound")
		for i in 20: check(scene.move_courier(Vector3(-0.1, 0, 0.05)), "Supported terrace approach failed")
		check(scene.courier_actor.global_position.distance_to(scene.pact_controller.meeting.global_position) < 9, "Walking did not bring courier within range")
		var event := InputEventKey.new()
		event.physical_keycode = KEY_R
		event.pressed = true
		event.echo = true
		scene._unhandled_input(event)
		check(scene.pact_controller.chapter == 1, "Key echo accepted as delivery")
		event.echo = false
		scene._unhandled_input(event)
		check(scene.pact_controller.chapter == 2 and scene.pact_controller.stage == "receiving", "Actual R input did not deliver")
		scene.chapter_action.pressed.emit()
		check(scene.pact_controller.accepted_count == 1, "Button repeated accepted delivery")
		scene.pact_controller.advance(2.0)
		check(scene.pact_controller.stage == "reading", "Chapter animation not using native controller")
		scene.reset_chapter()
		check(scene.pact_controller.chapter == 1 and scene.pact_controller.stage == "waiting", "Reset did not restore explicit chapter fixture")
		for node in scene.pact_controller.rest: check(node.transform.is_equal_approx(scene.pact_controller.rest[node]), "Chapter reset retained gesture pose")
		check(not scene.interact_chapter(), "Reset bypassed distance gate")
		for i in 20: scene.move_courier(Vector3(-0.1, 0, 0.05))
		scene.chapter_action.pressed.emit()
		check(scene.pact_controller.chapter == 2 and scene.pact_controller.accepted_count == 1, "Actual button failed valid nearby delivery")
	scene.free()
	print(JSON.stringify({"test": "gate_pact_chapter", "passed": failures.is_empty(), "failures": failures, "scope": "Chapter fixture, human courier and terrace support; not full-game rescue completion"}))
	quit(0 if failures.is_empty() else 1)
