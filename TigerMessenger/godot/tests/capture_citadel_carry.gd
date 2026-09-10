extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1280,800)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    w._show_carry_preview()
    await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-entry/roman-carry-preview.png")
    print("Three approved family actors at the real entrance; static carry review only")
    w.queue_free();await process_frame;quit()
