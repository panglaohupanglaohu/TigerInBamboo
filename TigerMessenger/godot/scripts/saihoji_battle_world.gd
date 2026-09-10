extends Node3D
## Native original-world Saihoji integration. Authored candidates, original world
## subtrees and source IDs. Actual movement and swept projectile contact feed core.
const Director = preload("res://scripts/saihoji_battle_director.gd")
const Music = preload("res://scripts/saihoji_battle_audio.gd")
const WORLD = "res://assets/world-source/original-world-v1.glb"
const FAMILY = "res://assets/roman-family-v1/romanSoldier_%s_blue"
var model: Node3D
var original_surface_visual = preload("res://scripts/original_surface_adapter.gd").new()
var original_surface_result: Dictionary = {}
var kun: Node3D
var fleet: Node3D
var garden: Node3D
var garden_island: Node3D
var garden_island_original: Transform3D
var director = Director.new()
var music = Music.new()
var camera: Camera3D
var status: Label
var mission_drumming := false
var source_nodes: Dictionary = {}
var troops: Array[Dictionary] = []
var heavies: Array[Dictionary] = []
var ships: Array[Dictionary] = []
var crafts: Array[Dictionary] = []
var projectiles: Array[Dictionary] = []
var fleet_members: Array[Node3D] = []
var fleet_original: Array[Transform3D] = []
var escort_pods: Array[Node3D] = []
var original_instances=preload("res://scripts/original_instance_adapter.gd").new()
var original_instances_result:Dictionary={}
var root_support=preload("res://scripts/saihoji_root_support.gd").new()
var pine_visual=preload("res://scripts/saihoji_pine_adapter.gd").new()
var concealment_visual=preload("res://scripts/saihoji_concealment_adapter.gd").new()
var concealment_result:Dictionary={}
var socco_transport=preload("res://scripts/saihoji_socco_transport.gd").new()
var heavy_boot_corners:Array=[]
var gatepod_visual=preload("res://scripts/saihoji_gatepod_adapter.gd").new()
var escort_original: Array[Transform3D] = []
var ropes: Array[MeshInstance3D] = []
var jaw: Node3D
var jaw_triangles := 0
var kun_morph_nodes: Dictionary = {}
var kun_candidate_active := false
var water_result: Dictionary = {}
var terrain_result: Dictionary = {}
var landing_planner=preload("res://scripts/saihoji_landing_planner.gd").new()
var foot_offsets:Dictionary={}
var aircraft_visual=preload("res://scripts/saihoji_aircraft_adapter.gd").new()
var kun_original: Transform3D
var hub := Vector3(-0.424024048, 0.529919264, -0.734431195)
var east := Vector3.ZERO
var north := Vector3.ZERO
var landing := Vector3.ZERO
var castle_dir := Vector3.ZERO
var junction_dir := Vector3.ZERO
var fleet_origin := Vector3.ZERO
var fleet_center := Vector3.ZERO
var route_t := 0.0
var elapsed := 0.0
var lift_target := 0.0
var lift_value := 0.0
var assault_t := 0.0
var combat_elapsed := 0.0
var assault_origin := Vector3.ZERO
var assault_hub := Vector3.ZERO
var assault_east := Vector3.ZERO
var assault_north := Vector3.ZERO
var returning := false
var return_hold := 0.0
var shot_serial := 0
@export var battle_seed: int = 20260909
var battle_rng := RandomNumberGenerator.new()
var swallow_serial := 0
var swallowed: Array[Dictionary] = []
var swallow_t := 0.0
var kun_turning := false
var kun_counter_offset := Vector3.ZERO
var kun_counter_return := false
var swallow_geometry:Dictionary={}
var yaw := 0.2
var pitch := 0.42
var distance := 88.0
var dragging := false
var camera_focus := "battle"
var ready_for_battle := false
var events: Array[Dictionary] = []
var assembly: Dictionary = {}
var heavy_frames: Array[Dictionary] = []
var prefabs: Dictionary = {}
var warship_visual = preload("res://scripts/saihoji_warship_adapter.gd").new()
var terrain_body: StaticBody3D
var collision_mesh_count := 0
var ground_samples := 0
var ground_fallbacks := 0
var blocked_projectiles := 0
var load_error := ""
var initial_load_error := ""
var outcome_message := ""
var beam: MeshInstance3D
var battle_started := false
var reinforcement_count := 0
var reinforcement_wait := 20.0

func _ready() -> void:
    model = load(WORLD).instantiate(); add_child(model)
    _index(model)
    kun = source_nodes.get("leviathanGroup[156]")
    fleet = source_nodes.get("moebius-aircraft-squad[78]")
    garden = source_nodes.get("leviathanGroup[156]/leviathan-island[39]/SaihojiSixScenes[45]")
    if not kun or not fleet or not garden:
        load_error = "原世界鲲/舰队/苔庭六景身份缺失"; push_error(load_error); return
    kun_original = kun.transform
    garden_island = source_nodes.get("leviathanGroup[156]/leviathan-island[39]")
    garden_island_original = garden_island.transform
    hub = kun.position.normalized(); east = Vector3.UP.cross(hub).normalized(); north = hub.cross(east).normalized()
    landing = (hub + east * 0.11).normalized()
    castle_dir = source_nodes["castleContainer[69]"].position.normalized() if source_nodes.has("castleContainer[69]") else Vector3(114.446289,63.319804,83.302786).normalized()
    junction_dir = Vector3(62.830039,80.103728,-123.407372).normalized()
    for i in range(5):
        var member: Node3D = source_nodes.get("moebius-aircraft-squad[78]/moebius-aircraft[%d]" % i)
        if member:
            fleet_members.append(member); fleet_original.append(member.transform); fleet_origin += member.position / 5.0
    fleet_center = fleet_origin
    var escort: Node3D = source_nodes.get("moebius-aircraft-squad[78]/gate-pod-escort[5]")
    if escort:
        for child in escort.get_children():
            if child is Node3D:
                child.set_meta("forward_plus_z",true);escort_pods.append(child);escort_original.append(child.global_transform)
    original_surface_result = original_surface_visual.apply(model)
    _adapt_world()
    original_instances_result=original_instances.apply(model,JSON.parse_string(FileAccess.get_file_as_string("res://assets/world-source/original-instance-map.json")))
    pine_visual.apply(source_nodes)
    if pine_visual.report.count!=25:load_error="原六庭古松候选映射未完整接入"
    aircraft_visual.apply(fleet_members)
    gatepod_visual.apply(escort_pods)
    terrain_result=preload("res://scripts/saihoji_terrain_adapter.gd").apply(model)
    _build_jaw()
    root_support.apply(garden_island)
    concealment_result=concealment_visual.apply(garden_island)
    if not bool(concealment_result.get("applied",false)):
        load_error="苔庭五区外围隐蔽环境未接入：%s" % str(concealment_result.get("reason","unknown"))
    garden_island.position.y=maxf(6.08,(root_support.dry_plate_radius-kun.position.length())/0.5)
    add_child(director); director.event_emitted.connect(_on_event)
    add_child(music)
    _load_prefabs()
    _setup_view()
    _terrain_collision()
    await get_tree().physics_frame
    landing_planner.build(get_world_3d(),landing)
    if landing_planner.available.is_empty():load_error="苔庭现有地面没有足够的连通干燥站位"
    initial_load_error=load_error
    ready_for_battle = load_error.is_empty() and fleet_members.size() == 5
    _update_status()

func _index(node: Node) -> void:
    var extras: Dictionary = node.get_meta("extras", {})
    var path := str(extras.get("sourcePath", ""))
    if not path.is_empty(): source_nodes[path] = node
    for child in node.get_children(): _index(child)

func _adapt_world() -> void:
    for node in model.find_children("*", "MeshInstance3D", true, false):
        if str(node.name).contains("cloud-impostors") or str(node.name).begins_with("backlit-highlight-") or str(node.name) == "planet-v8-curved-ocean": node.visible = false
        for surface in node.mesh.get_surface_count():
            var arrays: Array = node.mesh.surface_get_arrays(surface)
            if arrays[Mesh.ARRAY_COLOR] != null and arrays[Mesh.ARRAY_COLOR].size() > 0:
                var material = node.get_active_material(surface)
                if material is StandardMaterial3D:
                    var adapted = material.duplicate(); adapted.vertex_color_use_as_albedo = true; adapted.vertex_color_is_srgb = false
                    node.set_surface_override_material(surface, adapted)

    water_result=preload("res://scripts/saihoji_water_adapter.gd").apply(model)

