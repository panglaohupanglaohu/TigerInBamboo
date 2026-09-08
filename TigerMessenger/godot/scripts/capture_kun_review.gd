extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
    root.size = Vector2i(1280, 850)
    var review = load("res://scenes/asset_review.tscn").instantiate()
    root.add_child(review)
    await process_frame
    review.orbiting = false
    for i in range(review.assets.size()):
        if review.assets[i].id == "leviathanIsland": review._select(i)
    if review.current == null or review.assets[review.index].label != "鲲":
        push_error("Kun review failed")
        quit(1)
        return
    review.orbit = 0.4
    review._update_camera()
    await process_frame
    await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png("res://../artifacts/pipeline/leviathan-kun-review.png")
    print("KUN_REVIEW_OK count=",review.assets.size()," nodes=",review._count(review.current))
    review.queue_free()
    await process_frame
    quit()
