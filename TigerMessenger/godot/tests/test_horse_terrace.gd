extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    await w._start_traversal("gladius",true)
    w.set_physics_process(false)
    await physics_frame
    await process_frame
    var hosts=w.castle_adapter.west_city.find_children("highland-west-city","Node3D",true,false)
    if hosts.size()!=1:w.free();quit(1);return
    var host:Node3D=hosts[0]
    var horse:Node3D=w.castle_adapter.trojan_horse
    var position:Vector3=host.to_local(horse.global_position)
    var up:Vector3=host.global_basis.y.normalized()
    var points=[Vector3(75,5.8,72.5),Vector3(75,5.8,66),Vector3(75,4.9,62.75),Vector3(75,4,60),Vector3(68,4,60),Vector3(60,4,60)]
    var supported:int=0
    for local in points:
        var point:Vector3=host.to_global(local)
        var query=PhysicsRayQueryParameters3D.create(point+up*.15,point-up*.2)
        if not host.get_world_3d().direct_space_state.intersect_ray(query).is_empty():supported+=1
    var passed:bool=position.distance_to(Vector3(75,5.8,72.5))<.01 and supported==points.size()
    var masonry=host.find_children("horse-terrace-blender-masonry","MeshInstance3D",true,false)
    var masonry_source:String=str(masonry[0].get_meta("extras",{}).get("sourceBlender","")) if masonry.size()==1 else ""
    passed=passed and masonry_source.ends_with("horse-terrace-r04.blend")
    var current_landmarks:bool=not w.landmarks.has("纳沃纳广场")
    for label in ["新城广场","木马高台","新城港口"]:
        current_landmarks=current_landmarks and is_instance_valid(w.landmarks.get(label)) and w.landmarks[label].is_visible_in_tree()
    passed=passed and current_landmarks
    var report={"current_landmarks":current_landmarks,"masonry_source":masonry_source,"masonry_instances":masonry.size(),"horse_city_position":[position.x,position.y,position.z],"physical_supports":supported,"probes":points.size(),"passed":passed,"scope":"Actual original imported horse placement and terrace/ramp physics support, not animated night raid."}
    var f=FileAccess.open("res://../artifacts/pipeline/citadel-horse-terrace/godot-check.json",FileAccess.WRITE);f.store_string(JSON.stringify(report,"  "));f.close()
    print(JSON.stringify(report));w.free();quit(0 if passed else 1)
