extends SceneTree
var failures: Array = []
func _initialize() -> void: call_deferred("run_test")
func check(ok: bool, message: String) -> void:
    if not ok: failures.append(message)
func run_test() -> void:
    root.size = Vector2i(1200,1000)
    var scene = load("res://scenes/scout_candidate.tscn").instantiate()
    root.add_child(scene)
    scene.set_process(false)
    await process_frame
    var adapter = scene.runtime
    var fixture = JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/pipeline/scoutAircraft/godot/behavior-fixture.json"))
    adapter.mounted = false
    var initial: Vector3 = adapter.aircraft.position
    adapter.update_original(5.0, 0.3)
    check(adapter.aircraft.position == initial and adapter.last_delta == 0.0, "Unmounted original early-return")
    adapter.configure_hover(Vector3(2,3,4), Vector3(0.6,0.8,0))
    var results: Array = []
    for sample in fixture.samples:
        adapter.update_original(sample.time, 0.02)
        var wanted := Vector3(sample.position[0],sample.position[1],sample.position[2])
        check(adapter.aircraft.position.distance_to(wanted)<0.00001,"Position matches source JS at t="+str(sample.time))
        check(absf(adapter.beacon_light.light_energy-sample.intensity)<0.00001,"Point light matches source JS")
        check(absf(adapter.beacon_material.albedo_color.a-sample.opacity)<0.00001,"Beacon opacity property matches source JS")
        check(adapter.last_delta==0.02,"Delta retained")
        results.append({"time":sample.time,"position":str(adapter.aircraft.position),"energy":adapter.beacon_light.light_energy})
    var original_basis: Basis = adapter.nodes["n26"].basis
    adapter.update_original(50,0.016)
    check(adapter.nodes["n26"].basis==original_basis,"Legacy propeller/spinner is not animated")
    adapter.update_defense_light(0.22)
    check(is_equal_approx(adapter.beacon_light.light_energy,1.4),"Defense flash override")
    adapter.update_defense_light(0)
    check(is_equal_approx(adapter.beacon_light.light_energy,0.55),"Defense idle override")
    adapter.update_original(1,0.016)
    var pulse_energy: float = adapter.beacon_light.light_energy
    adapter.update_defense_light(0.22,true)
    check(is_equal_approx(adapter.beacon_light.light_energy,pulse_energy),"Manual mode does not apply defense override")
    scene.model.rotation.y=0.4
    adapter.aircraft.force_update_transform()
    check(adapter.cockpit_world_position().distance_to(adapter.aircraft.to_global(Vector3(0,0.48,0.72)))<0.00001,"Cockpit anchor follows transforms")
    var muzzles: Array[Vector3] = adapter.muzzle_world_positions()
    check(muzzles[0].distance_to(adapter.aircraft.to_global(Vector3(-0.7,-0.16,1.6)))<0.00001,"Left muzzle follows transform")
    check(muzzles[1].distance_to(adapter.aircraft.to_global(Vector3(0.7,-0.16,1.6)))<0.00001,"Right muzzle follows transform")
    scene.model.rotation.y=0
    adapter.configure_hover(Vector3.ZERO,Vector3.UP)
    var captures: Array = []
    if DisplayServer.get_name()!="headless":
        for time in [0.0,2.0]:
            adapter.update_original(time,0.016)
            for i in range(8): await process_frame
            await RenderingServer.frame_post_draw
            var path := "res://../artifacts/pipeline/scoutAircraft/godot/behavior-%s.png" % str(int(time))
            root.get_texture().get_image().save_png(ProjectSettings.globalize_path(path))
            captures.append(path)
    var report := {"passed":failures.is_empty(),"failures":failures,"reference":"behavior-fixture.json executes original JS callback","samples":results,"captures":captures,"mounted_hover_implemented":true,"defense_light_override_implemented":true,"flight_ai_implemented":false,"player_piloting_implemented":false,"world_integrated":false}
    FileAccess.open("res://../artifacts/pipeline/scoutAircraft/godot/behavior-validation.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print("SCOUT_BEHAVIOR ",JSON.stringify(report))
    quit(0 if failures.is_empty() else 1)
