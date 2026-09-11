extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var world=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(world);await process_frame
    var adapter=world.seabed_adapter
    var report:Dictionary=adapter.report.duplicate()
    var exact:bool=false
    if is_instance_valid(adapter.target):
        var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-seabed.json"))
        var vertices:PackedVector3Array=adapter.target.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
        exact=vertices.size()*3==data.positions.size()
        for i in range(vertices.size()):
            var order:int=[0,2,1][i%3]
            var k:int=(int(i/3)*3+order)*3
            if vertices[i].distance_to(Vector3(data.positions[k],data.positions[k+1],data.positions[k+2]))>.0001:exact=false
        var m=data.matrix
        var expected:Transform3D=world.model.global_transform*Transform3D(Basis(Vector3(m[0],m[1],m[2]),Vector3(m[4],m[5],m[6]),Vector3(m[8],m[9],m[10])),Vector3(m[12],m[13],m[14]))
        exact=exact and adapter.target.global_transform.is_equal_approx(expected)
    report["geometry_and_transform_exact"]=exact
    report["passed"]=report.get("passed",false) and exact
    FileAccess.open("res://../artifacts/pipeline/citadel-plaza-horse/seabed-godot.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));world.queue_free();await process_frame;quit(0 if report.passed else 1)
