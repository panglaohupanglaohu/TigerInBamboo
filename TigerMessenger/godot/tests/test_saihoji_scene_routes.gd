extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    change_scene_to_file("res://scenes/original_world.tscn")
    await create_timer(0.3).timeout
    var original_ok:bool=current_scene!=null and current_scene.get_script().resource_path.ends_with("original_world.gd")
    change_scene_to_file("res://scenes/saihoji_battle_world.tscn")
    await create_timer(0.3).timeout
    var battle=current_scene
    var ready:bool=battle.ready_for_battle and not battle.director.running
    battle.music.set_muted(true);battle.reset_battle()
    change_scene_to_file("res://scenes/original_world.tscn")
    await create_timer(0.3).timeout
    var back_ok:bool=current_scene!=null and current_scene.get_script().resource_path.ends_with("original_world.gd")
    print(JSON.stringify({"original_loaded":original_ok,"battle_waits_for_user":ready,"return_loaded":back_ok,"passed":original_ok and ready and back_ok}))
    quit(0 if original_ok and ready and back_ok else 1)
