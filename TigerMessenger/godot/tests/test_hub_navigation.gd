extends SceneTree
func _initialize() -> void:
    run.call_deferred()
func run() -> void:
    var nav = root.get_node("TestNavigation")
    for path in ["res://scenes/test_hub.tscn", "res://scenes/citadel_world.tscn", "res://scenes/test_hub.tscn"]:
        var old = weakref(current_scene) if current_scene != null else null
        nav.go(path)
        while nav.busy: await process_frame
        assert(current_scene.scene_file_path == path)
        assert(old == null or old.get_ref() == null, "Old scene retained")
        print("HUB_NAV_PASS ", path)
    quit(0)
