extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var world=load("res://scenes/saihoji_battle_world.tscn").instantiate();root.add_child(world)
    while not world.ready_for_battle and world.load_error.is_empty():await physics_frame
    world.set_physics_process(false);world.music.set_muted(true)
    world.preview_kun_roll(0)
    var initial:Transform3D=world.garden_island.global_transform
    var trees:Array=[]
    for entry in world.pine_visual.entries:trees.append(entry.anchor.transform)
    world.preview_kun_roll(PI*0.75)
    var tail_motion:bool=not world.roll_tail_nodes[0].basis.is_equal_approx(world.roll_tail_bases[0])
    var fluke_motion:bool=not world.roll_tail_nodes[1].basis.is_equal_approx(world.roll_tail_bases[1])
    world.preview_kun_roll(PI)
    var inverted:float=initial.basis.y.normalized().dot(world.garden_island.global_basis.y.normalized())
    var unchanged:=true
    for i in trees.size():unchanged=unchanged and trees[i].is_equal_approx(world.pine_visual.entries[i].anchor.transform)
    world.preview_kun_roll(TAU)
    var restored:bool=initial.is_equal_approx(world.garden_island.global_transform)
    var result={"tail_moves":tail_motion,"flukes_follow":fluke_motion,"passed":tail_motion and fluke_motion and world.roll_tail_nodes[0].basis.is_equal_approx(world.roll_tail_bases[0]) and trees.size()==25 and unchanged and inverted<-.999 and restored,"pine_count":trees.size(),"local_tree_transforms_unchanged":unchanged,"garden_up_dot_at_180":inverted,"360_restored":restored,"scope":"model attachment preview only; no combat trigger"}
    FileAccess.open("res://../artifacts/pipeline/kun-roll-model/godot-report.json",FileAccess.WRITE).store_string(JSON.stringify(result,"  "))
    print(JSON.stringify(result));world.reset_battle();world.queue_free();await process_frame;quit(0 if result.passed else 1)
