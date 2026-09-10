extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var c=w.stair_candidate;c.set_enabled(true)
    var body=StaticBody3D.new();w.add_child(body)
    for mesh in c.root.get_children():
        var shape=CollisionShape3D.new();shape.shape=mesh.mesh.create_trimesh_shape();body.add_child(shape);shape.global_transform=mesh.global_transform
    await physics_frame;await physics_frame
    var space=w.get_world_3d().direct_space_state
    var up:Vector3=c.root.global_basis.y.normalized()
    var failures:Array=[];var samples:=0;var step_up_samples:=0
    var capsule=CapsuleShape3D.new();capsule.radius=0.19;capsule.height=0.9
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
                if not space.intersect_shape(query,1).is_empty():failures.append({"segment":i,"t":float(k)/n,"reason":"blocked_even_after_step_up"})
    c.set_enabled(false)
    var restored:bool=c.original.visible and not c.root.visible
    var report=c.report.duplicate(true)
    report.step_up_required_samples=step_up_samples;report.step_up_limit=0.14
    report.samples=samples;report.failures=failures;report.candidate_support_and_capsule_passed=failures.is_empty();report.original_restored=restored
    report.scope="Candidate steps only: 0.05m ray samples and 0.38m-wide / 0.9m-high body proxy with at most 0.14m explicit step-up; excludes solid original tower shell, weapons, entrance, top deck and walking animation. No siege acceptance."
    FileAccess.open("res://../artifacts/pipeline/citadel-entry/stair-candidate.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify({"treads":report.treads,"samples":samples,"failures":failures.size(),"restored":restored}))
    w.queue_free();await process_frame;quit(0 if failures.is_empty() and restored else 1)
