extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    var terrain=w.find_child("OldHarborOceanGrade",true,false).find_child("citadel-oskar-grid-mountain-surface",true,false)
    var current=terrain.mesh
    var doc=GLTFDocument.new();var state=GLTFState.new()
    assert(doc.append_from_file(ProjectSettings.globalize_path("res://../artifacts/pipeline/citadel-compact-ascent/before-old-harbor-overlay.glb"),state)==OK)
    var baseline=doc.generate_scene(state)
    var old=baseline.find_child("citadel-oskar-grid-mountain-surface",true,false).mesh
    var results=[]
    for version in ["before","after"]:
        terrain.mesh=old if version=="before" else current
        await w._start_traversal("gladius",true,false)
        w.set_physics_process(false)
        var walker=w.traversal
        for i in range(1500):
            walker.tick(1.0/60.0)
            if walker.phase=="blocked" or walker.evidence().completed_steps>=4:break
        results.append({"version":version,"result":walker.evidence()})
        w._reset_traversal();await process_frame
    print(JSON.stringify(results))
    FileAccess.open("res://../artifacts/pipeline/citadel-compact-ascent/bridge-start-audit.json",FileAccess.WRITE).store_string(JSON.stringify(results,"  "))
    baseline.free();w.free();quit()
