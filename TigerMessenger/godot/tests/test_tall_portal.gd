extends SceneTree
func _initialize():call_deferred("run")
func run():
    root.size=Vector2i(1600,1000)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    w.set_process(false);w.set_physics_process(false)
    var gates=w.castle_adapter.original.find_children("citadel-new-main-gate","Node3D",true,false).filter(func(n):return n.is_visible_in_tree())
    if gates.size()!=1:push_error("Expected one released gate");w.free();quit(1);return
    var gate=gates[0];var faces=[]
    for m in gate.find_children("*","MeshInstance3D",true,false):
        if str(m.name) not in ["main-gate-wall","main-gate-carved-surround"]:continue
        for i in range(m.mesh.get_surface_count()):
            var a=m.mesh.surface_get_arrays(i);var v=a[Mesh.ARRAY_VERTEX];var ix=a[Mesh.ARRAY_INDEX]
            var count=ix.size() if ix!=null and not ix.is_empty() else v.size()
            for j in range(0,count,3):
                var points=[]
                for k in range(3):points.append(gate.to_local(m.to_global(v[ix[j+k] if ix!=null and not ix.is_empty() else j+k])))
                faces.append(points)
    var source=JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/pipeline/citadel-tall-portal/check.json"));var passed=faces.size()>0;var rows=[]
    for probe in source.probes:
        var start=Vector3(probe.x,probe.y,5);var finish=Vector3(probe.x,probe.y,-5);var depth=INF
        for f in faces:
            var hit=Geometry3D.segment_intersects_triangle(start,finish,f[0],f[1],f[2])
            if hit!=null:depth=minf(depth,start.distance_to(hit))
        var exists=is_finite(depth);var error=absf(depth-float(probe.depth)) if exists and probe.depth!=null else 0
        var ok=exists==bool(probe.expected) and error<.003;passed=passed and ok
        rows.append({"x":probe.x,"y":probe.y,"hit":exists,"passed":ok,"depth_error":error})
    var report={"passed":passed,"triangles":faces.size(),"probes":rows,"scope":"Released Godot portal triangle aperture probes against Web. Separate character route test covers traversal."}
    FileAccess.open("res://../artifacts/pipeline/citadel-tall-portal/godot.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
    w.assault_route.set_visible(false);w.window_lights.set_enabled(true)
    var city=w.castle_adapter.original.find_child("highland-west-city",true,false)
    w.camera.global_position=city.to_global(Vector3(100,30,68));w.camera.look_at(city.to_global(Vector3(61,19,24)),city.global_basis.y.normalized());w.camera.fov=55
    await process_frame;await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-tall-portal/godot.png")
    print(JSON.stringify(report));w.free();quit(0 if passed else 1)
