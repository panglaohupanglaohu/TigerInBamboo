extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
    var world = load("res://scenes/saihoji_battle_world.tscn").instantiate()
    root.add_child(world)
    while not world.ready_for_battle and world.load_error.is_empty(): await physics_frame
    world.set_physics_process(false); world.music.set_muted(true)
    var result: Dictionary = world.target_garden.report
    var data = JSON.parse_string(FileAccess.get_file_as_string(world.target_garden.DATA))
    var errors: Array[String] = []
    if not result.get("applied",false): errors.append("target garden not applied")
    if result.get("trees_repositioned",0)!=25: errors.append("25 original pine seeds must match")
    if not world.load_error.is_empty(): errors.append(world.load_error)
    if world.target_garden.node.get_parent()!=world.garden_island: errors.append("garden must follow Kun island")
    if world.kun.is_ancestor_of(world.concealment_visual.node): errors.append("ambush cover must stay on planet")
    var max_error := 0.0
    for tree in data.trees:
        for entry in world.pine_visual.entries:
            if int(entry.row.seed)==int(tree.seed):
                var expected: Transform3D = world.garden_island.global_transform*world.target_garden._matrix(tree.matrix)
                max_error=maxf(max_error,entry.anchor.global_position.distance_to(expected.origin))
    if max_error>0.0001: errors.append("pine coordinate conversion diverges from shared Web data")
    if OS.has_environment("SAIHOJI_TARGET_CAPTURE"):
        root.size=Vector2i(1400,950)
        world.kun.position=world.kun.position.normalized()*185.0
        world.garden_island.position.y=6.08
        world.camera.position=world.garden_island.to_global(Vector3(10,30,27))
        world.camera.look_at(world.garden_island.to_global(Vector3(0,1,0)),world.garden_island.global_basis.y.normalized())
        for i in range(4): await process_frame
        await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png(OS.get_environment("SAIHOJI_TARGET_CAPTURE"))
    var report={"passed":errors.is_empty(),"errors":errors,"target":result,"max_tree_position_error":max_error,"scope":"shared mesh/tree import and unchanged static ambush cover; not visual acceptance"}
    print(JSON.stringify(report))
    FileAccess.open("/tmp/saihoji-target-garden-godot.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    world.queue_free(); await process_frame
    quit(0 if errors.is_empty() else 1)
