extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    await w._start_traversal("gladius",true)
    w.set_physics_process(false)
    var gates=w.castle_adapter.west_city.find_children("citadel-harbor-watergate","Node3D",true,false)
    if gates.size()!=1:push_error("Expected actual watergate");w.free();quit(1);return
    var gate:Node3D=gates[0]
    var physics=w.get_world_3d().direct_space_state
    var blocked:=0;var checks:=0;var walls:=0;var shape_count:=0;var obstruction_sources:Array=[]
    for x in [-1.6,-.8,0.0,.8,1.6]:
        for y in [1.0,1.8,2.6,3.3]:
            var hit=physics.intersect_ray(PhysicsRayQueryParameters3D.create(gate.to_global(Vector3(x,y,-1.2)),gate.to_global(Vector3(x,y,1.2))))
            checks+=1
            if not hit.is_empty():
                blocked+=1
                var body:CollisionObject3D=hit.collider
                var owner=body.shape_owner_get_owner(body.shape_find_owner(hit.shape))
                obstruction_sources.append({"x":x,"y":y,"source":str(owner.get_meta("source",""))})
    for x in [-3.4,3.4]:
        var hit=physics.intersect_ray(PhysicsRayQueryParameters3D.create(gate.to_global(Vector3(x,1,-2)),gate.to_global(Vector3(x,1,2))))
        if not hit.is_empty():walls+=1
    for s in w.traversal_context.body.get_children():
        if s is CollisionShape3D and str(s.get_meta("source","")).contains("harbor-watergate-perforated-wall"):shape_count+=1
    var landings=w.castle_adapter.west_city.find_children("west-city-harbor-middle-landing","MeshInstance3D",true,false)
    var support:=false
    if landings.size()==1:
        var landing:MeshInstance3D=landings[0];var box: AABB=landing.get_aabb()
        var p=landing.to_global(Vector3(0,box.end.y,0));var up=landing.global_basis.y.normalized()
        support=not physics.intersect_ray(PhysicsRayQueryParameters3D.create(p+up*.05,p-up*.05)).is_empty()
    var guards:=0
    var steps=w.castle_adapter.west_city.find_children("west-city-stair-harbor-*","MeshInstance3D",true,false)
    for z in [64.0,70.0,75.0]:
        var nearest:MeshInstance3D=null;var distance:=INF
        for step in steps:
            var d=abs(step.position.z-z)
            if d<distance:distance=d;nearest=step
        if nearest==null:continue
        var a:Vector3=nearest.to_global(Vector3(0,nearest.get_aabb().end.y+.5,0))
        for side in [-1,1]:
            var b:Vector3=a+nearest.global_basis.x.normalized()*side*2.7
            var hit=physics.intersect_ray(PhysicsRayQueryParameters3D.create(a,b))
            if not hit.is_empty():
                var body:CollisionObject3D=hit.collider
                var owner=body.shape_owner_get_owner(body.shape_find_owner(hit.shape))
                if str(owner.get_meta("source","")).contains("harbor-stair-retaining-wall"):guards+=1
    var report={"guard_hits":guards,"obstructions":obstruction_sources,"passage_checks":checks,"blocked":blocked,"side_walls_blocking":walls,"perforated_wall_shapes":shape_count,"middle_landing_supported":support,"passed":blocked==0 and walls==2 and shape_count==1 and support and guards==6,"scope":"Actual production Godot collision for watergate and middle landing; no full boarding or battle assertion"}
    var f=FileAccess.open("res://../artifacts/pipeline/citadel-harbor-watergate/godot-check.json",FileAccess.WRITE);f.store_string(JSON.stringify(report,"  "));f.close()
    print(JSON.stringify(report));w.free();quit(0 if report.passed else 1)
