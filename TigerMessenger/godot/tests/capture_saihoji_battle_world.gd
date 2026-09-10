extends SceneTree
var out_dir:="/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/saihoji-battle-world/"
var tag:="native-r34"
var samples:Dictionary={}
var render_samples:Dictionary={}
func _initialize()->void:call_deferred("run")
func capture(label:String)->void:
    await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png(out_dir+tag+"-"+label+".png")
    render_samples[label]={"draw_calls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),"primitives":Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),"rendered_objects":Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME),"nodes":Performance.get_monitor(Performance.OBJECT_NODE_COUNT),"objects":Performance.get_monitor(Performance.OBJECT_COUNT),"resources":Performance.get_monitor(Performance.OBJECT_RESOURCE_COUNT),"real_time_fps_measured":false,"scope":"One actual GPU-rendered frame during fixed-step observation; not a realtime FPS benchmark"}
func run()->void:
    if OS.has_environment("SAIHOJI_CAPTURE_TAG"):tag=OS.get_environment("SAIHOJI_CAPTURE_TAG")
    root.size=Vector2i(1280,800)
    var world=load("res://scenes/saihoji_battle_world.tscn").instantiate();root.add_child(world)
    await physics_frame
    await physics_frame
    world.set_physics_process(false);world.music.set_muted(true)
    for i in range(3):await process_frame
    await capture("before")
    world.begin_battle()
    var ramp_captured:=false
    var return_captured:=false
    var mouth_captured:=false
    var rope_captured:=false
    var expel_captured:=false
    for i in range(60*360):
        world._physics_process(1.0/60.0)
        if i%120==0:await physics_frame
        if i in [60*64,60*84,60*110]:
            if i==60*84:world.camera_focus="battle";world.distance=35.0;world.pitch=0.5;world.yaw=1.7;world._camera()
            samples[str(int(i/60))]=world.evidence()
            await capture(str(int(i/60)))
            if i==60*84:
                world.camera_focus="defenders";world.distance=18;world.pitch=0.38;world._camera()
                await capture("defenders")
                world.camera_focus="battle";world.distance=35;world.pitch=0.5;world._camera()
        if not ramp_captured and world.heavies.any(func(h):return h.kind=="hauler" and h.state=="walking_out" and h.path_step==1 and world.crafts[h.vehicle].node.to_local(h.node.position).z < -3.4):
            var craft:Node3D=world.crafts[0].node
            var focus:Vector3=craft.global_transform*Vector3(0,-1.2,-3.5)
            world.camera.position=craft.global_transform*Vector3(4,2,-10)
            world.camera.look_at(focus,craft.global_basis.y.normalized())
            await capture("actual-socco-exit");samples["socco_exit"]=world.evidence();ramp_captured=true
            world._camera()
        if not return_captured and world.heavies.any(func(h):return h.kind=="hauler" and h.state=="walking_in" and h.path_step==2):
            var craft:Node3D=world.crafts[0].node
            world.camera.position=craft.global_transform*Vector3(4,2,-10)
            world.camera.look_at(craft.global_transform*Vector3(0,-1.2,-3.5),craft.global_basis.y.normalized())
            await capture("actual-socco-return");samples["socco_return"]=world.evidence();return_captured=true
            world._camera()
        if not rope_captured and world.heavies.any(func(h):return h.kind=="pod" and h.state=="descending" and h.visual_t>0.6):
            var pos:Vector3=world.escort_pods[0].global_position-world.hub*3.0
            world.camera.position=pos+world.east*12.0+world.hub*3.0
            world.camera.look_at(pos,world.hub)
            await capture("actual-ropes")
            samples["actual_ropes"]=world.evidence();rope_captured=true
            world._camera()
        if not expel_captured and not world.swallowed.is_empty() and world.swallow_t>6.4:
            world.camera_focus="kun";world.distance=30;world.pitch=0.3;world._camera()
            await capture("actual-expel")
            samples["actual_expel"]=world.evidence();expel_captured=true
            world.camera_focus="battle";world.distance=35;world.pitch=0.5;world._camera()
        if not mouth_captured and not world.swallowed.is_empty() and world.swallow_t>1.5:
            world.camera_focus="kun";world.distance=35;world.pitch=0.3;world._camera()
            await capture("actual-swallow")
            samples["actual_swallow"]=world.evidence();mouth_captured=true
            world.camera_focus="battle";world.distance=35;world.pitch=0.5;world._camera()
    var report:Dictionary=world.evidence();report.samples=samples;report.render_samples=render_samples;report.mouth_captured=mouth_captured
    FileAccess.open(out_dir+tag+"-report.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    world.reset_battle();world.queue_free();await process_frame;quit()
