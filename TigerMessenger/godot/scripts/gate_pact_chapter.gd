extends "res://scripts/original_world.gd"
## Bounded chapter fixture in the same original world, on the authored terrace.
const COURIER := "res://assets/human-courier-v1/human-courier.glb"
# Keep 20 cm inside the terrace constraint; Vector3 float precision makes
# an exact -17.3 boundary become -17.299999 and fail a double comparison.
const SPAWN := Vector3(-17.5, 3.26, -23.9)
var gate_adapter
var pact_controller
var courier_actor: Node3D
var chapter_status: Label
var chapter_action: Button
var walk_triangles: Array[PackedVector3Array] = []
var chapter_ready := false
var chapter_error := ""
var movement_rejection := ""

func _ready() -> void:
	super._ready()
	if not model.has_meta("gate_target_adapter"):
		chapter_error = "叹息之门尚未接入。"
		_refresh_chapter()
		return
	gate_adapter = model.get_meta("gate_target_adapter")
	pact_controller = gate_adapter.pact
	if not is_instance_valid(pact_controller) or not pact_controller.last_error.is_empty():
		chapter_error = "英雄绑定失败；章节测试未启动。"
		_refresh_chapter()
		return
	_index_terrace()
	courier_actor = load(COURIER).instantiate() as Node3D
	courier_actor.name = "GateChapterHumanCourier"
	gate_adapter.candidate.add_child(courier_actor)
	_match_hero_height(courier_actor)
	chapter_ready = true
	reset_chapter()
	center = pact_controller.meeting.global_position + gate_adapter.seat.global_basis.y * 0.8
	up = gate_adapter.seat.global_basis.y.normalized()
	camera.global_position = gate_adapter.seat.to_global(Vector3(-32, 10.5, -32))
	camera.look_at(center, up)
	camera.fov = 48

func _ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var box := VBoxContainer.new()
	box.position = Vector2(16, 16)
	box.custom_minimum_size = Vector2(360, 0)
	layer.add_child(box)
	var title := Label.new()
	title.text = "贰 · 叹息之门的约定｜章节测试"
	box.add_child(title)
	var scope := Label.new()
	scope.text = "起点：已携书店密信（chapter 1）。\n此处仅测试会面交付；完整救援主线尚未迁移。\nWASD / 方向键：台上步行 · R：靠近交付"
	box.add_child(scope)
	chapter_status = Label.new()
	chapter_status.custom_minimum_size.x = 360
	chapter_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(chapter_status)
	status = chapter_status
	chapter_action = Button.new()
	chapter_action.text = "[R] 交付密信，与英雄结盟"
	chapter_action.pressed.connect(interact_chapter)
	box.add_child(chapter_action)
	var restart := Button.new()
	restart.text = "重置本章测试"
	restart.pressed.connect(reset_chapter)
	box.add_child(restart)
	var light_label := Label.new()
	light_label.text = "门区局部灯光时段（正午 → 黄昏 → 夜灯）"
	box.add_child(light_label)
	var phase := HSlider.new()
	phase.min_value = 0.5
	phase.max_value = 0.98
	phase.step = 0.01
	phase.value = 0.5
	phase.value_changed.connect(func(value: float):
		if gate_adapter and is_instance_valid(gate_adapter.candidate):
			gate_adapter.candidate.get_node("GateLighting").set_phase(value))
	box.add_child(phase)

func _index_terrace() -> void:
	walk_triangles.clear()
	for node in gate_adapter.candidate.find_children("*", "MeshInstance3D", true, false):
		if not str(node.name).ends_with("_walk"): continue
		var local: Transform3D = gate_adapter.candidate.global_transform.affine_inverse() * node.global_transform
		var faces: PackedVector3Array = node.mesh.get_faces()
		for i in range(0, faces.size(), 3):
			var triangle := PackedVector3Array([local * faces[i], local * faces[i + 1], local * faces[i + 2]])
			walk_triangles.append(triangle)

func terrace_height(point: Vector3) -> float:
	var height := -INF
	for triangle in walk_triangles:
		var hit = Geometry3D.ray_intersects_triangle(Vector3(point.x, 3.9, point.z), Vector3.DOWN, triangle[0], triangle[1], triangle[2])
		if hit != null and hit.y >= 3.0 and hit.y <= 3.4: height = maxf(height, hit.y)
	return height

