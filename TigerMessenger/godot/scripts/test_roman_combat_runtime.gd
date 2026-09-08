extends SceneTree
const Runtime = preload("res://scripts/roman_combat_runtime.gd")
var failures: Array[String] = []
var report_path := ""
var fixture_path := ""
var maximum_grip_error := 0.0
var events: Array[Dictionary] = []
var lifecycle: Array[Dictionary] = []
var identities: Dictionary = {}

func remember_identity(node: Node) -> void:
    var extras: Dictionary = node.get_meta("extras", {})
    if extras.has("three_node_id"): identities[node] = node.get_parent()
    for child in node.get_children(): remember_identity(child)

func _initialize() -> void:
    for arg in OS.get_cmdline_user_args():
        if arg.begins_with("--output="): report_path = arg.trim_prefix("--output=")
        if arg.begins_with("--fixture="): fixture_path = arg.trim_prefix("--fixture=")
    call_deferred("run")

func check(value: bool, message: String) -> void:
    if not value: failures.append(message)

func spawn(side: String, parent: Node, position: Vector3) -> Node3D:
    var actor = load("res://assets/supplemental/romanSoldier_gladius_%s.glb" % side).instantiate() as Node3D
    parent.add_child(actor); actor.global_position = position
    return actor

func run() -> void:
    var scene = load("res://scenes/roman_combat_slice.tscn").instantiate()
    root.add_child(scene)
    var runtime = scene.runtime
    runtime.set_process(false)
    runtime.random_value = func(): return 0.5
    runtime.combat_event.connect(func(row): events.append(row))
    var armor_instances: Dictionary = {}
    for unit in runtime.units:
        armor_instances[unit.unit_id] = unit.armor._armor.get_instance_id()
        remember_identity(unit.actor)
    # Actual runtime selects foes and applies damage; tests never assign down/dead.
    for frame in range(360):
        runtime.step(1.0 / 60.0)
        if frame % 15 == 0:
            var states: Array = []
            for unit in runtime.units:
                var state: Dictionary = unit.snapshot()
                state["worldPosition"] = [unit.actor.global_position.x, unit.actor.global_position.y, unit.actor.global_position.z]
                states.append(state)
            lifecycle.append({"time": runtime.time, "states": states})
        for unit in runtime.units:
            maximum_grip_error = maxf(maximum_grip_error, maxf(unit.sword.get_grip_error(), unit.shield.get_grip_error()))
            check(unit.armor._armor.get_instance_id() == armor_instances[unit.unit_id], "Armor instance replaced during combat")
    check(events.any(func(e): return e.type == "melee_attack" and str(e.attacker).begins_with("red")), "Red never attacked")
    check(events.any(func(e): return e.type == "melee_attack" and str(e.attacker).begins_with("blue")), "Blue never attacked")
    check(events.filter(func(e): return e.type == "despawn_visual").size() == 2, "Two defeated actors must finish death lifecycle")
    check(maximum_grip_error < 0.0001, "World-space sword or shield grip drift")
    for node in identities:
        check(is_instance_valid(node) and node.get_parent() == identities[node], "Original source node or parent replaced during combat")
    var identities_checked := identities.size()
    identities.clear()
    for unit in runtime.units:
        var was_visible: bool = unit.actor.visible
        var original_id: int = unit.actor.get_instance_id()
        unit.break_shield()
        for value in [false, true, false, true]:
            check(unit.set_candidates(value), "Equipment toggle failed")
            check(not unit.shield.shield.visible, "Toggle revived broken shield")
            check(unit.actor.visible == was_visible, "Toggle revived defeated actor")
            check(unit.actor.get_instance_id() == original_id, "Combat root identity replaced")
    # Repeat through true SceneTree processing, distinct from deterministic stepping.
    scene.reset_encounter()
    runtime = scene.runtime
    var autonomous_events: Array[Dictionary] = []
    runtime.combat_event.connect(func(row): autonomous_events.append(row))
    await create_timer(0.12).timeout
    check(autonomous_events.any(func(e): return e.type == "hit"), "No autonomous SceneTree combat hit")
    var autonomous_trace: Array = autonomous_events.duplicate(true)
    var autonomous_hits := autonomous_trace.filter(func(e): return e.type == "hit").size()
    runtime.set_process(false)
    # Exact extracted source damage oracle for both variants (direct hit events,
    # no claim that Godot projectile transport has been migrated).
    var oracle = JSON.parse_string(FileAccess.get_file_as_string(fixture_path))
    var oracle_cases := 0
    for side in ["red", "blue"]:
        for scenario in oracle.scenarios:
            var actor := spawn(side, scene, Vector3(30, 160, 30))
            var unit = runtime.register_actor(actor)
            unit.melee_engaged = 1.0 # source: no arrow blocking during melee
            for i in range(scenario.hits.size()):
                unit.receive_hit(scenario.hits[i])
                var expected: Dictionary = scenario.states[i]
                check(unit.arrow_hits == int(expected.arrowHits) and unit.melee_hits == int(expected.meleeHits) and unit.downed == expected.downed and unit.dead == expected.dead, side + " damage oracle " + scenario.name)
                oracle_cases += 1
            runtime.unregister_actor(actor); actor.free()
    # Range and climb guards prevent false combat, independently of pose updates.
    var guard_root := Node3D.new(); root.add_child(guard_root)
    var guard_runtime = Runtime.new(); guard_root.add_child(guard_runtime); guard_runtime.set_process(false)
    var red := spawn("red", guard_root, Vector3(0, 160, 0))
    var blue := spawn("blue", guard_root, Vector3(10, 160, 0))
    var r = guard_runtime.register_actor(red); var b = guard_runtime.register_actor(blue)
    guard_runtime.step(0.05)
    check(not r.downed and not b.downed, "Out-of-range hit")
    blue.global_position = Vector3(1.3, 160, 0)
    guard_root.visible = false
    guard_runtime.step(0.05)
    check(not r.downed and not b.downed, "Hidden transport parent participated in combat")
    guard_root.visible = true
    r.melee_cooldown = 2; b.siege_stage = "climb"
    guard_runtime.step(0.05)
    check(not r.downed and not b.downed, "Climbing blue counterattacked")
    # Broken shields remain broken when arrow hit events arrive.
    r.break_shield(); r.receive_hit("arrow"); r.receive_hit("arrow")
    check(r.arrow_hits == 2 and r.downed, "Broken shield incorrectly blocked an arrow")
    guard_root.free()
    var fake_soldier := Node3D.new(); fake_soldier.name = "gladius-soldier"
    fake_soldier.set_meta("extras", {"sourcePath": "old-harbor-scene[61]/porter-squad[28]/porter[0]"})
    scene.add_child(fake_soldier)
    check(runtime.register_actor(fake_soldier) == null, "Name-only static porter incorrectly became a combatant")
    fake_soldier.free()
    var report := {"passed": failures.is_empty(), "failures": failures, "scope": "Reusable equipment/lifecycle adapter and original gladius siege algorithm subset. Real autonomous hits, not pose playback. Global transport, siege routes, projectiles and original-world combat deployment remain unported.", "originalNodeIdentitiesChecked": identities_checked, "damageOracleCases": oracle_cases, "maximumWorldGripError": maximum_grip_error, "autonomousSceneTreeHits": autonomous_hits, "autonomousSceneTreeEvents": autonomous_trace, "events": events, "lifecycle": lifecycle, "screenshotsCaptured": false}
    var file := FileAccess.open(report_path, FileAccess.WRITE); file.store_string(JSON.stringify(report, "  "))
    print("ROMAN_COMBAT ", JSON.stringify({"passed": report.passed, "failures": failures, "oracleCases": oracle_cases, "maxGrip": maximum_grip_error}))
    scene.queue_free(); await process_frame
    quit(0 if failures.is_empty() else 1)
