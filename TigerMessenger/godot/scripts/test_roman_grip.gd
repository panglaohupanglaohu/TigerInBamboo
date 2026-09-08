extends SceneTree
## Headless functional checks against the real red/blue imported GLBs.
const Adapter = preload("res://scripts/roman_grip_adapter.gd")
const VARIANTS := ["red", "blue"]
const TOLERANCE := 0.00001
var failures: Array[String] = []
var corrected_cases := 0
var maximum_error := 0.0
var baseline_errors: Dictionary = {}


func _initialize() -> void:
	call_deferred("_run")


func _check(value: bool, message: String) -> void:
	if not value:
		failures.append(message)
		push_error(message)


func _run() -> void:
	for side in VARIANTS:
		_test_variant(side)
	_test_invalid_binding()
	print(JSON.stringify({"test": "roman_grip", "variants": VARIANTS, "correctedCases": corrected_cases, "maxGripError": maximum_error, "baselineGripError": baseline_errors, "failures": failures}))
	await process_frame
	quit(0 if failures.is_empty() else 1)


func _test_variant(side: String) -> void:
	var path := "res://assets/supplemental/romanSoldier_gladius_%s.glb" % side
	var before_hash := FileAccess.get_sha256(path)
	var packed := ResourceLoader.load(path, "PackedScene", ResourceLoader.CACHE_MODE_IGNORE) as PackedScene
	_check(packed != null, "%s: actual GLB must load" % side)
	if packed == null:
		return
	var wrapper := Node3D.new()
	root.add_child(wrapper)
	var model := packed.instantiate() as Node3D
	wrapper.add_child(model)
	var adapter = Adapter.new()
	_check(adapter.bind(model), "%s: bind references from extras.three_userData" % side)
	if not adapter.is_bound():
		wrapper.free()
		return
	var sword: Node3D = adapter.sword
	var arm: Node3D = adapter.arm_r
	var equipment: Node3D = sword.get_parent()
	var original_transform := sword.transform
	var original_arm := arm.transform
	var original_equipment := equipment.transform
	var original_parent := sword.get_parent()
	baseline_errors[side] = adapter.get_grip_error()
	_check(adapter.get_grip_error() > 0.3, "%s: original detached grip is reproduced" % side)
	_check(not adapter.enabled and sword.transform == original_transform, "%s: bind alone must not mutate" % side)
	_check(not adapter.update_grip() and sword.transform == original_transform, "%s: disabled update is a no-op" % side)
	_check(adapter.set_enabled(true), "%s: enable standing correction" % side)
	_check(adapter.get_grip_error() < TOLERANCE, "%s: standing grip coincides" % side)
	_check(sword.basis == original_transform.basis, "%s: standing correction preserves basis exactly" % side)
	# Rebind while corrected: OFF must still return to the first original.
	_check(adapter.bind(model), "%s: repeated bind is valid" % side)
	adapter.set_enabled(false)
	_check(sword.transform == original_transform, "%s: rebind did not replace original transform cache" % side)
	adapter.set_enabled(true)

	for parent_mode in range(2):
		if parent_mode == 1:
			wrapper.transform = Transform3D(Basis.from_euler(Vector3(0.3, -0.8, 0.45)).scaled(Vector3(1.7, 0.6, 2.2)), Vector3(12.4, -3.2, 5.1))
			equipment.transform = Transform3D(Basis.from_euler(Vector3(-0.2, 0.35, 0.1)).scaled(Vector3(0.8, 1.3, 0.7)), Vector3(0.06, -0.03, 0.02))
		for arm_angle in [-1.0, -0.2, 0.0, 0.85, 1.7, 2.8]:
			arm.transform = original_arm
			arm.rotation = Vector3(0.12 * sin(arm_angle), 0.25 * cos(arm_angle), arm_angle)
			for aim in [Vector3(0.15, 0, -0.9), Vector3(-0.4, 0.6, 1.2), Vector3(1.1, -0.7, -1.8)]:
				sword.basis = Basis.from_euler(aim).scaled(Vector3(0.9, 1.15, 0.8))
				var aim_basis := sword.basis
				_check(adapter.update_grip(), "%s: pose/aim correction updates" % side)
				var error: float = adapter.get_grip_error()
				maximum_error = maxf(maximum_error, error)
				corrected_cases += 1
				_check(error < TOLERANCE, "%s: transformed parent grip error %s" % [side, error])
				_check(sword.basis == aim_basis, "%s: update changes position only" % side)
				_check(sword.get_parent() == original_parent, "%s: equipment parent unchanged" % side)

	adapter.bind(model)
	_check(adapter.get_rest_arm_transform() == original_arm, "%s: rest arm getter retains bound pose" % side)
	_check(adapter.get_rest_sword_transform() == original_transform, "%s: rest sword getter retains original transform" % side)
	adapter.set_enabled(false)
	_check(sword.transform == original_transform, "%s: OFF restores complete original local transform" % side)
	# Once disabled, a later caller transform belongs to the caller.
	sword.position += Vector3(0.01, 0.02, 0.03)
	var caller_transform := sword.transform
	adapter.set_enabled(false)
	_check(sword.transform == caller_transform, "%s: repeated OFF does not overwrite caller changes" % side)
	sword.transform = original_transform
	equipment.transform = original_equipment
	arm.transform = original_arm
	wrapper.transform = Transform3D.IDENTITY
	adapter.set_enabled(true)
	adapter.unbind()
	_check(sword.transform == original_transform and not adapter.is_bound(), "%s: unbind restores and clears references" % side)

	# Switching to another valid instance restores the former one.
	adapter.bind(model)
	adapter.set_enabled(true)
	var another := packed.instantiate() as Node3D
	wrapper.add_child(another)
	_check(adapter.bind(another), "%s: switch model succeeds" % side)
	_check(sword.transform == original_transform, "%s: switching restores previous model" % side)
	_check(not adapter.enabled, "%s: newly bound model starts disabled" % side)
	adapter.set_enabled(true)
	var another_sword: Node3D = adapter.sword
	another.free()
	_check(not adapter.is_bound() and not adapter.update_grip(), "%s: freed nodes are safe" % side)
	adapter.unbind()
	_check(not is_instance_valid(another_sword), "%s: no model lifetime retained" % side)
	wrapper.free()
	_check(FileAccess.get_sha256(path) == before_hash, "%s: GLB file was not modified" % side)


func _test_invalid_binding() -> void:
	var adapter = Adapter.new()
	var empty := Node3D.new()
	root.add_child(empty)
	_check(not adapter.bind(empty), "Missing node references fail without mutation")
	_check(not adapter.set_enabled(true), "Unbound adapter cannot enable")
	empty.free()
