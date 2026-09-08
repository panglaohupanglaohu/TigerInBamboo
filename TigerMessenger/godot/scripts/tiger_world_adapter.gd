extends RefCounted
## Reversible visual replacement at the exact original swamp tiger placement.
const SOURCE_PATH := "moebius-swamp-placement[77]/moebius-swamp-zone[0]/moebius-cyber-ink-tiger[334]"
const CANDIDATE_PATH := "res://assets/art-pilots/moebius-tiger-anatomy-v3.glb"
const TAIL_IDS := ["n27", "n28", "n31", "n34", "n37", "n40", "n43", "n46", "n49"]
const IDLE_TAIL_CLIP := "tiger/idle_tail"
const IDLE_TAIL_DURATION := TAU / 3.0
const IDLE_TAIL_KEYS := 128
var original: Node3D
var candidate: Node3D
var candidate_root: Node3D
var enabled := false
var last_error := ""
var _visible := true
var _world: Node3D
var _tail_player: AnimationPlayer
var _tail_rest: Dictionary = {}

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
        if not _prepare_idle_tail():
            candidate.free()
            candidate = null
            candidate_root = null
            _tail_rest.clear()
            return false
        original.get_parent().add_child(candidate)
        candidate_root.transform = original.transform
    if candidate:
        candidate.visible = value
        if value: candidate_root.transform = original.transform
    original.visible = false if value else _visible
    if value and not enabled:
        _tail_player.play(IDLE_TAIL_CLIP)
    elif not value and is_instance_valid(_tail_player):
        _tail_player.stop()
        for pivot in _tail_rest: pivot.transform = _tail_rest[pivot]
    enabled = value
    last_error = ""
    return true

func _prepare_idle_tail() -> bool:
    # Only the original idle-tail formulas are ported. The world root, feet,
    # head and story state remain untouched. Never use stale -45-degree extras.
    var pivots: Array[Node3D] = []
    for id in TAIL_IDS:
        var matches: Array[Node3D] = []
        _find_id(candidate, id, matches)
        if matches.size() != 1:
            last_error = "Idle tail requires each original pivot exactly once: " + id
            return false
        var pivot := matches[0]
        var angles := pivot.basis.orthonormalized().get_euler(EULER_ORDER_XYZ)
        # The saved v3 chain rests about X only. Refuse a different contract
        # rather than silently discarding a future authored Y/Z rest rotation.
        if absf(angles.y) > 0.00001 or absf(angles.z) > 0.00001:
            last_error = "Unexpected non-X tiger tail rest rotation: " + id
            return false
        _tail_rest[pivot] = pivot.transform
        pivots.append(pivot)
    var animation := Animation.new()
    animation.length = IDLE_TAIL_DURATION
    animation.loop_mode = Animation.LOOP_LINEAR
    for i in range(pivots.size()):
        var pivot := pivots[i]
        var rest: Transform3D = _tail_rest[pivot]
        var rest_x := rest.basis.orthonormalized().get_euler(EULER_ORDER_XYZ).x
        var rest_scale := rest.basis.get_scale()
        var track := animation.add_track(Animation.TYPE_VALUE)
        animation.track_set_path(track, NodePath(str(candidate.get_path_to(pivot)) + ":transform"))
        for frame in range(IDLE_TAIL_KEYS + 1):
            var t := IDLE_TAIL_DURATION * frame / IDLE_TAIL_KEYS
            var gait := t * 3.0
            var x: float
            var z: float
            if i == 0:
                x = rest_x + cos(gait * 2.0) * 0.035 * 0.25
                z = sin(gait) * 0.42 * 0.55 * 0.35
            else:
                var u := float(i - 1) / 7.0
                var phase := u * 0.5
                x = rest_x + cos(gait * 2.0 - phase) * lerpf(0.02, 0.06, u) * 0.55
                z = sin(gait - phase) * lerpf(0.1, 0.45, u) * 0.55
            # Three's XZY root and XYZ joints both reduce to Rx * Rz when Y=0.
            var posed := Basis(Vector3.RIGHT, x) * Basis(Vector3(0, 0, 1), z)
            animation.track_insert_key(track, t, Transform3D(posed.scaled_local(rest_scale), rest.origin))
    var library := AnimationLibrary.new()
    library.add_animation("idle_tail", animation)
    _tail_player = AnimationPlayer.new()
    _tail_player.name = "OriginalIdleTail"
    _tail_player.root_node = NodePath("..")
    candidate.add_child(_tail_player)
    _tail_player.add_animation_library("tiger", library)
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
    _tail_player = null
    _tail_rest.clear()
    _world = null
    enabled = false
