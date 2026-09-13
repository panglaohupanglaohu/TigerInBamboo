extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var world=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(world);await process_frame
    var adapter=world.old_harbor_grade_adapter;var report=adapter.report.duplicate()
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/old-harbor-ocean-grade.json"))
    var m=data.harborMatrix
    var expected=world.model.global_transform*Transform3D(Basis(Vector3(m[0],m[1],m[2]),Vector3(m[4],m[5],m[6]),Vector3(m[8],m[9],m[10])),Vector3(m[12],m[13],m[14]))
    var exact:bool=is_instance_valid(adapter.replacement) and adapter.replacement.global_transform.is_equal_approx(expected)
    var decks=adapter.replacement.find_children("pier-deck","MeshInstance3D",true,false) if exact else []
    var boats=adapter.replacement.find_children("fisher-boat","Node3D",true,false) if exact else []
    var shore=adapter.replacement.find_children("citadel-old-shore-approach","Node3D",true,false)
    var rocks=adapter.replacement.find_children("old-shore-blender-rock-support","MeshInstance3D",true,false)
    var visible_terrain=0
    for mesh in world.model.find_children("citadel-oskar-grid-mountain-surface","MeshInstance3D",true,false):
        if mesh.is_visible_in_tree():visible_terrain+=1
    report["shore_groups"]=shore.size();report["rock_supports"]=rocks.size();report["visible_main_terrain"]=visible_terrain
    report["matrix_exact"]=exact;report["decks"]=decks.size();report["boats"]=boats.size();report["passed"]=report.get("passed",false) and exact and decks.size()==1 and boats.size()==1 and shore.size()==1 and rocks.size()==1 and visible_terrain==1
    FileAccess.open("res://../artifacts/pipeline/citadel-old-harbor-grade/godot-candidate.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));world.queue_free();await process_frame;quit(0 if report.passed else 1)
