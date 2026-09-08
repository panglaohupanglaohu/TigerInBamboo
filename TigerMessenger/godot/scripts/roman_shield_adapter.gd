class_name RomanShieldAdapter
extends RefCounted
## Reversible concept-driven shield grip and limited guard-pose candidate.
## Call update_grip AFTER changing the left-arm guard pose.
## Original GLB is never edited; parent hierarchy remains. The new grip is a separate child asset.

const HAND_LOCAL := Vector3(0.0, -0.138, 0.0)
const GRIP_LOCAL := Vector3(-0.055, 0.0, 0.0)
const HANDLE_PATH := "res://assets/art-pilots/roman-shield-handle-v1.glb"
const GUARD_Z := 1.05
const GUARD_OUTWARD_Y := -0.8
const SHIELD_Y := -0.5
const SHOULDER_DEPTH_DELTA := 0.034
const MAX_SWING := 0.15

var enabled := false
var last_error := ""
var arm_l: Node3D
var shield: Node3D
var _model: Node3D
var _shield_parent: Node3D
var _original_transform := Transform3D.IDENTITY
var _original_arm_transform := Transform3D.IDENTITY
var _original_visible := true
var _handle: Node3D


func bind(model_root: Node3D) -> bool:
	# Never recapture a corrected transform when the UI rebinds the same model.
	if is_instance_valid(model_root) and model_root == _model and is_bound():
		return true
	unbind()
	last_error = ""
	if not is_instance_valid(model_root):
		last_error = "No valid model root."
		return false
	var nodes: Dictionary = {}
	var owners: Array[Dictionary] = []
	if not _collect(model_root, nodes, owners):
		return false
	if owners.size() != 1:
		last_error = "Expected one soldier with parts.armL and equipment.shield references."
		return false
	var owner: Dictionary = owners[0]
	var arm_id := _node_ref(owner.get("parts", {}), "armL")
	var shield_id := _node_ref(owner.get("equipment", {}), "shield")
	var found_arm: Variant = nodes.get(arm_id)
	var found_shield: Variant = nodes.get(shield_id)
	if not found_arm is Node3D or not found_shield is Node3D or found_arm == found_shield:
		last_error = "Soldier node references cannot be resolved to distinct 3D nodes."
		return false
	if not found_shield.get_parent() is Node3D or found_shield.is_set_as_top_level():
		last_error = "Shield requires its original 3D parent and inherited transform."
		return false
	_model = model_root
	arm_l = found_arm
	shield = found_shield
	_shield_parent = shield.get_parent()
	_original_transform = shield.transform
	_original_arm_transform = arm_l.transform
	_original_visible = shield.visible
	return true


func get_rest_arm_transform() -> Transform3D:
	return _original_arm_transform


func get_rest_shield_transform() -> Transform3D:
	return _original_transform


func get_guard_arm_transform(swing: float = 0.0) -> Transform3D:
	var angle := GUARD_Z + clampf(swing, -MAX_SWING, MAX_SWING)
	var transform := _original_arm_transform
	# Minimal shoulder depth adjustment plus outward arm rotation keeps the
	# shoulder on the existing torso, rather than translating the whole arm away.
	transform.origin.z += SHOULDER_DEPTH_DELTA
	transform.basis = Basis(Vector3.UP, GUARD_OUTWARD_Y) * Basis(Vector3.BACK, angle) * Basis.from_scale(_original_arm_transform.basis.get_scale())
	return transform


func get_guard_shield_basis() -> Basis:
	return Basis(Vector3.UP, SHIELD_Y) * Basis.from_scale(_original_transform.basis.get_scale())


func has_handle() -> bool:
	return is_instance_valid(_handle)


func _ensure_handle() -> bool:
	if is_instance_valid(_handle):
		return true
	if not ResourceLoader.exists(HANDLE_PATH):
		last_error = "Shield handle candidate has not been imported."
		return false
	var packed := ResourceLoader.load(HANDLE_PATH, "PackedScene", ResourceLoader.CACHE_MODE_IGNORE) as PackedScene
	if packed == null:
		last_error = "Shield handle candidate cannot be loaded."
		return false
	var instance: Node = packed.instantiate()
	if not instance is Node3D:
		instance.free()
		last_error = "Shield handle candidate requires a 3D root."
		return false
	_handle = instance
	_handle.name = "RomanShieldGripHandle"
	shield.add_child(_handle)
	_handle.transform = Transform3D.IDENTITY
	return true


