extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
    var world = load("res://scenes/world_layout.tscn").instantiate()
    root.add_child(world)
    for i in range(4): await process_frame
    var failures: Array[String] = []
    if world.terrain == null: failures.append("terrain missing")
    var meta: Dictionary = world.terrain_data
    if meta.get("euler",0) != 2 or not meta.get("closedManifold",false): failures.append("topology")
    if FileAccess.get_sha256("res://assets/terrain/world-terrain-v3.glb") != meta.get("sha256",""): failures.append("resource hash")
    var triangles: int = 0
    if world.terrain:
        for item in world.terrain.find_children("*","MeshInstance3D",true,false):
            triangles += item.mesh.get_faces().size()/3
        world.terrain.visible=false
        if world.terrain.visible: failures.append("hide toggle")
        world.terrain.visible=true
    if triangles != 32000: failures.append("triangle count")
    if world.points.size() != 14: failures.append("landmark count")
    var result := {"passed":failures.is_empty(),"failures":failures,"triangles":triangles,"landmarks":world.points.size(),"glbSHA256":meta.get("sha256"),"sourceWorldMoved":false,"scope":"Terrain/layout candidate imports and runs; no gameplay or original-region deployment acceptance"}
    var out := FileAccess.open("res://terrain-check.json",FileAccess.WRITE)
    out.store_string(JSON.stringify(result,"  "));out.close()
    print(JSON.stringify(result))
    world.free();quit(0 if failures.is_empty() else 1)
