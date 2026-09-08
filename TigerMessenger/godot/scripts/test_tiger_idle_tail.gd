extends SceneTree
var failures: Array[String] = []
var ids: Dictionary = {}
var output := ""
var fixture := ""

func _initialize() -> void:
    for arg in OS.get_cmdline_user_args():
        if arg.begins_with("--output="): output = arg.trim_prefix("--output=")
        if arg.begins_with("--fixture="): fixture = arg.trim_prefix("--fixture=")
    call_deferred("run")

func collect(node: Node) -> void:
    var extras: Dictionary = node.get_meta("extras", {})
    var id := str(extras.get("three_node_id", node.get_meta("three_node_id", "")))
    if id != "" and node is Node3D:
        if ids.has(id): failures.append("Duplicate original identity " + id)
        ids[id] = node
    for child in node.get_children(): collect(child)

func snapshot(node: Node, rows: Dictionary) -> void:
    if node is Node3D: rows[node] = {"transform": node.transform, "parent": node.get_parent(), "visible": node.visible}
    for child in node.get_children(): snapshot(child, rows)

func check_snapshot(rows: Dictionary, label: String) -> void:
    for node in rows:
        var row: Dictionary = rows[node]
        if node.get_parent() != row.parent or not node.transform.is_equal_approx(row.transform) or node.visible != row.visible:
            failures.append(label + " changed " + str(node.name))

func matrix_array(t: Transform3D) -> Array:
    return [t.basis.x.x,t.basis.x.y,t.basis.x.z,0,t.basis.y.x,t.basis.y.y,t.basis.y.z,0,t.basis.z.x,t.basis.z.y,t.basis.z.z,0,t.origin.x,t.origin.y,t.origin.z,1]

func tail_points(adapter) -> Array:
    var points: Array = []
    for id in adapter.TAIL_IDS: points.append(ids[id].global_position - adapter.candidate_root.global_position)
    return points.map(func(p): return [p.x,p.y,p.z])

func run() -> void:
    if output == "" or fixture == "":
        push_error("Explicit --output and --fixture required")
        quit(1)
        return
    var expected = JSON.parse_string(FileAccess.get_file_as_string(fixture))
    var scene = load("res://scenes/original_world.tscn").instantiate()
    root.add_child(scene)
    var adapter = scene.tiger_adapter
    if not adapter.candidate:
        push_error("Missing tiger candidate: " + adapter.last_error)
        quit(1)
        return
    adapter.set_enabled(false)
    var original_rows: Dictionary = {}
    snapshot(adapter.original, original_rows)
    var world_transform: Transform3D = adapter.original.global_transform
    collect(adapter.candidate)
    for i in range(80):
        if not ids.has("n%d" % i): failures.append("Missing original identity n%d" % i)
    if ids.size() != 80: failures.append("Expected exactly 80 source IDs")
    var rest: Dictionary = {}
    snapshot(adapter.candidate_root, rest)
    var rest_tail: Dictionary = {}
    for id in adapter.TAIL_IDS: rest_tail[id] = matrix_array(ids[id].transform)
    var before_points := tail_points(adapter)
    adapter.set_enabled(true)
    var player: AnimationPlayer = adapter.candidate.get_node("OriginalIdleTail")
    var player_id := player.get_instance_id()
    var start: Transform3D = ids.n49.transform
    await create_timer(0.18).timeout
    var automatic_motion: bool = not ids.n49.transform.is_equal_approx(start)
    if not automatic_motion: failures.append("Idle tail did not advance through actual SceneTree frames")
    player.pause()
    var samples: Array = []
    var maximum_matrix_error := 0.0
    for pose in expected.samples:
        player.seek(float(pose.time), true)
        var matrices: Dictionary = {}
        for id in adapter.TAIL_IDS:
            var actual := matrix_array(ids[id].transform)
            matrices[id] = actual
            for i in range(16): maximum_matrix_error = maxf(maximum_matrix_error, absf(actual[i] - pose.nodes[id][i]))
        if not adapter.candidate_root.global_transform.is_equal_approx(world_transform): failures.append("Animated world placement changed")
        for node in rest:
            if not adapter._tail_rest.has(node) and not node.transform.is_equal_approx(rest[node].transform): failures.append("Non-tail rest changed")
            if node.get_parent() != rest[node].parent: failures.append("Candidate hierarchy changed")
        samples.append({"time": pose.time, "localMatrices": matrices, "worldRelativePivotPoints": tail_points(adapter)})
    if maximum_matrix_error > 0.0005: failures.append("Godot samples differ from independent Three.js original idle formula")
    player.seek(0.0, true)
    var loop_start: Transform3D = ids.n49.transform
    player.seek(adapter.IDLE_TAIL_DURATION, true)
    var loop_seam: bool = ids.n49.transform.is_equal_approx(loop_start)
    if not loop_seam: failures.append("Idle loop seam differs")
    var toggles: Array = []
    for i in range(6):
        adapter.set_enabled(false)
        check_snapshot(rest, "Candidate rest on disable")
        check_snapshot(original_rows, "Original source")
        var restored := true
        for pivot in adapter._tail_rest: restored = restored and pivot.transform.is_equal_approx(adapter._tail_rest[pivot])
        toggles.append({"iteration": i, "restored": restored, "playerStopped": not player.is_playing()})
        adapter.set_enabled(true)
        if adapter.candidate.get_node("OriginalIdleTail").get_instance_id() != player_id: failures.append("Toggle duplicated animation player")
        player.pause()
        player.seek(0.37, true)
    adapter.set_enabled(false)
    check_snapshot(original_rows, "Original source after toggles")
    var source = adapter.original
    adapter.unbind()
    if not source.visible or source.get_parent() == null: failures.append("Unbind failed to restore original")
    var report := {"passed": failures.is_empty(), "failures": failures, "scope": "Original-world placement with original idle-tail formulas only; no roaming, drinking, dialogue, rescue, terrain-contact or visual approval claim", "originalIds": ids.size(), "originalNodesChecked": original_rows.size(), "sampleCount": samples.size(), "maximumMatrixErrorAgainstThree": maximum_matrix_error, "automaticSceneTreeMotion": automatic_motion, "loopSeamPreserved": loop_seam, "sameWorldTransform": source.global_transform.is_equal_approx(world_transform), "restTailMatrices": rest_tail, "beforeRestPivotPoints": before_points, "toggleEvidence": toggles, "samples": samples, "screenshotsCaptured": false}
    var file := FileAccess.open(output, FileAccess.WRITE)
    file.store_string(JSON.stringify(report, "  "))
    print("TIGER_IDLE ", JSON.stringify({"passed": report.passed, "failures": failures, "samples": samples.size(), "matrixError": maximum_matrix_error, "automaticMotion": automatic_motion}))
    scene.queue_free()
    await process_frame
    quit(0 if failures.is_empty() else 1)
