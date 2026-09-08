extends Node3D
## 原作资产检视：一次加载一项，来源和适配缺口始终可见。
## 独立 SubViewport 将模型与列表、说明分开，避免自动取景被 UI 遮挡。

const MAP_PATH := "res://assets/originals/import-map.json"
const REPORT_PATH := "res://assets/originals/export-report.json"
const MANIFEST_PAIRS := [[MAP_PATH, REPORT_PATH], ["res://assets/supplemental/import-map.json", "res://assets/supplemental/export-report.json"]]
const PARTIAL_NOTICE := "部分导入：材质 / 描边 / 动画适配未完成，当前仅供原作结构检视。"

var assets: Array = []
var export_report: Dictionary = {}
var candidates: Dictionary = {}
var current_resources: Dictionary = {}
var archive_toggle: CheckButton
var candidate_button: Button
var index := -1
var current: Node3D = null
var camera: Camera3D
var pivot: Node3D
var world_root: Node3D
var model_view: SubViewport
var view_container: SubViewportContainer
var list: ItemList
var info: RichTextLabel
var heading: Label
var empty_hint: Label
var rotate_button: Button
var orbit := 0.0
var pitch := -0.22
var orbiting := true
var dragging := false
var frame_radius := 1.0
var base_distance := 4.0
var zoom_factor := 1.0


func _ready() -> void:
	_build_ui()
	_load_manifest()
	if assets.is_empty():
		info.text = "未找到有效的原作导入清单。\n需要 res://assets/originals/import-map.json；资源导出与导入完成后点击“刷新清单”。"
		return
	_select(0)


func _load_manifest() -> void:
	candidates.clear()
	current_resources.clear()
	if FileAccess.file_exists("res://data/asset-registry.json"):
		var registry = JSON.parse_string(FileAccess.get_file_as_string("res://data/asset-registry.json"))
		if registry is Dictionary:
			for entry in registry.get("assets", []):
				current_resources[str(entry.id)] = entry.get("currentResource", {})
				var preview: String = str(entry.get("replacement", {}).get("previewScene", ""))
				if preview.begins_with("res://scenes/") and ResourceLoader.exists(preview):
					candidates[str(entry.id)] = preview
	assets.clear()
	export_report.clear()
	list.clear()
	heading.text = "原作资产 · 无有效清单"
	var seen: Dictionary = {}
	for pair in MANIFEST_PAIRS:
		if not FileAccess.file_exists(pair[0]):
			continue
		var doc: Variant = JSON.parse_string(FileAccess.get_file_as_string(pair[0]))
		if not doc is Dictionary or not doc.get("assets") is Array:
			continue
		for row in doc["assets"]:
			if not row is Dictionary:
				continue
			var asset_id: String = str(row.get("id", ""))
			if asset_id.is_empty() or seen.has(asset_id):
				continue
			seen[asset_id] = pair[0]
			assets.append(row)
		if FileAccess.file_exists(pair[1]):
			var rep: Variant = JSON.parse_string(FileAccess.get_file_as_string(pair[1]))
			if rep is Dictionary and rep.get("results") is Array:
				for row in rep["results"]:
					if row is Dictionary and seen.get(str(row.get("id", "")), "") == pair[0]:
						export_report[str(row.get("id", ""))] = row
	for a in assets:
		var id: String = str(a.get("id", "?"))
		var status: String = str(export_report.get(id, {}).get("status", ""))
		var mark: String = {"ok": "●", "partial": "◐", "failed": "✗"}.get(status, "○")
		list.add_item("%s  %s" % [mark, a.get("label", id)])
		list.set_item_tooltip(list.item_count - 1, "%s · %s" % [id, status if status else "尚无导出记录"])
	heading.text = "原作资产 · %d 项" % assets.size()


