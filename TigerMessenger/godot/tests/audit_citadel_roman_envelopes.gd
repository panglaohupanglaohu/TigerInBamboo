extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var c=w.stair_candidate;c.set_enabled(true)
    w._set_shell(true)
    var body=StaticBody3D.new();w.add_child(body)
    for mesh in c.root.get_children():
        var shape=CollisionShape3D.new();shape.shape=mesh.mesh.create_trimesh_shape();body.add_child(shape);shape.global_transform=mesh.global_transform;shape.set_meta("source",str(mesh.get_path()))
    # Audit remaining visible source tower surfaces as well as the new wall boxes.
    var tower:Node3D=w.castle_adapter.original
    for mesh in tower.find_children("*","MeshInstance3D",true,false):
        if not mesh.is_visible_in_tree() or c.root.is_ancestor_of(mesh) or w.shell_candidate.root.is_ancestor_of(mesh):continue
        if mesh.mesh==null or mesh.mesh is ImmediateMesh:continue
        var mat=mesh.get_active_material(0)
        if mat is BaseMaterial3D and mat.transparency!=BaseMaterial3D.TRANSPARENCY_DISABLED:continue
        var shape=CollisionShape3D.new();shape.shape=mesh.mesh.create_trimesh_shape();body.add_child(shape);shape.global_transform=mesh.global_transform;shape.set_meta("source",str(mesh.get_path()))
    await physics_frame;await physics_frame
    var space=w.get_world_3d().direct_space_state
    var up:Vector3=c.root.global_basis.y.normalized()
    var results:Dictionary={}
    for role in ["gladius","spear","longbow"]:
        var path="res://assets/roman-family-v1/romanSoldier_%s_blue"%role
        var actor=load(path+".glb").instantiate();w.add_child(actor)
        var pose=load("res://scripts/roman_carry_pose.gd").new()
        if not pose.bind(actor,role,JSON.parse_string(FileAccess.get_file_as_string(path+".assembly.json"))):quit(1);return
        pose.set_enabled(true)
        var vertices=PackedVector3Array();var lowest:=INF;var pieces:Array=[]
        for mesh in actor.find_children("*","MeshInstance3D",true,false):
            if not mesh.is_visible_in_tree():continue
            var transform:Transform3D=actor.global_transform.affine_inverse()*mesh.global_transform
            var piece_points=PackedVector3Array()
            for surface in range(mesh.mesh.get_surface_count()):
                var positions:PackedVector3Array=mesh.mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX]
                for position in positions:
                    var point:Vector3=transform*position;vertices.append(point);piece_points.append(point);lowest=minf(lowest,point.y)
            if piece_points.size()>=4:
                var piece=ConvexPolygonShape3D.new();piece.points=piece_points;pieces.append({"shape":piece,"name":str(mesh.name)})
        var shape=ConvexPolygonShape3D.new();shape.points=vertices
        var failures:Array=[];var samples:=0;var broadphase_only:=0
        for i in range(c.route.size()-1):
            var a:Vector3=c.root.to_global(c.route[i]);var b:Vector3=c.root.to_global(c.route[i+1])
            var tangent:Vector3=(b-a).slide(up).normalized()
            if tangent.length()<0.5:continue
            var facing:=Basis(tangent,up,tangent.cross(up)).orthonormalized()
            var n:=maxi(1,int(ceil(a.distance_to(b)/0.05)))
            for k in range(n+1):
                samples+=1
                var foot:Vector3=a.lerp(b,float(k)/n)
                var hit=space.intersect_ray(PhysicsRayQueryParameters3D.create(foot+up*0.16,foot-up*0.2))
                if hit.is_empty():failures.append({"segment":i,"reason":"unsupported"});continue
                var query=PhysicsShapeQueryParameters3D.new();query.shape=shape;query.transform=Transform3D(facing,Vector3(hit.position)+up*(-lowest+0.015))
                if not space.intersect_shape(query,1).is_empty():
                    query.transform.origin+=up*0.14
                    var contacts=space.intersect_shape(query,1)
                    if not contacts.is_empty():
                        var blocked:Array=[]
                        for piece in pieces:
                            query.shape=piece.shape
                            if not space.intersect_shape(query,1).is_empty():blocked.append(piece.name)
                        if blocked.is_empty():broadphase_only+=1
                        else:failures.append({"segment":i,"t":float(k)/n,"reason":"carried_mesh_blocked","parts":blocked})
        results[role]={"samples":samples,"failures":failures,"source_vertices":vertices.size(),"hull_only_false_positives":broadphase_only,"grip_error":pose.grip_error(),"passed":failures.is_empty()}
        pose.set_enabled(false);actor.queue_free()
    var report={"roles":results,"scope":"Convex envelope of actual visible carried body and equipment vertices at path samples, with 0.14 step-up. Per-visible-mesh convex refinement rejects whole-body hull empty-space false positives; excludes swept turn transitions and walking animation.","passed":results.values().all(func(r):return r.passed)}
    FileAccess.open("res://../artifacts/pipeline/citadel-entry/roman-envelopes.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    for role in results:print(role+": "+str(results[role].failures.size())+" / "+str(results[role].samples))
    w.queue_free();await process_frame;quit(0 if report.passed else 1)