func move_courier(offset: Vector3) -> bool:
	if not chapter_ready: return false
	movement_rejection = ""
	var next := courier_actor.position + offset
	# Keep the chapter fixture on the authored terrace, inside its parapets.
	if next.x < -28.6 or next.x > -17.3 or next.z < -24.0 or next.z > -16.2:
		movement_rejection = "超出台内行走边界"
		return false
	var height := terrace_height(next)
	if not is_finite(height):
		movement_rejection = "未命中实际台面三角形"
		return false
	for hero in pact_controller.meeting.get_children():
		var hero_local: Vector3 = gate_adapter.candidate.to_local(hero.global_position)
		if Vector2(next.x, next.z).distance_to(Vector2(hero_local.x, hero_local.z)) < 0.75:
			movement_rejection = "与英雄站位过近"
			return false
	next.y = height + 0.02
	courier_actor.position = next
	if offset.length_squared() > 0.000001:
		courier_actor.rotation.y = atan2(-offset.x, -offset.z)
	return true

func reset_chapter() -> void:
	if not chapter_ready: return
	courier_actor.position = SPAWN
	courier_actor.rotation = Vector3.ZERO
	if not move_courier(Vector3.ZERO):
		chapter_error = "会面台站位检测失败：%s；交付测试未启动。" % movement_rejection
		pact_controller.reset()
		chapter_ready = false
	else:
		pact_controller.begin_chapter_test(courier_actor)
		chapter_error = ""
	_refresh_chapter()

func interact_chapter() -> bool:
	if not chapter_ready: return false
	var accepted: bool = pact_controller.interact()
	_refresh_chapter()
	return accepted

func _process(delta: float) -> void:
	if not chapter_ready: return
	var side := float(Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT)) - float(Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT))
	var forward := float(Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP)) - float(Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN))
	var inv: Basis = gate_adapter.seat.global_basis.inverse()
	var direction: Vector3 = inv * (camera.global_basis.x * side - camera.global_basis.z * forward)
	direction.y = 0
	if direction.length_squared() > 0:
		move_courier(direction.normalized() * minf(delta, 0.05) * 2.2)
	_refresh_chapter()

func _refresh_chapter() -> void:
	if not chapter_status: return
	if not chapter_error.is_empty():
		chapter_status.text = chapter_error
		chapter_action.disabled = true
		return
	if not chapter_ready: return
	var distance: float = courier_actor.global_position.distance_to(pact_controller.meeting.global_position)
	if pact_controller.chapter == 1:
		chapter_status.text = "携有书店密信 · 距会面点 %.1f 米\n%s" % [distance, pact_controller.last_rejection if not pact_controller.last_rejection.is_empty() else "请走近奥德休斯与阿喀琉斯。"]
	else:
		var names := {"receiving": "接过密信", "reading": "阅读密信", "acknowledging": "点头应诺", "waiting": "盟约会面已完成"}
		chapter_status.text = "%s\n奥德休斯提议以苍鹭为饵；阿喀琉斯答应掩护。\n章节测试到此为止，未启动后续战斗或完整救援。" % names.get(pact_controller.stage, "")
	chapter_action.disabled = pact_controller.chapter != 1

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and not event.ctrl_pressed and not event.meta_pressed and event.physical_keycode == KEY_R:
		interact_chapter()
		get_viewport().set_input_as_handled()

# Normalize this imported courier to Odysseus' 1.66 m; keep Achilles' crest taller.
func _match_hero_height(actor: Node3D) -> void:
	var bounds := AABB()
	var first := true
	for child in actor.find_children("*", "MeshInstance3D", true, false):
		if not child.is_visible_in_tree(): continue
		var local_box: AABB = (actor.global_transform.affine_inverse()*child.global_transform)*child.get_aabb()
		if first: bounds=local_box; first=false
		else: bounds=bounds.merge(local_box)
	if not first and bounds.size.y>0.001: actor.scale=Vector3.ONE*(1.66/bounds.size.y)