func _build_ui() -> void:
	var ui := CanvasLayer.new()
	add_child(ui)
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "top", "right", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 12)
	ui.add_child(margin)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	margin.add_child(row)
	var sidebar := VBoxContainer.new()
	sidebar.custom_minimum_size.x = 255
	row.add_child(sidebar)
	heading = Label.new()
	heading.text = "原作资产"
	sidebar.add_child(heading)
	list = ItemList.new()
	list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	list.item_selected.connect(_select)
	sidebar.add_child(list)
	var legend := Label.new()
	legend.text = "◐ 部分适配  ○ 未导出  ✗ 失败\n● 导出完成，仍需游戏验收"
	legend.add_theme_font_size_override("font_size", 13)
	sidebar.add_child(legend)
	archive_toggle = CheckButton.new()
	archive_toggle.text = "查看原始归档（优化前）"
	archive_toggle.toggled.connect(func(_enabled: bool):
		if index >= 0: _select(index)
	)
	sidebar.add_child(archive_toggle)
	candidate_button = Button.new()
	candidate_button.text = "查看优化候选 · 尚未替换原作"
	candidate_button.disabled = true
	candidate_button.pressed.connect(func():
		if index >= 0 and index < assets.size():
			var preview: String = str(candidates.get(str(assets[index].get("id", "")), ""))
			if not preview.is_empty(): get_tree().change_scene_to_file(preview)
	)
	sidebar.add_child(candidate_button)
	var back := Button.new()
	back.text = "返回原作星球"
	back.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/original_world.tscn"))
	sidebar.add_child(back)
	var refresh := Button.new()
	refresh.text = "刷新清单"
	refresh.pressed.connect(_refresh)
	sidebar.add_child(refresh)

	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(right)
	var toolbar := HBoxContainer.new()
	right.add_child(toolbar)
	rotate_button = Button.new()
	rotate_button.text = "暂停旋转"
	rotate_button.pressed.connect(_toggle_rotation)
	toolbar.add_child(rotate_button)
	var reset := Button.new()
	reset.text = "重置视角"
	reset.pressed.connect(_reset_view)
	toolbar.add_child(reset)
	var help := Label.new()
	help.text = "拖动旋转 · 滚轮缩放 · 空格暂停 · R 重置"
	help.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	help.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	help.add_theme_font_size_override("font_size", 13)
	toolbar.add_child(help)

	var view_stack := Control.new()
	view_stack.custom_minimum_size = Vector2(220, 180)
	view_stack.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_child(view_stack)
	view_container = SubViewportContainer.new()
	view_container.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	view_container.stretch = true
	view_container.focus_mode = Control.FOCUS_ALL
	view_container.gui_input.connect(_view_input)
	view_stack.add_child(view_container)
	model_view = SubViewport.new()
	model_view.own_world_3d = true
	model_view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	view_container.add_child(model_view)
	model_view.size_changed.connect(_fit_distance)
	world_root = Node3D.new()
	model_view.add_child(world_root)
	pivot = Node3D.new()
	world_root.add_child(pivot)
	camera = Camera3D.new()
	camera.current = true
	camera.keep_aspect = Camera3D.KEEP_HEIGHT
	pivot.add_child(camera)

	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-40, 35, 0)
	key.light_energy = 1.1
	world_root.add_child(key)
	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-15, -130, 0)
	fill.light_energy = 0.45
	world_root.add_child(fill)
	var env := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color(0.09, 0.11, 0.14)
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.35, 0.40, 0.46)
	environment.ambient_light_energy = 0.8
	env.environment = environment
	world_root.add_child(env)
	empty_hint = Label.new()
	empty_hint.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	empty_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	empty_hint.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	empty_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	empty_hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	empty_hint.text = "请选择原作资产"
	view_stack.add_child(empty_hint)

	info = RichTextLabel.new()
	info.bbcode_enabled = false # 来源与报告按纯文本显示，不解释其中的标记。
	info.custom_minimum_size.y = 190
	info.scroll_active = true
	info.selection_enabled = true
	info.add_theme_font_size_override("normal_font_size", 14)
	right.add_child(info)


func _refresh() -> void:
	var selected_id: String = str(assets[index].get("id", "")) if index >= 0 and index < assets.size() else ""
	_load_manifest()
	if assets.is_empty():
		_release_current()
		index = -1
		info.text = "原作导入清单不可用；请核对资源目录。"
		empty_hint.text = "暂无可用清单"
		empty_hint.show()
		return
	var next_index := 0
	for i in range(assets.size()):
		if str(assets[i].get("id", "")) == selected_id:
			next_index = i
			break
	_select(next_index)


func _release_current() -> void:
	if is_instance_valid(current):
		# 先移除旧节点再加载下一项；不让大场景多占一帧内存。
		current.get_parent().remove_child(current)
		current.free()
	current = null
	dragging = false


