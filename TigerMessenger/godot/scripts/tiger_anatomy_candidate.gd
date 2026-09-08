extends Node3D
## Same camera/scale source comparison for the user-approved swamp tiger target.
const ORIGINAL := "res://assets/originals/moebiusTiger.glb"
const CANDIDATE := "res://assets/art-pilots/moebius-tiger-anatomy-v3.glb"
var current: Node3D
var studio: Node3D
var camera: Camera3D
var viewport: SubViewport
var notice: Label
var candidate_enabled := true
var pose_mode := 0
var time := 0.0
var nodes: Dictionary = {}
var rest: Dictionary = {}
var yaw := 0.0
var dragging := false
var view_index := 0
var view_selector: OptionButton
var pivot := Vector3(0, 0.65, -0.4)
var zoom := 1.0

func _ready() -> void:
    var ui := CanvasLayer.new()
    add_child(ui)
    var margin := MarginContainer.new()
    margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    for side in ["left", "right", "top", "bottom"]: margin.add_theme_constant_override("margin_"+side, 16)
    ui.add_child(margin)
    var row := HBoxContainer.new()
    row.add_theme_constant_override("separation", 18)
    margin.add_child(row)
    var panel := VBoxContainer.new()
    panel.custom_minimum_size.x = 285
    panel.add_theme_constant_override("separation", 12)
    row.add_child(panel)
    var heading := Label.new()
    heading.text = "湖沼之虎 · 按图重塑"
    panel.add_child(heading)
    var reference := TextureRect.new()
    var img := Image.load_from_file("res://../assets/references/tiger/user-target-20260909.png")
    if img: reference.texture = ImageTexture.create_from_image(img)
    reference.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
    reference.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
    reference.custom_minimum_size = Vector2(285, 200)
    panel.add_child(reference)
    var caption := Label.new()
    caption.text = "你的目标图 · 相同镜头比较模型"
    panel.add_child(caption)
    for enabled in [false, true]:
        var button := Button.new()
        button.text = "查看优化后" if enabled else "查看原模型"
        button.pressed.connect(func(): set_candidate(enabled))
        panel.add_child(button)
    view_selector = OptionButton.new()
    for label in ["三分之四视角", "正面 · 头部与胸肩", "侧面 · 身体与尾巴", "背面 · 后肢与尾根"]: view_selector.add_item(label)
    view_selector.item_selected.connect(set_view)
    panel.add_child(view_selector)
    var poses := OptionButton.new()
    for label in ["站立", "行走挂点检查", "低头挂点检查"]: poses.add_item(label)
    poses.item_selected.connect(func(i): pose_mode=i;time=0;apply_pose(0.0))
    panel.add_child(poses)
    var back := Button.new()
    back.text = "返回资产库"
    back.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/asset_review.tscn"))
    panel.add_child(back)
    var world := Button.new()
    world.text = "原世界中的虎"
    world.pressed.connect(func(): get_tree().set_meta("focus_tiger_candidate", true);get_tree().change_scene_to_file("res://scenes/original_world.tscn"))
    panel.add_child(world)
    notice = Label.new()
    notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    notice.custom_minimum_size.x = 285
    panel.add_child(notice)
    var container := SubViewportContainer.new()
    container.stretch = true
    container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    container.size_flags_vertical = Control.SIZE_EXPAND_FILL
    container.gui_input.connect(_view_input)
    row.add_child(container)
    viewport = SubViewport.new()
    viewport.own_world_3d = true
    viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    container.add_child(viewport)
    studio = Node3D.new()
    viewport.add_child(studio)
    var env := WorldEnvironment.new()
    env.environment = Environment.new()
    env.environment.background_mode = Environment.BG_COLOR
    env.environment.background_color = Color("ded5c8")
    env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.environment.ambient_light_color = Color("dce5ee")
    env.environment.ambient_light_energy = 0.35
    studio.add_child(env)
    var sun := DirectionalLight3D.new()
    sun.rotation_degrees = Vector3(-35, -40, 0)
    sun.light_energy = 0.8
    sun.shadow_enabled = true
    studio.add_child(sun)
    var fill := DirectionalLight3D.new()
    fill.rotation_degrees = Vector3(-20, 140, 0)
    fill.light_energy = 0.2
    studio.add_child(fill)
    var floor_mesh := MeshInstance3D.new()
    var plane := PlaneMesh.new()
    plane.size = Vector2(200, 200)
    floor_mesh.mesh = plane
    var floor_mat := StandardMaterial3D.new()
    floor_mat.albedo_color = Color("958b7e")
    floor_mat.roughness = 1.0
    floor_mesh.material_override = floor_mat
    floor_mesh.position.y = -0.01
    studio.add_child(floor_mesh)
    camera = Camera3D.new()
    camera.projection = Camera3D.PROJECTION_ORTHOGONAL
    camera.size = 5.2
    camera.near = 0.02
    camera.far = 200
    camera.current = true
    studio.add_child(camera)
    set_candidate(true)
    set_view(0)

