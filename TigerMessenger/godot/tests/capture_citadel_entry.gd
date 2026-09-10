extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1280,800)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    w.shell_toggle.button_pressed=false;w.stair_toggle.button_pressed=false
    await RenderingServer.frame_post_draw
    var out="res://../artifacts/pipeline/citadel-entry/"
    root.get_texture().get_image().save_png(out+"city-overview.png")
    w._inspect_stair_interior()
    await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png(out+"stair-interior.png")
    w.stair_toggle.button_pressed=true
    w.route_toggle.button_pressed=false
    await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png(out+"stair-continuous-candidate.png")
    w.stair_toggle.button_pressed=false
    var hidden=w._cutaway_hidden.duplicate()
    w._focus_landmark("木马")
    for item in hidden:
        if not item.visible:push_error("Tower cutaway failed to restore");quit(1);return
    await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png(out+"trojan-horse.png")
    print("Citadel: four actual scene captures; tower cutaway restored")
    w.queue_free();await process_frame;quit()