func _load_prefabs() -> void:
    for role in ["spear", "gladius", "longbow"]:
        var path := FAMILY % role
        if not ResourceLoader.exists(path + ".glb"): load_error = "缺少候选：" + path; return
        prefabs[role] = load(path + ".glb")
        assembly[role] = JSON.parse_string(FileAccess.get_file_as_string(path + ".assembly.json"))
    if not warship_visual.load_data(): load_error = "传统战船 v6 动作数据缺失"; return
    prefabs.ship = load(warship_visual.MODEL)
    prefabs.heavy = load("res://assets/vanguard-color-v2/vanguard-color-v2.glb")
    assembly.heavy=JSON.parse_string(FileAccess.get_file_as_string("res://assets/vanguard-battle-v1/vanguard-battle-v1.assembly.json"))
    for frame in assembly.heavy.poseFrames:
        var transforms:Dictionary={}
        for id in frame.transforms:
            transforms[id]=_array_transform(frame.transforms[id])
        heavy_frames.append(transforms)
    prefabs.hauler = load("res://assets/socco-color-v2/socco-color-v2.glb")
    for kind in ["spear","gladius","longbow","heavy"]:
        var probe:Node3D=prefabs[kind].instantiate();add_child(probe)
        foot_offsets[kind]=_measure_foot_offset(probe,["n64","n74"] if kind=="heavy" else ["n23","n26"])
        if kind=="heavy":
            var nodes:Dictionary={};_candidate_index(probe,nodes)
            for id in ["n64","n74"]:
                var foot:Node3D=nodes[id]
                var meshes:Array=foot.find_children("*","MeshInstance3D",true,false)
                if foot is MeshInstance3D:meshes.append(foot)
                for mesh in meshes:
                    var trans:Transform3D=probe.global_transform.affine_inverse()*mesh.global_transform
                    var bounds:AABB=mesh.mesh.get_aabb()
                    for x in [bounds.position.x,bounds.end.x]:
                        for z in [bounds.position.z,bounds.end.z]:heavy_boot_corners.append(trans*Vector3(x,bounds.position.y,z))
            var lowest:=INF
            for point in heavy_boot_corners:lowest=minf(lowest,point.y)
            heavy_boot_corners=heavy_boot_corners.filter(func(point):return point.y<=lowest+0.005)
        probe.queue_free()

func _terrain_collision() -> void:
    terrain_body = StaticBody3D.new(); terrain_body.name = "OriginalSaihojiTerrainCollision"; add_child(terrain_body)
    for node in model.find_children("*", "MeshInstance3D", true, false):
        var path := str(node.get_meta("extras", {}).get("sourcePath", ""))
        if path.begins_with("leviathanGroup["): continue
        var name_l := path.get_file().get_slice("[",0).to_lower() if not path.is_empty() else str(node.name).to_lower()
        var parent_name:=str(node.get_parent().name)
        var parent_source:=str(node.get_parent().get_meta("extras",{}).get("sourcePath","")).get_file()
        if not (name_l in ["planet-surface","mossy-terrain","leviathan-crust-plate","leviathan-terrain-topography"] or name_l.begins_with("leviathan-moss-bed") or parent_name=="mossyGround" or parent_source.begins_with("mossyGround[")): continue
        var center: Vector3 = node.global_transform * node.get_aabb().get_center()
        if center.length() > 1.0 and center.normalized().angle_to(hub) * 160.0 > 65.0: continue
        var shape := CollisionShape3D.new(); shape.shape = node.mesh.create_trimesh_shape()
        terrain_body.add_child(shape); shape.global_transform = node.global_transform; collision_mesh_count += 1

func _ground(direction: Vector3) -> Vector3:
    var dir := direction.normalized()
    var query := PhysicsRayQueryParameters3D.create(dir * 210.0, dir * 130.0)
    var hit := get_world_3d().direct_space_state.intersect_ray(query)
    ground_samples += 1
    if not hit.is_empty(): return hit.position + dir * 0.22
    ground_fallbacks += 1
    return dir * 160.3

func _setup_view() -> void:
    var env := WorldEnvironment.new(); env.environment = Environment.new(); env.environment.background_mode = Environment.BG_COLOR
    env.environment.background_color = Color("91b6ce"); env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.environment.ambient_light_color = Color("d8e5ea"); env.environment.ambient_light_energy = 0.8; add_child(env)
    var sun := DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-45,-30,0); sun.light_energy = 1.2; add_child(sun)
    camera = Camera3D.new(); camera.far = 1400; camera.near = 0.1; camera.fov = 55; add_child(camera); camera.current = true; _camera()
    var layer := CanvasLayer.new(); add_child(layer)
    var panel := HBoxContainer.new(); panel.position = Vector2(16,16); layer.add_child(panel)
    var title := Label.new(); title.text = "苔庭之战"; panel.add_child(title)
    var begin := Button.new(); begin.text = "开始苔庭守卫任务"; begin.pressed.connect(begin_battle); panel.add_child(begin)
    var reset_button := Button.new(); reset_button.text = "结束并复位"; reset_button.pressed.connect(reset_battle); panel.add_child(reset_button)
    var mute:=CheckButton.new();mute.text="本场静音";mute.toggled.connect(func(value:bool):music.set_muted(value));panel.add_child(mute)
    var back:=Button.new();back.text="返回球形原世界";back.pressed.connect(func():reset_battle();get_tree().change_scene_to_file("res://scenes/original_world.tscn"));panel.add_child(back)
    var close := Button.new(); close.text = "近看阵列"; close.pressed.connect(func(): camera_focus="defenders";distance=18;pitch=0.38;_camera()); panel.add_child(close)
    var wide := Button.new(); wide.text = "看完整战场"; wide.pressed.connect(func(): camera_focus="battle";distance=88;_camera()); panel.add_child(wide)
    var watch_kun:=Button.new();watch_kun.text="看鲲反抗";watch_kun.pressed.connect(func():camera_focus="kun";distance=35;pitch=0.3;_camera());panel.add_child(watch_kun)
    status = Label.new(); status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; status.custom_minimum_size.x = 310; status.position=Vector2(16,62); layer.add_child(status)
    beam = _line(Color(0.6,0.95,0.85,0.18), 1.3); beam.visible = false; add_child(beam)

func begin_battle() -> void:
    if not ready_for_battle or director.running: return
    reset_battle()
    var blue_ids: Array = []
    for ship in range(2):
        for index in range(25): blue_ids.append("blue-%d-%d" % [ship,index])
    for ship in range(100,106):
        for index in range(9): blue_ids.append("blue-%d-%d" % [ship,index])
    var heavy_ids: Array = []
    for i in range(27): heavy_ids.append("vanguard-%d" % i)
    var fleet_ids: Array = []
    for i in range(fleet_members.size()): fleet_ids.append("moebius-%d" % i)
    director.configure(fleet_ids, blue_ids, heavy_ids)
    battle_rng.seed = battle_seed
    battle_started = director.start()

func reset_battle() -> void:
    director.reset(); music.reset(); battle_started = false
    load_error=initial_load_error;outcome_message=""
    for rows in [troops, heavies, ships, crafts, projectiles]:
        for row in rows:
            if is_instance_valid(row.node): row.node.queue_free()
        rows.clear()
    swallowed.clear(); events.clear()
    reinforcement_count=0;reinforcement_wait=20.0
    landing_planner.release_all()
    for rope in ropes: rope.queue_free()
    ropes.clear()
    for i in range(escort_pods.size()): escort_pods[i].global_transform = escort_original[i]
    gatepod_visual.reset()
    socco_transport.reset()
    warship_visual.reset()
    if jaw: _set_kun_mouth(0.0,0.0)
    kun.transform = kun_original
    garden_island.transform = garden_island_original
    garden_island.position.y=maxf(6.08,(root_support.dry_plate_radius-kun.position.length())/0.5)
    for i in range(fleet_members.size()): fleet_members[i].transform = fleet_original[i]
    elapsed = 0.0; route_t = 0.0; lift_target = 0.0; lift_value = 0.0; returning = false
    fleet_center = fleet_origin; shot_serial = 0; swallow_serial = 0; swallow_t = 0.0; assault_t = 0.0
    kun_turning=false
    kun_counter_offset=Vector3.ZERO;kun_counter_return=false
    aircraft_visual.tick(0.0,1.0,false)
    if beam: beam.visible = false
    _update_status()

func _on_event(event: Dictionary) -> void:
    events.append(event.duplicate(true))
    match event.type:
        "ship_departure_requested": _launch_ship(str(event.ship_id))
        "resistance_enabled": music.play_effect("phalanx_alarm",landing*160.0)
        "suction_changed": music.play_effect("kun_step",kun.global_position)
        "whale_lift_requested": lift_target = float(event.target)
        "assault_requested": _launch_heavies(event.direction)
        "withdrawal_requested": returning = true; return_hold = 3.2
        "bgm_intent":
            match event.cue:
                "kun_prelude_once": music.cue()
                "kun_storm_once": music.begin_battle()
                "fleet_assault": music.set_fleet_active(true)
                "": music.end_battle()
        "round_completed":
            music.end_battle(); music.set_fleet_active(false)
            kun.basis=kun_original.basis
        "cleanup_requested":
            music.reset()
            if event.get("reason","")=="anti_air_exhausted":outcome_message="防空力量耗尽，鲲仍受吸取。可重新开始。"
            elif event.get("reason","")=="defenders_defeated":outcome_message="蓝盔守卫已倒下。可重新开始。"

