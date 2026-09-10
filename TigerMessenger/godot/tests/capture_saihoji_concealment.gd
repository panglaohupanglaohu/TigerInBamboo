extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1280,800)
    var w=load("res://scenes/saihoji_battle_world.tscn").instantiate()
    root.add_child(w)
    await physics_frame
    await physics_frame
    w.set_physics_process(false);w.music.set_muted(true);w.begin_battle()
    for i in range(60*160):
        w._physics_process(1.0/60.0)
        if i%120==0:await physics_frame
        if w.director.phase=="concealment" and w.director.snapshot().formation:break
        if not w.director.running:break
    var out="/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/saihoji-godot-ambush/"
    if w.director.phase!="concealment" or not w.director.snapshot().formation:
        push_error("No actual concealed formation: "+w.load_error);quit(1);return
    w.camera_focus="defenders";w.distance=23;w.pitch=0.7;w._camera()
    await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png(out+"pine-formation.png")
    var unit:Node3D=w.troops[0].node
    var up=unit.position.normalized()
    var target=unit.position+up*0.5
    w.camera.position=target+unit.basis.x*1.35+unit.basis.z*0.7+up*0.2
    w.camera.look_at(target,up)
    await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png(out+"pine-ready-close.png")
    var evidence=w.evidence();evidence.capture_scope="Actual original scene, 50 arrived and held before signal; no landing or hit injections; visual captures, not full natural traversal"
    FileAccess.open(out+"pine-capture.json",FileAccess.WRITE).store_string(JSON.stringify(evidence,"  "))
    w.reset_battle();w.queue_free();await process_frame;quit()
