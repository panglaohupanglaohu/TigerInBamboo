extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    w.set_process(false);w.set_physics_process(false)
    w.traversal_context.bind(w)
    await physics_frame
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/old-harbor-ocean-grade.json"))
    var roots=w.old_harbor_grade_adapter.replacement.find_children("citadel-old-shore-arcades","Node3D",true,false)
    var report={"roots":roots.size(),"routes":[],"night":false,"day":false}
    var passed=roots.size()==1
    for entry in data.arcades:
        var path:Array=[]
        for p in entry.route:path.append(Vector3(p[0],p[1],p[2]))
        var walker=preload("res://scripts/citadel_roman_traversal.gd").new()
        if not walker.bind(w,"gladius",w.castle_adapter.original,path,true):passed=false;break
        for i in range(60*100):
            walker.tick(1.0/60)
            if walker.phase in ["arrived","blocked"]:break
        var evidence=walker.evidence();report.routes.append(evidence);passed=passed and walker.phase=="arrived"
        walker.actor.queue_free();await process_frame
    var windows=[]
    if roots.size()==1:windows=roots[0].find_children("harbor-detail-harbor-amber-window*","MeshInstance3D",true,false)
    w.window_lights.set_enabled(true)
    report.night=windows.size()==2 and windows.all(func(m):return m.get_active_material(0).emission_energy_multiplier>2.0)
    w.window_lights.set_enabled(false)
    report.day=windows.size()==2 and windows.all(func(m):return is_zero_approx(m.get_active_material(0).emission_energy_multiplier))
    report.passed=passed and report.night and report.day
    FileAccess.open("res://../artifacts/pipeline/citadel-shore-arcades/godot-test.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));w.free();quit(0 if report.passed else 1)
