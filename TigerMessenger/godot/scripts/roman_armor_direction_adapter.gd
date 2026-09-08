class_name RomanArmorDirectionAdapter
extends RefCounted
## Reversible body-local wearable contract: artifacts/pipeline/roman-armor-v3-direction/assembly.json.
## Source body/limbs/equipment stay in place. No animation ownership is added.
const ARMOR_PATH := "res://assets/art-pilots/roman-armor-v3-direction.glb"
const CREST_YAW := PI / 2.0
const CREST_OFFSET := Vector3(0.0, -0.018, 0.0)
const HIDE_IDS := ["n5", "n9"]
const CREST_IDS := ["n11", "n13", "n15"]
var enabled := false
var last_error := ""
var _model: Node3D
var _body: Node3D
var _armor: Node3D
var _hidden: Array[Dictionary] = []
var _crests: Array[Dictionary] = []

func bind(model_root: Node3D) -> bool:
    if is_instance_valid(model_root) and model_root == _model and is_bound():
        last_error = ""
        return true
    unbind()
    last_error = ""
    if not is_instance_valid(model_root):
        last_error = "No valid soldier model root."
        return false
    var nodes: Dictionary = {}
    var owners: Array[String] = []
    if not _collect(model_root, nodes, owners): return false
    if owners.size() != 1 or owners[0] != "n2" or not nodes.get("n2") is Node3D:
        last_error = "Expected one soldier with original parts.body reference n2."
        return false
    var body: Node3D = nodes["n2"]
    var hidden: Array[Dictionary] = []
    var crests: Array[Dictionary] = []
    for id in HIDE_IDS + CREST_IDS:
        var node: Variant = nodes.get(id)
        if not node is Node3D or node.get_parent() != body or node.is_set_as_top_level():
            last_error = "Armor source node must retain original body parent: " + id
            return false
        if id in HIDE_IDS:
            hidden.append({"node":node,"visible":node.visible})
        else:
            crests.append({"node":node,"transform":node.transform})
    _model = model_root
    _body = body
    _hidden = hidden
    _crests = crests
    return true

func _collect(node: Node, nodes: Dictionary, owners: Array[String]) -> bool:
    var extras: Variant = node.get_meta("extras", {})
    if not extras is Dictionary: extras = {}
    var id := str(extras.get("three_node_id", node.get_meta("three_node_id", "")))
    if not id.is_empty():
        if nodes.has(id):
            last_error = "Duplicate original node IDs: bind one soldier only."
            return false
        nodes[id] = node
    var raw: Variant = extras.get("three_userData", node.get_meta("three_userData", {}))
    var data: Variant = JSON.parse_string(raw) if raw is String else raw
    if data is Dictionary:
        var parts: Variant = data.get("parts")
        if parts is Dictionary:
            var reference: Variant = parts.get("body")
            if reference is Dictionary and reference.has("nodeRef"):
                owners.append(str(reference.nodeRef))
    for child in node.get_children():
        if not _collect(child, nodes, owners): return false
    return true

func is_bound() -> bool:
    if not is_instance_valid(_model) or not is_instance_valid(_body): return false
    if _body != _model and not _model.is_ancestor_of(_body): return false
    if _hidden.size() != 2 or _crests.size() != 3: return false
    for row in _hidden + _crests:
        if not is_instance_valid(row.node) or row.node.get_parent() != _body or row.node.is_set_as_top_level(): return false
    return true

func _instantiate_candidate() -> Node3D:
    if not ResourceLoader.exists(ARMOR_PATH):
        last_error = "Roman armor candidate has not been imported."
        return null
    var packed := ResourceLoader.load(ARMOR_PATH, "PackedScene", ResourceLoader.CACHE_MODE_IGNORE) as PackedScene
    if packed == null:
        last_error = "Roman armor candidate cannot be loaded."
        return null
    var instance: Node = packed.instantiate()
    if not instance is Node3D:
        instance.free()
        last_error = "Roman armor candidate requires a 3D root."
        return null
    return instance

func _validate_candidate(node: Node) -> int:
    # The published wearable is three mesh islands/groups under identity nodes.
    if node is Node3D and (not node.transform.is_equal_approx(Transform3D.IDENTITY) or node.is_set_as_top_level()):
        return -1000
    var count := 1 if node is MeshInstance3D and node.mesh != null else 0
    for child in node.get_children(): count += _validate_candidate(child)
    return count

func set_enabled(value: bool) -> bool:
    if not value:
        if enabled: _restore()
        enabled = false
        last_error = ""
        return is_bound()
    if not is_bound():
        last_error = "Bind a valid soldier before enabling armor."
        return false
    if enabled:
        last_error = ""
        return true
    if not is_instance_valid(_armor):
        var candidate := _instantiate_candidate()
        if candidate == null: return false
        if _validate_candidate(candidate) != 3:
            candidate.free()
            last_error = "Armor requires exactly three meshes and identity transforms."
            return false
        candidate.name = "RomanArmorV3Direction"
        candidate.visible = false
        _body.add_child(candidate)
        _armor = candidate
    # Loading and validation have succeeded; only now mutate original visibility/pose.
    for row in _hidden: row.node.visible = false
    for row in _crests:
        var adjusted: Transform3D = Transform3D(Basis(Vector3.UP, CREST_YAW), Vector3.ZERO) * row.transform
        adjusted.origin += CREST_OFFSET
        row.node.transform = adjusted
    _armor.visible = true
    enabled = true
    last_error = ""
    return true

func _restore() -> void:
    if is_instance_valid(_armor): _armor.visible = false
    for row in _hidden:
        if is_instance_valid(row.node): row.node.visible = row.visible
    for row in _crests:
        if is_instance_valid(row.node) and row.node.get_parent() == _body:
            row.node.transform = row.transform

func unbind() -> void:
    if enabled: _restore()
    if is_instance_valid(_armor): _armor.free()
    _armor = null
    enabled = false
    _model = null
    _body = null
    _hidden.clear()
    _crests.clear()
    last_error = ""
