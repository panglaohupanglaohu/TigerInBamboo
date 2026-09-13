extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var world=load("res://scenes/citadel_world.tscn").instantiate()
    root.add_child(world)
    await process_frame
    var report={"caps":[],"passed":true}
    var ocean=world.ocean_adapter.ocean
    for legacy_name in ["citadel-moat","highland-waterfront-water","west-city-water-channel"]:
        var nodes=world.model.find_children(legacy_name,"Node3D",true,false)
        # A fresh visible-only export omits retired water entirely; older
        # archives retain one hidden node. Both must leave the global sea unique.
        var hidden:bool=nodes.size()<=1
        for node in nodes:hidden=hidden and not node.is_visible_in_tree() and node.get_meta("retiredWaterCap",false)
        report.caps.append({"name":legacy_name,"count":nodes.size(),"hidden":hidden})
        report.passed=report.passed and hidden
    var protected_nodes=[]
    for node in world.model.find_children("*","Node3D",true,false):
        if "bridge" in node.name.to_lower() or "sail" in node.name.to_lower() or "mast" in node.name.to_lower():
            protected_nodes.append({"node":node,"visible":node.visible,"parent":node.get_parent()})
    for node in world.model.find_children("citadel-moat","Node3D",true,false):node.visible=true
    world.ocean_adapter.bind(world.model)
    for node in world.model.find_children("citadel-moat","Node3D",true,false):report.passed=report.passed and not node.is_visible_in_tree()
    var preserved:=true
    for row in protected_nodes:preserved=preserved and row.node.visible==row.visible and row.node.get_parent()==row.parent
    report.protected_objects=protected_nodes.size()
    report.protected_preserved=preserved
    report.ocean_reused=is_instance_valid(ocean) and ocean==world.ocean_adapter.ocean and ocean.is_visible_in_tree()
    report.passed=report.passed and preserved and report.ocean_reused
    report.scope="Citadel actual entry, three legacy water groups hidden, repeated bind, ocean identity and bridge/sail/mast preservation; not full Web/Godot visual parity or navigation."
    FileAccess.open("res://../artifacts/pipeline/citadel-moat-retirement/godot-report.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report))
    world.queue_free()
    await process_frame
    quit(0 if report.passed else 1)
