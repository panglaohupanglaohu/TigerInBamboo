extends Node3D
## Independent grip candidate. Pose modes are inspection fixtures, not combat AI.
@export_enum("blue", "red") var variant := "blue"
var model: Node3D
var camera: Camera3D
var runtime = preload("res://scripts/roman_grip_adapter.gd").new()
var shield_runtime = preload("res://scripts/roman_shield_adapter.gd").new()
var armor_runtime = preload("res://scripts/roman_armor_direction_adapter.gd").new()
var armor_correction_enabled := true
var shield_correction_enabled := true
var arm: Node3D
var sword: Node3D
var arm_rest: Transform3D
var sword_rest: Transform3D
var correction_enabled := true
var pose_mode := 0
var elapsed := 0.0
var dragging := false
var status: Label

func _ready() -> void:
    var env := WorldEnvironment.new()
    env.environment = Environment.new()
    env.environment.background_mode = Environment.BG_COLOR
    env.environment.background_color = Color("c8d5dc")
    env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.environment.ambient_light_color = Color.WHITE
    env.environment.ambient_light_energy = 0.7
    add_child(env)
    var sun := DirectionalLight3D.new()
    sun.rotation_degrees = Vector3(-35, -30, 0)
    sun.light_energy = 1.4
    add_child(sun)
    load_variant(variant)
    camera = Camera3D.new()
    camera.projection = Camera3D.PROJECTION_ORTHOGONAL
    camera.size = 1.6
    camera.position = Vector3(2.1, 1.4, -2.8)
    add_child(camera)
    camera.look_at(Vector3(0, 0.55, 0))
    camera.current = true
    set_view(0)
    var canvas := CanvasLayer.new()
    add_child(canvas)
    var panel := VBoxContainer.new()
    panel.position = Vector2(20, 18)
    panel.add_theme_constant_override("separation", 10)
    canvas.add_child(panel)
    var title := Label.new()
    title.text = "罗马短剑兵 · 概念图优化候选"
    title.add_theme_color_override("font_color", Color("172f3f"))
    panel.add_child(title)
    var toggle := CheckButton.new()
    toggle.name = "GripToggle"
    toggle.text = "短剑握持修正"
    toggle.add_theme_color_override("font_color", Color("172f3f"))
    toggle.add_theme_color_override("font_hover_color", Color("172f3f"))
    toggle.add_theme_color_override("font_pressed_color", Color("172f3f"))
    toggle.button_pressed = true
    toggle.toggled.connect(set_correction)
    panel.add_child(toggle)
    var shield_toggle := CheckButton.new()
    shield_toggle.name = "ShieldToggle"
    shield_toggle.text = "持盾修正 · 抬臂与背握把"
    shield_toggle.add_theme_color_override("font_color", Color("172f3f"))
    shield_toggle.add_theme_color_override("font_pressed_color", Color("172f3f"))
    shield_toggle.add_theme_color_override("font_hover_color", Color("172f3f"))
    shield_toggle.button_pressed = true
    shield_toggle.toggled.connect(set_shield_correction)
    panel.add_child(shield_toggle)
    var armor_toggle := CheckButton.new()
    armor_toggle.name = "ArmorToggle"
    armor_toggle.text = "头盔与分片裙甲"
    armor_toggle.add_theme_color_override("font_color", Color("172f3f"))
    armor_toggle.add_theme_color_override("font_pressed_color", Color("172f3f"))
    armor_toggle.add_theme_color_override("font_hover_color", Color("172f3f"))
    armor_toggle.button_pressed = true
    armor_toggle.toggled.connect(set_armor_correction)
    panel.add_child(armor_toggle)
    var compare := HBoxContainer.new()
    panel.add_child(compare)
    for enabled in [false, true]:
        var button := Button.new()
        button.text = "查看原作" if not enabled else "查看优化候选"
        button.pressed.connect(func(): set_all_corrections(enabled))
        compare.add_child(button)
    var views := OptionButton.new()
    views.name = "ViewSelector"
    views.add_item("视角：正面")
    views.add_item("视角：持盾侧")
    views.add_item("视角：背面握把")
    views.add_item("视角：持剑侧")
    views.item_selected.connect(set_view)
    panel.add_child(views)
    var colors := OptionButton.new()
    colors.add_item("蓝色羽冠")
    colors.add_item("红色羽冠")
    colors.select(0 if variant == "blue" else 1)
    colors.item_selected.connect(func(i): load_variant("blue" if i == 0 else "red"))
    panel.add_child(colors)
    var poses := OptionButton.new()
    poses.add_item("姿态检查：站立")
    poses.add_item("姿态检查：摆臂")
    poses.add_item("姿态检查：瞄准")
    poses.item_selected.connect(func(i): pose_mode = i; elapsed = 0.0; apply_pose(0.0))
    panel.add_child(poses)
    var back := Button.new()
    back.text = "返回资产库"
    back.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/asset_review.tscn"))
    panel.add_child(back)
    status = Label.new()
    status.add_theme_color_override("font_color", Color("172f3f"))
    status.text = "拖动旋转 · 滚轮缩放\n姿态检查不代表战斗动画已接入"
    panel.add_child(status)

