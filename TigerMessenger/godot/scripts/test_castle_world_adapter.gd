extends SceneTree
const Adapter = preload("res://scripts/castle_world_adapter.gd")
var failures: Array[String] = []
func _initialize() -> void: call_deferred("run")
func check(condition: bool, message: String) -> void:
    if not condition:
        failures.append(message)
        push_error(message)
func run() -> void:
    var world := load("res://assets/world-source/original-world-v1.glb").instantiate() as Node3D
    root.add_child(world)
    var adapter = Adapter.new()
    check(adapter.bind(world), "bind actual castle placement: " + adapter.last_error)
    if not adapter.is_bound():
        world.free()
        quit(1)
        return
    var castle: Node3D = adapter.original
    var before := castle.global_transform
    var originals: Array[Dictionary] = []
    _capture(world, originals)
    check(not adapter.enabled, "bind defaults off")
    check(adapter.set_enabled(true), "enable imported castle: " + adapter.last_error)
    if not adapter.enabled:
        world.free()
        quit(1)
        return
    var candidate: Node3D = adapter.candidate
    check(candidate.global_transform.is_equal_approx(before), "candidate takes exact original global placement")
    check(castle.global_transform == before, "source castle transform unchanged")
    var hidden := 0
    for row in originals:
        check(row.node.transform == row.transform, "source local transform unchanged")
        if row.node.visible != row.visible:
            hidden += 1
            check(str(row.node.name).begins_with("citadel-layer-"), "only town layers are hidden")
    check(hidden == 12, "exactly 12 original town layers hidden")
    adapter.bind(world)
    check(adapter.candidate == candidate, "repeat bind does not allocate or recapture")
    adapter.set_enabled(false)
    for row in originals: check(row.node.visible == row.visible and row.node.transform == row.transform, "OFF restores source state")
    adapter.set_enabled(true)
    check(adapter.candidate == candidate, "ON reuses candidate")
    var meshes := candidate.find_children("*", "MeshInstance3D", true, false).size()
    adapter.unbind()
    check(not is_instance_valid(candidate), "unbind frees candidate")
    for row in originals: check(row.node.visible == row.visible, "unbind restores original visibility")
    print(JSON.stringify({"test":"castle_world_adapter", "passed":failures.is_empty(), "failures":failures, "originalNodesChecked":originals.size(), "hiddenTownLayers":hidden, "candidateMeshInstances":meshes, "originalCastleGlobalTransformPreserved":castle.global_transform==before, "scope":"actual original-world GLB placement, reversible static town candidate; not gameplay, collision or native WFC editing"}))
    world.free()
    await process_frame
    quit(0 if failures.is_empty() else 1)
func _capture(node: Node, rows: Array[Dictionary]) -> void:
    if node is Node3D: rows.append({"node":node,"visible":node.visible,"transform":node.transform})
    for child in node.get_children(): _capture(child, rows)