func _physics_process(delta: float) -> void:
    if not ready_for_battle or not director.running: return
    elapsed += delta
    _patrol(delta)
    lift_value = move_toward(lift_value, lift_target, delta * 0.095)
    kun.position = (hub * 160.0 + kun_counter_offset).normalized() * lerpf(147.0, 184.0, lift_value)
    garden_island.position.y = maxf(6.08,(root_support.dry_plate_radius-kun.position.length())/0.5)
    _kun_retaliation(delta)
    _reinforcements(delta)
    _ships(delta); _soldiers(delta); _assault(delta); _projectiles(delta); _swallow(delta)
    var scan_distance := fleet_center.normalized().angle_to(hub) * 160.0
    director.tick(delta, {"fleet_present": true, "fleet_ground_dir": fleet_center.normalized(), "near": scan_distance < 68.0, "far": scan_distance > 78.0, "drum_active": mission_drumming, "whale_lift": lift_value})
    if director.phase == "fight" and not director.snapshot().formation:
        var first_wave:=troops.filter(func(t):return int(t.id.get_slice("-",1))<2)
        if first_wave.size() == 50 and first_wave.all(func(t): return t.state == "formed" or t.state == "down"):
            director.report_formation_ready()
    beam.visible = lift_value > 0.01 and scan_distance < 78.0
    aircraft_visual.tick(elapsed,1.0-float(director.snapshot().sink_step)/6.0,beam.visible)
    if beam.visible: _place_line(beam, kun.position + hub * 7.0, fleet_center, 1.3)
    if troops.size()>=50 and reinforcement_count>=6 and troops.all(func(t):return t.state=="down") and director.phase=="fight":
        director.stop("defenders_defeated")
    _check_defeat()
    if camera_focus!="battle":_camera()
    _update_status()

func _check_defeat()->void:
    # Explicit native mission rule: do not leave an irrecoverable anti-air objective running.
    # All supplies must have landed and every in-flight attack must have resolved.
    if director.phase!="fight" or reinforcement_count<6 or ships.any(func(s):return s.state=="out"):return
    if projectiles.any(func(p):return p.kind in ["arrow","javelin"]):return
    if troops.any(func(t):return t.state!="down" and t.role in ["spear","longbow"]):return
    director.stop("anti_air_exhausted")

func _patrol(delta: float) -> void:
    # Source-style independent shuttle: travel then hold, never held by infantry.
    route_t += delta
    var period := 184.0
    var t := fmod(route_t, period)
    var target_dir := hub
    var origin_dir := fleet_origin.normalized()
    var blend := 0.0
    if t < 56.0: blend = t / 56.0
    elif t < 92.0: blend = 1.0
    elif t < 148.0: blend = 1.0 - (t - 92.0) / 56.0
    fleet_center = origin_dir.slerp(target_dir, blend).normalized() * 195.0
    var old_up := fleet_origin.normalized()
    var new_up := fleet_center.normalized()
    var rotation := Basis(Quaternion(old_up,new_up))
    for i in range(fleet_members.size()):
        var offset := fleet_original[i].origin - fleet_origin
        fleet_members[i].position = fleet_center + rotation * offset
        fleet_members[i].basis = rotation * fleet_original[i].basis
    if director.assault_phase in ["idle","done"]:
        for i in range(escort_pods.size()):
            escort_pods[i].global_position = fleet_center + rotation * (escort_original[i].origin - fleet_origin)
            escort_pods[i].global_basis = rotation * escort_original[i].basis

func _reinforcements(delta:float)->void:
    # Original deployed supply line: first after 20 s, then 30 s, at most six 3x3 ships.
    if mission_drumming or returning or director.phase!="fight" or reinforcement_count>=6:return
    reinforcement_wait-=delta
    if reinforcement_wait<=0.0:
        _launch_ship("saihoji-warship-%d"%(100+reinforcement_count))
        reinforcement_count+=1;reinforcement_wait=30.0

func _launch_ship(id: String) -> void:
    var index := int(id.get_slice("-",2))
    var node: Node3D = prefabs.ship.instantiate(); node.name = id; add_child(node)
    var visual: Dictionary = warship_visual.bind(node)
    if visual.is_empty(): load_error = "传统战船 v6 节点绑定失败"; node.queue_free(); return
    var row := {"node": node, "visual":visual, "id": id, "index": index, "u": 0.0, "state": "out", "land_reported": false}
    ships.append(row)
    var grid:=3 if index>=100 else 5
    for i in range(grid*grid):
        var x := i % grid; var z := int(i / grid)
        var edge := maxi(absi(x-2), absi(z-2)); var man := absi(x-2)+absi(z-2)
        var role := "spear" if edge >= 2 else ("gladius" if man == 2 else "longbow")
        var actor: Node3D = prefabs[role].instantiate(); actor.name = "blue-%d-%d" % [index,i]; add_child(actor)
        var nodes: Dictionary = {}; _candidate_index(actor,nodes)
        var formation_origin:=landing
        if index>=100:
            var angle:float=(index-100)*2.399963
            formation_origin=(landing*cos(12.0/160.0)+east*cos(angle)*sin(12.0/160.0)+north*sin(angle)*sin(12.0/160.0)).normalized()
        var requested:Vector3=formation_origin + east*((x-2)*0.008+(index*0.035 if index<2 else 0.0)) + north*((z-2)*0.008)
        var point:Vector3=landing_planner.reserve(requested.normalized()*160.8)
        if point==Vector3.ZERO:
            load_error="苔庭干燥站位不足，无法继续部署";actor.queue_free();director.stop("landing_capacity_exhausted");return
        point+=point.normalized()*(float(foot_offsets[role])-0.22)
        troops.append({"node": actor, "id": str(actor.name), "role": role, "ship": id, "index": i, "state": "aboard", "hp": 2, "shield_broken": false, "grudge": 0.0, "cooldown": i*0.11, "pose_time": i*0.08, "last_pose": -1, "nodes": nodes, "slot": point})

func _candidate_index(node: Node, result: Dictionary) -> void:
    var extras: Dictionary = node.get_meta("extras", {})
    var id := str(extras.get("three_node_id", extras.get("roman_family_added_id", extras.get("kun_added_id", extras.get("vanguard_added_id", extras.get("id", ""))))))
    if id.is_empty():
        var name_s := str(node.name)
        if name_s.begins_with("n") and name_s.get_slice("_",0).substr(1).is_valid_int(): id = name_s.get_slice("_",0)
    if not id.is_empty(): result[id] = node
    if node is Node3D and (extras.get("candidateHidden",false) or not extras.get("three_visible",true)):node.visible=false
    for child in node.get_children(): _candidate_index(child,result)

func _route(u: float) -> Vector3:
    if u < 0.44: return castle_dir.lerp(junction_dir,u/0.44).normalized()
    if u < 0.56: return junction_dir
    return junction_dir.lerp(landing,(u-0.56)/0.44).normalized()

func _ships(delta: float) -> void:
    if returning: return_hold = maxf(0.0,return_hold-delta)
    for ship in ships:
        if ship.state == "out":
            ship.u = minf(1.0,ship.u+delta/34.0)
            _orient_ship(ship.node,ship.u,true)
            if ship.u >= 1.0:
                ship.state = "docked"
                for tr in troops:
                    if tr.ship == ship.id: tr.state = "landing"
                if ship.index<2:director.report_landing(ship.id)
                else:events.append({"type":"reinforcement_landed","ship_id":ship.id,"time":elapsed})
        elif ship.state == "docked" and returning and return_hold <= 0.0:
            for tr in troops:
                if tr.ship == ship.id and tr.state not in ["down","aboard"]: tr.state = "boarding"
            if troops.filter(func(t): return t.ship == ship.id).all(func(t): return t.state in ["aboard","down"]): ship.state = "back"
        elif ship.state == "back":
            ship.u = maxf(0.0,ship.u-delta/34.0)
            _orient_ship(ship.node,ship.u,false)
            if ship.u <= 0.0: ship.state = "returned"; ship.node.visible = false
        warship_visual.tick(ship.visual,delta,ship.state in ["out","back"] and not (ship.u >= 0.44 and ship.u < 0.56))
    if returning and ships.size()>=2 and ships.all(func(s):return s.state=="returned") and crafts.all(func(c):return c.node.position.distance_to(fleet_center)<5.0): director.report_withdrawal_complete()

func _orient_ship(node: Node3D, u: float, outbound: bool) -> void:
    var pos := _route(u)*160.18
    var tangent := _route(minf(1.0,u+0.002))-_route(maxf(0.0,u-0.002))
    if tangent.length_squared()<0.00000001: tangent = _route(0.44)-_route(0.438)
    if not outbound: tangent = -tangent
    _orient(node,pos,pos+tangent,1.7)

func _orient(node: Node3D, pos: Vector3, target: Vector3, size: float = 1.0) -> void:
    var up := pos.normalized(); var front := (target-pos).slide(up).normalized()
    if front.length_squared()<0.01: front = east.slide(up).normalized()
    var side := front.cross(up).normalized()
    var facing := Basis(up.cross(front).normalized(),up,front) if node.get_meta("forward_plus_z",false) else Basis(front,up,side)
    node.transform = Transform3D(facing.scaled(Vector3.ONE*size),pos)

