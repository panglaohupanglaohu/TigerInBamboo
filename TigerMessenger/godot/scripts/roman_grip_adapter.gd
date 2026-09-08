class_name RomanGripAdapter
extends RefCounted
## Reversible position-only correction for the original Roman gladius soldier.
## Call update_grip AFTER the caller updates arm pose and weapon aiming basis.
## Original GLB hierarchy, geometry, materials and weapon orientation stay intact.

const HAND_LOCAL := Vector3(0.0, -0.138, 0.0)
const GRIP_LOCAL := Vector3(0.0, 0.04, 0.0)

var enabled := false
var last_error := ""
var arm_r: Node3D
var sword: Node3D
var _model: Node3D
var _weapon_parent: Node3D
var _original_transform := Transform3D.IDENTITY
var _original_arm_transform := Transform3D.IDENTITY


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
		last_error = "Expected one soldier with parts.armR and equipment.gladius references."
		return false
	var owner: Dictionary = owners[0]
	var arm_id := _node_ref(owner.get("parts", {}), "armR")
	var sword_id := _node_ref(owner.get("equipment", {}), "gladius")
	var found_arm: Variant = nodes.get(arm_id)
	var found_sword: Variant = nodes.get(sword_id)
	if not found_arm is Node3D or not found_sword is Node3D or found_arm == found_sword:
		last_error = "Soldier node references cannot be resolved to distinct 3D nodes."
		return false
	if not found_sword.get_parent() is Node3D or found_sword.is_set_as_top_level():
		last_error = "Weapon requires its original 3D parent and inherited transform."
		return false
	_model = model_root
	arm_r = found_arm
	sword = found_sword
	_weapon_parent = sword.get_parent()
	_original_transform = sword.transform
	_original_arm_transform = arm_r.transform
	return true


func get_rest_arm_transform() -> Transform3D:
	return _original_arm_transform


func get_rest_sword_transform() -> Transform3D:
	return _original_transform


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
	if data is Dictionary and not _node_ref(data.get("parts"), "armR").is_empty() and not _node_ref(data.get("equipment"), "gladius").is_empty():
		owners.append(data)
	for child in node.get_children():
		if not _collect(child, nodes, owners):
			return false
	return true


func is_bound() -> bool:
	return is_instance_valid(_model) and is_instance_valid(arm_r) and is_instance_valid(sword) and is_instance_valid(_weapon_parent) and sword.get_parent() == _weapon_parent and (_model == arm_r or _model.is_ancestor_of(arm_r)) and (_model == sword or _model.is_ancestor_of(sword))


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
	enabled = true
	if not update_grip():
		_restore()
		enabled = false
		return false
	return true


func update_grip() -> bool:
	if not enabled or not is_bound():
		return false
	if not arm_r.is_inside_tree() or not sword.is_inside_tree():
		last_error = "Grip correction requires nodes inside the scene tree."
		return false
	if absf(_weapon_parent.global_basis.determinant()) < 1e-15:
		last_error = "Weapon parent has a singular transform."
		return false
	var hand_in_parent := _weapon_parent.to_local(arm_r.to_global(HAND_LOCAL))
	# Basis includes the caller's rotation and scale. Assign only translation.
	sword.position = hand_in_parent - sword.basis * GRIP_LOCAL
	last_error = ""
	return true


func get_grip_error() -> float:
	if not is_bound() or not arm_r.is_inside_tree() or not sword.is_inside_tree():
		return INF
	return arm_r.to_global(HAND_LOCAL).distance_to(sword.to_global(GRIP_LOCAL))


func _restore() -> void:
	if is_instance_valid(sword) and is_instance_valid(_weapon_parent) and sword.get_parent() == _weapon_parent:
		sword.transform = _original_transform


func unbind() -> void:
	if enabled:
		_restore()
	enabled = false
	_model = null
	arm_r = null
	sword = null
	_weapon_parent = null
