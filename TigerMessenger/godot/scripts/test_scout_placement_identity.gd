extends SceneTree
var failures: Array = []
var by_source: Dictionary = {}
func _initialize() -> void: call_deferred("run_test")
func collect(node: Node) -> void:
    var extras: Dictionary = node.get_meta("extras", {})
    if extras.has("sourcePath"):
        var key: String = extras.sourcePath
        if by_source.has(key) and key.begins_with("crystal-scout-defense-squad["): failures.append("Duplicate scout sourcePath: " + key)
        by_source[key] = node
    for child in node.get_children(): collect(child)
func matrix(values: Array) -> Transform3D:
    return Transform3D(Basis(Vector3(values[0],values[1],values[2]),Vector3(values[4],values[5],values[6]),Vector3(values[8],values[9],values[10])),Vector3(values[12],values[13],values[14]))
func run_test() -> void:
    var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/scout-placement-audit.json"))
    var world = load("res://assets/world-source/original-world-v1.glb").instantiate()
    root.add_child(world)
    collect(world)
    var results: Array = []
    for row in data.instances:
        var node: Node3D = by_source.get(row.sourcePath)
        if not node:
            failures.append("Missing exact source identity " + row.id)
            continue
        var expected: Transform3D = matrix(row.localMatrix)
        var parent_expected: Transform3D = matrix(data.parentMatrix)
        var parent: Node3D = by_source.get(row.parentSourcePath)
        if node.get_parent() != parent: failures.append("Wrong squad parent " + row.id)
        if not node.transform.is_equal_approx(expected): failures.append("Local matrix mismatch " + row.id)
        if not node.global_transform.is_equal_approx(parent_expected * expected): failures.append("World matrix mismatch " + row.id)
        if not node.is_visible_in_tree(): failures.append("Original unexpectedly hidden " + row.id)
        results.append({"id":row.id,"godotNodePath":str(node.get_path()),"sourcePath":row.sourcePath,"position":str(node.global_position),"scale":str(node.scale),"visible":node.is_visible_in_tree()})
    if results.size()!=5: failures.append("Expected five defense identities")
    var report := {"passed":failures.is_empty(),"failures":failures,"runtime":"Godot existing imported GLB, headless scene load only, no import process","instances":results,"mountedGateScoutInstances":0,"worldIntegrated":false,"candidateReplacementEnabled":false}
    FileAccess.open("res://../artifacts/pipeline/scoutAircraft/deployment/identity-validation.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print("SCOUT_PLACEMENT_IDENTITY ",JSON.stringify(report))
    world.queue_free()
    await process_frame
    quit(0 if failures.is_empty() else 1)
