extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var found=w.old_harbor_grade_adapter.replacement.find_children("citadel-old-city-support-spur","MeshInstance3D",true,false)
    var triangles=0
    for mesh in found:
        for i in range(mesh.mesh.get_surface_count()):
            var arrays=mesh.mesh.surface_get_arrays(i);var indices=arrays[Mesh.ARRAY_INDEX]
            triangles+=(indices.size() if indices!=null and indices.size()>0 else arrays[Mesh.ARRAY_VERTEX].size())/3
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/old-harbor-ocean-grade.json"))
    var m=data.castleMatrix
    var expected=w.model.global_transform*Transform3D(Basis(Vector3(m[0],m[1],m[2]),Vector3(m[4],m[5],m[6]),Vector3(m[8],m[9],m[10])),Vector3(m[12],m[13],m[14]))
    var report={"meshes":found.size(),"triangles":triangles,"matrix_exact":found.size()==1 and found[0].global_transform.is_equal_approx(expected)}
    report.passed=report.matrix_exact and triangles==192
    FileAccess.open("res://../artifacts/pipeline/citadel-foundation-support/godot-import.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));w.free();quit(0 if report.passed else 1)
