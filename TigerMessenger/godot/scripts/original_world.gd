extends Node3D
## Original assembled world overview. Source geometry/layout, native behaviors pending.
var camera: Camera3D
var model: Node3D
var manifest: Dictionary
var center := Vector3.ZERO
var up := Vector3.UP
var distance := 520.0
var yaw := 0.0
var pitch := 0.3
var dragging := false
var status: Label
var island: Node3D
var region_list: ItemList
var regions: Array = []
@export var scout_candidate_preview := true
var scout_deployments: Array = []
var scout_deployment_error := ""
var scout_preview_toggle: CheckButton
var tiger_adapter = preload("res://scripts/tiger_world_adapter.gd").new()
var tiger_toggle: CheckButton
var bookshop_adapter = preload("res://scripts/bookshop_world_adapter.gd").new()
var castle_adapter = preload("res://scripts/castle_world_adapter.gd").new()
var castle_toggle: CheckButton


func _ready() -> void:
	manifest = JSON.parse_string(FileAccess.get_file_as_string("res://data/original-world-manifest.json"))
	model = load("res://assets/world-source/original-world-v1.glb").instantiate()
	model.name = "Original_Web_World_R160"
	add_child(model)
	# These source meshes depend on screen-space/landmask shaders. A raw
	# opaque GLB surface would obscure the original terrain and architecture.
	for node in model.find_children("*", "MeshInstance3D", true, false):
		if str(node.name).contains("cloud-impostors") or str(node.name).begins_with("backlit-highlight-") or str(node.name)=="planet-v8-curved-ocean":
			node.visible=false
		for surface in node.mesh.get_surface_count():
			var arrays: Array = node.mesh.surface_get_arrays(surface)
			if arrays[Mesh.ARRAY_COLOR] != null and arrays[Mesh.ARRAY_COLOR].size()>0:
				var material = node.get_active_material(surface)
				if material is StandardMaterial3D:
					var adapted = material.duplicate()
					adapted.vertex_color_use_as_albedo=true
					adapted.vertex_color_is_srgb=false
					node.set_surface_override_material(surface,adapted)
	set_scout_candidate_preview(scout_candidate_preview)
	if tiger_adapter.bind(model): tiger_adapter.set_enabled(true)
	if bookshop_adapter.bind(model): bookshop_adapter.set_enabled(true)
	if castle_adapter.bind(model): castle_adapter.set_enabled(true)
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color("b9cfda")
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color("d4e2e8")
	environment.environment.ambient_light_energy = .7
	add_child(environment)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-45,-30,0)
	sun.light_color = Color("fff1d8")
	sun.light_energy = 1.1
	add_child(sun)
	camera = Camera3D.new()
	camera.near = .2
	camera.far = 2500
	camera.fov = 52
	add_child(camera)
	camera.current = true
	_mirror_island()
	_ui()
	_camera()
	if get_tree().get_meta("focus_tiger_candidate", false):
		get_tree().remove_meta("focus_tiger_candidate")
		focus_tiger()

func _ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var box := VBoxContainer.new()
	box.position = Vector2(16,16)
	box.custom_minimum_size = Vector2(280,0)
	layer.add_child(box)
	var title := Label.new()
	title.text = "TigerMessenger · 原作世界全局
