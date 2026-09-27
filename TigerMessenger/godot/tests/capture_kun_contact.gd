extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var world=load("res://scenes/saihoji_battle_world.tscn").instantiate();root.add_child(world)
    while not world.ready_for_battle and world.load_error.is_empty():await physics_frame
    world.set_physics_process(false);world.music.set_muted(true)
    if not world.load_error.is_empty():push_error(world.load_error);quit(1);return
    for control in world.find_children("*","Control",true,false):control.hide()
    var covers=JSON.parse_string(FileAccess.get_file_as_string("res://data/saihoji-kun-cover-points.json"))
    var garden:Node3D=world.target_garden.node
    var actor:Node3D=world.prefabs.spear.instantiate();world.add_child(actor)
    var ids:Dictionary={};world._candidate_index(actor,ids)
    var camera:Camera3D=world.camera;camera.current=true;camera.fov=48;camera.near=0.05
    for slot in ["pine-1247-cover-0","pine-3011-cover-15"]:
        var row:Dictionary=covers.points.filter(func(r):return r.id==slot)[0]
        var hit:Dictionary=world.target_garden.sample_support(Vector2(row.localPoint[0],row.localPoint[2]))
        var up:Vector3=hit.normal
        var forward:Vector3=garden.global_basis.z.normalized().slide(up).normalized()
        var yaw:=90.0 if slot=="pine-1247-cover-0" else 0.0
        var basis:=Basis(up.cross(forward).normalized(),up,forward)*Basis(Vector3.UP,deg_to_rad(yaw))
        actor.global_transform=Transform3D(basis,hit.position+up*float(world.foot_offsets.spear))
        var focus:Vector3=hit.position+up*0.8
        camera.global_position=focus+basis.z*2.4+basis.x*1.0+up*0.45
        camera.look_at(focus,up)
        for i in 8:await process_frame
        await RenderingServer.frame_post_draw
        var path:String="res://../artifacts/pipeline/saihoji-target-integration/contact-"+slot+".png"
        var error:int=root.get_texture().get_image().save_png(path)
        print("CONTACT_CAPTURE ",slot," ",error)
    world.queue_free();await process_frame;quit()
