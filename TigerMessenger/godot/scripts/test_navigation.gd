extends CanvasLayer
## One runtime, one region instance. Free the previous world before loading another.
const HOME = "res://scenes/test_hub.tscn"
var busy := false
var back: Button
var message: Label
func _ready() -> void:
    layer = 100
    back = Button.new()
    back.text = "返回测试大厅"
    add_child(back)
    back.pressed.connect(go.bind(HOME))
    message = Label.new()
    message.position = Vector2(24, 24)
    add_child(message)
    get_viewport().size_changed.connect(_place)
    _place()
func _place() -> void:
    back.position = Vector2(maxf(8, get_viewport().get_visible_rect().size.x - 170), get_viewport().get_visible_rect().size.y - 46)
    back.size = Vector2(154, 34)
func _process(_dt: float) -> void:
    var current = get_tree().current_scene
    back.visible = not busy and current != null and current.scene_file_path != HOME
func go(path: String) -> void:
    if busy: return
    if not ResourceLoader.exists(path):
        message.text = "场景文件缺失：" + path
        return
    busy = true
    _switch.call_deferred(path)
func _switch(path: String) -> void:
    message.text = "正在切换场景，请稍候…"
    var old = get_tree().current_scene
    get_tree().current_scene = null
    if is_instance_valid(old):
        get_tree().root.remove_child(old)
        old.queue_free()
    await get_tree().process_frame
    await get_tree().process_frame
    var packed = load(path) as PackedScene
    if packed == null:
        message.text = "场景加载失败，请返回测试大厅"
        packed = load(HOME) as PackedScene
    var next = packed.instantiate()
    get_tree().root.add_child(next)
    get_tree().current_scene = next
    message.text = ""
    busy = false
