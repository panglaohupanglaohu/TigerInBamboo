extends SceneTree
var results: Array = []
func _initialize() -> void:
    call_deferred("_run")
func _run() -> void:
    var review = load("res://scenes/asset_review.tscn").instantiate()
    root.add_child(review)
    await process_frame
    review.set_process(false)
    var failed := false
    for i in review.assets.size():
        var row: Dictionary = review.assets[i]
        var path: String = row.get("godot", {}).get("res", "")
        if not ResourceLoader.exists(path): continue
        review._select(i)
        await process_frame
        var meshes := 0
        if review.current:
            for child in review.current.find_children("*", "MeshInstance3D", true, false):
                if child.mesh: meshes += 1
        if meshes == 0: failed = true
        results.append({"id": row.id, "meshes": meshes, "instantiated": review.current != null})
        if "--screenshots" in OS.get_cmdline_user_args() and row.get("representative", false):
            await RenderingServer.frame_post_draw
            root.get_texture().get_image().save_png(ProjectSettings.globalize_path("res://../artifacts/godot-export/" + row.id + "-godot.png"))
    var f := FileAccess.open("res://../artifacts/godot-export/godot-verification.json", FileAccess.WRITE)
    f.store_string(JSON.stringify({"tested": results.size(), "failed": failed, "results": results}, "  "))
    print("ORIGINAL_IMPORTS_TESTED ", results.size(), " FAILED ", failed)
    review.free()
    quit(1 if failed else 0)
