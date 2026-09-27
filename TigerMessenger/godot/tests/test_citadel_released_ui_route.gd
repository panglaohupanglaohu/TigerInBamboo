extends SceneTree
func _initialize():call_deferred("run")
func run():
    var world=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(world)
    await process_frame
    world.set_process(false);world.set_physics_process(false)
    var checks=[]
    for spec in [[false,false,false],[true,false,false],[false,false,true]]:
        var selection=load("res://scripts/citadel_traversal_route.gd").resolve(world,true,spec[0],spec[1],spec[2])
        checks.append({"kind":str(spec),"valid":selection.get("valid",false),"source":selection.get("source","")})
    await world._start_traversal("spear",true)
    var row={"phase":"missing"}
    if world.traversal!=null:
        for i in range(100):world.traversal.tick(1.0/60.0)
        row=world.traversal.evidence()
        row["source"]=world.traversal.actor.get_meta("route_source","")
    var passed=row.get("route_points",0)==293 and row.get("surface_following",false) and row.get("completed_steps",0)>0 and row.get("phase","")!="blocked"
    for check in checks:passed=passed and check.valid
    world._reset_traversal()
    passed=passed and world.traversal==null
    var report={"passed":passed,"routes":checks,"actual_button_handler":row,"reset_clears_actor":world.traversal==null,"scope":"Actual released UI handler, initial movement and reset; full route separately audited, no siege claim."}
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/released-ui-route.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));world.free();quit(0 if passed else 1)
