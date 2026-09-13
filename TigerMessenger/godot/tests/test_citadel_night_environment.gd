extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var lighting=w.window_lights
    lighting.set_enabled(false)
    var sun=lighting.sun_rows[0].sun
    var before_basis:Basis=sun.global_basis
    var before_energy:float=sun.light_energy
    var before_color:Color=sun.light_color
    var env=lighting.environment_rows[0].env
    var before_ambient:float=env.ambient_light_energy
    lighting.set_enabled(true)
    var orientation_error=sun.global_basis.z.normalized().distance_to(lighting.night_direction.normalized())
    var night=lighting.evidence()
    var night_energy:float=sun.light_energy
    lighting.set_enabled(false)
    var restored=sun.global_basis.is_equal_approx(before_basis) and is_equal_approx(sun.light_energy,before_energy) and sun.light_color==before_color and is_equal_approx(env.ambient_light_energy,before_ambient)
    var result={"direction_error":orientation_error,"night_energy":night_energy,"day_restored":restored,"night_environment_matching":night.environment_matching,"point_count":lighting.points.size()+lighting.old_points.size()}
    result.passed=orientation_error<0.0001 and restored and night.environment_matching and result.point_count==6
    FileAccess.open("res://../artifacts/pipeline/citadel-terrain-render/night-environment-test.json",FileAccess.WRITE).store_string(JSON.stringify(result,"  "))
    print(JSON.stringify(result));w.free();quit(0 if result.passed else 1)
