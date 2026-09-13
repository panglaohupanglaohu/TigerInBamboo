extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var rows=[];var passed=true
    for path in ["res://scenes/original_world.tscn","res://scenes/citadel_world.tscn"]:
        var w=load(path).instantiate();root.add_child(w);await process_frame
        var names=["old-shore-blender-rock-support","citadel-old-city-support-spur","citadel-shore-cypress-groves","citadel-old-shore-arcades"]
        var visible={}
        for name in names:visible[name]=w.model.find_children(name,"Node3D",true,false).filter(func(n):return n.is_visible_in_tree()).size()
        var grade=w.old_harbor_grade_adapter
        var row={"scene":path,"frame":preload("res://scripts/citadel_surface_variant.gd").enabled(),"harbor":grade.report,"visible":visible,"mirrored_experiment":w.island!=null,"day":w.window_lights.evidence()}
        row.passed=row.frame and grade.report.get("passed",false) and visible.values().all(func(v):return v==1) and row.mirrored_experiment and row.day.matching==row.day.total
        w.castle_toggle.button_pressed=false;await process_frame
        row.toggle_off=not grade.replacement.visible and not w.castle_adapter.enabled
        w.castle_toggle.button_pressed=true;await process_frame
        row.toggle_on=grade.replacement.visible and w.castle_adapter.enabled
        row.passed=row.passed and row.toggle_off and row.toggle_on
        passed=passed and row.passed;rows.append(row)
        w.queue_free();await process_frame
    var report={"passed":passed,"rows":rows,"scope":"No command line layout flags. Both original-world overview and citadel entry use current shared assembly; full gameplay migration remains incomplete."}
    FileAccess.open("res://../artifacts/pipeline/citadel-default-entry/godot-default.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));quit(0 if passed else 1)
