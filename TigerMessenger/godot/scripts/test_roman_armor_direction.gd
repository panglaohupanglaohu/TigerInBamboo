extends SceneTree
## Tests the real source GLBs plus Blender-exported handle candidate.
## Separation is proven using all triangle vertices projected onto directional
## planes, including oblique shield-frame axes; this is NOT an AABB test.
## Re-run after replacing helmet/skirt/body geometry: the source hashes are part
## of the result. No claim about a future geometry version is made here.
const ShieldAdapter = preload("res://scripts/roman_shield_adapter.gd")
const SwordAdapter = preload("res://scripts/roman_grip_adapter.gd")
const ArmorAdapter = preload("res://scripts/roman_armor_direction_adapter.gd")
const ARMOR_PATH := "res://assets/art-pilots/roman-armor-v3-direction.glb"
const ASSEMBLY_RELATIVE := "../artifacts/pipeline/roman-armor-v3-direction/assembly.json"
var failures: Array[String] = []
var cases := 0
var max_grip_error := 0.0
var minimum_body_separation := INF
var minimum_sword_separation := INF
var source_hashes: Dictionary = {}
var handle_hash := ""
var candidate_hashes: Dictionary = {}
var geometry_counts: Dictionary = {}
var assembly: Dictionary = {}


func _initialize() -> void:
	call_deferred("_run")


func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
		push_error(message)


func _run() -> void:
	handle_hash = FileAccess.get_sha256(ShieldAdapter.HANDLE_PATH)
	var assembly_path := ProjectSettings.globalize_path("res://").path_join(ASSEMBLY_RELATIVE).simplify_path()
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(assembly_path))
	_check(parsed is Dictionary, "armor assembly contract parses")
	if not parsed is Dictionary:
		quit(1)
		return
	assembly = parsed
	candidate_hashes = {"armor":FileAccess.get_sha256(ARMOR_PATH), "handle":handle_hash, "assembly":FileAccess.get_sha256(assembly_path)}
	for side in ["blue", "red"]:
		_test_variant(side)
	print(JSON.stringify({"test":"roman_armor_direction", "variants":["blue","red"], "cases":cases, "maxGripError":max_grip_error, "minimumBodySeparation":minimum_body_separation, "minimumSwordSeparation":minimum_sword_separation, "separationMethod":"supporting planes over actual triangle vertices, model-root units", "sourceSha256":source_hashes, "candidateSha256":candidate_hashes, "geometryCounts":geometry_counts, "armorFixture":"real v3 direction adapter: identity wearable at n2, crest +90Y then offset", "failures":failures}))
	await process_frame
	quit(0 if failures.is_empty() else 1)


