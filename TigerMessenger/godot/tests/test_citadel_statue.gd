extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    var matches=w.castle_adapter.west_city.find_children("citadel-plaza-hero-statue","Node3D",true,false)
    if matches.size()!=1:
        push_error("Expected exactly one integrated plaza hero statue");w.free();quit(1);return
    var statue:Node3D=matches[0]
    var extras:Dictionary=statue.get_meta("extras",{})
    var source_id:String=str(extras.get("sourceId",""))
    var source_blender:String=str(extras.get("sourceBlender",""))
    var source_ok:bool=source_id=="citadel-soldier-statue-r03" and source_blender=="assets/models/optimized/citadel-statue/citadel-soldier-statue-r03.blend"
    var inverse:Transform3D=w.castle_adapter.original.global_transform.affine_inverse()
    var bounds:=AABB();var seeded:=false;var count:=0
    for mesh in statue.find_children("*","MeshInstance3D",true,false):
        if mesh.mesh==null or not mesh.is_visible_in_tree():continue
        # Vertex bounds, not transformed local AABB, for exact tilted asset geometry.
        var transform:Transform3D=inverse*mesh.global_transform
        for surface in range(mesh.mesh.get_surface_count()):
            for vertex in mesh.mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX]:
                var point:Vector3=transform*vertex
                if not seeded:bounds=AABB(point,Vector3.ZERO);seeded=true
                else:bounds=bounds.expand(point)
        count+=1
    var placement:Vector3=inverse*statue.global_position
    var dimensions_ok:bool=seeded and absf(bounds.position.y-4)<0.03 and absf(bounds.size.y-6.88*1.2)<0.03
    var position_ok:bool=absf(placement.x-8)<0.03 and absf(placement.z-71.5)<0.03
    await w._start_traversal("gladius",true)
    w.set_physics_process(false)
    var frame:Transform3D=w.castle_adapter.original.global_transform
    var hit:Dictionary=w.get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(frame*Vector3(8,4.08,71.5),frame*Vector3(8,3.7,71.5)))
    var support_local:Vector3=inverse*hit.position if not hit.is_empty() else Vector3.INF
    var ground_ok:bool=not hit.is_empty() and absf(support_local.y-bounds.position.y)<0.03
    if w.traversal!=null:
        for i in range(60*400):
            w.traversal.tick(1.0/60.0)
            if w.traversal.phase in ["arrived","blocked"]:break
    var march:Dictionary=w.traversal.evidence() if w.traversal!=null else {}
    var report={"source_id":source_id,"source_blender":source_blender,"source_verified":source_ok,"passed":source_ok and position_ok and dimensions_ok and ground_ok and march.get("phase","")=="arrived","statue_count":matches.size(),"mesh_count":count,"placement":[placement.x,placement.y,placement.z],"bounds_min":[bounds.position.x,bounds.position.y,bounds.position.z],"bounds_size":[bounds.size.x,bounds.size.y,bounds.size.z],"position_verified":position_ok,"height_and_base_verified":dimensions_ok,"plaza_support_verified":ground_ok,"support_y":support_local.y,"march":march,"scope":"Actual Godot statue geometry, plaza support ray and existing new-city march; no statue collision, full siege or visual acceptance."}
    FileAccess.open("res://../artifacts/pipeline/citadel-west-city/godot-statue.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));w._reset_traversal();w.queue_free();await process_frame
    quit(0 if report.passed else 1)
