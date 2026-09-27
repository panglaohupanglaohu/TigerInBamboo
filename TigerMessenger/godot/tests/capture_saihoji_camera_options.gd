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
    tag="camera-options"
    root.size=Vector2i(1000,650)
    var world=load("res://scenes/saihoji_battle_world.tscn").instantiate();root.add_child(world)
    await physics_frame;await physics_frame
    world.set_physics_process(false);world.music.set_muted(true);world.begin_battle()
    var sent:=false
    for i in range(84*60+1):
        world._physics_process(1.0/60.0)
        if not sent and world.director.snapshot().formation:sent=world.director.request_ambush_signal()
        if i%120==0:await physics_frame
    world.camera_focus="defenders";world.distance=22;world.pitch=0.12
    for angle in [0.0,1.0,2.0,3.0,4.0,5.0]:
        world.yaw=angle;world._camera();await capture(str(int(angle)))
    world.reset_battle();world.queue_free();await process_frame;quit()