func _soldiers(delta: float) -> void:
    for tr in troops:
        var actor: Node3D = tr.node
        if tr.state == "down": continue
        var ship = ships.filter(func(s):return s.id==tr.ship)[0]
        if tr.state == "aboard":
            var deck: Vector3 = ship.node.global_position + ship.node.global_basis.y.normalized()*0.65 + ship.node.global_basis.x.normalized()*((tr.index%5-2)*0.45) + ship.node.global_basis.z.normalized()*((int(tr.index/5)-2)*0.28)
            _orient(actor,deck,fleet_center)
        elif tr.state in ["landing","boarding"]:
            var target: Vector3 = tr.slot if tr.state=="landing" else ship.node.global_position+landing*0.6
            var next: Vector3 = actor.position.move_toward(target,delta*2.6)
            _orient(actor,next,target)
            if next.distance_to(target)<0.08: tr.state = "formed" if tr.state=="landing" else "aboard"
        elif tr.state == "formed":
            if _retaliate(tr,delta): continue
            _orient(actor,actor.position.move_toward(tr.slot,delta*2.6),fleet_center)
            tr.cooldown -= delta
            if director.whale_phase == "resisting" and director.snapshot().formation and not returning:
                if tr.role == "longbow":
                    tr.pose_time += delta
                    var frames: Array = assembly[tr.role].poseFrames
                    var frame_index := int(fmod(tr.pose_time*120.0,frames.size()))
                    _pose(tr,frames[frame_index])
                    var previous := int(tr.last_pose)
                    var steps := (frame_index - previous + frames.size()) % frames.size() if previous >= 0 else 0
                    for offset in range(1, steps + 1):
                        var crossed := (previous + offset) % frames.size()
                        if bool(frames[crossed].get("released",false)) and tr.cooldown <= 0.0:
                            _fire(tr, fleet_members[shot_serial%fleet_members.size()], "arrow",45.0)
                            tr.cooldown = 2.6 + battle_rng.randf()*1.6
                    tr.last_pose = frame_index
                elif tr.role == "spear" and tr.cooldown <= 0.0:
                    _fire(tr,fleet_members[tr.index%fleet_members.size()],"javelin",38.0); tr.cooldown=11.0+battle_rng.randf()*7.0
                if tr.role == "gladius" and tr.cooldown<=0.0:
                    for enemy in heavies:
                        if enemy.state=="ground" and enemy.node.position.distance_to(actor.position)<1.7:
                            _damage_heavy(enemy,"melee"); tr.cooldown=1.15
                            break

func _pose(tr: Dictionary, frame: Dictionary) -> void:
    for id in frame.transforms:
        if not tr.nodes.has(id): continue
        var a: Array = frame.transforms[id]
        tr.nodes[id].transform = Transform3D(Basis(Vector3(a[0],a[1],a[2]),Vector3(a[4],a[5],a[6]),Vector3(a[8],a[9],a[10])),Vector3(a[12],a[13],a[14]))
    if frame.has("arrowVisible") and tr.nodes.has("n67"): tr.nodes["n67"].visible = bool(frame.arrowVisible)

func _fire(shooter: Dictionary, target: Node3D, kind: String, speed: float) -> void:
    var start: Vector3 = shooter.node.position + shooter.node.position.normalized()*0.6
    if shooter.has("nodes") and kind == "arrow" and shooter.nodes.has("n67"):
        start = shooter.nodes["n67"].global_position
    if kind=="bolt" and shooter.nodes.has("n39"):
        _heavy_pose(shooter,0.0)
        start=shooter.nodes.n39.to_global(Vector3(0,0,0.47))
    var end: Vector3 = target.global_position
    if kind=="bolt":
        var separation:=start.distance_to(end)
        var hit_chance:=0.86/(1.0+separation/280.0)
        if _vt_hash(int(shooter.id.get_slice("-",1))+1,int(shooter.bolt_shots)*7+3)>=hit_chance:
            var axis:Vector3=(end-start).normalized().cross(end.normalized()).normalized()
            var side:=1.0 if _vt_hash(int(shooter.id.get_slice("-",1))+1,int(shooter.bolt_shots)*13+5)>0.5 else -1.0
            end+=axis*side*(1.0+1.1*_vt_hash(int(shooter.id.get_slice("-",1))+1,int(shooter.bolt_shots)*17+7))
    var flight := start.distance_to(end)/speed if kind=="bolt" else (1.15 if kind=="arrow" else 1.5)
    var spread := 6.0 if kind=="arrow" else 6.4
    var aim_offset := Vector3((battle_rng.randf()-0.5)*spread,(battle_rng.randf()-0.5)*spread*0.5,(battle_rng.randf()-0.5)*spread) if kind!="bolt" else Vector3.ZERO
    var velocity := (end-start)/maxf(0.01,flight)
    var node := _line(Color("e5c985") if kind!="bolt" else Color("91ffff"),0.035); add_child(node)
    shot_serial += 1
    projectiles.append({"node":node,"id":"shot-%d"%shot_serial,"shooter":shooter.id,"target":target,"kind":kind,"pos":start,"velocity":velocity,"from":start,"to":end+aim_offset,"offset":aim_offset,"arc_up":start.normalized(),"fly":0.0,"duration":flight,"life":flight+0.8})

func _projectiles(delta: float) -> void:
    for index in range(projectiles.size()-1,-1,-1):
        var p := projectiles[index]; var start: Vector3=p.pos; var next: Vector3=start+p.velocity*delta
        p.fly += delta / maxf(0.01,p.duration)
        if p.kind!="bolt" and is_instance_valid(p.target):
            p.to = p.to.lerp(p.target.global_position+p.offset,minf(1.0,delta*(2.1 if p.kind=="arrow" else 1.7)))
            var progress := minf(1.0,p.fly)
            next = p.from.lerp(p.to,progress)+p.arc_up*sin(progress*PI)*(3.2 if p.kind=="arrow" else 4.5)
            p.velocity=(next-start)/maxf(delta,0.001)
            if p.fly>1.0: p.life=0.0
        p.life-=delta; var hit:=false
        var obstacle := get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(start,next))
        if not obstacle.is_empty(): hit=true;blocked_projectiles+=1
        if not hit and is_instance_valid(p.target):
            var center: Vector3=p.target.global_position
            var nearest := Geometry3D.get_closest_point_to_segment(center,start,next)
            var radius := 4.8 if p.kind!="bolt" else 0.7
            if nearest.distance_to(center)<radius:
                hit=true
                events.append({"type":"projectile_contact","shot_id":p.id,"shooter_id":p.shooter,"kind":p.kind,"distance":nearest.distance_to(center),"radius":radius,"time":elapsed})
                if p.kind!="bolt":
                    var aircraft_index:=fleet_members.find(p.target)
                    if aircraft_index>=0: director.report_fleet_hit(p.id,p.shooter,"moebius-%d"%aircraft_index,p.kind)
                    else:
                        for enemy in heavies:
                            if enemy.node==p.target:
                                if battle_rng.randf() < (0.55 if p.kind=="arrow" else 0.4): events.append({"type":"vanguard_deflect","unit_id":enemy.id,"time":elapsed})
                                else: _damage_heavy(enemy,p.kind)
                                break
                else:
                    for tr in troops:
                        if tr.node==p.target and tr.state!="down":
                            _hit_blue(tr,"bolt",p.shooter)
                            break
        p.pos=next;_place_line(p.node,next,next-p.velocity.normalized()*0.65,0.035)
        if hit or p.life<=0.0: p.node.queue_free();projectiles.remove_at(index)

func _launch_heavies(direction:Vector3) -> void:
    assault_hub=direction.normalized();assault_east=Vector3.UP.cross(assault_hub).normalized();assault_north=assault_hub.cross(assault_east).normalized()
    for row in heavies+crafts:
        if is_instance_valid(row.node):
            if row.node.get_parent():row.node.get_parent().remove_child(row.node)
            row.node.queue_free()
    heavies.clear();crafts.clear()
    for rope in ropes:rope.queue_free()
    ropes.clear()
    assault_t=0.0;combat_elapsed=0.0;assault_origin=fleet_center
    music.set_fleet_active(true)
    socco_transport.reset()
    var used_berths:Array=[]
    for i in range(3):
        var craft:Node3D=prefabs.hauler.instantiate();add_child(craft);craft.name="socco-%d"%i;craft.set_meta("forward_plus_z",true)
        var row:Dictionary=socco_transport.add(craft)
        var candidates:Array=[]
        if assault_hub.angle_to(landing)*160.0<40.0:candidates.assign(landing_planner.available)
        else:candidates.append(assault_hub*160.5+assault_east*[-8.0,8.0,0.0][i])
        socco_transport.solve(row,get_world_3d(),candidates,assault_hub*160.5+assault_east*[-8.0,8.0,0.0][i],assault_hub*160.0,used_berths)
        if row.valid:used_berths.append(row.target.origin)
        socco_transport.set_angle(row,PI/2)
        crafts.append({"node":craft,"index":i,"transport":row})
    for i in range(27):
        var actor:Node3D=prefabs.heavy.instantiate();add_child(actor);actor.name="vanguard-%d"%i;actor.set_meta("forward_plus_z",true)
        var slot:=_ground((assault_hub+assault_east*(0.03+(i%9)*0.008)+assault_north*(0.08+int(i/9)*0.008)).normalized())
        if assault_hub.angle_to(landing)*160.0<40.0:
            var dry:Vector3=landing_planner.reserve(slot)
            if dry==Vector3.ZERO:
                actor.queue_free();load_error="重甲登陆区没有足够干燥站位";director.stop("landing_capacity_exhausted");return
            slot=dry+dry.normalized()*(float(foot_offsets.heavy)-0.22)
        else:slot+=slot.normalized()*(float(foot_offsets.heavy)-0.22)
        var native_nodes:Dictionary={};_candidate_index(actor,native_nodes)
        var pod_rider := i < 6
        var vehicle := int(i / 2) if pod_rider else int((i-6)/7)
        var guard := not pod_rider and (i-6)%7 == 6
        var rope := _line(Color("d4cbb3"),0.025);add_child(rope);rope.visible=false;ropes.append(rope)
        heavies.append({"node":actor,"id":"vanguard-%d"%i,"state":"guarding" if guard else "aboard","life":3,"arrow_hits":0,"javelin_hits":0,"melee_hits":0,"bolt_phase":"idle","bolt_t":0.0,"bolt_charge":0.0,"bolt_shots":0,"swing_t":0.0,"melee_active":false,"blade_flash":0.0,"visual_state":"","visual_t":0.0,"nodes":native_nodes,"slot":slot,"cooldown":i*0.1,"kind":"pod" if pod_rider else "hauler","vehicle":vehicle,"seat":i%2 if pod_rider else (i-6)%7,"path_step":0,"ground_waypoint_done":false,"guard":guard,"rope":rope})

