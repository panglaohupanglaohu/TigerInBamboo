extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var world=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(world)
    await process_frame
    var gardens=world.castle_adapter.west_city.find_children("citadel-terrace-garden","Node3D",true,false)
    var garden_meshes:int=gardens[0].find_children("*","MeshInstance3D",true,false).size() if gardens.size()==1 else 0
    var stages:Array=[]
    for on in [false,true,false]:
        world.window_lights.set_enabled(on)
        stages.append(world.window_lights.evidence())
    var passed:bool=garden_meshes==7
    for stage in stages:
        if stage.environment_count<1 or not stage.environment_matching or stage.counts.new!=160 or stage.matching!=stage.total or stage.point_lights!=3 or stage.lit_points!=(3 if stage.enabled else 0):passed=false
    var report:={"garden_meshes":garden_meshes,"stages":stages,"passed":passed,"scope":"Actual Godot world window materials switch and restore; preview only, not siege captured-room or global day-night logic."}
    FileAccess.open("res://../artifacts/pipeline/citadel-west-city/godot-window-cycle.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));world.free();quit(0 if passed else 1)
