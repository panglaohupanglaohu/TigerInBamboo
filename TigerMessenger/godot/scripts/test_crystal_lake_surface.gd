extends SceneTree
func _initialize() -> void:
	var model=load("res://assets/world-source/original-world-v1.glb").instantiate()
	root.add_child(model)
	var count=preload("res://scripts/crystal_lake_surface_adapter.gd").new().bind(model)
	print(JSON.stringify({"replaced_lake_layers":count,"passed":count==2}))
	model.queue_free()
	quit(0 if count==2 else 1)