func _select(i: int) -> void:
	if i < 0 or i >= assets.size():
		return
	index = i
	list.select(i)
	list.ensure_current_is_visible()
	_release_current()
	var a: Dictionary = assets[i]
	var id: String = str(a.get("id", "?"))
	candidate_button.disabled = not candidates.has(id)
	var res_path: String = str(a.get("godot", {}).get("res", ""))
	var archived: bool = archive_toggle.button_pressed
	var selected_resource: Dictionary = current_resources.get(id, {})
	if not archived:
		res_path = str(selected_resource.get("res", res_path))
	var lines: Array[String] = ["%s  ·  %s" % [a.get("label", id), id]]
	lines.append("显示：原始归档（优化前）" if archived else "显示：当前注册版本 · " + str(selected_resource.get("revision", "original-archive")))
	var rep: Dictionary = export_report.get(id, {})
	var status: String = str(rep.get("status", ""))
	# 即使 lost 数组为空，partial 也不能显示成完成。
	lines.append(PARTIAL_NOTICE if status == "partial" else "原作导入检视；模型显示不代表材质、动画、碰撞或玩法迁移完成。")
	lines.append("来源：%s" % a.get("exportSource", {}).get("path", "?"))
	lines.append("资源：%s" % res_path)
	if not (res_path.begins_with("res://assets/originals/") or res_path.begins_with("res://assets/supplemental/") or res_path.begins_with("res://assets/art-pilots/")):
		lines.append("资源路径不在原作目录，未加载。")
	elif ResourceLoader.exists(res_path):
		var resource: Resource = ResourceLoader.load(res_path, "PackedScene", ResourceLoader.CACHE_MODE_IGNORE)
		if resource is PackedScene:
			var instance: Node = resource.instantiate()
			if instance is Node3D:
				current = instance
				world_root.add_child(current)
				if id == "bookshop" and res_path == "res://assets/art-pilots/bookshop-art-v3.glb":
					load("res://scripts/bookshop_ink.gd").attach(current)
					load("res://scripts/bookshop_materials.gd").set_enabled(current)
				_reset_view()
				var scale_info: Dictionary = a.get("scale", {})
				lines.append("原作规模：节点 %s · 网格 %s · 顶点 %s" % [scale_info.get("nodes", "?"), scale_info.get("meshDatablocks", "?"), scale_info.get("verticesIncludingOutline", "?")])
				lines.append("当前场景节点：%d" % _count(current))
			else:
				instance.free()
				lines.append("加载失败：根节点不是三维场景。")
		else:
			lines.append("资源存在但无法加载为三维场景。")
	else:
		lines.append("尚未导出或尚未由 Godot 导入；完成后刷新清单。")
	if not status.is_empty():
		lines.append("导出状态：%s" % status)
	for loss in rep.get("lost", []):
		lines.append("缺失：%s" % str(loss))
	if rep.has("reason"):
		lines.append("原因：%s" % str(rep["reason"]).left(400))
	for gap in a.get("knownGaps", []):
		lines.append("已知缺口：%s" % str(gap))
	info.text = "\n".join(lines)
	info.scroll_to_line(0)
	empty_hint.visible = current == null
	empty_hint.text = "%s\n此项暂无可显示的原作资源，详细原因见下方。" % a.get("label", id)


func _count(node: Node) -> int:
	var result := 1
	for child in node.get_children():
		result += _count(child)
	return result


func _frame(node: Node3D) -> void:
	var bounds := _aabb(node)
	if bounds.size.length() <= 0.0001:
		bounds = AABB(Vector3(-0.5, -0.5, -0.5), Vector3.ONE)
	pivot.global_position = bounds.get_center()
	frame_radius = maxf(bounds.size.length() * 0.5, 0.05)
	_fit_distance()


func _fit_distance() -> void:
	if camera == null or model_view == null:
		return
	var aspect := maxf(float(model_view.size.x) / maxf(float(model_view.size.y), 1.0), 0.1)
	var vertical_half := deg_to_rad(camera.fov) * 0.5
	var horizontal_half := atan(tan(vertical_half) * aspect)
	base_distance = frame_radius / maxf(sin(minf(vertical_half, horizontal_half)), 0.01) * 1.15
	_update_camera()


func _update_camera() -> void:
	pivot.rotation = Vector3(pitch, orbit, 0)
	var distance := base_distance * zoom_factor
	camera.position = Vector3(0, 0, distance)
	camera.rotation = Vector3.ZERO
	camera.near = maxf(frame_radius * 0.0001, 0.001)
	camera.far = maxf(distance + frame_radius * 5.0, 10.0)


func _reset_view() -> void:
	orbit = 0.0
	pitch = -0.22
	zoom_factor = 1.0
	if current != null:
		_frame(current)


func _aabb(node: Node) -> AABB:
	var bounds := AABB()
	var seeded := false
	for mesh in _meshes(node):
		if not mesh.is_visible_in_tree():
			continue
		var transformed: AABB = mesh.global_transform * mesh.get_aabb()
		bounds = bounds.merge(transformed) if seeded else transformed
		seeded = true
	return bounds


func _meshes(node: Node) -> Array[VisualInstance3D]:
	var result: Array[VisualInstance3D] = []
	if node is VisualInstance3D:
		result.append(node)
	for child in node.get_children():
		result.append_array(_meshes(child))
	return result


func _toggle_rotation() -> void:
	orbiting = not orbiting
	rotate_button.text = "暂停旋转" if orbiting else "继续旋转"


func _process(delta: float) -> void:
	if orbiting and not dragging and current != null:
		orbit = wrapf(orbit + delta * 0.35, -PI, PI)
		_update_camera()


func _view_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT:
			dragging = event.pressed
			if event.pressed:
				view_container.grab_focus()
			if event.double_click:
				_reset_view()
		elif event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
			var factor := 0.86 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0 / 0.86
			zoom_factor = clampf(zoom_factor * factor, 0.15, 12.0)
			_update_camera()
		view_container.accept_event()
	elif event is InputEventMouseMotion and dragging:
		orbit -= event.relative.x * 0.008
		pitch = clampf(pitch - event.relative.y * 0.008, -1.45, 1.45)
		_update_camera()
		view_container.accept_event()


func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and not event.pressed:
		dragging = false


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		dragging = false


func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_SPACE:
				_toggle_rotation()
			KEY_R:
				_reset_view()
			KEY_RIGHT, KEY_DOWN:
				_select(mini(index + 1, assets.size() - 1))
			KEY_LEFT, KEY_UP:
				_select(maxi(index - 1, 0))
