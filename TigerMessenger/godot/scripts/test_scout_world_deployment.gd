extends SceneTree
var failures: Array = []
func _initialize() -> void: call_deferred("run_test")
func check(ok: bool, message: String) -> void:
    if not ok: failures.append(message)
func run_test() -> void:
    root.size=Vector2i(1280,800)
    var scene = load("res://scripts/original_world.gd").new()
    root.add_child(scene)
    await process_frame
    check(scene.scout_deployment_error.is_empty(),"Deployment has no identity errors")
    check(scene.scout_deployments.size()==5,"Exactly five candidate instances")
    var instances: Array=[]
    for entry in scene.scout_deployments:
        var original: Node3D=entry.original
        var candidate: Node3D=entry.candidate
        var adapter=entry.adapter
        check(not original.is_visible_in_tree() and candidate.is_visible_in_tree(),"One visible version "+entry.id)
        check(candidate.get_parent()==original.get_parent(),"Same squad parent "+entry.id)
        check(adapter.aircraft.global_transform.is_equal_approx(original.global_transform),"Same world transform/scale "+entry.id)
        var before: Transform3D=adapter.aircraft.global_transform
        adapter.update_original(3.0,.02)
        check(adapter.aircraft.global_transform.is_equal_approx(before) and not adapter.mounted,"Defense has no invented mounted hover "+entry.id)
        check(adapter.cockpit_world_position().distance_to(original.to_global(Vector3(0,.48,.72)))<.0001,"Cockpit world attachment "+entry.id)
        var muzzles: Array[Vector3]=adapter.muzzle_world_positions()
        check(muzzles[0].distance_to(original.to_global(Vector3(-.7,-.16,1.6)))<.0001,"Muzzle world attachment "+entry.id)
        instances.append({"id":entry.id,"globalPosition":str(candidate.global_position),"scale":str(candidate.scale),"sourceHidden":not original.visible,"nodeIds":adapter.nodes.size()})
    scene.set_scout_candidate_preview(false)
    for entry in scene.scout_deployments:
        check(entry.original.visible==entry.original_visible and not entry.candidate.visible,"Original restored "+entry.id)
    scene.set_scout_candidate_preview(true)
    check(scene.scout_deployments.size()==5,"Toggling does not duplicate candidates")
    var captures: Array=[]
    if DisplayServer.get_name()!="headless" and scene.scout_deployments.size()==5:
        var craft: Node3D=scene.scout_deployments[3].original
        scene.center=craft.global_position
        scene.up=craft.global_basis.y.normalized()
        scene.distance=13
        scene.pitch=.35
        scene.yaw=1.1
        scene._camera()
        for enabled in [false,true]:
            scene.set_scout_candidate_preview(enabled)
            for i in range(8): await process_frame
            await RenderingServer.frame_post_draw
            var path: String="res://../artifacts/pipeline/scoutAircraft/deployment/world-"+("candidate" if enabled else "original")+".png"
            root.get_texture().get_image().save_png(ProjectSettings.globalize_path(path))
            captures.append(path)
    var report: Dictionary={"passed":failures.is_empty(),"failures":failures,"instances":instances,"captures":captures,"staticWorldDeployment":failures.is_empty(),"hoverApplied":false,"formationAi":false,"playerPiloting":false,"originalSquadRetained":true}
    FileAccess.open("res://../artifacts/pipeline/scoutAircraft/deployment/world-validation.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print("SCOUT_WORLD_DEPLOYMENT ",JSON.stringify(report))
    scene.queue_free()
    await process_frame
    quit(0 if failures.is_empty() else 1)