func _node_ref(section: Variant, key: String) -> String:
	if not section is Dictionary:
		return ""
	var reference: Variant = section.get(key)
	return str(reference.get("nodeRef", "")) if reference is Dictionary else ""


func _collect(node: Node, nodes: Dictionary, owners: Array[Dictionary]) -> bool:
	var extras: Variant = node.get_meta("extras", {})
	if not extras is Dictionary:
		extras = {}
	var source_id := str(extras.get("three_node_id", node.get_meta("three_node_id", "")))
	if not source_id.is_empty():
		if nodes.has(source_id):
			last_error = "Duplicate source node IDs: bind a single imported soldier."
			return false
		nodes[source_id] = node
	var raw: Variant = extras.get("three_userData", node.get_meta("three_userData", {}))
	var data: Variant = JSON.parse_string(raw) if raw is String else raw
	if data is Dictionary and not _node_ref(data.get("parts"), "armL").is_empty() and not _node_ref(data.get("equipment"), "shield").is_empty():
		owners.append(data)
	for child in node.get_children():
		if not _collect(child, nodes, owners):
			return false
	return true


func is_bound() -> bool:
	return is_instance_valid(_model) and is_instance_valid(arm_l) and is_instance_valid(shield) and is_instance_valid(_shield_parent) and shield.get_parent() == _shield_parent and (_model == arm_l or _model.is_ancestor_of(arm_l)) and (_model == shield or _model.is_ancestor_of(shield))


func set_enabled(value: bool) -> bool:
	if not value:
		# Restore only when transitioning from an active correction; repeated OFF
		# calls must not overwrite later transforms owned by the caller.
		if enabled:
			_restore()
		enabled = false
		return is_bound()
	if not is_bound():
		last_error = "Bind a valid soldier before enabling grip correction."
		return false
	if enabled:
		return update_grip()
	if not _ensure_handle():
		return false
	arm_l.transform = get_guard_arm_transform()
	shield.basis = get_guard_shield_basis()
	_handle.show()
	enabled = true
	if not update_grip():
		_restore()
		enabled = false
		return false
	return true


func update_grip() -> bool:
	if not enabled or not is_bound():
		return false
	if not arm_l.is_inside_tree() or not shield.is_inside_tree():
		last_error = "Grip correction requires nodes inside the scene tree."
		return false
	if absf(_shield_parent.global_basis.determinant()) < 1e-15:
		last_error = "Shield parent has a singular transform."
		return false
	var hand_in_parent := _shield_parent.to_local(arm_l.to_global(HAND_LOCAL))
	# Basis includes the caller's rotation and scale. Assign only translation.
	shield.position = hand_in_parent - shield.basis * GRIP_LOCAL
	last_error = ""
	return true


func get_grip_error() -> float:
	if not is_bound() or not arm_l.is_inside_tree() or not shield.is_inside_tree():
		return INF
	return arm_l.to_global(HAND_LOCAL).distance_to(shield.to_global(GRIP_LOCAL))


func _restore() -> void:
	if is_instance_valid(arm_l):
		arm_l.transform = _original_arm_transform
	if is_instance_valid(_handle):
		_handle.hide()
	if is_instance_valid(shield) and is_instance_valid(_shield_parent) and shield.get_parent() == _shield_parent:
		shield.transform = _original_transform
		# Preserve a shield hidden by damage while the candidate was enabled.
		# This adapter never turns a broken/invisible shield back on.
		shield.visible = shield.visible and _original_visible


func unbind() -> void:
	if enabled:
		_restore()
	if is_instance_valid(_handle):
		_handle.free()
	_handle = null
	enabled = false
	_model = null
	arm_l = null
	shield = null
	_shield_parent = null
