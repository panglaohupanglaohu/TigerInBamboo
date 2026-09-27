extends SceneTree
var checks:=0
var failures:Array[String]=[]
func check(ok:bool,label:String)->void:
    checks+=1
    if not ok:failures.append(label)
func _initialize()->void:
    var world=load("res://scripts/saihoji_battle_world.gd").new()
    var a:Dictionary={"node":Node3D.new(),"state":"landing","id":"a"}
    var b:Dictionary={"node":Node3D.new(),"state":"landing","id":"b"}
    world.troops.assign([a,b])
    a.node.position=Vector3(0,161,0)
    b.node.position=Vector3(0,161,0.7)
    check(not world._crowd_step_clear(a,a.node.position,Vector3(0,161,0.2)),"following passenger stops before intersecting 0.65 m clearance")
    check(world._crowd_step_clear(b,b.node.position,Vector3(0,161,0.9)),"leader can leave queue without deadlock")
    check(world._crowd_step_clear(a,a.node.position,Vector3(0,161,-0.2)),"already crowded actor can move away")
    b.node.position=Vector3(0,161,1)
    check(not world._crowd_step_clear(a,a.node.position,Vector3(0,161,2)),"swept check prevents long-step tunnelling")
    b.node.position=Vector3(1,161,1)
    check(world._crowd_step_clear(a,a.node.position,Vector3(0,161,2)),"parallel separated lane remains usable")
    b.node.position=Vector3(0,161,0.7);b.state="boarding"
    check(not world._crowd_step_clear(a,a.node.position,Vector3(0,161,0.2)),"boarding movement uses same clearance")
    var start:Vector3=a.node.position
    world._crowd_step_clear(a,start,Vector3(0,161,0.2))
    check(a.node.position==start,"avoidance does not push actor sideways off validated dry route")
    print(JSON.stringify({"passed":failures.is_empty(),"checks":checks,"failures":failures,"scope":"moving passengers along validated routes; stationary combat actors and ship-deck seating are separate systems"}))
    a.node.free();b.node.free();world.director.free();world.music.free();world.free()
    quit(0 if failures.is_empty() else 1)
