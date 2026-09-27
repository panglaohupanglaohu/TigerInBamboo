extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var world=load("res://scenes/saihoji_battle_world.tscn").instantiate();root.add_child(world)
    while not world.ready_for_battle and world.load_error.is_empty():await physics_frame
    world.set_physics_process(false);world.music.set_muted(true)
    if not world.load_error.is_empty():push_error(world.load_error);quit(1);return
    var garden=world.target_garden
    var covers=JSON.parse_string(FileAccess.get_file_as_string("res://data/saihoji-kun-cover-points.json"))
    var cover_rows:Array=[]
    for row in covers.points:
        var p:=Vector3(row.localPoint[0],row.localPoint[1],row.localPoint[2])
        var hit:Dictionary=garden.sample_support(Vector2(p.x,p.z))
        cover_rows.append({"id":row.id,"supported":not hit.is_empty(),"local_height_difference":float(hit.local_position.y)-p.y if not hit.is_empty() else null,"source_clearance":row.clearance,"extra_pool_margin_pass":not garden.sample_support(Vector2(p.x,p.z),0.38).is_empty()})
    var samples:Array=[]
    for x in range(-20,21,2):
        for z in range(-12,13,2):
            var hit:Dictionary=garden.sample_support(Vector2(x,z))
            if not hit.is_empty():samples.append(hit)
    var pools_excluded:=true
    for pool in garden.support_pools:
        pools_excluded=pools_excluded and garden.sample_support(Vector2(pool.x,pool.z)).is_empty()
    var outside_excluded:bool=garden.sample_support(Vector2(1000,1000)).is_empty()
    var max_error:=0.0
    var min_up:=1.0
    for angle in [0.0,PI/2.0,PI,PI*1.5,TAU]:
        world.preview_kun_roll(angle)
        for before in samples:
            var p:Vector3=before.local_position
            var after:Dictionary=garden.sample_support(Vector2(p.x,p.z))
            if after.is_empty():max_error=INF;continue
            var carried:Vector3=garden.carry_between_frames(before.position,before.frame)
            max_error=maxf(max_error,carried.distance_to(after.position))
            min_up=minf(min_up,Vector3(after.normal).dot(garden.node.global_basis.y.normalized()))
    world.reset_battle()
    var reset_error:=0.0
    for before in samples:
        var p:Vector3=before.local_position
        var after:Dictionary=garden.sample_support(Vector2(p.x,p.z))
        reset_error=maxf(reset_error,Vector3(after.position).distance_to(before.position))
    var result:Dictionary={"passed":cover_rows.size()==50 and cover_rows.all(func(r):return r.supported) and samples.size()>50 and pools_excluded and outside_excluded and max_error<0.0001 and reset_error<0.0001 and min_up>0.84,"cover_slots":cover_rows,"supported_cover_slots":cover_rows.filter(func(r):return r.supported).size(),"support_samples":samples.size(),"support_triangles":garden.support_faces.size()/3,"pools_excluded":pools_excluded,"outside_excluded":outside_excluded,"max_carry_error":max_error,"minimum_local_up_dot":min_up,"reset_error":reset_error,"poses":5,"scope":"real shared ground query and frame transfer; soldiers remain on shore until route migration"}
    FileAccess.open("res://../artifacts/pipeline/saihoji-target-integration/moving-support-report.json",FileAccess.WRITE).store_string(JSON.stringify(result,"  "))
    print(JSON.stringify(result));world.queue_free();await process_frame;quit(0 if result.passed else 1)