func _assault(delta:float)->void:
    if heavies.is_empty():return
    assault_t+=delta
    var stage:String=director.assault_phase
    if stage == "combat":
        combat_elapsed += delta
        var alive_defenders := troops.filter(func(t):return t.state!="down").size()
        var alive_fighters := heavies.filter(func(h):return h.state!="down" and not h.guard).size()
        if alive_defenders <= 2 or alive_fighters <= 12 or combat_elapsed >= 90.0:
            director.report_assault_stage("withdraw")
            stage=director.assault_phase
    if stage=="approach" and crafts.any(func(c):return not c.transport.valid):
        events.append({"type":"socco_berth_rejected","time":elapsed,"reason":"Actual terrain cannot support rear ramp; occupied craft withdraws"})
        director.report_assault_stage("withdraw");stage=director.assault_phase
    for craft in crafts:
        var row:Dictionary=craft.transport
        var target:Vector3=row.target.origin if row.valid else assault_origin
        var pos:Vector3=assault_origin.lerp(target,minf(assault_t/8.0,1.0))
        if stage == "done":pos=craft.node.position.move_toward(fleet_center,delta*12.0)
        craft.node.transform=Transform3D(row.target.basis if row.valid else Basis.IDENTITY,pos)
        var desired:float=row.open_angle if stage in ["insert","combat","withdraw","extract"] and row.valid else PI/2
        if stage in ["withdraw","extract"] and heavies.filter(func(h):return h.kind=="hauler" and h.vehicle==craft.index).all(func(h):return h.state in ["aboard","guarding","down"]):desired=PI/2
        var old_angle:float=row.angle
        socco_transport.set_angle(row,move_toward(row.angle,desired,delta*1.4))
        if absf(row.angle-row.open_angle)<0.001 and (row.triangles.is_empty() or absf(old_angle-row.angle)>0.00001):socco_transport.cache_surface(row)
    for i in range(escort_pods.size()):
        var pod_pos := assault_origin.lerp(_ground(assault_hub)+assault_hub*9.0+assault_east*[-7.0,7.0,0.0][i]+assault_north*[-6.0,-6.0,-13.0][i],minf(assault_t/8.0,1.0))
        if stage == "done": pod_pos=escort_pods[i].position.move_toward(fleet_center,delta*12.0)
        _orient(escort_pods[i],pod_pos,landing*160.0,escort_original[i].basis.get_scale().x)
        gatepod_visual.set_deployment(i,1.0 if stage in ["insert","combat","withdraw","extract"] else 0.0)
    if stage=="approach" and crafts.all(func(c):return c.transport.valid and c.node.position.distance_to(c.transport.target.origin)<0.1):director.report_assault_stage("insert")
    var all_ground:=true
    for enemy in heavies:
        if enemy.state=="down" or enemy.state=="swallowed":continue
        var carrier: Node3D = escort_pods[enemy.vehicle] if enemy.kind == "pod" and escort_pods.size() == 3 else crafts[enemy.vehicle].node
        if enemy.kind=="hauler" and _socco_passenger(enemy,delta):continue
        if enemy.guard:
            _orient(enemy.node,carrier.position+carrier.basis.y.normalized()*0.5,carrier.position+carrier.basis.z.normalized()*3.0)
            continue
        enemy.rope.visible = enemy.kind == "pod" and enemy.state in ["descending","extracting"]
        if enemy.rope.visible: _place_line(enemy.rope,carrier.global_position,enemy.node.position,0.025)
        var boarding:Vector3=_pod_hang_position(enemy,carrier) if enemy.kind=="pod" else carrier.position
        if enemy.state=="aboard":
            enemy.node.position=boarding
            if director.assault_phase=="insert":enemy.state="descending"
        if enemy.state=="descending":
            var next:Vector3=enemy.node.position.move_toward(enemy.slot,delta*3.5);_orient(enemy.node,next,landing*160.0)
            if next.distance_to(enemy.slot)<0.05:enemy.state="ground"
            else:all_ground=false
        if enemy.state=="ground" and director.assault_phase in ["insert","combat"] and not enemy.guard:
            enemy.cooldown-=delta
            var candidates:=troops.filter(func(t):return t.state=="formed")
            var threat_ids:Array=director.snapshot().threat_ids
            var preferred:=candidates.filter(func(t):return t.id in threat_ids)
            if not preferred.is_empty():candidates=preferred
            candidates.sort_custom(func(a,b):return a.node.position.distance_squared_to(enemy.node.position)<b.node.position.distance_squared_to(enemy.node.position))
            if not candidates.is_empty():
                var foe=candidates[0]
                var dest:Vector3=_actor_ground(enemy.node.position.move_toward(foe.node.position,delta*0.85 if director.assault_phase=="combat" else 0.0),"heavy")
                if assault_hub.angle_to(landing)*160.0<40.0 and dest.length()<160.607+float(foot_offsets.heavy)-0.02:dest=enemy.node.position
                _orient(enemy.node,dest,foe.node.position)
                var separation:float=enemy.node.position.distance_to(foe.node.position)
                enemy.melee_active=separation<=3.0
                enemy.blade_flash=maxf(0.0,enemy.blade_flash-delta)
                enemy.swing_t+=delta
                if separation<=3.0 and enemy.swing_t>=0.7:
                    enemy.swing_t=0.0;_hit_blue(foe,"blade",enemy.id)
                    enemy.blade_flash=0.18
                var fired:=_charge_bolt(enemy,delta,separation>3.0 and separation<=500.0)
                if fired:
                    enemy.bolt_shots+=1
                    _fire(enemy,foe.node,"bolt",30.0)
        if returning and director.assault_phase=="combat":director.report_assault_stage("withdraw")
        if director.assault_phase in ["withdraw","extract"]:
            enemy.state="extracting"
            enemy.node.position=enemy.node.position.move_toward(boarding,delta*5.0)
            if enemy.node.position.distance_to(boarding)<0.1:enemy.state="aboard";enemy.node.visible=false
    if all_ground and director.assault_phase=="insert" and heavies.all(func(h):return h.guard or h.state in ["ground","swallowed","down"]):director.report_assault_stage("combat")
    if director.assault_phase=="withdraw":director.report_assault_stage("extract")
    if director.assault_phase=="extract" and heavies.all(func(h):return h.state in ["aboard","down","guarding"]) and crafts.all(func(c):return absf(c.transport.angle-PI/2)<0.001):director.report_assault_stage("done");music.set_fleet_active(false)

    for enemy in heavies:
        if enemy.state!="down":_heavy_pose(enemy,delta)
        enemy.rope.visible=enemy.kind=="pod" and enemy.state in ["descending","extracting"]
        if enemy.rope.visible and enemy.nodes.has("add:rope-grip"):
            var carrier:Node3D=escort_pods[enemy.vehicle] if enemy.kind=="pod" else crafts[enemy.vehicle].node
            var anchor:Vector3=gatepod_visual.rope_anchor(enemy.vehicle,enemy.seat) if enemy.kind=="pod" else carrier.global_position
            _place_line(enemy.rope,anchor,enemy.nodes["add:rope-grip"].global_position,0.025)

