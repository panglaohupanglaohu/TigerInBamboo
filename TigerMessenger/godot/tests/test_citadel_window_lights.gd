extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var world=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(world)
    await process_frame
    var gardens=world.castle_adapter.west_city.find_children("citadel-terrace-garden","Node3D",true,false)
    var garden_meshes:int=gardens[0].find_children("*","MeshInstance3D",true,false).size() if gardens.size()==1 else 0
    var imported_counts={"claude":0,"target":0}
    var imported_hues_preserved:=true
    for row in world.window_lights.rows:
        var source_name=str(row.mesh.name)
        if source_name.begins_with("target-castle-exterior"):imported_counts.target+=1
        elif source_name.contains("claude"):imported_counts.claude+=1
        else:continue
        imported_hues_preserved=imported_hues_preserved and row.day.emission.is_equal_approx(row.night.emission) and is_equal_approx(row.day.emission_energy_multiplier,0.04) and is_equal_approx(row.night.emission_energy_multiplier,1.55)
    var light_data=JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-new-city-lighting.json"))
    var expected_points:int=light_data.points.size()
    var manifest_matches:bool=world.window_lights.points.size()==expected_points
    for i in range(mini(world.window_lights.points.size(),expected_points)):
        var spec:Dictionary=light_data.points[i]
        var point:OmniLight3D=world.window_lights.points[i]
        manifest_matches=manifest_matches and point.position.is_equal_approx(Vector3(spec.position[0],spec.position[1],spec.position[2])) and is_equal_approx(point.omni_range,float(spec.radius)) and is_equal_approx(float(point.get_meta("night_energy")),float(spec.godotEnergy))
    var stages:Array=[]
    for on in [false,true,false]:
        world.window_lights.set_enabled(on)
        stages.append(world.window_lights.evidence())
    var passed:bool=manifest_matches and garden_meshes==7 and imported_counts.claude>0 and imported_counts.target>0 and imported_hues_preserved
    for stage in stages:
        if stage.old_point_lights!=4 or stage.old_lit_points!=(4 if stage.enabled else 0) or stage.environment_count<1 or not stage.environment_matching or stage.counts.new<=0 or stage.matching!=stage.total or stage.point_lights!=expected_points or stage.lit_points!=(expected_points if stage.enabled else 0):passed=false
    var report:={"manifest_matches":manifest_matches,"garden_meshes":garden_meshes,"imported_counts":imported_counts,"imported_hues_preserved":imported_hues_preserved,"stages":stages,"passed":passed,"scope":"Actual Godot world window materials switch and restore; preview only, not siege captured-room or global day-night logic."}
    FileAccess.open("res://../artifacts/pipeline/citadel-west-city/godot-window-cycle.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));world.free();quit(0 if passed else 1)
