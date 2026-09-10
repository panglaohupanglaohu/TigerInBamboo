extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1280,800)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    w.shell_toggle.button_pressed=false;w.stair_toggle.button_pressed=false
    w._focus_landmark("塔内旋梯")
    var out="res://../artifacts/pipeline/citadel-entry/"
    await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png(out+"tower-solid-before.png")
    w.stair_toggle.button_pressed=true;w.shell_toggle.button_pressed=true
    await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png(out+"tower-hollow-after.png")
    var tower:Node3D=w.landmarks["塔内旋梯"].get_parent()
    var up:Vector3=tower.global_basis.y.normalized()
    w.camera.position=tower.to_global(Vector3(0,4.35,3.4));w.camera.look_at(tower.to_global(Vector3(0,4.35,1.5)),up)
    await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png(out+"tower-entrance.png")
    w._inspect_stair_interior();w.route_toggle.button_pressed=false
    await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png(out+"tower-connected-stairs.png")
    w._restore_cutaway();w.shell_toggle.button_pressed=false;w.stair_toggle.button_pressed=false
    for row in w.shell_candidate.originals:
        if row.node.visible!=row.visible:push_error("Source visibility did not restore");quit(1);return
    print("Hollow tower: four real captures, source visibility restored")
    w.queue_free();await process_frame;quit()
