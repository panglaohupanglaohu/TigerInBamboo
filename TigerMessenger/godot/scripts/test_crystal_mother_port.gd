extends SceneTree
func _initialize() -> void:
	var port=preload("res://scripts/crystal_mother_port.gd").new()
	root.add_child(port)
	var count=port.build()
	port._physics_process(11.0)
	var rise=port.lift.position.length()
	var passed=count==22 and absf(rise-(port.high-port.low))<0.001
	print(JSON.stringify({"parts":count,"lift_rise":rise,"passed":passed,"boarding":"not implemented in Godot"}))
	port.queue_free()
	quit(0 if passed else 1)
