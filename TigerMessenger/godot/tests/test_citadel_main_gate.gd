extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    var gates=w.castle_adapter.west_city.find_children("citadel-new-main-gate","Node3D",true,false)
    if gates.size()!=1:push_error("Expected one main gate");w.free();quit(1);return
    var gate:Node3D=gates[0]
    var hosts=w.castle_adapter.west_city.find_children("highland-west-city","Node3D",true,false)
    # Keep legacy probe coordinates in the new-city frame as its production yaw changes.
    var reference:Transform3D=hosts[0].global_transform*Transform3D(Basis.IDENTITY,Vector3(52,0,0))
    var inverse:Transform3D=reference.affine_inverse()
    var gate_position:Vector3=inverse*gate.global_position
    var hits:=0;var triangles:=0
    for mesh in gate.find_children("*","MeshInstance3D",true,false):
        if mesh.mesh==null:continue
        var transform:Transform3D=inverse*mesh.global_transform
        for surface in range(mesh.mesh.get_surface_count()):
            var arrays:Array=mesh.mesh.surface_get_arrays(surface)
            var vertices:PackedVector3Array=arrays[Mesh.ARRAY_VERTEX]
            var indices:PackedInt32Array=arrays[Mesh.ARRAY_INDEX] if arrays[Mesh.ARRAY_INDEX]!=null else PackedInt32Array()
            var length:int=vertices.size() if indices.is_empty() else indices.size()
            for i in range(0,length-2,3):
                var points:Array[Vector3]=[]
                for j in range(3):points.append(transform*vertices[indices[i+j] if not indices.is_empty() else i+j])
                triangles+=1
                for x in [7.65,8.0,8.35]:
                    for y in [16.1,16.6,17.2]:
                        if Geometry3D.segment_intersects_triangle(Vector3(x,y,15),Vector3(x,y,7),points[0],points[1],points[2])!=null:hits+=1
    await w._start_traversal("gladius",true)
    w.set_physics_process(false)
    var frame:Transform3D=reference
    var physics=w.get_world_3d().direct_space_state
    var flight_steps:=0;var flight_supported:=0;var flight_shapes:=0
    var flights=w.castle_adapter.west_city.find_children("highland-old-city-entry-flight","Node3D",true,false)
    if flights.size()==1:
        for step in flights[0].find_children("old-city-entry-step-*","MeshInstance3D",true,false):
            flight_steps+=1
            var shape:CollisionShape3D=null
            for item in w.traversal_context.body.get_children():
                if item is CollisionShape3D and str(item.get_meta("source",""))==str(step.get_path()):shape=item;break
            if shape==null:continue
            flight_shapes+=1
            var b:AABB=step.get_aabb()
            var point:Vector3=step.to_global(Vector3(b.get_center().x,b.end.y,b.get_center().z))
            var up:Vector3=step.global_basis.y.normalized()
            var hit:Dictionary=physics.intersect_ray(PhysicsRayQueryParameters3D.create(point+up*0.04,point-up*0.04))
            if not hit.is_empty() and hit.collider==w.traversal_context.body:
                var hit_shape=w.traversal_context.body.shape_owner_get_owner(w.traversal_context.body.shape_find_owner(hit.shape))
                if hit_shape==shape and hit.position.distance_to(point)<0.015:flight_supported+=1
    var court_guard_hits:=0
    for flight in [0,1]:
        var x:float=11.0 if flight==0 else 8.0
        var y:float=16.0+flight*3.15+1.575+0.3
        for side in [-1,1]:
            var hit:Dictionary=physics.intersect_ray(PhysicsRayQueryParameters3D.create(frame*Vector3(x,y,5.5),frame*Vector3(x+side*1.4,y,5.5)))
            if not hit.is_empty():
                var collider:CollisionObject3D=hit.collider
                var owner=collider.shape_owner_get_owner(collider.shape_find_owner(hit.shape))
                if str(owner.get_meta("source","")).contains("court-solid-stone"):court_guard_hits+=1
    var balcony_guard_hits:=0
    for endpoint in [Vector3(4.5,37.5,2.4),Vector3(11.5,37.5,2.4),Vector3(8,37.5,4.5)]:
        var hit:Dictionary=physics.intersect_ray(PhysicsRayQueryParameters3D.create(frame*Vector3(8,37.5,2.4),frame*endpoint))
        if not hit.is_empty():
            var collider:CollisionObject3D=hit.collider
            var owner=collider.shape_owner_get_owner(collider.shape_find_owner(hit.shape))
            if str(owner.get_meta("source","")).contains("court-solid-stone"):balcony_guard_hits+=1
    var actual_passage_hits:=0
    for x in [7.65,8.0,8.35]:
        for y in [16.1,16.6,17.2]:
            if not physics.intersect_ray(PhysicsRayQueryParameters3D.create(frame*Vector3(x,y,15),frame*Vector3(x,y,7))).is_empty():actual_passage_hits+=1
    var wall_hits:=0;var wall_sources:Array[String]=[]
    for x in [3.0,13.0]:
        var wall_hit:Dictionary=physics.intersect_ray(PhysicsRayQueryParameters3D.create(frame*Vector3(x,17,15),frame*Vector3(x,17,7)))
        if not wall_hit.is_empty():
            var body:CollisionObject3D=wall_hit.collider
            var owner=body.shape_owner_get_owner(body.shape_find_owner(wall_hit.shape))
            var source_path:String=str(owner.get_meta("source",""))
            if source_path.contains("main-gate-wall") or source_path.contains("main-gate-carved-surround"):
                wall_hits+=1;wall_sources.append(source_path)
    var harbor_meshes:=0
    var harbor_supports:=0
    for mesh in w.castle_adapter.west_city.find_children("*","MeshInstance3D",true,false):
        if not (str(mesh.name).begins_with("west-city-stair-harbor-") or str(mesh.name) in ["west-city-harbor-quay","west-city-harbor-top-landing"]):continue
        harbor_meshes+=1
        var box:AABB=mesh.get_aabb()
        var point:Vector3=mesh.to_global(Vector3(box.get_center().x,box.end.y,box.get_center().z))
        var up:Vector3=mesh.global_basis.y.normalized()
        var hit:Dictionary=physics.intersect_ray(PhysicsRayQueryParameters3D.create(point+up*0.04,point-up*0.04))
        if not hit.is_empty() and hit.collider==w.traversal_context.body:harbor_supports+=1
    var parapet_hits:=0
    for tier in [1,2]:
        for side in [-1,1]:
            var center:=Vector3(8+side*4.08,4+(tier-1)*6+6.0/11.0+0.42,48-(tier-1)*20-8.0/11.0)
            var hit:Dictionary=physics.intersect_ray(PhysicsRayQueryParameters3D.create(frame*(center-Vector3(0.6,0,0)),frame*(center+Vector3(0.6,0,0))))
            if not hit.is_empty():
                var collider:CollisionObject3D=hit.collider
                var owner=collider.shape_owner_get_owner(collider.shape_find_owner(hit.shape))
                if str(owner.get_meta("source","")).contains("processional-solid-stone"):parapet_hits+=1
    var solid_shapes:=0
    for shape in w.traversal_context.body.get_children():
        if shape is CollisionShape3D and str(shape.get_meta("source","")).contains("/main-gate-"):
            assert(shape.shape is ConcavePolygonShape3D)
            solid_shapes+=1
    if w.traversal==null:quit(1);return
    for i in range(60*maxi(400,w.traversal.route.size())):
        w.traversal.tick(1.0/60.0)
        if w.traversal.phase in ["arrived","blocked"]:break
    var report:Dictionary=w.traversal.evidence()
    report["gate_count"]=gates.size()
    report["gate_position"]=[gate_position.x,gate_position.y,gate_position.z]
    report["gate_position_frame"]="new-city authored frame translated by x=-52; follows city yaw, not castle-local"
    report["gate_triangles_checked"]=triangles
    report["passage_ray_hits"]=hits
    report["physics_passage_hits"]=actual_passage_hits
    report["physics_wall_hits"]=wall_hits
    report["gate_trimesh_shapes"]=solid_shapes
    report["wall_sources"]=wall_sources
    report["entry_flight_steps"]=flight_steps
    report["entry_flight_collision_shapes"]=flight_shapes
    report["entry_flight_supported_steps"]=flight_supported
    report["harbor_meshes"]=harbor_meshes
    report["harbor_supported_meshes"]=harbor_supports
    report["parapet_physics_hits"]=parapet_hits
    report["balcony_guard_hits"]=balcony_guard_hits
    report["court_guard_hits"]=court_guard_hits
    report["passed"]=balcony_guard_hits==3 and court_guard_hits==4 and harbor_meshes>10 and harbor_supports==harbor_meshes and parapet_hits==4 and flight_steps==28 and flight_shapes==28 and flight_supported==28 and actual_passage_hits==0 and wall_hits==2 and solid_shapes==2 and w.traversal.phase=="arrived" and hits==0 and gate_position.distance_to(Vector3(8,16,11))<0.03
    report["scope"]="Production Godot main gate wall and carved surround use exact concave mesh collision. Nine passage rays stay clear, both side walls block, and actual new-city soldier march completes; 28 old tower entry treads each have registered collision and direct physical support; not Godot night-raid task migration or a full siege."
    print(JSON.stringify(report))
    FileAccess.open("res://../artifacts/pipeline/citadel-west-city/godot-main-gate.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    w._reset_traversal();w.queue_free();await process_frame
    quit(0 if report.passed else 1)
