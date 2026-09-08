extends SceneTree
func _initialize() -> void:call_deferred("run")
func run() -> void:
    root.size=Vector2i(1280,800)
    var world=load("res://scenes/world_layout.tscn").instantiate()
    root.add_child(world)
    for i in range(4):await process_frame
    assert(world.points.size()==world.layout.regions.size())
    assert(world.layout.status=="candidate-not-deployed")
    for p in world.points.values():assert(absf(p.length()-1)<.00001)
    if DisplayServer.get_name()!="headless":
        for side in range(2):
            world.yaw=.7+PI*side;world._camera()
            await process_frame
            await RenderingServer.frame_post_draw
            root.get_texture().get_image().save_png(ProjectSettings.globalize_path("res://../artifacts/world-migration/layout-v2-"+str(side)+".png"))
    print("WORLD_LAYOUT_PREVIEW_OK ",world.points.size())
    world.free();quit(0)