func _test_variant(side: String) -> void:
	var path := "res://assets/supplemental/romanSoldier_gladius_%s.glb" % side
	source_hashes[side] = FileAccess.get_sha256(path)
	var packed := load(path) as PackedScene
	_check(packed != null, "%s: source GLB loads" % side)
	if packed == null:
		return
	var wrapper := Node3D.new()
	root.add_child(wrapper)
	var model := packed.instantiate() as Node3D
	wrapper.add_child(model)
	var shield_adapter = ShieldAdapter.new()
	var sword_adapter = SwordAdapter.new()
	_check(shield_adapter.bind(model), "%s: resolve shield node references" % side)
	_check(sword_adapter.bind(model), "%s: resolve sword node references" % side)
	if not shield_adapter.is_bound() or not sword_adapter.is_bound():
		wrapper.free()
		return
	var arm: Node3D = shield_adapter.arm_l
	var shield: Node3D = shield_adapter.shield
	var arm_rest := arm.transform
	var shield_rest := shield.transform
	var shield_visible := shield.visible
	var original_parent := shield.get_parent()
	_check(not shield_adapter.enabled and arm.transform == arm_rest and shield.transform == shield_rest, "%s: bind has no pose side effect" % side)
	_check(shield_adapter.set_enabled(true), "%s: enable handle and pose (%s)" % [side, shield_adapter.last_error])
	if not shield_adapter.enabled:
		wrapper.free()
		return
	_check(shield_adapter.has_handle(), "%s: real Blender handle is attached" % side)
	var handle := shield.get_node("RomanShieldGripHandle") as Node3D
	_check(handle.transform == Transform3D.IDENTITY, "%s: handle follows shield without extra transform" % side)
	_check(shield.visible == shield_visible, "%s: enable preserves shield visibility" % side)
	sword_adapter.set_enabled(true)
	var sword: Node3D = sword_adapter.sword
	var right_arm: Node3D = sword_adapter.arm_r
	var sword_rest: Transform3D = sword_adapter.get_rest_sword_transform()
	var right_rest: Transform3D = sword_adapter.get_rest_arm_transform()
	var nodes: Dictionary = {}
	_collect_nodes(model, nodes)
	var fixture := _attach_armor(nodes, model)
	if fixture.is_empty():
		shield_adapter.unbind()
		sword_adapter.unbind()
		wrapper.free()
		return
	var obstacles: Array[Node3D] = [nodes["n2"], nodes["n23"], nodes["n26"]]
	geometry_counts[side] = {"armorTriangleVertices":_mesh_vertices(fixture["instance"], model).size(), "bodyTriangleVertices":_mesh_vertices(nodes["n2"], model).size(), "shieldTriangleVertices":_mesh_vertices(shield, model, true).size()}
	_check(geometry_counts[side]["armorTriangleVertices"] > 0, "%s: new armor contributes real triangles" % side)

	for parent_mode in range(2):
		if parent_mode == 1:
			wrapper.transform = Transform3D(Basis.from_euler(Vector3(0.3, -0.6, 0.4)).scaled(Vector3(1.6, 0.75, 1.3)), Vector3(8, -3, 6))
		for swing in [-0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15]:
			arm.transform = shield_adapter.get_guard_arm_transform(swing)
			shield.basis = shield_adapter.get_guard_shield_basis()
			for pose in range(3):
				for phase in [-1.0, 0.0, 1.0]:
					right_arm.transform = right_rest
					sword.transform = sword_rest
					if pose == 1:
						right_arm.rotate_z(phase * 0.55)
					elif pose == 2:
						right_arm.rotate_z(0.35 + phase * 0.2)
						var direction := Vector3(0.8, 0.25 + phase * 0.25, 0.3).normalized()
						sword.basis = Basis(Quaternion(Vector3.UP, direction)) * Basis.from_scale(sword_rest.basis.get_scale())
					sword_adapter.update_grip()
					var desired_basis := shield.basis
					_check(shield_adapter.update_grip(), "%s: shield grip updates" % side)
					var error: float = shield_adapter.get_grip_error()
					max_grip_error = maxf(max_grip_error, error)
					_check(error < 0.00001, "%s: grip error %s" % [side, error])
					_check(shield.basis == desired_basis and shield.get_parent() == original_parent, "%s: update preserves shield basis and parent" % side)
					var shield_vertices := _mesh_vertices(shield, model, true)
					var body_vertices := PackedVector3Array()
					for obstacle in obstacles:
						body_vertices.append_array(_mesh_vertices(obstacle, model))
					var sword_vertices := _mesh_vertices(sword, model)
					var basis_in_model: Basis = (model.global_transform.affine_inverse() * shield.global_transform).basis.orthonormalized()
					var body_gap := _separating_gap(shield_vertices, body_vertices, basis_in_model)
					var sword_gap := _separating_gap(shield_vertices, sword_vertices, basis_in_model)
					minimum_body_separation = minf(minimum_body_separation, body_gap)
					minimum_sword_separation = minf(minimum_sword_separation, sword_gap)
					_check(body_gap > 0.002, "%s: body separation %s, swing=%s" % [side, body_gap, swing])
					_check(sword_gap > 0.002, "%s: sword separation %s, swing=%s pose=%s phase=%s" % [side, sword_gap, swing, pose, phase])
					cases += 1

	# Independent equipment-parent rotation/scale still requires exact gripping;
	# these arbitrary perturbations are NOT advertised as collision-safe poses.
	var equipment: Node3D = shield.get_parent()
	var equipment_rest := equipment.transform
	equipment.transform = Transform3D(Basis.from_euler(Vector3(0.3, 0.2, -0.1)).scaled(Vector3(0.8, 1.3, 0.9)), Vector3(0.02, -0.01, 0.03))
	_check(shield_adapter.update_grip() and shield_adapter.get_grip_error() < 0.00001, "%s: non-unit equipment-parent grip" % side)
	equipment.transform = equipment_rest
	var sword_before_off := sword.transform
	shield_adapter.bind(model)
	_check(shield_adapter.get_rest_arm_transform() == arm_rest and shield_adapter.get_rest_shield_transform() == shield_rest, "%s: repeat bind retains original transforms" % side)
	shield_adapter.set_enabled(false)
	_check(arm.transform == arm_rest and shield.transform == shield_rest, "%s: OFF restores arm and shield" % side)
	_check(not handle.visible and shield.visible == shield_visible, "%s: OFF hides candidate handle only" % side)
	_check(sword.transform == sword_before_off and sword_adapter.enabled, "%s: shield OFF does not alter sword adapter" % side)
	shield_adapter.set_enabled(true)
	shield.hide() # Simulate original onShieldBroken while correction is active.
	shield_adapter.set_enabled(false)
	_check(not shield.visible, "%s: OFF cannot resurrect a broken shield" % side)
	shield_adapter.set_enabled(true)
	_check(not shield.visible, "%s: ON cannot resurrect a broken shield" % side)
	shield_adapter.unbind()
	_check(not is_instance_valid(handle), "%s: unbind releases handle instance" % side)
	_check(arm.transform == arm_rest and shield.transform == shield_rest, "%s: unbind restores original transforms" % side)
	# A shield already hidden before binding must also remain hidden.
	_check(shield_adapter.bind(model), "%s: rebind hidden shield" % side)
	_check(shield_adapter.set_enabled(true) and not shield.visible, "%s: hidden-at-bind remains hidden" % side)
	shield_adapter.set_enabled(false)
	_check(not shield.visible, "%s: hidden-at-bind OFF restores hidden visibility" % side)
	arm.position.x += 0.001
	var caller_pose := arm.transform
	shield_adapter.set_enabled(false)
	_check(arm.transform == caller_pose, "%s: repeated OFF leaves caller pose alone" % side)
	arm.transform = arm_rest
	shield_adapter.unbind()
	sword_adapter.unbind()
	_restore_armor(fixture)
	wrapper.free()
	_check(FileAccess.get_sha256(path) == source_hashes[side], "%s: source GLB unchanged" % side)


