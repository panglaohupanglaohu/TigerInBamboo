extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
    root.size=Vector2i(1440,1000)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    w.set_process(false);w.set_physics_process(false)
    for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
    var adapter=w.front_harbor_berth_adapter
    assert(is_instance_valid(adapter.ship))
    assert(adapter.ship.is_visible_in_tree())
    adapter.set_enabled(false)
    assert(not adapter.ship.visible)
    for old in adapter.previous: assert(old.visible)
    adapter.set_enabled(true)
    for old in adapter.previous: assert(not old.visible)
    var frame:Transform3D=adapter.ship.get_parent().global_transform
    w.camera.global_position=frame*Vector3(65,16,124)
    w.camera.look_at(frame*Vector3(35,1,91),frame.basis.y.normalized());w.camera.fov=48
    w.window_lights.set_enabled(false)
    await process_frame
    await RenderingServer.frame_post_draw
    var out="res://../artifacts/pipeline/citadel-front-port-berth/"
    root.get_texture().get_image().save_png(out+"godot-resident.png")
    var report:Dictionary=adapter.report.duplicate()
    report.position=[adapter.ship.position.x,adapter.ship.position.y,adapter.ship.position.z]
    report.passed=true
    FileAccess.open(out+"godot-resident-test.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));w.queue_free();await process_frame;quit()
