extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var lighting=w.window_lights
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-tier-lighting.json"))
    var records=[];var max_error:=0.0
    for side in ["old","new"]:
        var points=lighting.old_points if side=="old" else lighting.points
        var expected=[]
        for row in data.expectedWorld:
            if row.side==side:expected.append(row)
        for i in range(points.size()):
            var row=expected[i];var p=row.world
            var error=points[i].global_position.distance_to(w.model.to_global(Vector3(p[0],p[1],p[2])))
            max_error=maxf(max_error,error);records.append({"side":side,"error":error,"radius":points[i].omni_range})
    lighting.set_enabled(true);var night=lighting.evidence()
    lighting.set_enabled(false);var day=lighting.evidence()
    var report={"night":night,"day":day,"max_position_error":max_error,"points":records}
    report.passed=lighting.old_points.size()==3 and lighting.points.size()==3 and max_error<0.001 and night.lit_points==3 and night.old_lit_points==3 and day.lit_points==0 and day.old_lit_points==0
    FileAccess.open("res://../artifacts/pipeline/citadel-tier-lighting/godot-test.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));w.free();quit(0 if report.passed else 1)
