extends Node3D
const CANDIDATE = "res://assets/art-pilots/scoutAircraft-art-v1.glb"
var model: Node3D
var camera: Camera3D
var hidden_outlines := 0
var glass_count := 0
var dragging := false
var runtime = preload("res://scripts/scout_runtime_adapter.gd").new()
var animation_time := 0.0

func _ready() -> void:
    var env := WorldEnvironment.new()
    env.environment = Environment.new()
    env.environment.background_mode = Environment.BG_COLOR
    env.environment.background_color = Color(0.68, 0.70, 0.71)
    env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.environment.ambient_light_color = Color(0.8, 0.85, 0.9)
    env.environment.ambient_light_energy = 0.65
    add_child(env)
    var key := DirectionalLight3D.new()
    key.rotation_degrees = Vector3(-40, -30, 0)
    key.light_color = Color(1.0, 0.94, 0.85)
    key.light_energy = 0.85
    add_child(key)
    model = load(CANDIDATE).instantiate()
    add_child(model)
    adapt(model)
    runtime.bind(model)
    runtime.configure_hover(runtime.aircraft.position, Vector3.UP)
    camera = Camera3D.new()
    camera.projection = Camera3D.PROJECTION_ORTHOGONAL
    camera.keep_aspect = Camera3D.KEEP_WIDTH
    camera.size = 9.6002
    camera.position = Vector3(9.9375, 9.55, 15.312)
    add_child(camera)
    camera.look_at(Vector3(0, 0.29, 0.6316))
    camera.current = true
    var canvas := CanvasLayer.new()
    add_child(canvas)
    var label := Label.new()
    label.position = Vector2(24, 20)
    label.add_theme_color_override("font_color", Color(0.12, 0.16, 0.2))
    label.text = "侦察机 · 原作优化候选  |  独立检视，尚未替换正式世界"
    canvas.add_child(label)
    var back := Button.new()
    back.position = Vector2(24, 54)
    back.text = "返回资产库"
    back.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/asset_review.tscn"))
    canvas.add_child(back)
    var hint := Label.new()
    hint.position = Vector2(160, 61)
    hint.text = "拖动旋转 · 滚轮缩放"
    hint.add_theme_color_override("font_color", Color(0.12, 0.16, 0.2))
    canvas.add_child(hint)

func adapt(node: Node) -> void:
    var extras: Dictionary = node.get_meta("extras", {})
    var data = JSON.parse_string(str(extras.get("three_userData", "{}")))
    if data is Dictionary and data.get("isOutline", false) and node is GeometryInstance3D:
        node.visible = false
        hidden_outlines += 1
    if node is MeshInstance3D and node.name == "triple-gate-scout-canopy":
        var glass := StandardMaterial3D.new()
        glass.albedo_color = Color(0.61, 0.84, 0.91, 0.22)
        glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
        glass.cull_mode = BaseMaterial3D.CULL_BACK
        glass.roughness = 0.14
        glass.metallic_specular = 0.65
        glass.shading_mode = BaseMaterial3D.SHADING_MODE_PER_PIXEL
        node.material_override = glass
        node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
        glass_count += 1
    for child in node.get_children(): adapt(child)

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventMouseButton:
        if event.button_index == MOUSE_BUTTON_LEFT: dragging = event.pressed
        if event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
            camera.size = clampf(camera.size * (0.9 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1.1), 3, 20)
    if event is InputEventMouseMotion and dragging:
        model.rotate_y(-event.relative.x * 0.01)

func _process(delta: float) -> void:
    animation_time += delta
    runtime.update_original(animation_time, delta)
