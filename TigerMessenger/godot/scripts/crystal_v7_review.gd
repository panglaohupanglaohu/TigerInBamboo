extends Node3D
## Local V7 art candidate made from the original live Web assets in Blender.
## This view does not claim spherical navigation or rescue-story migration.
var model: Node3D
var camera: Camera3D
var current_round := 1
var yaw := 0.30
var pitch := 0.35
var distance := 205.0
var dragging := false
var label: Label
func _ready() -> void:
	var environment := WorldEnvironment.new()
	environment.environment=Environment.new()
	environment.environment.background_mode=Environment.BG_COLOR
	environment.environment.background_color=Color("b8d5e6")
	environment.environment.ambient_light_source=Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color=Color("cde3ed")
	environment.environment.ambient_light_energy=.4
	environment.environment.tonemap_mode=Environment.TONE_MAPPER_FILMIC
	add_child(environment)
	var sun:=DirectionalLight3D.new()
	sun.rotation_degrees=Vector3(-48,-35,0);sun.light_color=Color("fff0d8");sun.light_energy=1.0
	sun.shadow_enabled=true;sun.directional_shadow_max_distance=300;add_child(sun)
	var sea:=MeshInstance3D.new();sea.name="ReviewSea"
	var plane:=PlaneMesh.new();plane.size=Vector2(2000,2000);sea.mesh=plane;sea.position.y=-.2
	var water:=StandardMaterial3D.new();water.albedo_color=Color("123e55");water.roughness=.45;water.metallic=.05
	sea.material_override=water;add_child(sea)
	camera=Camera3D.new();camera.fov=43;camera.near=.2;camera.far=1000;add_child(camera);camera.current=true
	var ui:=CanvasLayer.new();ui.name="ReviewUI";add_child(ui)
	var panel:=VBoxContainer.new();panel.position=Vector2(20,20);ui.add_child(panel)
	label=Label.new();panel.add_child(label)
	var row:=HBoxContainer.new();panel.add_child(row)
	for r in [1,2,3]:
		var button:=Button.new();button.text="第 %d 轮"%r;button.pressed.connect(func():set_round(r));row.add_child(button)
	var help:=Label.new();help.text="拖动旋转 · 滚轮缩放 · 局部美术候选，非完整关卡";panel.add_child(help)
	set_round(3 if ResourceLoader.exists("res://assets/art-pilots/crystal-v7-r03.glb") else 1)
	_update_camera()
func set_round(r:int)->void:
	if is_instance_valid(model):remove_child(model);model.queue_free()
	current_round=r
	var path:="res://assets/art-pilots/crystal-v7-r%02d.glb"%r
	if not ResourceLoader.exists(path):push_error("Missing V7 round: "+path);return
	model=load(path).instantiate();model.name="CrystalV7_Round_%d"%r;add_child(model)
	label.text="水晶城 · V7 · 第 %d 轮 / 3"%r
func _update_camera()->void:
	var target:=Vector3(0,27,0)
	camera.position=target+Vector3(sin(yaw)*cos(pitch),sin(pitch),cos(yaw)*cos(pitch))*distance
	camera.look_at(target)
func _unhandled_input(event:InputEvent)->void:
	if event is InputEventMouseButton:
		if event.button_index==MOUSE_BUTTON_LEFT:dragging=event.pressed
		if event.pressed and event.button_index==MOUSE_BUTTON_WHEEL_UP:distance=maxf(80,distance*.9)
		if event.pressed and event.button_index==MOUSE_BUTTON_WHEEL_DOWN:distance=minf(400,distance*1.1)
	if event is InputEventMouseMotion and dragging:
		yaw-=event.relative.x*.005;pitch=clampf(pitch+event.relative.y*.004,.12,1.25)
	_update_camera()
