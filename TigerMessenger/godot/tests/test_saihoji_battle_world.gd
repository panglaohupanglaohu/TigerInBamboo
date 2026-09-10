extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
    var world = load("res://scenes/saihoji_battle_world.tscn").instantiate()
    root.add_child(world)
    await physics_frame
    world.set_physics_process(false)
    world.music.set_muted(true)
    if OS.has_environment("SAIHOJI_BATTLE_SEED"):world.battle_seed=int(OS.get_environment("SAIHOJI_BATTLE_SEED"))
    world.begin_battle()
    var snapshots: Array = []
    for i in range(60 * 720):
        world._physics_process(1.0/60.0)
        if i % 600 == 0: snapshots.append(world.evidence().state)
        if i % 120 == 0: await physics_frame
        if not world.director.running: break
    var report:Dictionary = world.evidence()
    report.snapshots = snapshots
    report.seed=world.battle_seed
    report.test_scope = "manual fixed-step native movement and swept contacts; no injected hit/landing events"
    var types:Array=report.events.map(func(e):return e.type)
    var units:Dictionary={}
    for unit in world.troops: units[unit.id]=true
    var contacts:Array=report.events.filter(func(e):return e.type=="projectile_contact")
    var checks:Dictionary={
        "source_world_loaded": world.source_nodes.has("planet-surface[40]") and world.source_nodes.has("leviathanGroup[156]"),
        "six_gardens_under_original_island": world.garden.get_parent()==world.garden_island,
        "source_five_fleet_members":world.fleet_members.size()==5,
        "source_three_escort_pods":world.escort_pods.size()==3,
        "original_fifty_ids_preserved":world.troops.filter(func(t):return int(t.id.get_slice("-",1))<2).size()==50,
        "reinforcement_ids_unique":units.size()==world.troops.size(),
        "all_dispatched_reinforcements_really_landed":world.reinforcement_count<=6 and types.count("reinforcement_landed")==world.reinforcement_count,
        "socco_original_fourteen_seats":world.crafts.all(func(c):return range(109,123).all(func(id):return c.transport.ids.has("n%d"%id))),
        "socco_real_door_transit":types.count("socco_passenger_exited")>=18 and types.count("socco_passenger_boarded")+report.events.filter(func(e):return e.type=="vanguard_wound" and e.life<=0 and int(str(e.unit_id).get_slice("-",1))>=6).size()>=types.count("socco_passenger_exited"),
        "vanguard_ids_do_not_follow_auto_renaming":world.heavies.size()==27 and world.heavies.all(func(h):return int(h.id.get_slice("-",1))>=0 and int(h.id.get_slice("-",1))<27),
        "socco_survivors_returned":world.heavies.filter(func(h):return h.kind=="hauler").all(func(h):return h.state in ["aboard","guarding","down"]),
        "socco_ramps_closed_after_boarding":world.crafts.all(func(c):return absf(c.transport.angle-PI/2)<0.001),
        "socco_feet_have_real_support":world.socco_transport.report.unsupported_samples==0,
        "two_real_ship_landings":types.count("ship_landed")==2,
        "source_terrain_no_fallback":report.ground_samples>0 and report.ground_fallbacks==0,
        "physical_contacts_observed":not contacts.is_empty(),
        "all_contacts_geometric":contacts.all(func(c):return c.distance<c.radius),
        "fleet_hit_precedes_deployment":types.find("fleet_hit")>=0 and types.find("fleet_hit")<types.find("assault_requested"),
        "deployment_requires_distinct_hits":types.count("assault_requested")<=types.count("fleet_hit"),
        "candidate_kun_mouth_integrated":report.kun_candidate_active,
    }
    report.checks=checks
    report.victory_observed=report.state.phase=="complete"
    report.full_visual_gameplay_accepted=false
    report.passed=checks.values().all(func(value):return value)
    FileAccess.open(OS.get_environment("SAIHOJI_WORLD_REPORT"),FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report.state))
    print("events ",report.events.size()," error ",report.load_error)
    world.reset_battle()
    report.reset_cleared_actors=world.troops.is_empty() and world.heavies.is_empty() and world.ships.is_empty() and world.projectiles.is_empty()
    FileAccess.open(OS.get_environment("SAIHOJI_WORLD_REPORT"),FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    world.queue_free();await process_frame
    quit()