func _socco_passenger(enemy:Dictionary,delta:float)->bool:
    var row:Dictionary=crafts[enemy.vehicle].transport
    var carrier:Node3D=row.node
    var seat:Vector3=socco_transport.seat(row,enemy.seat)
    var withdrawing:bool=director.assault_phase in ["withdraw","extract"]
    if row.triangles.is_empty():socco_transport.cache_surface(row)
    for id in ["n62","n63"]:
        if enemy.nodes.has(id):enemy.nodes[id].visible=enemy.state=="ground"
    if enemy.guard or (enemy.state=="aboard" and (not withdrawing or not row.valid)):
        var resting:Vector3=socco_transport.standing(row,seat,heavy_boot_corners)
        if not resting.is_finite():
            socco_transport.report.unsupported_samples+=1
            load_error="SOCCO 舱内足部支撑缺失，暂停通行";return true
        enemy.node.transform=carrier.global_transform*Transform3D(Basis(Vector3.UP,PI),resting)
        if enemy.guard:return true
        if director.assault_phase!="insert" or absf(row.angle-row.open_angle)>0.001:return true
        var waiting:=heavies.filter(func(h):return h.kind=="hauler" and h.vehicle==enemy.vehicle and h.state=="aboard" and not h.guard)
        waiting.sort_custom(func(a,b):return a.seat<b.seat)
        if not row.busy.is_empty() or waiting.is_empty() or waiting[0].id!=enemy.id:return true
        row.busy=enemy.id;enemy.state="walking_out";enemy.path_step=0
    if enemy.state=="ramp_clear" and not withdrawing:
        var goal:Vector3=enemy.slot
        if not enemy.ground_waypoint_done:
            var slot_local:Vector3=carrier.to_local(enemy.slot)
            goal=_actor_ground(carrier.global_transform*Vector3(2.5 if slot_local.x>=0 else -2.5,0,-2.62-2.9*cos(row.open_angle)-0.8),"heavy")
        var next:Vector3=_actor_ground(enemy.node.position.move_toward(goal,delta*1.2),"heavy")
        if next.length()<160.607+float(foot_offsets.heavy)-0.02:return true
        _orient(enemy.node,next,goal)
        if next.distance_to(goal)<0.1:
            if enemy.ground_waypoint_done:enemy.state="ground"
            else:enemy.ground_waypoint_done=true
        return true
    if enemy.state=="ground" and not withdrawing:return false
    if enemy.state=="aboard" and withdrawing:return true
    if withdrawing and enemy.state not in ["walking_in","aboard","guarding"]:
        var waiting:=heavies.filter(func(h):return h.kind=="hauler" and h.vehicle==enemy.vehicle and h.state not in ["aboard","guarding","down","swallowed"])
        waiting.sort_custom(func(a,b):return a.seat>b.seat)
        if row.busy!=enemy.id:
            if not row.busy.is_empty() or waiting.is_empty() or waiting[0].id!=enemy.id:return true
            row.busy=enemy.id
        enemy.state="walking_in";enemy.path_step=0
    if enemy.state not in ["walking_out","walking_in"]:return false
    if absf(row.angle-row.open_angle)>0.001:return true
    var tip_z:float=-2.62-2.9*cos(row.open_angle)
    var lane:float=seat.x
    var outside:Vector3=carrier.global_transform*Vector3(lane,-2,tip_z-0.8)
    var local:Vector3=carrier.to_local(enemy.node.position)
    var entering:bool=enemy.state=="walking_in"
    var path:Array=[Vector3(lane,0,-2.60),Vector3(lane,0,tip_z+0.10),Vector3(lane,0,tip_z-0.8)]
    if entering:
        if enemy.path_step==0:
            var target:Vector3=_actor_ground(outside,"heavy")
            var next:Vector3=_actor_ground(enemy.node.position.move_toward(target,delta*1.2),"heavy")
            _orient(enemy.node,next,target)
            if next.distance_to(target)<0.1:enemy.path_step=1
            return true
        path=[Vector3(lane,0,tip_z+0.10),Vector3(lane,0,-2.60),Vector3(lane,0,seat.z)]
    var step:int=enemy.path_step-1 if entering else enemy.path_step
    var aim:Vector3=path[mini(step,2)]
    var planar:Vector3=Vector3(local.x,0,local.z).move_toward(aim,delta*1.0)
    var next_local:Vector3=socco_transport.standing(row,planar,heavy_boot_corners)
    if not next_local.is_finite():
        # Beyond the physical ramp, feet use the same real terrain collider.
        var up:Vector3=carrier.global_basis.y.normalized()
        var global_pos:Vector3=carrier.global_transform*planar
        var query:=PhysicsRayQueryParameters3D.create(global_pos+up*1.0,global_pos-up*5.0);query.collision_mask=1
        var hit:=get_world_3d().direct_space_state.intersect_ray(query)
        if hit.is_empty() or Vector3(hit.position).length()<160.607:
            socco_transport.report.unsupported_samples+=1
            load_error="SOCCO 后门脚下失去干燥支撑，暂停通行";return true
        socco_transport.report.terrain_support_samples+=1
        var local_hit:Vector3=carrier.to_local(hit.position)
        next_local=Vector3(planar.x,local_hit.y+float(foot_offsets.heavy)-0.019,planar.z)
    enemy.node.transform=carrier.global_transform*Transform3D(Basis(Vector3.UP,PI),next_local)
    if Vector2(planar.x-aim.x,planar.z-aim.z).length()<0.025:
        enemy.path_step+=1
        if step==2:
            row.busy=""
            if entering:
                enemy.state="aboard";socco_transport.report.completed_entries+=1
                events.append({"type":"socco_passenger_boarded","id":enemy.id,"craft":str(carrier.name),"seat":enemy.seat,"time":elapsed})
            else:
                enemy.state="ramp_clear";socco_transport.report.completed_exits+=1
                events.append({"type":"socco_passenger_exited","id":enemy.id,"craft":str(carrier.name),"seat":enemy.seat,"time":elapsed})
    return true

func _pod_hang_position(enemy:Dictionary,carrier:Node3D)->Vector3:
    # Separate both bodies below the actual guides; keep their ropes' upper ends
    # fixed to the two exported mechanical anchor nodes.
    var anchor:Vector3=gatepod_visual.rope_anchor(enemy.vehicle,enemy.seat)
    var side:float=-1.0 if enemy.seat==0 else 1.0
    return anchor-carrier.global_basis.y.normalized()*2.4+carrier.global_basis.x.normalized()*side*0.75

func _render_inventory()->Array:
    var rows:Array=[]
    for subtree in model.get_children():
        var meshes:Array=subtree.find_children("*","MeshInstance3D",true,false)
        if subtree is MeshInstance3D:meshes.append(subtree)
        if meshes.is_empty():continue
        var visible_count:=0;var shadow_count:=0;var surfaces:=0
        for mesh in meshes:
            if mesh.is_visible_in_tree():
                visible_count+=1;surfaces+=mesh.mesh.get_surface_count()
                if mesh.cast_shadow!=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF:shadow_count+=1
        var multis:Array=subtree.find_children("*","MultiMeshInstance3D",true,false)
        var live_multis:=0;var gpu_instances:=0
        for multi in multis:
            if multi.is_visible_in_tree():live_multis+=1;gpu_instances+=multi.multimesh.instance_count
        rows.append({"source":subtree.get_meta("extras",{}).get("sourcePath",str(subtree.name)),"mesh_instances":meshes.size(),"visible_in_tree":visible_count,"visible_surfaces":surfaces,"visible_multimeshes":live_multis,"gpu_instances":gpu_instances,"shadow_enabled_visible":shadow_count,"visibility_scope":"Scene visibility; camera/frustum/occlusion not inferred"})
    rows.sort_custom(func(a,b):return a.visible_surfaces>b.visible_surfaces)
    return rows

func _rope_evidence()->Array:
    var rows:Array=[]
    for enemy in heavies:
        if enemy.kind!="pod" or not enemy.rope.visible:continue
        var hand:Vector3=enemy.nodes.n34.global_position
        var grip:Vector3=enemy.nodes["add:rope-grip"].global_position
        rows.append({"id":enemy.id,"seat":enemy.seat,"state":enemy.state,"pose_seconds":enemy.visual_t,"hand_to_grip":hand.distance_to(grip),"anchor":gatepod_visual.rope_anchor(enemy.vehicle,enemy.seat),"grip":grip,"hand":hand,"line_start_error":(enemy.rope.transform*Vector3(0,-0.5,0)).distance_to(gatepod_visual.rope_anchor(enemy.vehicle,enemy.seat)),"line_end_error":(enemy.rope.transform*Vector3(0,0.5,0)).distance_to(grip)})
    return rows

func _array_transform(a:Array)->Transform3D:
    return Transform3D(Basis(Vector3(a[0],a[1],a[2]),Vector3(a[4],a[5],a[6]),Vector3(a[8],a[9],a[10])),Vector3(a[12],a[13],a[14]))

func _heavy_pose(enemy:Dictionary,delta:float)->void:
    if heavy_frames.is_empty():return
    if enemy.visual_state!=enemy.state:enemy.visual_state=enemy.state;enemy.visual_t=0.0
    else:enemy.visual_t+=delta
    var frame:=0.0
    if enemy.state in ["descending","extracting"]:frame=lerpf(100,130,minf(1.0,enemy.visual_t/0.6))
    elif enemy.state=="swallowed":frame=100.0
    elif enemy.state=="ground":
        if enemy.blade_flash>0.0:frame=lerpf(60,75,1.0-enemy.blade_flash/0.18)
        elif enemy.melee_active:frame=lerpf(0,45,minf(1.0,enemy.swing_t/0.7))
        elif enemy.bolt_phase in ["charging","discharge"]:frame=lerpf(0,30,minf(1.0,enemy.bolt_charge/0.4))
        elif enemy.bolt_phase=="cooldown":frame=lerpf(30,0,minf(1.0,enemy.bolt_t/0.85))
    var lower:=clampi(int(floor(frame)),0,heavy_frames.size()-1)
    var upper:=mini(lower+1,heavy_frames.size()-1)
    for id in heavy_frames[lower]:
        if enemy.nodes.has(id):enemy.nodes[id].transform=heavy_frames[lower][id].interpolate_with(heavy_frames[upper][id],frame-floor(frame))