半径 160 · 原 Web 实际布局"
	title.add_theme_color_override("font_color",Color("172c36"))
	box.add_child(title)
	var all := Button.new()
	all.text = "查看整颗星球"
	all.pressed.connect(func(): center=Vector3.ZERO;up=Vector3.UP;distance=520;pitch=.3;_camera())
	box.add_child(all)
	region_list = ItemList.new()
	region_list.custom_minimum_size = Vector2(280,145)
	box.add_child(region_list)
	var names := {"bookshop":"书店镇", "odysseyCitadel":"圣城古堡", "canalJunctionCitadel":"运河古堡", "harbor":"旧港", "moebius":"莫比斯水晶城", "moebiusSwamp":"莫比斯湖沼", "mossSaihoji":"苔庭", "abandonedGate":"叹息之门", "tripleGateScoutAircraft":"侦察机队", "aircraftSquad":"莫比斯主舰队", "airship":"航空艇", "gatePods":"门区泡机"}
	for key in names:
		if manifest.landmarks.has(key):
			regions.append(key)
			region_list.add_item(names[key])
	region_list.item_selected.connect(_focus_region)
	var scouts := CheckButton.new()
	scout_preview_toggle = scouts
	scouts.text = "侦察机候选 · 原位静态部署"
	scouts.button_pressed = scout_candidate_preview
	scouts.toggled.connect(set_scout_candidate_preview)
	box.add_child(scouts)
	var scout_focus := Button.new()
	scout_focus.text = "近看侦察机 · 原作位置"
	scout_focus.pressed.connect(func():
		if scout_deployments.size()==5:
			var craft: Node3D=scout_deployments[3].original
			center=craft.global_position;up=craft.global_basis.y.normalized();distance=13;pitch=.35;yaw=1.1;_camera()
			status.text="防卫队侦察机 · 原作快照位置\n可切换原版/候选；编队与驾驶尚未迁移"
	)
	box.add_child(scout_focus)
	tiger_toggle = CheckButton.new()
	tiger_toggle.text = "湖沼之虎 · 按图重塑"
	tiger_toggle.button_pressed = tiger_adapter.enabled
	tiger_toggle.toggled.connect(func(value):
		if not tiger_adapter.set_enabled(value):
			tiger_toggle.set_pressed_no_signal(tiger_adapter.enabled)
			status.text=tiger_adapter.last_error
	)
	box.add_child(tiger_toggle)
	var tiger_focus := Button.new()
	tiger_focus.text = "近看湖沼之虎 · 原作位置"
	tiger_focus.pressed.connect(focus_tiger)
	box.add_child(tiger_focus)
	castle_toggle = CheckButton.new()
	castle_toggle.text = "圣城 · 共享边 WFC 城镇"
	castle_toggle.button_pressed = castle_adapter.enabled
	castle_toggle.toggled.connect(func(value):
		if not castle_adapter.set_enabled(value): castle_toggle.set_pressed_no_signal(castle_adapter.enabled)
	)
	box.add_child(castle_toggle)
	var layout := Button.new()
	layout.text = "360° 全球布局方案 · 对照原作"
	layout.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/world_layout.tscn"))
	box.add_child(layout)
	var assets := Button.new()
	var registry = JSON.parse_string(FileAccess.get_file_as_string("res://data/asset-registry.json"))
	assets.text = "统一资产库 · %d 条目 / 变体" % registry.get("assets", []).size()
	assets.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/asset_review.tscn"))
	box.add_child(assets)
	var saihoji_battle := Button.new()
	saihoji_battle.text = "进入苔庭之战 · 原作战场"
	saihoji_battle.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/saihoji_battle_world.tscn"))
	box.add_child(saihoji_battle)
	var mirror := Button.new()
	mirror.text = "查看镜像小岛 · 实验区"
	mirror.pressed.connect(func(): center=island.position;up=center.normalized();distance=42;pitch=.4;_camera())
	box.add_child(mirror)
	var enter := Button.new()
	enter.text = "进入镜像小岛实验关卡"
	enter.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/mirror_island_lab.tscn"))
	box.add_child(enter)
	status = Label.new()
	status.text = "拖动旋转 · 滚轮缩放
当前：原作静态部署核对
动画、战争、交通与主线迁移中"
	status.add_theme_color_override("font_color",Color("172c36"))
	box.add_child(status)

func focus_tiger() -> void:
	if not tiger_adapter.original: return
	center=tiger_adapter.focus_position()
	up=tiger_adapter.original.global_basis.y.normalized()
	distance=4.2
	pitch=0.18
	yaw=0.8
	_camera()
	status.text="湖沼之虎 · 原作湖沼位置\n可切换模型；当前核对造型与放置"

func _mirror_island() -> void:
	# Choose the most separated direction from actual named region centres.
	var best := Vector3(0,-1,0)
	var best_score := -1.0
	for i in range(120):
		var y := 1.0-2.0*(i+.5)/120.0
		var a := i*2.39996323
		var d := Vector3(sqrt(1-y*y)*cos(a),y,sqrt(1-y*y)*sin(a))
		var score := 2.0
		for row in manifest.landmarks.values():
			var pos := Vector3(row.center[0],row.center[1],row.center[2])
			if pos.length() > 100: score=minf(score,1-d.dot(pos.normalized()))
		if score > best_score: best_score=score;best=d
	island=Node3D.new()
	island.name="Mirror_Island_Experimental"
	island.position=best*163.0
	add_child(island)
	var z := Vector3.FORWARD.slide(best).normalized()
	if z.length()<.1:z=Vector3.RIGHT.slide(best).normalized()
	island.basis=Basis(z.cross(best),best,-z).orthonormalized()
	var ground:=MeshInstance3D.new()
	var disk:=CylinderMesh.new()
	disk.top_radius=10;disk.bottom_radius=7;disk.height=3;disk.radial_segments=16
	ground.mesh=disk
	var mat:=StandardMaterial3D.new();mat.albedo_color=Color("668469")
	ground.material_override=mat;island.add_child(ground)
	for i in range(3):
		var house=load("res://assets/house.glb").instantiate()
		house.position=Vector3((i-1)*4,1.5,0)
		island.add_child(house)
	var label:=Label3D.new();label.text="镜像小岛 · 实验区";label.position=Vector3(0,5,0);label.font_size=64;label.pixel_size=.035
	island.add_child(label)