func _collect_nodes(node: Node, result: Dictionary) -> void:
	var extras: Dictionary = node.get_meta("extras", {})
	if extras.has("three_node_id"):
		result[str(extras["three_node_id"])] = node
	for child in node.get_children():
		_collect_nodes(child, result)


func _mesh_vertices(node: Node, frame: Node3D, shield_surface_only: bool = false) -> PackedVector3Array:
	var vertices := PackedVector3Array()
	if shield_surface_only and node.name == "RomanShieldGripHandle":
		return vertices # Intentional hand/handle contact is outside shield-disc test.
	if node is MeshInstance3D and node.is_visible_in_tree() and node.mesh != null:
		var to_frame: Transform3D = frame.global_transform.affine_inverse() * node.global_transform
		for point in node.mesh.get_faces():
			vertices.append(to_frame * point)
	for child in node.get_children():
		vertices.append_array(_mesh_vertices(child, frame, shield_surface_only))
	return vertices


func _separating_gap(a: PackedVector3Array, b: PackedVector3Array, shield_basis: Basis) -> float:
	if a.is_empty() or b.is_empty():
		return -INF
	var axes: Array[Vector3] = [Vector3.RIGHT, Vector3.UP, Vector3.BACK]
	for x in [-1.0, 0.0, 1.0]:
		for y in [-1.0, 0.0, 1.0]:
			for z in [-1.0, 0.0, 1.0]:
				var direction := Vector3(x, y, z)
				if direction.length_squared() > 0:
					axes.append((shield_basis * direction).normalized())
	var best := -INF
	for axis in axes:
		var min_a := INF
		var max_a := -INF
		var min_b := INF
		var max_b := -INF
		for point in a:
			var projection := axis.dot(point)
			min_a = minf(min_a, projection)
			max_a = maxf(max_a, projection)
		for point in b:
			var projection := axis.dot(point)
			min_b = minf(min_b, projection)
			max_b = maxf(max_b, projection)
		best = maxf(best, maxf(min_a - max_b, min_b - max_a))
	return best


func _attach_armor(nodes: Dictionary, model: Node3D) -> Dictionary:
	var visibility: Dictionary = {}
	for id in assembly["hideOriginalNodeIds"]:
		visibility[nodes[str(id)]] = nodes[str(id)].visible
	var crest_rest: Dictionary = {}
	for id in assembly["crestNodeIds"]:
		crest_rest[nodes[str(id)]] = nodes[str(id)].transform
	var adapter = ArmorAdapter.new()
	_check(adapter.bind(model), "direction armor adapter binds")
	_check(adapter.set_enabled(true), "direction armor adapter enables: " + adapter.last_error)
	if not adapter.enabled: return {}
	var body: Node3D = nodes[str(assembly["attachBodyNodeId"])]
	var instance: Node3D = body.get_node("RomanArmorV3Direction")
	for node in crest_rest:
		var expected: Transform3D = Transform3D(Basis(Vector3.UP, PI / 2.0), Vector3.ZERO) * crest_rest[node]
		expected.origin += Vector3(0, -.018, 0)
		_check(node.transform.is_equal_approx(expected), "crest direction +90Y matches assembly")
	adapter.bind(model)
	return {"instance":instance, "adapter":adapter, "visibility":visibility, "crestRest":crest_rest}


func _restore_armor(fixture: Dictionary) -> void:
	fixture["adapter"].set_enabled(false)
	for node in fixture["visibility"]:
		_check(node.visible == fixture["visibility"][node], "armor adapter restores original visibility")
	for node in fixture["crestRest"]:
		_check(node.transform == fixture["crestRest"][node], "armor adapter restores original crest transform")
	fixture["adapter"].unbind()
	_check(not is_instance_valid(fixture["instance"]), "armor adapter releases direction candidate")
