extends SceneTree
func _initialize():call_deferred("run")
func run():
    root.size=Vector2i(1600,1000)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    w.set_process(false);w.set_physics_process(false)
    var group:Node3D=null
    for n in w.castle_adapter.original.find_children("citadel-target-castle-silhouette","Node3D",true,false):
        if n.is_visible_in_tree():group=n;break
    assert(group!=null)
    var source=JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/pipeline/citadel-master-terrain/keep-side-facades.json"))
    var bodies=[];var vertices=0;var meshes=0
    for m in group.find_children("*","MeshInstance3D",true,false):
        if not m.is_visible_in_tree():continue
        meshes+=1
        for s in range(m.mesh.get_surface_count()):vertices+=m.mesh.surface_get_arrays(s)[Mesh.ARRAY_VERTEX].size()
        var body=StaticBody3D.new();body.collision_layer=1<<19;body.collision_mask=0
        var shape=CollisionShape3D.new();shape.shape=m.mesh.create_trimesh_shape();body.add_child(shape);w.add_child(body);body.global_transform=m.global_transform;bodies.append(body)
    await physics_frame;await physics_frame
    var records=[];var passed=meshes==source.geometry.meshes and vertices==source.geometry.vertices
    for i in range(source.wfc.openingProbes.size()):
        var probe=source.wfc.openingProbes[i];var web=source.windows[i];var depths={}
        var normal=Vector3(probe.normal[0],probe.normal[1],probe.normal[2])
        for field in ["center","wall"]:
            var xyz=probe[field];var p=Vector3(xyz[0],xyz[1],xyz[2]);var start=p+normal*.6
            var query=PhysicsRayQueryParameters3D.create(group.to_global(start),group.to_global(p-normal*.4),1<<19)
            var hit=w.get_world_3d().direct_space_state.intersect_ray(query)
            depths[field]=-1.0 if hit.is_empty() else start.distance_to(group.to_local(hit.position))
        var error=maxf(absf(depths.center-float(web.opening.depth)),absf(depths.wall-float(web.wall.depth)))
        var ok=depths.center>depths.wall+.2 and depths.wall>=0 and error<.002
        passed=passed and ok;records.append({"id":probe.id,"passed":ok,"max_depth_error":error,"depths":depths})
    var proportions=OS.get_cmdline_user_args().has("--proportions")
    var lighting=OS.get_cmdline_user_args().has("--lighting")
    var report={"passed":passed,"meshes":meshes,"vertices":vertices,"windows":records,"scope":"Actual released Godot facade triangles: 39 opening and wall ray depths compared with Web. Not full gameplay."}
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/"+("keep-lighting-godot.json" if lighting else ("keep-proportions-godot.json" if proportions else "keep-side-facades-godot.json")),FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    if OS.get_cmdline_user_args().has("--capture"):
        for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
        w.assault_route.set_visible(false)
        var city=w.castle_adapter.original.find_child("highland-west-city",true,false)
        w.camera.global_position=city.to_global(Vector3(100,30,68));w.camera.look_at(city.to_global(Vector3(61,19,24)),city.global_basis.y.normalized());w.camera.fov=55
        w.window_lights.set_enabled(true)
        await process_frame;await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-master-terrain/"+("keep-lighting-after-godot.png" if lighting else ("keep-proportions-after-godot.png" if proportions else "keep-facades-after-godot.png")))
    print(JSON.stringify(report));w.free();quit(0 if passed else 1)
