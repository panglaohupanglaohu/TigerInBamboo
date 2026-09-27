extends SceneTree

func _initialize():
    call_deferred("run")

func run():
    var world=load("res://scenes/citadel_world.tscn").instantiate()
    root.add_child(world)
    await process_frame
    var lighting=world.window_lights
    var profile=JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-released-lighting.json"))
    var passed=true
    var records=[]
    for row in profile.points:
        var lights=lighting.old_points if row.side=="old" else lighting.points
        if int(row.index)>=lights.size():
            passed=false
            continue
        var light=lights[int(row.index)]
        var p=row.castlePosition
        var expected=world.castle_adapter.original.to_global(Vector3(p[0],p[1],p[2]))
        var error=light.global_position.distance_to(expected)
        passed=passed and error<0.001 and is_equal_approx(light.omni_range,float(row.radius))
        records.append({"side":row.side,"index":row.index,"position_error":error})
    var states=[]
    for enabled in [false,true,false]:
        lighting.set_enabled(enabled)
        var state=lighting.evidence()
        states.append(state)
        passed=passed and state.matching==state.total and state.environment_matching
        passed=passed and state.lit_points==(5 if enabled else 0) and state.old_lit_points==(3 if enabled else 0)
        passed=passed and int(state.counts.get("ridge",0))==1
    var report={"passed":passed,"points":records,"states":states,"scope":"Actual released old/new lamp anchors and day-night-day restoration, including ridge materials. No subjective visual or shadow-leak certification."}
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/released-lighting-cycle.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report))
    world.free()
    quit(0 if passed else 1)
