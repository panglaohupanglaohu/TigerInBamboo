extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var world=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(world);await process_frame
    var adapter=world.camp_shallows_adapter
    var report:Dictionary=adapter.report.duplicate()
    var data=JSON.parse_string(FileAccess.get_file_as_string(preload("res://scripts/citadel_surface_variant.gd").data_path("res://data/camp-shallows.json")))
    var exact:bool=adapter.targets.size()==11
    var vertices_checked:int=0
    for i in range(adapter.targets.size()):
        var target=adapter.targets[i];var patch=data.patches[i]
        var arrays=target.mesh.surface_get_arrays(0)
        var vertices:PackedVector3Array=arrays[Mesh.ARRAY_VERTEX]
        exact=exact and vertices.size()*3==patch.positions.size()
        for j in range(vertices.size()):
            var k:int=j*3
            if vertices[j].distance_to(Vector3(patch.positions[k],patch.positions[k+1],patch.positions[k+2]))>.0001:exact=false
            vertices_checked+=1
        var m=patch.matrix
        var expected=world.model.global_transform*Transform3D(Basis(Vector3(m[0],m[1],m[2]),Vector3(m[4],m[5],m[6]),Vector3(m[8],m[9],m[10])),Vector3(m[12],m[13],m[14]))
        exact=exact and target.global_transform.is_equal_approx(expected)
        var indices:PackedInt32Array=arrays[Mesh.ARRAY_INDEX]
        for j in range(indices.size()):
            if indices[j]!=int(patch.indices[int(j/3)*3+[0,2,1][j%3]]):exact=false
    report["geometry_transform_winding_exact"]=exact;report["vertices_checked"]=vertices_checked
    report["passed"]=report.get("passed",false) and exact
    var name="godot-common-frame.json" if preload("res://scripts/citadel_surface_variant.gd").enabled() else "godot-default.json"
    FileAccess.open("res://../artifacts/pipeline/camp-ocean-conformance/"+name,FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));world.queue_free();await process_frame;quit(0 if report.passed else 1)
