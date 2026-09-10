extends SceneTree
var failures:Array[String]=[]
func check(value:bool,label:String)->void:
    if not value:failures.append(label)
func _initialize()->void:
    var d=load("res://scripts/saihoji_battle_director.gd").new()
    root.add_child(d)
    d.require_ambush_signal=true
    d.configure(["fleet"],["blue"],["heavy"])
    d.start()
    var obs={"fleet_present":true,"fleet_ground_dir":Vector3.UP,"near":true,"far":false,"drum_active":false,"whale_lift":0.0}
    for i in range(50):d.tick(1.0,obs)
    check(d.whale_phase=="buried","fleet proximity cannot lift whale before landing")
    check(not d.request_ambush_signal(),"early signal rejected")
    check(not d.report_fleet_hit("early","blue","fleet"),"no ambush damage before preparation")
    d.report_landing("saihoji-warship-0");d.report_landing("saihoji-warship-1")
    check(d.phase=="concealment","landing enters preparation")
    check(not d.request_ambush_signal(),"docking alone is not all soldiers ready")
    d.report_formation_ready()
    for i in range(20):d.tick(1.0,obs)
    check(d.whale_phase=="buried" and d.assault_phase=="idle","waiting holds whale and heavy deployment")
    check(d.request_ambush_signal(),"ready messenger can signal")
    check(not d.request_ambush_signal(),"signal once")
    obs.near=false;obs.far=true;d.tick(4.0,obs)
    check(d.whale_phase=="buried","signal alone does not invent discovery")
    obs.near=true;obs.far=false
    for i in range(5):d.tick(1.0,obs)
    check(d.phase=="fight" and d.whale_phase=="rising","real nearby scan begins rise after signal")
    check(d.assault_phase=="idle","discovery does not deploy heavies")
    obs.whale_lift=1.0;d.tick(1.0,obs)
    check(d.report_fleet_hit("real","blue","fleet") and d.assault_phase=="approach","real defender hit triggers heavies")
    d.reset();d.start()
    check(not d.snapshot().ambush_signal and not d.snapshot().formation,"reset clears permission")
    var report={"passed":failures.is_empty(),"failures":failures,"scope":"director rule test; real scene integration checked separately"}
    print(JSON.stringify(report))
    var args=OS.get_cmdline_user_args()
    if not args.is_empty():FileAccess.open(args[0],FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    quit(0 if failures.is_empty() else 1)
