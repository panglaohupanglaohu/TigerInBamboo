extends RefCounted
## Reversible visual replacement at the exact original swamp tiger placement.
const SOURCE_PATH := "moebius-swamp-placement[77]/moebius-swamp-zone[0]/moebius-cyber-ink-tiger[334]"
const CANDIDATE_PATH := "res://assets/art-pilots/moebius-tiger-anatomy-v3.glb"
var original: Node3D
var candidate: Node3D
var candidate_root: Node3D
var enabled := false
var last_error := ""
var _visible := true
var _world: Node3D

func bind(world: Node3D) -> bool:
    if _world == world and is_instance_valid(original): return true
    unbind()
    var matches: Array[Node3D] = []
    _find_source(world,matches)
    if matches.size() != 1:
        last_error = "Expected exactly one original swamp tiger root."
        return false
    original = matches[0]
    _world = world
    _visible = original.visible
    return true

func _find_source(node: Node, found: Array[Node3D]) -> void:
    var extras: Dictionary = node.get_meta("extras", {})
    if extras.get("sourcePath", "") == SOURCE_PATH and node is Node3D: found.append(node)
    for child in node.get_children(): _find_source(child, found)

func _find_id(node: Node, id: String, found: Array[Node3D]) -> void:
    var extras: Dictionary = node.get_meta("extras", {})
    if str(extras.get("three_node_id",node.get_meta("three_node_id",""))) == id and node is Node3D: found.append(node)
    for child in node.get_children(): _find_id(child,id,found)

func set_enabled(value: bool) -> bool:
    if not is_instance_valid(original): return false
    if value and not is_instance_valid(candidate):
        if not ResourceLoader.exists(CANDIDATE_PATH):
            last_error = "Tiger candidate has not been imported."
            return false
        var packed = load(CANDIDATE_PATH) as PackedScene
        if not packed: return false
        var instance = packed.instantiate() as Node3D
        if not instance: return false
        var roots: Array[Node3D] = []
        _find_id(instance,"n0",roots)
        if roots.size() != 1:
            instance.free()
            last_error = "Candidate must contain the original n0 root exactly once."
            return false
        var root := roots[0]
        # A GLTF wrapper is allowed only if identity. Never multiply factory .4 twice.
        var ancestor: Node = root.get_parent()
        while ancestor and ancestor != instance.get_parent():
            if ancestor is Node3D and not ancestor.transform.is_equal_approx(Transform3D.IDENTITY):
                instance.free()
                last_error = "Unexpected transformed import wrapper."
                return false
            ancestor = ancestor.get_parent()
        preload("res://scripts/tiger_candidate_materials.gd").adapt(instance)
        candidate = instance
        candidate_root = root
        candidate.name = "SwampTiger_AnatomyCandidate"
        original.get_parent().add_child(candidate)
        candidate_root.transform = original.transform
    if candidate:
        candidate.visible = value
        if value: candidate_root.transform = original.transform
    original.visible = false if value else _visible
    enabled = value
    last_error = ""
    return true

func focus_position() -> Vector3:
    var roots: Array[Node3D] = []
    if candidate and enabled:
        _find_id(candidate,"n1",roots)
        if roots.size() == 1: return roots[0].global_position
    return original.global_position if original else Vector3.ZERO

func unbind() -> void:
    if is_instance_valid(original) and enabled: original.visible = _visible
    if is_instance_valid(candidate): candidate.free()
    original = null
    candidate = null
    candidate_root = null
    _world = null
    enabled = false
