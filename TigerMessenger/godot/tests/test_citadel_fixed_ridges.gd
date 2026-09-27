extends SceneTree
func _initialize():call_deferred("run")
func run():
    var world=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(world);await process_frame
    world.set_process(false);world.set_physics_process(false)
    var ridge=world.find_child("citadel-fixed-ridge-lines",true,false)
    if ridge==null:push_error("No released ridge lines");world.free();quit(1);return
    var initial=ridge.global_transform
    world.window_lights.set_enabled(false)
    var day=ridge.get_active_material(0).albedo_color.to_html(false)
    world.camera.position+=Vector3(12,5,-8);await process_frame
    var fixed=ridge.global_transform.is_equal_approx(initial)
    world.window_lights.set_enabled(true)
    var night=ridge.get_active_material(0).albedo_color.to_html(false)
    var vertices=ridge.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX].size()
    var passed=day=="d6aa58" and night=="cad6e7" and fixed and vertices>0 and ridge.get_meta("skipColliders",false)
    var report={"passed":passed,"day":day,"night":night,"fixed_after_camera_move":fixed,"segments":vertices/2,"skip_colliders":ridge.get_meta("skipColliders",false),"scope":"Actual native released scene geometry/material toggle; Web screenshots separately reviewed."}
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/fixed-ridges-godot.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));world.free();quit(0 if passed else 1)