func _kun_retaliation(delta:float)->void:
    # Explicit encounter revision: face real attackers, never enlarge the mouth cone
    # or teleport victims to manufacture a swallow. The complete original root turns.
    if not swallowed.is_empty():return
    if returning or director.whale_phase!="resisting":
        var restored:=kun.basis.get_rotation_quaternion().slerp(kun_original.basis.get_rotation_quaternion(),minf(1.0,delta*0.65))
        kun.basis=Basis(restored).scaled(kun_original.basis.get_scale());kun_turning=false
        kun_counter_offset=kun_counter_offset.move_toward(Vector3.ZERO,delta*2.0);return
    if kun_counter_return:
        kun_counter_offset=kun_counter_offset.move_toward(Vector3.ZERO,delta*2.0)
        if kun_counter_offset.length()<0.02:kun_counter_return=false
        return
    if director.assault_phase not in ["insert","combat"]:return
    var enemies:=heavies.filter(func(h):return h.state=="ground" and not h.guard and h.node.position.distance_to(kun.position)<55.0)
    if enemies.is_empty():return
    var center:=Vector3.ZERO
    for enemy in enemies:center+=enemy.node.position/float(enemies.size())
    var desired:Vector3=(center-kun.position).slide(hub).normalized()
    var forward:Vector3=kun.basis.x.slide(hub).normalized()
    if desired.length_squared()<0.01 or forward.length_squared()<0.01:return
    var angle:=forward.signed_angle_to(desired,hub)
    if absf(angle)>0.02:
        if not kun_turning:events.append({"type":"kun_counter_turn","time":elapsed,"toward_enemy_ids":enemies.map(func(h):return h.id),"angle_radians":angle,"design_revision":"active facing; original mouth range/cone retained"})
        kun_turning=true
        kun.basis=Basis(hub,clampf(angle,-delta*0.22,delta*0.22))*kun.basis
    if absf(angle)<0.25:
        # The mouth sits 15 m ahead of the root. Retreat physically until the
        # actual attackers are in front of it; keep the source cone/range.
        var forward_distance:float=(center-kun.position).dot(forward)
        var needed:=clampf(18.0-forward_distance,0.0,10.0-kun_counter_offset.length())
        if needed>0.02:
            var step:=minf(delta*2.0,needed)
            var proposed:Vector3=(kun_counter_offset-forward*step).limit_length(10.0)
            var proposed_root:Vector3=(hub*160.0+proposed).normalized()*kun.position.length()
            var shift:Vector3=proposed_root-kun.position
            var mouth:Vector3=kun.global_transform*Vector3(30,-9,0)
            var ray:=PhysicsRayQueryParameters3D.create(mouth,mouth+shift)
            ray.collision_mask=1
            var obstructed:=not get_world_3d().direct_space_state.intersect_ray(ray).is_empty()
            for friend in troops:
                if friend.state=="formed" and friend.node.position.distance_to(mouth+shift)<2.0:obstructed=true
            if not obstructed:
                if kun_counter_offset.length()<0.01:events.append({"type":"kun_counter_retreat","time":elapsed,"max_distance":10.0,"max_speed":2.0,"source_mouth_range":26.0,"source_mouth_dot":0.15})
                kun_counter_offset=proposed

func _swallow(delta:float)->void:
    var mouth:Vector3=kun.global_transform*Vector3(30,-9,0)
    var front:=kun.global_basis.x.normalized()
    swallow_geometry={"time":elapsed,"mouth":mouth,"enemies":[]}
    for enemy in heavies:
        if enemy.state=="ground" and not enemy.guard:
            var offset:Vector3=enemy.node.position-mouth
            swallow_geometry.enemies.append({"id":enemy.id,"distance":offset.length(),"dot":offset.normalized().dot(front),"root_horizontal":(enemy.node.position-kun.position).slide(hub).length()})
    if swallowed.is_empty() and director.assault_phase in ["insert","combat"] and not returning:
        var available:=heavies.filter(func(h):return h.state=="ground" and h.node.position.distance_to(mouth)<26.0 and (h.node.position-mouth).normalized().dot(front)>0.15)
        available.sort_custom(func(a,b):return a.node.position.distance_squared_to(mouth)<b.node.position.distance_squared_to(mouth))
        var ids:Array=[]
        for h in available.slice(0,3):ids.append(h.id)
        if not ids.is_empty():
            swallow_serial+=1
            if director.report_whale_swallow("swallow-%d"%swallow_serial,ids):
                swallowed=available.slice(0,3);swallow_t=0.0
                for h in swallowed:h.state="swallowed";h["swallow_start"]=h.node.position
    if not swallowed.is_empty():
        swallow_t+=delta
        if jaw:
            var gape := minf(swallow_t/0.9,1.0) if swallow_t<5.9 else maxf(0.0,1.0-(swallow_t-5.9)/1.8)
            _set_kun_mouth(gape,gape*(0.8 if swallow_t>=3.5 else 0.45))
        for h in swallowed:
            if swallow_t<0.9:h.node.position=h.swallow_start
            elif swallow_t<3.5:h.node.position=h.swallow_start.lerp(mouth,clampf((swallow_t-0.9)/2.6,0.0,1.0))
            elif swallow_t<5.9:h.node.visible=false
            else:h.node.visible=true;h.node.position=mouth.lerp(h.slot,minf((swallow_t-5.9)/1.8,1.0))
        if swallow_t>=7.7:
            events.append({"type":"whale_expel_complete","time":elapsed,"enemy_ids":swallowed.map(func(h):return h.id),"opening_seconds":0.9,"pull_seconds":2.6,"hold_seconds":2.4,"expel_seconds":1.8})
            for h in swallowed:h.state="ground";h.cooldown=2.2
            swallowed.clear()
            kun_counter_return=true
            if jaw: _set_kun_mouth(0.0,0.0)

func _build_jaw() -> void:
    # Adopt only the edited original body and added mouth from the approved candidate.
    # World eyes, island, six live gardens and every existing transform stay attached.
    var candidate:Node3D=load("res://assets/kun-battle-v2/kun-battle-v2.glb").instantiate()
    add_child(candidate)
    var ids:Dictionary={};_candidate_index(candidate,ids)
    if not ids.has("n1") or not ids.has("add:jaw-pivot"):
        load_error="鲲候选缺少原身体或下颌节点";candidate.queue_free();return
    var original_body:Node3D=source_nodes.get("leviathanGroup[156]/leviathan-body[0]")
    original_body.visible=false
    var adopted:Array=[ids.n1,ids["add:jaw-pivot"],ids["add:mouth-roof"],ids["add:upper-lip-line"],ids["add:throat-membrane"]]
    for node in adopted:
        var local:Transform3D=node.transform
        node.reparent(kun,false);node.transform=local
        _candidate_index(node,kun_morph_nodes)
    for node in adopted:
        _adapt_kun_colors(node)
    jaw=ids["add:jaw-pivot"]
    if kun_morph_nodes.has("n2"):kun_morph_nodes.n2.visible=false
    candidate.queue_free();kun_candidate_active=true
    _set_kun_mouth(0.0,0.0)

func _adapt_kun_colors(node:Node)->void:
    if node is MeshInstance3D:
        for i in node.mesh.get_surface_count():
            var material=node.get_active_material(i)
            var colors=node.mesh.surface_get_arrays(i)[Mesh.ARRAY_COLOR]
            if material is StandardMaterial3D and colors!=null and colors.size()>0:
                var adapted=material.duplicate();adapted.vertex_color_use_as_albedo=true;adapted.vertex_color_is_srgb=false
                node.set_surface_override_material(i,adapted)
    for child in node.get_children():_adapt_kun_colors(child)

func _set_kun_mouth(gape:float,inflation:float)->void:
    if not kun_candidate_active:return
    var angle:=deg_to_rad(38.0)*gape
    jaw.rotation.z=-angle
    var weights:Dictionary={"add:throat-membrane":{"JawTurnSin":sin(angle)/sin(deg_to_rad(38.0)),"JawTurnCos":(1.0-cos(angle))/(1.0-cos(deg_to_rad(38.0)))},"add:jaw-shell":{"ThroatInflation":inflation},"add:lower-lip":{"LipFullness":gape}}
    weights["add:mouth-floor"]={"ThroatInflation":inflation}
    weights["add:inner-throat"]=weights["add:throat-membrane"].duplicate()
    for id in weights:
        var mesh:MeshInstance3D=kun_morph_nodes.get(id)
        if not mesh:continue
        for name in weights[id]:
            var index:=mesh.find_blend_shape_by_name(name)
            if index>=0:mesh.set_blend_shape_value(index,float(weights[id][name]))

func _line(color:Color,width:float)->MeshInstance3D:
    var node:=MeshInstance3D.new();var mesh:=CylinderMesh.new();mesh.top_radius=width;mesh.bottom_radius=width;mesh.height=1.0;mesh.radial_segments=6;node.mesh=mesh
    var mat:=StandardMaterial3D.new();mat.albedo_color=color;mat.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
    if color.a<1.0:mat.transparency=BaseMaterial3D.TRANSPARENCY_ALPHA
    node.material_override=mat;return node

func _place_line(node:Node3D,a:Vector3,b:Vector3,width:float)->void:
    var length:=a.distance_to(b)
    if length<0.001:return
    var up:Vector3=(b-a).normalized();var side:=up.cross(Vector3.RIGHT).normalized()
    if side.length()<0.1:side=up.cross(Vector3.FORWARD).normalized()
    node.transform=Transform3D(Basis(side,up*length,side.cross(up)),(a+b)*0.5)

func _camera()->void:
    if not camera:return
    var center:=landing*162.0+hub*8.0
    if camera_focus=="kun":center=kun.global_transform*Vector3(22,-8,0)
    elif camera_focus=="defenders":
        var live:=troops.filter(func(t):return t.state=="formed")
        if not live.is_empty():
            center=Vector3.ZERO
            for tr in live:center+=tr.node.position/float(live.size())
            center+=center.normalized()*0.65
    camera.position=center+distance*((east*cos(yaw)+north*sin(yaw))*cos(pitch)+hub*sin(pitch))
    camera.look_at(center,hub)

