extends SceneTree
func _initialize(): call_deferred("run")
func run():
    var world=load("res://scenes/citadel_world.tscn").instantiate()
    root.add_child(world)
    await process_frame
    var berth=world.front_harbor_berth_adapter
    var report=berth.report.duplicate(true)
    report["bearing_count"]=world.find_children("citadel-boarding-bearing","MeshInstance3D",true,false).size()
    report["step_count"]=world.find_children("citadel-boarding-step","MeshInstance3D",true,false).size()
    report["passed"]=report.get("boarding_geometry_installed",false) and report.bearing_count==1 and report.step_count==1
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/boarding-native-installed.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report))
    world.free();quit(0 if report.passed else 1)
