extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1440,1000)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    w.set_process(false);w.set_physics_process(false)
    for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
    w.assault_route.set_visible(false)
    var foundation=w.castle_adapter.original.find_child("highland-town-foundation-platform",true,false)
    var frame:Transform3D=foundation.global_transform
    w.camera.global_position=frame*Vector3(48,24,64)
    w.camera.look_at(frame*Vector3(0,-2,13),frame.basis.y.normalized());w.camera.fov=48
    var imported=w.old_harbor_grade_adapter.replacement
    var main=imported.find_child("citadel-oskar-grid-mountain-surface",true,false)
    var seal=imported.find_child("citadel-coastal-cliff-seal",true,false)
    assert(main.is_visible_in_tree() and seal.is_visible_in_tree())
    var main_triangles:int=main.mesh.get_faces().size()/3
    var seal_triangles:int=seal.mesh.get_faces().size()/3
    assert(main_triangles==25810 and seal_triangles==1028)
    var out="res://../artifacts/pipeline/citadel-old-city-slope/"
    for night in [false,true]:
        w.window_lights.set_enabled(night)
        await process_frame
        await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png(out+("godot-night.png" if night else "godot-day.png"))
    var report={"passed":true,"main_triangles":main_triangles,"seal_triangles":seal_triangles,"scope":"Actual citadel world terrain replacement and fixed-camera day/night capture"}
    FileAccess.open(out+"godot-geometry.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));w.queue_free();await process_frame;quit()
