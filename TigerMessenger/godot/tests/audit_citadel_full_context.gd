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
    var controls:Dictionary={}
    for label in ["solid_slab","tower_hole","door_hole"]:
        var point=Vector3(5,4.6,0) if label=="solid_slab" else (Vector3(0,4.6,0) if label=="tower_hole" else Vector3(0,4.6,3.4))
        var query=PhysicsRayQueryParameters3D.create(c.root.to_global(point),c.root.to_global(point-Vector3.UP),4)
        var hit=space.intersect_ray(query)
        controls[label]=not hit.is_empty() if label=="solid_slab" else hit.is_empty()
    var retained_slab_hits:=0
    for x in range(-8,11):
        for z in range(-8,11):
            if abs(x)<4 and z>-4 and z<5:continue
            var point:=Vector3(x,4.6,z)
            if not space.intersect_ray(PhysicsRayQueryParameters3D.create(c.root.to_global(point),c.root.to_global(point-Vector3.UP),4)).is_empty():retained_slab_hits+=1
    controls.solid_slab=retained_slab_hits>0
    var up:Vector3=c.root.global_basis.y.normalized()
    var failures:Array=[];var samples:=0;var step_up_samples:=0
    var capsule=CapsuleShape3D.new();capsule.radius=0.19;capsule.height=1.2
    for i in range(c.route.size()-1):
        var a:Vector3=c.root.to_global(c.route[i]);var b:Vector3=c.root.to_global(c.route[i+1])
        var n:=maxi(1,int(ceil(a.distance_to(b)/0.05)))
        for k in range(n+1):
            samples+=1
            var foot:Vector3=a.lerp(b,float(k)/n)
            var hit=space.intersect_ray(PhysicsRayQueryParameters3D.create(foot+up*0.16,foot-up*0.2))
            if hit.is_empty():failures.append({"segment":i,"t":float(k)/n,"reason":"unsupported"});continue
            var query=PhysicsShapeQueryParameters3D.new();query.shape=capsule
            query.transform=Transform3D(c.root.global_basis.orthonormalized(),Vector3(hit.position)+up*(capsule.height*0.5+0.015))
            if not space.intersect_shape(query,1).is_empty():
                step_up_samples+=1
                # Standing capsule is expected to touch the next riser. Check an explicit
                # bounded step-up envelope as a separate result, not a walking claim.
                query.transform.origin+=up*0.14
                var contacts=space.intersect_shape(query,1)
                if not contacts.is_empty():
                    var contact=contacts[0];var collider:CollisionObject3D=contact.collider
                    var owner=collider.shape_owner_get_owner(collider.shape_find_owner(contact.shape))
                    failures.append({"segment":i,"t":float(k)/n,"reason":"blocked_even_after_step_up","source":str(owner.get_meta("source",owner.get_path()))})
    c.set_enabled(false)
    w._set_shell(false)
    var restored:bool=c.original.visible and not c.root.visible
    var report=c.report.duplicate(true)
    report.shell=w.shell_candidate.report
    report.town_cavity=w.town_cavity.report
    report.cavity_collision_controls=controls
    report.retained_slab_collision_samples=retained_slab_hits
    report.step_up_required_samples=step_up_samples;report.step_up_limit=0.14
    report.samples=samples;report.failures=failures;report.candidate_support_and_capsule_passed=failures.is_empty();report.original_restored=restored
    report.scope="Tower candidate plus all visible opaque original castle and current WFC town geometry: 0.05m ray samples and 0.38m-wide / 1.2m-high body proxy with at most 0.14m explicit step-up; includes opened capture deck and portal-to-stair route; excludes weapons, exterior approach, walking animation. No siege acceptance."
    FileAccess.open("res://../artifacts/pipeline/citadel-entry/full-context-audit.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify({"treads":report.treads,"samples":samples,"failures":failures.size(),"restored":restored}))
    w.queue_free();await process_frame;quit(0 if restored and failures.is_empty() and controls.values().all(func(v):return v) else 1)
