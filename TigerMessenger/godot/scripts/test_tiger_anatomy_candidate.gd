extends SceneTree
var failures: Array[String] = []
func _initialize() -> void: call_deferred("run")
func run() -> void:
    root.size = Vector2i(1440, 960)
    var scene = load("res://scenes/tiger_anatomy_candidate.tscn").instantiate()
    root.add_child(scene)
    await process_frame
    scene.set_process(false)
    var results: Array = []
    var missing := not ResourceLoader.exists(scene.CANDIDATE)
    if missing: failures.append("Candidate GLB missing")
    for enabled in [false,true]:
        if not scene.set_candidate(enabled): continue
        for id in ["n0","n1","n8","n27","n28","n31","n34","n37","n40","n43","n46","n49","n52","n59","n66","n73"]:
            if not scene.nodes.has(id): failures.append("Missing original joint " + id)
        if scene.nodes.has("n0") and not scene.nodes.n0.scale.is_equal_approx(Vector3.ONE*0.4): failures.append("Factory scale changed")
        scene.pose_mode=0
        scene.apply_pose(0.0)
        var bounds := AABB()
        var first := true
        var triangles := 0
        for mesh in scene.current.find_children("*", "MeshInstance3D", true, false):
            if not mesh.is_visible_in_tree(): continue
            var box: AABB = mesh.global_transform*mesh.get_aabb()
            bounds=box if first else bounds.merge(box)
            first=false
            for surface in mesh.mesh.get_surface_count():
                var arrays: Array=mesh.mesh.surface_get_arrays(surface)
                triangles+=(arrays[Mesh.ARRAY_INDEX].size() if arrays[Mesh.ARRAY_INDEX]!=null and arrays[Mesh.ARRAY_INDEX].size()>0 else arrays[Mesh.ARRAY_VERTEX].size())/3
        results.append({"candidate":enabled,"triangles":triangles,"min":[bounds.position.x,bounds.position.y,bounds.position.z],"size":[bounds.size.x,bounds.size.y,bounds.size.z]})
        for view in range(4):
            scene.set_view(view)
            await process_frame
            await RenderingServer.frame_post_draw
            if DisplayServer.get_name()!="headless": root.get_texture().get_image().save_png("res://../artifacts/pipeline/tiger-anatomy-v3/godot-%s-view%d.png" % ["after" if enabled else "before",view])
        for mode in [1,2]:
            scene.pose_mode=mode
            for frame in range(90):
                scene.apply_pose(float(frame)/30.0)
                for id in scene.nodes:
                    if not scene.nodes[id].global_transform.is_finite(): failures.append("Nonfinite animation transform")
            scene.set_view(0)
            await process_frame
            await RenderingServer.frame_post_draw
            if DisplayServer.get_name()!="headless": root.get_texture().get_image().save_png("res://../artifacts/pipeline/tiger-anatomy-v3/godot-%s-pose%d.png" % ["after" if enabled else "before",mode])
    var report: Dictionary = {"passed":failures.is_empty(),"failures":failures,"models":results,"scope":"Same-camera geometry and retained-joint pose fixture; not full roam/quest behavior"}
    var file:=FileAccess.open("res://../artifacts/pipeline/tiger-anatomy-v3/godot-candidate-validation.json", FileAccess.WRITE)
    file.store_string(JSON.stringify(report,"  "))
    print("TIGER_CANDIDATE ",JSON.stringify(report))
    scene.queue_free()
    await process_frame
    quit(0 if failures.is_empty() else 1)
