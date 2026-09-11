extends SceneTree
func _initialize()->void:
    var route=preload("res://scripts/citadel_harbor_approach.gd").new()
    var passed:bool=route.load_route()
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-harbor-approach.json"))
    var max_error:float=0.0
    for i in range(route.poses.size()):
        var sample:Transform3D=route.sample(route.distances[i]/route.length)
        var p=data.poses[i].position;var q=data.poses[i].quaternion
        max_error=maxf(max_error,sample.origin.distance_to(Vector3(p[0],p[1],p[2])))
        passed=passed and sample.basis.get_rotation_quaternion().angle_to(Quaternion(q[0],q[1],q[2],q[3]).normalized())<0.002
    passed=passed and max_error<0.0001
    for i in range(101):
        var t:float=float(i)/100.0
        passed=passed and route.sample_departure(t).is_equal_approx(route.sample(1.0-t))
    passed=passed and route.sample(1).is_equal_approx(route.sample_departure(0))
    var report={"passed":passed,"poses":route.poses.size(),"reverse_samples":101,"length":route.length,"max_position_error":max_error,"scope":"Godot replay matches exported Web key poses; no Godot boat collision or story fleet integration"}
    FileAccess.open("res://../artifacts/pipeline/citadel-plaza-horse/godot-harbor-approach.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));quit(0 if passed else 1)
