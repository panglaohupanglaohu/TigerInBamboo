extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var adapter=w.castle_adapter
    if not is_instance_valid(adapter.trojan_horse) or not is_instance_valid(adapter.original_horse):
        push_error("Relocated and archived horses must bind uniquely");w.free();quit(1);return
    var horse:Node3D=adapter.trojan_horse
    var archived:Node3D=adapter.original_horse
    var archive_transform:Transform3D=archived.transform
    var frame:Transform3D=adapter.original.global_transform.affine_inverse()*horse.global_transform
    var placement:=frame.origin
    var scale_value:Vector3=frame.basis.get_scale()
    var unique:bool=horse.is_visible_in_tree() and not archived.is_visible_in_tree()
    w._focus_landmark("木马")
    var focused:bool=w.landmarks["木马"]==horse and w.camera.position.is_finite()
    adapter.set_enabled(false)
    var restored:bool=archived.visible==adapter._horse_original_visible and not horse.is_visible_in_tree() and archived.transform.is_equal_approx(archive_transform)
    adapter.set_enabled(true)
    var reused:bool=adapter.trojan_horse==horse and horse.is_visible_in_tree() and not archived.is_visible_in_tree()
    await w._start_traversal("gladius",true);w.set_physics_process(false)
    if w.traversal!=null:
        for i in range(60*400):
            w.traversal.tick(1.0/60.0)
            if w.traversal.phase in ["arrived","blocked"]:break
    var march:Dictionary=w.traversal.evidence() if w.traversal!=null else {}
    var report={"passed":unique and restored and reused and focused and placement.distance_to(Vector3(19,4,71.5))<0.03 and scale_value.distance_to(Vector3.ONE*0.72)<0.03 and march.get("phase","")=="arrived","placement":[placement.x,placement.y,placement.z],"scale":[scale_value.x,scale_value.y,scale_value.z],"single_visible_horse":unique,"archive_restored_on_disable":restored,"replacement_reused_on_enable":reused,"landmark_focus_updated":focused,"archive_source":archived.get_meta("extras",{}).get("sourcePath",""),"relocated_source":horse.get_meta("extras",{}),"march":march,"scope":"Same Web horse asset exported at new placement as static Godot geometry. Archived duplicate hidden reversibly. Belly doors, ropes, infiltration actors and task logic are NOT migrated by this import."}
    FileAccess.open("res://../artifacts/pipeline/citadel-west-city/godot-horse.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));w._reset_traversal();w.queue_free();await process_frame;quit(0 if report.passed else 1)
