extends SceneTree
class TestWorld extends Node3D:
    var castle_adapter:Dictionary
    var shell_candidate:Dictionary

func _initialize()->void:call_deferred("run")
func run()->void:
    var w=TestWorld.new();root.add_child(w)
    var original=Node3D.new();w.add_child(original)
    original.transform=Transform3D(Basis.from_euler(Vector3(.27,-.4,.18)),Vector3(12,25,-9))
    var west:Node3D=load("res://assets/art-pilots/citadel-west-city-v1.glb").instantiate()
    original.add_child(west);west.set_meta("citadel_visual_expansion",true)
    var shell=Node3D.new();w.add_child(shell)
    w.castle_adapter={"original":original};w.shell_candidate={"root":shell}
    var context=load("res://scripts/citadel_collision_context.gd").new();context.bind(w)
    await physics_frame;await physics_frame
    var points=load("res://scripts/west_city_route.gd").new().points()
    var walker=load("res://scripts/citadel_roman_traversal.gd").new()
    if not walker.bind(w,"gladius",original,points):quit(1);return
    var start:Vector3=walker.actor.global_position
    for i in range(60*400):
        walker.tick(1.0/60.0)
        if walker.phase in ["arrived","blocked"]:break
    var result:Dictionary=walker.evidence()
    result["distance_from_start"]=walker.actor.global_position.distance_to(start)
    result["scope"]="Actual approved gladius mesh moves using production collision-guarded controller on exported left-city walking surfaces. Building avoidance and battle not included."
    result["passed"]=walker.phase=="arrived" and result.distance_from_start>30
    walker.dispose()
    var blocker=StaticBody3D.new();w.add_child(blocker)
    var shape=CollisionShape3D.new();var box=BoxShape3D.new();box.size=Vector3(.15,3,4);shape.shape=box;blocker.add_child(shape)
    var direction:Vector3=(points[1]-points[0]).slide(Vector3.UP).normalized()
    blocker.global_transform=original.global_transform*Transform3D(Basis(direction,Vector3.UP,direction.cross(Vector3.UP)),points[7]+Vector3.UP*1.4)
    await physics_frame;await physics_frame
    var control=load("res://scripts/citadel_roman_traversal.gd").new()
    control.bind(w,"gladius",original,points)
    for i in range(1200):
        control.tick(1.0/60.0)
        if control.phase=="blocked":break
    var stop:Vector3=control.actor.global_position
    for i in range(120):control.tick(1.0/60.0)
    result["blocker_stops_actor"]=control.phase=="blocked" and stop.distance_to(control.actor.global_position)<.00001
    result["passed"]=result.passed and result.blocker_stops_actor
    control.dispose()
    print(JSON.stringify(result))
    FileAccess.open("res://../artifacts/pipeline/citadel-west-city/godot-march.json",FileAccess.WRITE).store_string(JSON.stringify(result,"  "))
    w.queue_free();await process_frame;quit(0 if result.passed else 1)