func _unhandled_input(event:InputEvent)->void:
    if event is InputEventMouseButton:
        if event.button_index==MOUSE_BUTTON_LEFT:dragging=event.pressed
        if event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN]:distance=clampf(distance*(0.88 if event.button_index==MOUSE_BUTTON_WHEEL_UP else 1.12),10,250);_camera()
    if event is InputEventMouseMotion and dragging:yaw-=event.relative.x*0.008;pitch=clampf(pitch+event.relative.y*0.006,0.1,1.3);_camera()

func _update_status()->void:
    if not status:return
    var names:Dictionary={"at_castle":"待命","prelude":"序曲","fight":"守卫苔庭","withdrawal":"撤军","complete":"鲲已脱离吸取","stopped":"任务结束"}
    var phase_name:String=names.get(director.phase,"运兵前往苔庭")
    var alive:=troops.filter(func(t):return t.state!="down").size()
    status.text="鼓息后运兵出发；拖动旋转、滚轮缩放。\n%s\n舰队受击 %d / 300 · 鲲回落 %d/6\n蓝盔守卫 %d · 重甲敌军 %d"%[phase_name,director.snapshot().hits,director.snapshot().sink_step,alive,heavies.filter(func(h):return h.state!="down").size()]
    if not outcome_message.is_empty():status.text+="\n"+outcome_message
    if not load_error.is_empty():status.text=load_error

func evidence()->Dictionary:
    return {"scope":"original-world native integration candidate; pending visual/gameplay acceptance","source_whale":"leviathanGroup[156]","six_scenes_preserved":garden!=null,"fleet_members":fleet_members.size(),"terrain_collision_meshes":collision_mesh_count,"jaw_triangles":jaw_triangles,"kun_candidate_active":kun_candidate_active,"water":water_result,"terrain_repair":terrain_result,"aircraft_visual":aircraft_visual.report,"gatepod_visual":gatepod_visual.report,"socco_transport":socco_transport.report,"transport_occupants":heavies.map(func(h):return {"id":h.id,"state":h.state,"kind":h.kind,"vehicle":h.vehicle,"seat":h.seat}),"render_inventory":_render_inventory(),"original_instances":original_instances_result,"pines":pine_visual.report,"root_support":root_support.report,"original_surfaces":original_surface_result,"landing_plan":landing_planner.report,"foot_offsets":foot_offsets,"heavy_pose_frames":heavy_frames.size(),"swallow_geometry":swallow_geometry,"ropes":_rope_evidence(),"feet":_feet_evidence(),"escort_pods":escort_pods.size(),"ground_samples":ground_samples,"ground_fallbacks":ground_fallbacks,"blocked_projectiles":blocked_projectiles,"state":director.snapshot(),"troops":troops.size(),"heavies":heavies.size(),"events":events.duplicate(true),"source_node_count":source_nodes.size(),"load_error":load_error}

func _measure_foot_offset(actor:Node3D,ids:Array)->float:
    var nodes:Dictionary={};_candidate_index(actor,nodes)
    var lowest:=INF
    for id in ids:
        var leg:Node3D=nodes.get(id)
        if not leg:continue
        var meshes:Array=leg.find_children("*","MeshInstance3D",true,false)
        if leg is MeshInstance3D:meshes.append(leg)
        for mesh in meshes:
            for surface in mesh.mesh.get_surface_count():
                for vertex in mesh.mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX]:
                    lowest=minf(lowest,actor.to_local(mesh.to_global(vertex)).y)
    if not is_finite(lowest):
        load_error="候选模型足部节点缺失";return 0.22
    return 0.02-lowest

func _actor_ground(direction:Vector3,kind:String)->Vector3:
    var point:=_ground(direction)
    return point+point.normalized()*(float(foot_offsets.get(kind,0.22))-0.22)

func _feet_evidence()->Array:
    var rows:Array=[]
    for tr in troops:
        if tr.state!="formed":continue
        var lowest:=INF
        for id in ["n23","n26"]:
            var leg:Node3D=tr.nodes.get(id)
            if not leg:continue
            var meshes:Array=leg.find_children("*","MeshInstance3D",true,false)
            if leg is MeshInstance3D:meshes.append(leg)
            for mesh in meshes:
                for surface in mesh.mesh.get_surface_count():
                    for vertex in mesh.mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX]:
                        lowest=minf(lowest,(mesh.global_transform*vertex).length())
        rows.append({"id":tr.id,"role":tr.role,"root_radius":tr.node.position.length(),"sole_radius":lowest if is_finite(lowest) else -1.0,"sea_radius":160.5})
    return rows

func _vt_hash(a:int,b:int)->float:
    var h:int=(a*374761393+b*668265263)&0xffffffff
    h=((h^(h>>13))*1274126177)&0xffffffff
    return float((h^(h>>16))&0xffffffff)/4294967296.0

func _damage_heavy(enemy:Dictionary,kind:String)->void:
    if enemy.state=="down":return
    var key:=kind+"_hits"
    var threshold:int={"arrow":20,"javelin":10,"melee":15}.get(kind,99999)
    enemy[key]+=1
    if enemy[key]>=threshold:
        enemy[key]=0;enemy.life-=1
        events.append({"type":"vanguard_wound","unit_id":enemy.id,"by":kind,"life":enemy.life,"time":elapsed})
        if enemy.life<=0:
            enemy.state="down";enemy.node.rotate_object_local(Vector3.RIGHT,1.3)
            if enemy.get("kind","")=="hauler" and enemy.vehicle<crafts.size():
                var row:Dictionary=crafts[enemy.vehicle].transport
                if row.busy==enemy.id:row.busy=""

func _hit_blue(tr:Dictionary,weapon:String,enemy_id:String)->void:
    if tr.state=="down":return
    if weapon=="blade" and tr.role in ["spear","gladius"] and not tr.shield_broken:
        tr.shield_broken=true
        if tr.nodes.has("n32"):tr.nodes.n32.visible=false
        events.append({"type":"shield_broken","unit_id":tr.id,"by":enemy_id,"time":elapsed})
    else:
        tr.hp-=2 if weapon=="blade" else 1
        if tr.hp<=0:tr.state="down";tr.node.rotate_object_local(Vector3.RIGHT,1.35)
        events.append({"type":"defender_hit","unit_id":tr.id,"by":enemy_id,"weapon":weapon,"dead":tr.state=="down","time":elapsed})
    tr.grudge=9.0
    for peer in troops:
        if peer.state=="formed" and peer.node.position.distance_to(tr.node.position)<=7.0:peer.grudge=maxf(peer.grudge,6.3)

func _retaliate(tr:Dictionary,delta:float)->bool:
    if tr.grudge<=0.0:return false
    tr.grudge=maxf(0.0,tr.grudge-delta)
    var near:=heavies.filter(func(h):return h.state=="ground" and h.node.position.distance_to(tr.node.position)<45.0)
    if near.is_empty():return false
    near.sort_custom(func(a,b):return a.node.position.distance_squared_to(tr.node.position)<b.node.position.distance_squared_to(tr.node.position))
    var enemy=near[0]
    tr.cooldown-=delta
    var target:Vector3=enemy.node.position
    if tr.role!="longbow":
        var next:Vector3=_actor_ground(tr.node.position.move_toward(target,delta*2.6),tr.role)
        if next.length()<160.607+float(foot_offsets[tr.role])-0.02:next=tr.node.position
        _orient(tr.node,next,target)
        if next.distance_to(target)<1.7 and tr.cooldown<=0.0:_damage_heavy(enemy,"melee");tr.cooldown=1.15
    else:
        _orient(tr.node,tr.node.position,target)
        tr.pose_time+=delta
        var frames:Array=assembly.longbow.poseFrames
        var at:=int(fmod(tr.pose_time*120.0,frames.size()))
        _pose(tr,frames[at])
        var previous:=int(tr.last_pose)
        var steps: int=(at-previous+frames.size())%frames.size() if previous>=0 else 0
        for offset in range(1,steps+1):
            if frames[(previous+offset)%frames.size()].get("released",false) and tr.cooldown<=0.0:
                _fire(tr,enemy.node,"arrow",45.0);tr.cooldown=1.6+battle_rng.randf()*0.9
        tr.last_pose=at
    return true

func _charge_bolt(enemy:Dictionary,delta:float,want:bool)->bool:
    var remain:=maxf(0.0,delta);var fired:=false
    for guard in range(8):
        match enemy.bolt_phase:
            "idle":
                enemy.bolt_charge=0.0;enemy.bolt_t=0.0
                if not want:break
                enemy.bolt_phase="charging"
            "charging":
                if not want:enemy.bolt_phase="idle";enemy.bolt_t=0.0;enemy.bolt_charge=0.0;break
                var need:float=1.55-enemy.bolt_t
                if remain<need:enemy.bolt_t+=remain;enemy.bolt_charge=minf(1.0,enemy.bolt_t/1.55);break
                remain-=need;enemy.bolt_charge=1.0;enemy.bolt_phase="discharge";enemy.bolt_t=0.0;fired=true
            "discharge":
                var need:float=0.18-enemy.bolt_t
                if remain<need:enemy.bolt_t+=remain;break
                remain-=need;enemy.bolt_t=0.0;enemy.bolt_phase="cooldown"
            "cooldown":
                var need:float=0.85-enemy.bolt_t
                if remain<need:enemy.bolt_t+=remain;enemy.bolt_charge=maxf(0.0,1.0-enemy.bolt_t/0.85);break
                remain-=need;enemy.bolt_t=0.0;enemy.bolt_charge=0.0;enemy.bolt_phase="idle"
    return fired
