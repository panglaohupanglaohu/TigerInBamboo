extends SceneTree
var failures: Array = []
var original_ids: Array = []
var meshes := 0
func _initialize() -> void:
    call_deferred("run_test")
func collect(node: Node) -> void:
    var extras: Dictionary = node.get_meta("extras", {})
    if extras.has("three_node_id"): original_ids.append(str(extras.three_node_id))
    if node is MeshInstance3D and node.is_visible_in_tree(): meshes += 1
    for child in node.get_children(): collect(child)
func run_test() -> void:
    root.size = Vector2i(1200, 1000)
    var scene = load("res://scenes/scout_candidate.tscn").instantiate()
    root.add_child(scene)
    for i in range(20): await process_frame
    collect(scene.model)
    for i in range(46):
        if not original_ids.has("n%d" % i): failures.append("Missing original ID n%d" % i)
    for named in ["triple-gate-scout-canopy", "triple-gate-scout-cockpit-anchor", "triple-gate-scout-propeller", "triple-gate-scout-cannon-muzzle-left", "triple-gate-scout-cannon-muzzle-right", "scout-cockpit-inner-liner"]:
        if not scene.model.find_child(named, true, false): failures.append("Missing " + named)
    if scene.glass_count != 1: failures.append("Expected one adapted original canopy")
    if meshes != 23: failures.append("Expected 23 visible mesh nodes, got %d" % meshes)
    var screenshot := ""
    if DisplayServer.get_name() != "headless":
        await RenderingServer.frame_post_draw
        screenshot = "res://../artifacts/pipeline/scoutAircraft/godot/candidate.png"
        root.get_texture().get_image().save_png(ProjectSettings.globalize_path(screenshot))
    var report := {"passed":failures.is_empty(), "failures":failures, "original_ids":original_ids, "visible_meshes":meshes, "hidden_outline_meshes":scene.hidden_outlines, "adapted_glass":scene.glass_count, "draw_calls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME), "triangles":Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME), "screenshot":screenshot, "world_integrated":false, "renderer":RenderingServer.get_current_rendering_method()}
    FileAccess.open("res://../artifacts/pipeline/scoutAircraft/godot/validation.json", FileAccess.WRITE).store_string(JSON.stringify(report, "  "))
    print("SCOUT_CANDIDATE ", JSON.stringify(report))
    quit(0 if failures.is_empty() else 1)