func _focus_region(index: int) -> void:
	var row:Dictionary=manifest.landmarks[regions[index]]
	center=Vector3(row.center[0],row.center[1],row.center[2])
	up=center.normalized() if center.length()>10 else Vector3.UP
	var size=Vector3(row.size[0],row.size[1],row.size[2]).length()
	distance=clampf(size*.65,22,220)
	pitch=.35
	_camera()
	status.text="%s · 原作实际部署
静态结构可检视；原行为迁移中" % region_list.get_item_text(index)

func _camera() -> void:
	var forward:=Vector3.FORWARD.slide(up).normalized()
	if forward.length()<.1:forward=Vector3.RIGHT.slide(up).normalized()
	var right:=forward.cross(up).normalized()
	camera.position=center+distance*((forward*cos(yaw)+right*sin(yaw))*cos(pitch)+up*sin(pitch))
	camera.look_at(center,up)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index==MOUSE_BUTTON_LEFT:dragging=event.pressed
		if event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN]:
			distance=clampf(distance*(.88 if event.button_index==MOUSE_BUTTON_WHEEL_UP else 1.12),4,1000);_camera()
	if event is InputEventMouseMotion and dragging:
		yaw-=event.relative.x*.008;pitch=clampf(pitch+event.relative.y*.006,-1.3,1.3);_camera()

# The old landmark is a FIVE-member defense squad, never a mounted single scout.
# Source: messengerIsland.js:381-402 and scoutDefense.js:605-613.
func _collect_scout_sources(node: Node, found: Dictionary) -> void:
	var extras: Dictionary = node.get_meta("extras", {})
	var key: String = str(extras.get("sourcePath", ""))
	if key.begins_with("crystal-scout-defense-squad["):
		if found.has(key): scout_deployment_error = "Duplicate original scout identity: " + key
		found[key] = node
	for child in node.get_children(): _collect_scout_sources(child, found)

func set_scout_candidate_preview(enabled: bool) -> void:
	if enabled and scout_deployments.is_empty():
		scout_deployment_error = ""
		var placement: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/scout-placement-audit.json"))
		var found: Dictionary = {}
		_collect_scout_sources(model, found)
		var pending: Array = []
		var material_adapter = preload("res://scripts/scout_candidate.gd").new()
		for row in placement.instances:
			var original: Node3D = found.get(row.sourcePath)
			var parent: Node3D = found.get(row.parentSourcePath)
			if not original or not parent or original.get_parent() != parent:
				scout_deployment_error = "Missing exact original scout/parent identity: " + row.id
				break
			var candidate: Node3D = load("res://assets/art-pilots/scoutAircraft-art-v1.glb").instantiate()
			material_adapter.adapt(candidate)
			var adapter = preload("res://scripts/scout_runtime_adapter.gd").new()
			adapter.bind(candidate)
			if not adapter.aircraft or adapter.nodes.size() != 46:
				scout_deployment_error = "Candidate node contract mismatch"
				candidate.free()
				break
			# Archived n0 has factory scale=1; source sibling transform supplies .72.
			# No configure_hover: defense instances lack basePosition/up in Web.
			candidate.transform = original.transform
			candidate.name = "Scout_Candidate_" + str(row.id).replace(":", "_")
			pending.append({"id":row.id,"original":original,"candidate":candidate,"adapter":adapter,"original_visible":original.visible})
		material_adapter.free()
		if not scout_deployment_error.is_empty() or pending.size()!=5:
			for entry in pending: entry.candidate.free()
			scout_candidate_preview = false
			push_error("Scout deployment kept originals: " + scout_deployment_error)
			return
		# Commit only after every source and candidate validates. Never hide the squad.
		for entry in pending:
			entry.original.get_parent().add_child(entry.candidate)
			entry.adapter.update_defense_light(0.0)
		scout_deployments = pending
	for entry in scout_deployments:
		entry.original.visible = false if enabled else entry.original_visible
		entry.candidate.visible = enabled
	scout_candidate_preview = enabled
	if scout_preview_toggle: scout_preview_toggle.set_pressed_no_signal(enabled)