func set_candidate(enabled: bool) -> bool:
    var path := CANDIDATE if enabled else ORIGINAL
    if not ResourceLoader.exists(path):
        notice.text = "新模型正在导入；原作保持可用。"
        if current == null and enabled: set_candidate(false)
        return false
    var packed = load(path) as PackedScene
    if not packed: return false
    var next = packed.instantiate() as Node3D
    if not next: return false
    if current:
        studio.remove_child(current)
        current.free()
    current = next
    studio.add_child(current)
    if enabled: preload("res://scripts/tiger_candidate_materials.gd").adapt(current)
    nodes.clear()
    rest.clear()
    _collect(current)
    candidate_enabled = enabled
    time = 0.0
    apply_pose(0.0)
    notice.text = ("当前：Blender 重塑模型" if enabled else "当前：原模型")+"\n拖动旋转 · 滚轮缩放\n动作选项检视连接点，完整巡游与剧情仍待迁移。"
    return true

func _collect(node: Node) -> void:
    var meta: Dictionary = node.get_meta("extras", {})
    var id: String = str(meta.get("three_node_id",node.get_meta("three_node_id", "")))
    if node is Node3D and not id.is_empty():
        nodes[id] = node
        rest[id] = node.transform
    for child in node.get_children(): _collect(child)

func apply_pose(t: float) -> void:
    for id in rest:
        nodes[id].transform = rest[id]
    var phase := t*7.5
    if pose_mode == 1:
        var swing := sin(phase)*0.28
        for row in [["n52",1.0],["n59",-1.0],["n66",-0.9],["n73",0.9]]:
            if nodes.has(row[0]): nodes[row[0]].rotate_object_local(Vector3.RIGHT, swing*row[1])
    if pose_mode == 2 and nodes.has("n8"):
        var down := (1-cos(t*1.5))*0.5
        nodes.n8.rotate_object_local(Vector3.RIGHT, down*0.65)
        nodes.n8.position += Vector3(0,-0.35*down,-0.3*down)
    if pose_mode != 0:
        for i in range(8):
            var id: String = ["n28","n31","n34","n37","n40","n43","n46","n49"][i]
            if nodes.has(id): nodes[id].rotate_object_local(Vector3.FORWARD, sin(t*2-i*0.2)*0.025)

func set_view(index: int) -> void:
    view_index = index
    if view_selector: view_selector.select(index)
    yaw = [0.8, 0.0, PI/2, PI][index]
    _camera()

func _camera() -> void:
    if not camera: return
    camera.size = 5.2*zoom
    camera.position = pivot+Vector3(sin(yaw)*8, 1.7, cos(yaw)*8)
    camera.look_at(pivot)

func _process(delta: float) -> void:
    time += delta
    apply_pose(time)

func _view_input(event: InputEvent) -> void:
    if event is InputEventMouseButton:
        if event.button_index == MOUSE_BUTTON_LEFT: dragging=event.pressed
        if event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN]:
            zoom=clampf(zoom*(0.9 if event.button_index==MOUSE_BUTTON_WHEEL_UP else 1.1),0.45,2.0)
            _camera()
    if event is InputEventMouseMotion and dragging:
        yaw-=event.relative.x*0.008
        _camera()
