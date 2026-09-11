extends SceneTree

func _initialize() -> void: call_deferred("run")

func run() -> void:
    var packed = load("res://assets/world-source/original-world-v1.glb") as PackedScene
    var model = packed.instantiate() as Node3D
    root.add_child(model)
    var adapter = preload("res://scripts/castle_world_adapter.gd").new()
    assert(adapter.bind(model))
    assert(adapter._old_placement.size() > 0)
    for row in adapter._old_placement:
        assert(row.node.position.is_equal_approx(row.transform.origin + adapter.OLD_CITY_OFFSET))
    var rotated_before:Array[Dictionary]=[]
    for row in adapter._old_orientation:rotated_before.append({"node":row.node,"transform":row.node.transform})
    assert(adapter.bind(model)) # Rebind must not accumulate the offset or yaw.
    for row in rotated_before:assert(row.node.transform.is_equal_approx(row.transform))
    for row in adapter._old_placement:
        assert(row.node.position.is_equal_approx(row.transform.origin + adapter.OLD_CITY_OFFSET))
    assert(adapter.set_enabled(true))
    assert(adapter.candidate.position.is_equal_approx(adapter.OLD_CITY_OFFSET))
    assert(is_instance_valid(adapter.west_city))
    assert(adapter.west_city.get_parent() == adapter.original)
    assert(adapter.west_city.transform.is_equal_approx(Transform3D.IDENTITY))
    var districts = adapter.west_city.find_children("west-city-*", "Node3D", true, false)
    assert(districts.size() > 3)
    assert(adapter._west_replaced.size() >= 2)
    for row in adapter._west_replaced: assert(not row.node.visible)
    var count = adapter.west_city.find_children("*", "MeshInstance3D", true, false).size()
    assert(count > 80)
    adapter.set_enabled(false)
    assert(not adapter.west_city.visible)
    for row in adapter._west_replaced: assert(row.node.visible == row.visible)
    adapter.set_enabled(true)
    assert(adapter.west_city.visible)
    print(JSON.stringify({"passed":true,"meshes":count,"replaced":adapter._west_replaced.size(),"identity_placement":true,"restore_verified":true,"scope":"Godot scene integration, no visual or traversal acceptance"}))
    var placements = adapter._old_placement.duplicate()
    var orientations = adapter._old_orientation.duplicate()
    adapter.unbind()
    for row in placements: assert(row.node.transform.is_equal_approx(row.transform))
    # The first capture of each node is its original orientation (foundation may be captured twice).
    var seen:Dictionary={}
    for row in orientations:
        if seen.has(row.node):continue
        assert(row.node.transform.is_equal_approx(row.transform));seen[row.node]=true
    model.free()
    quit()
