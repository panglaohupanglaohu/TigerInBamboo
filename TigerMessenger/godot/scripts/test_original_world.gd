extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
    root.size=Vector2i(1280,800)
    var world=load("res://scenes/original_world.tscn").instantiate()
    root.add_child(world)
    for i in range(5):await process_frame
    assert(world.manifest.radius==160)
    assert(world.model.get_child_count()>0)
    assert(world.regions.size()>=10)
    assert(world.island.position.length()>160)
    if DisplayServer.get_name()!="headless":
        await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png(ProjectSettings.globalize_path("res://../artifacts/world-migration/godot-world.png"))
        for key in ["bookshop","odysseyCitadel","moebiusSwamp"]:
            world._focus_region(world.regions.find(key))
            for i in range(4):await process_frame
            await RenderingServer.frame_post_draw
            root.get_texture().get_image().save_png(ProjectSettings.globalize_path("res://../artifacts/world-migration/godot-"+key+".png"))
    print("ORIGINAL_WORLD_OK regions=",world.regions.size()," radius=",world.manifest.radius)
    world.free();quit(0)
