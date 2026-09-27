extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var world=load("res://scenes/saihoji_battle_world.tscn").instantiate()
    root.add_child(world)
    while not world.ready_for_battle and world.load_error.is_empty():await physics_frame
    world.set_physics_process(false);world.music.set_muted(true);world.begin_battle()
    var min_gap:=INF
    var peak_queue:=0
    var peak_moving:=0
    var waited:=false
    var formed:=false
    var trunk_contacts:=0
    var trunk_samples:=0
    var elapsed:=0.0
    for frame in 60*240:
        world._physics_process(1.0/60.0);elapsed+=1.0/60.0
        var moving:Array=world.troops.filter(func(t):return t.state=="landing")
        peak_queue=maxi(peak_queue,world.troops.filter(func(t):return t.state=="landing_queue").size())
        peak_moving=maxi(peak_moving,moving.size())
        for i in moving.size():
            if frame%6==0:
                trunk_samples+=1
                if world.pine_cover.blocks_body(moving[i].node.position):trunk_contacts+=1
            waited=waited or float(moving[i].get("crowd_wait",0.0))>0.0
            for j in range(i+1,moving.size()):
                min_gap=minf(min_gap,moving[i].node.position.distance_to(moving[j].node.position))
        if world.director.snapshot().formation:
            formed=world.troops.size()==50 and world.troops.all(func(t):return t.state=="formed")
            break
        if frame%120==0:await physics_frame
    var report:Dictionary={"trunk_samples":trunk_samples,"trunk_contacts":trunk_contacts,"trunk_blocked_cells":world.landing_planner.report.get("trunk_blocked_cells",0),"passed":trunk_contacts==0 and formed and min_gap>=0.649 and peak_queue>0 and peak_moving>1,"fifty_arrived":formed,"minimum_moving_center_gap":min_gap,"peak_visible_aboard_queue":peak_queue,"peak_moving":peak_moving,"actual_yield_observed":waited,"arrival_seconds":elapsed,"load_error":world.load_error,"scope":"actual 50 traditional-ship passengers; moving landing bodies, not stationary cover / shield clearance"}
    if OS.has_environment("SAIHOJI_CROWD_REPORT"):FileAccess.open(OS.get_environment("SAIHOJI_CROWD_REPORT"),FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));world.queue_free();await process_frame;quit(0 if report.passed else 1)
