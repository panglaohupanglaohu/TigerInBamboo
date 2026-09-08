extends Node3D
func _ready() -> void:
    var lab = load("res://scenes/main.tscn").instantiate()
    add_child(lab)
    var layer := CanvasLayer.new()
    layer.layer=20
    add_child(layer)
    var back := Button.new()
    back.text="镜像小岛实验空间 · 返回原作星球"
    back.position=Vector2(380,16)
    back.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/original_world.tscn"))
    layer.add_child(back)
