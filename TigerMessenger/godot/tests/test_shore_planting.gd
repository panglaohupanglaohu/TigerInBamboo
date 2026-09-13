extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var grove=w.old_harbor_grade_adapter.replacement.find_children("citadel-shore-cypress-groves","Node3D",true,false)
    var meshes=grove[0].find_children("*","MeshInstance3D",true,false) if grove.size()==1 else []
    var triangles=0
    for mesh in meshes:
        for i in range(mesh.mesh.get_surface_count()):
            var arrays=mesh.mesh.surface_get_arrays(i);var indices=arrays[Mesh.ARRAY_INDEX]
            triangles+=(indices.size() if indices!=null and indices.size()>0 else arrays[Mesh.ARRAY_VERTEX].size())/3
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/old-harbor-ocean-grade.json"))
    var report={"groups":grove.size(),"meshes":meshes.size(),"triangles":triangles,"trees":data.planting.placed.size()}
    var web=JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/pipeline/citadel-shore-planting/report.json")).after
    var m=data.castleMatrix
    var expected=w.model.global_transform*Transform3D(Basis(Vector3(m[0],m[1],m[2]),Vector3(m[4],m[5],m[6]),Vector3(m[8],m[9],m[10])),Vector3(m[12],m[13],m[14]))
    report.matrix_exact=grove.size()==1 and grove[0].global_transform.is_equal_approx(expected)
    report.passed=report.matrix_exact and meshes.size()==web.meshes and triangles==web.triangles and data.planting.placed.size()==web.planting.placed.size()
    FileAccess.open("res://../artifacts/pipeline/citadel-shore-planting/godot-import.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));w.free();quit(0 if report.passed else 1)
