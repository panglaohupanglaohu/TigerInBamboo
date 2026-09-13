extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    await w._start_traversal("gladius",true,true)
    w.set_physics_process(false)
    w._reset_traversal()
    await physics_frame
    var frame=w.castle_adapter.original.find_child("citadel-front-harbor",true,false)
    if frame==null:push_error("Front harbor frame missing");quit(1);return
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/common-frame-citadel-front-harbor-route.json"))
    var points:Array=[]
    for p in data.approach.turnCourt.entry:points.append(Vector3(p[0],p[1],p[2]))
    var results:Array=[]
    var passed=true
    for reverse in [false,true]:
        var path=points.duplicate()
        if reverse:path.reverse()
        var walker=preload("res://scripts/citadel_roman_traversal.gd").new()
        if not walker.bind(w,"gladius",frame,path):passed=false;break
        for i in range(12000):
            walker.tick(1.0/60.0)
            if walker.phase in ["arrived","blocked"]:break
        var result=walker.evidence();result["reverse"]=reverse
        results.append(result);passed=passed and walker.phase=="arrived"
        walker.actor.queue_free();await process_frame
    var result={"passed":passed,"directions":results,"scope":"Original gladius carried geometry, production guarded controller, side-court entrance both ways; no crowds or final gait."}
    FileAccess.open("res://../artifacts/pipeline/citadel-side-court-audit/godot-march.json",FileAccess.WRITE).store_string(JSON.stringify(result,"  "))
    print(JSON.stringify(result));w.free();quit(0 if passed else 1)
