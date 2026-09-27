extends SceneTree
func _initialize(): call_deferred("run")
func run():
    var world=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(world)
    await process_frame
    world.set_process(false);world.set_physics_process(false)
    var selection=load("res://scripts/citadel_traversal_route.gd").resolve(world)
    if not selection.get("valid",false):push_error("Released UI route invalid");world.free();quit(1);return
    var points=selection.points
    var context=load("res://scripts/citadel_collision_context.gd").new();context.bind(world)
    var parapet_colliders=0
    var east_rock_colliders=0
    var upper_rock_colliders=0
    var landing_support_colliders=0
    for shape in context.body.get_children():
        if "integrated-upper-landing-support" in str(shape.get_meta("source","")):
            landing_support_colliders+=1
        if "citadel-processional-parapets-" in str(shape.get_meta("source","")):
            parapet_colliders+=1
        if "citadel-upper-rock-" in str(shape.get_meta("source","")):
            upper_rock_colliders+=1
        if "plaza-east-rock-footing" in str(shape.get_meta("source","")):
            east_rock_colliders+=1
    assert(landing_support_colliders==1,"Blender landing foundation must participate in route collision queries")
    assert(parapet_colliders==4,"Both Blender stair sidewall groups must participate in collision queries")
    assert(east_rock_colliders==1,"Released Blender east rock footing must participate in collision queries")
    assert(upper_rock_colliders==4,"All four upper Blender rock supports must participate in collision queries")
    await physics_frame;await physics_frame
    var reports={}
    for role in ["gladius","spear","longbow"]:
        var walker=load("res://scripts/citadel_roman_traversal.gd").new()
        if not walker.bind(world,role,selection.frame,points,selection.surface_following):
            reports[role]={"phase":"bind_failed"};continue
        for frame in range(18000):
            walker.tick(1.0/60.0)
            if walker.phase in ["arrived","blocked"]:break
        reports[role]=walker.evidence();walker.dispose()
    var report={"route_source":"common-frame-citadel-placement-r05-full-route.json","route_points":points.size(),"roles":reports,"scope":"Current full new-city route with original three weapon-bearing models and guarded rigid-leg clearance. Not natural patrol AI, combat actions or full gameplay."}
    report["parapet_colliders"]=parapet_colliders
    report["east_rock_colliders"]=east_rock_colliders
    report["upper_rock_colliders"]=upper_rock_colliders
    report["landing_support_colliders"]=landing_support_colliders
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/character-route-audit.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    var passed=reports.size()==3
    for row in reports.values():passed=passed and row.get("phase","")=="arrived" and row.get("completed_steps",0)==points.size()-1
    report["passed"]=passed
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/character-route-audit.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));world.free();quit(0 if passed else 1)
