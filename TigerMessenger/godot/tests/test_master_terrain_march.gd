extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    preload("res://tests/master_terrain_fixture.gd").mount(w)
    var horse_exit=OS.get_cmdline_user_args().has("--horse-exit")
    var front=OS.get_cmdline_user_args().has("--front-harbor")
    await w._start_traversal("gladius",true,front,false,horse_exit)
    w.set_physics_process(false)
    if w.traversal==null:w.free();quit(1);return
    var walker=w.traversal
    var start:Vector3=walker.actor.global_position
    var tick_budget=(walker.route.size()-1)*int(ceil((0.48+PI/1.5+0.05)*60))
    for i in range(tick_budget):
        walker.tick(1.0/60.0)
        if walker.phase in ["arrived","blocked"]:break
    var result:Dictionary=walker.evidence()
    result["tick_budget"]=tick_budget
    result["distance_from_start"]=walker.actor.global_position.distance_to(start)
    result["front_landmark"]=is_instance_valid(w.landmarks.get("前港登陆口"))
    result["passed"]=walker.phase=="arrived" and result.distance_from_start>(10 if horse_exit or front else 30) and result.completed_steps==result.route_points-1
    result["scope"]="Actual citadel scene, approved gladius mesh and production collision-guarded controller from plaza through the main gate, courtyard, tower stair and upper exit; no ship boarding or combat."
    result["terrain_revision"]=preload("res://tests/master_terrain_fixture.gd").revision()
    var tag="placement-r02" if OS.get_cmdline_user_args().has("--placement-r02") else ("placement-r01" if OS.get_cmdline_user_args().has("--placement-r01") else "r"+result.terrain_revision)
    if OS.get_cmdline_user_args().has("--placement-r03"):tag="placement-r03"
    if OS.get_cmdline_user_args().has("--placement-r04"):tag="placement-r04"
    if front:
        tag+="-front-harbor"
        result["scope"]="Original gladius carrying equipment through front harbor gate, stairs and turning court to plaza; no ship boarding or combat."
    if OS.get_cmdline_user_args().has("--full-harbor-route"):
        tag="placement-r05-full-route"
        result["scope"]="Original gladius carrying equipment continuously from quay through harbor gate, stairs, plaza, main gate, courtyard, spiral stairs and upper exit; no ship boarding or combat."
    if horse_exit:
        tag+="-horse-exit"
        result["scope"]="Actual original gladius carrying equipment, from relocated horse terrace down pedestrian stairs to main ascent approach; not horse animation or combat."
    result["candidate"]=tag
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/"+tag+"-godot-march.json",FileAccess.WRITE).store_string(JSON.stringify(result,"  "))
    print(JSON.stringify(result));w.free();quit(0 if result.passed else 1)
