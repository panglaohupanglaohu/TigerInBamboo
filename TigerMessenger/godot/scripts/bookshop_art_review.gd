extends Node3D
var model: Node3D
var original := false
var label: Label
func _ready() -> void:
    var env := WorldEnvironment.new()
    env.environment = Environment.new()
    env.environment.background_mode = Environment.BG_COLOR
    env.environment.background_color = Color(0.53, 0.68, 0.77)
    env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.environment.ambient_light_color = Color(0.72, 0.81, 0.9)
    env.environment.ambient_light_energy = 0.65
    add_child(env)
    var key := DirectionalLight3D.new()
    key.rotation_degrees = Vector3(-45,-35,0)
    key.light_color = Color(1.0,0.88,0.72)
    key.light_energy = 1.0
    key.shadow_enabled = true
    key.directional_shadow_max_distance = 60.0
    add_child(key)
    var cam := Camera3D.new()
    cam.projection = Camera3D.PROJECTION_ORTHOGONAL
    cam.keep_aspect = Camera3D.KEEP_WIDTH
    cam.size = 13.0
    cam.position = Vector3(9,10,23)
    add_child(cam)
    cam.look_at(Vector3(-0.4,3.2,0.5))
    cam.current = true
    var canvas := CanvasLayer.new()
    add_child(canvas)
    label = Label.new()
    label.position = Vector2(18,16)
    label.add_theme_color_override("font_color",Color(0.12,0.16,0.2))
    canvas.add_child(label)
    _load_model()
    if "--capture" in OS.get_cmdline_user_args():
        for i in range(5): await get_tree().process_frame
        await RenderingServer.frame_post_draw
        get_viewport().get_texture().get_image().save_png(ProjectSettings.globalize_path("res://../artifacts/bookshop-art-v1/godot-v3.png"))
        print("BOOKSHOP_ART_REVIEW_CAPTURE_OK")
        get_tree().quit()
func _unhandled_key_input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_TAB:
        original = not original
        _load_model()
func _load_model() -> void:
    if is_instance_valid(model): model.free()
    var path := "res://assets/originals/bookshop.glb" if original else "res://assets/art-pilots/bookshop-art-v3.glb"
    model = load(path).instantiate()
    add_child(model)
    label.text = ("原作档案" if original else "书店 · Blender MCP 第三轮样板") + "  |  Tab 同镜头切换  |  材质与玩法仍在适配"
