extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var world=load("res://scenes/saihoji_battle_world.tscn").instantiate();root.add_child(world)
    while not world.ready_for_battle and world.load_error.is_empty():await physics_frame
    world.set_physics_process(false);world.music.set_muted(true)
    if not world.load_error.is_empty():push_error(world.load_error);quit(1);return
    for control in world.find_children("*","Control",true,false):control.hide()
    world.preview_kun_roll(0.0)
    var garden:Node3D=world.garden_island
    world.camera.global_position=garden.to_global(Vector3(18,24,31))
    world.camera.look_at(garden.to_global(Vector3(0,0,0)),garden.global_basis.y.normalized())
    world.camera.current=true;world.camera.fov=45
    for i in 8:await process_frame
    await RenderingServer.frame_post_draw
    var label:=OS.get_environment("KUN_SYNC_CAPTURE")
    if label.is_empty():label="after"
    var path:String="res://../artifacts/pipeline/saihoji-target-integration/layout-sync-"+label+".png"
    var error:int=root.get_texture().get_image().save_png(path)
    print("LAYOUT_SYNC_CAPTURE ",label," ",error)
    world.queue_free();await process_frame;quit(error)
