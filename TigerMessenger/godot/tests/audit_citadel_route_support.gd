extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    w.shell_toggle.button_pressed=false;w.stair_toggle.button_pressed=false
    if not w.assault_route.report.get("loaded",false):quit(1);return
    var body=StaticBody3D.new();body.name="CitadelSupportAuditOnly";w.add_child(body)
    var mesh_count:=0
    for mesh in w.castle_adapter.original.find_children("*","MeshInstance3D",true,false):
        if not mesh.is_visible_in_tree() or mesh.mesh==null or mesh.mesh is ImmediateMesh:continue
        # Opaque physical-looking geometry only: decorative light/translucent panes are not ground.
        var mat=mesh.get_active_material(0)
        if mat is BaseMaterial3D and mat.transparency!=BaseMaterial3D.TRANSPARENCY_DISABLED:continue
        var shape=mesh.mesh.create_trimesh_shape()
        if shape==null:continue
        var c=CollisionShape3D.new();c.shape=shape;body.add_child(c);c.global_transform=mesh.global_transform;mesh_count+=1
    await physics_frame
    await physics_frame
    var routes:Array=[w.assault_route.anchors.stairRoute]
    for row in w.assault_route.anchors.interiorFloorRoutes:routes.append(row.points)
    var samples:=0;var supported:=0;var failures:Array=[]
    var up:Vector3=w.castle_adapter.original.global_basis.y.normalized()
    for r in range(routes.size()):
        for i in range(routes[r].size()-1):
            var aa:Array=routes[r][i];var bb:Array=routes[r][i+1]
            var a:Vector3=w.assault_route.node.to_global(Vector3(aa[0],aa[1],aa[2]));var b:Vector3=w.assault_route.node.to_global(Vector3(bb[0],bb[1],bb[2]))
            var n:=maxi(1,int(ceil(a.distance_to(b)/0.25)))
            for k in range(n+1):
                var point:Vector3=a.lerp(b,float(k)/n)
                var foot:Vector3=point-up*float(w.assault_route.anchors.get("feetClearance",0.22))
                var hit:Dictionary=w.get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(foot+up*0.35,foot-up*0.5))
                samples+=1
                var ok:bool=not hit.is_empty() and absf((Vector3(hit.position)-foot).dot(up))<=0.22 and absf(Vector3(hit.normal).dot(up))>=cos(deg_to_rad(45.0))
                if ok:supported+=1
                else:failures.append({"route":r,"segment":i,"fraction":float(k)/n,"world_position":point,"reason":"no_nearby_floor" if hit.is_empty() else "floor_offset_or_slope"})
    var report={"mesh_count":mesh_count,"samples":samples,"supported":supported,"unsupported":failures.size(),"failures":failures,"support_passed":failures.is_empty(),"walkability_validated":false,"scope":"Ray support samples at 0.25m on visible opaque castle meshes; excludes body clearance, swept movement, inter-route continuity and moving stairs. Does not establish a playable siege."}
    FileAccess.open("res://../artifacts/pipeline/citadel-entry/route-support.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify({"mesh_count":mesh_count,"samples":samples,"supported":supported,"unsupported":failures.size()}))
    w.queue_free();await process_frame;quit()