func load_variant(value: String) -> void:
    armor_runtime.unbind()
    shield_runtime.unbind()
    runtime.unbind()
    if is_instance_valid(model):
        remove_child(model)
        model.queue_free()
    variant = value
    model = load("res://assets/supplemental/romanSoldier_gladius_%s.glb" % variant).instantiate()
    add_child(model)
    if not runtime.bind(model):
        push_error("Cannot bind original Roman grip references")
        return
    arm = runtime.arm_r
    sword = runtime.sword
    arm_rest = arm.transform
    sword_rest = sword.transform
    runtime.set_enabled(correction_enabled)
    if not shield_runtime.bind(model): push_error(shield_runtime.last_error)
    if not shield_runtime.set_enabled(shield_correction_enabled): push_error(shield_runtime.last_error)
    if not armor_runtime.bind(model): push_error(armor_runtime.last_error)
    if not armor_runtime.set_enabled(armor_correction_enabled): push_error(armor_runtime.last_error)
    apply_pose(elapsed)

func set_correction(value: bool) -> void:
    correction_enabled = value
    runtime.set_enabled(value)
    apply_pose(elapsed)

func set_shield_correction(value: bool) -> void:
    shield_correction_enabled = value
    if not shield_runtime.set_enabled(value): push_error(shield_runtime.last_error)
    apply_pose(elapsed)

func set_armor_correction(value: bool) -> void:
    armor_correction_enabled = value
    if not armor_runtime.set_enabled(value): push_error(armor_runtime.last_error)

func set_all_corrections(value: bool) -> void:
    set_correction(value)
    set_shield_correction(value)
    set_armor_correction(value)
    for toggle_name in ["GripToggle", "ShieldToggle", "ArmorToggle"]:
        var toggle = find_child(toggle_name, true, false)
        if toggle: toggle.set_pressed_no_signal(value)

func set_view(index: int) -> void:
    var selector = find_child("ViewSelector", true, false)
    if selector: selector.select(index)
    model.rotation = Vector3.ZERO
    camera.position = [Vector3(3.3, 1.1, 0.5), Vector3(2.1, 1.4, 2.8), Vector3(-2.6, 1.3, 2.0), Vector3(2.1, 1.4, -2.8)][index]
    camera.look_at(Vector3(0, 0.55, 0))

func apply_pose(time: float) -> void:
    if not is_instance_valid(arm) or not is_instance_valid(sword): return
    arm.transform = arm_rest
    sword.transform = sword_rest
    if pose_mode == 1:
        arm.rotate_z(sin(time * 1.8) * 0.55)
    elif pose_mode == 2:
        arm.rotate_z(0.35 + sin(time * 1.2) * 0.2)
        # Same +Y blade axis as the source aimCombatToolAt. Target directions
        # are explicit inspection samples; no synthetic battle loop is claimed.
        var direction := Vector3(0.8, 0.25 + sin(time) * 0.25, 0.3).normalized()
        sword.basis = Basis(Quaternion(Vector3.UP, direction)) * Basis.from_scale(sword_rest.basis.get_scale())
    runtime.update_grip()
    if shield_runtime.is_bound():
        if shield_correction_enabled:
            var swing := sin(time * 1.8) * 0.12 if pose_mode == 1 else (sin(time) * 0.1 if pose_mode == 2 else 0.0)
            shield_runtime.arm_l.transform = shield_runtime.get_guard_arm_transform(swing)
            shield_runtime.shield.basis = shield_runtime.get_guard_shield_basis()
        else:
            shield_runtime.arm_l.transform = shield_runtime.get_rest_arm_transform()
        shield_runtime.update_grip()

func _process(delta: float) -> void:
    elapsed += delta
    apply_pose(elapsed)

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventMouseButton:
        if event.button_index == MOUSE_BUTTON_LEFT: dragging = event.pressed
        if event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
            camera.size = clampf(camera.size * (0.9 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1.1), 0.7, 3.0)
    if event is InputEventMouseMotion and dragging:
        model.rotate_y(-event.relative.x * 0.01)
