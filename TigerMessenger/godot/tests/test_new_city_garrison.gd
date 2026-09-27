extends SceneTree
func _initialize():call_deferred("run")
func run():
    var world=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(world)
    await process_frame
    world.set_process(false);world.set_physics_process(false)
    var posts=world.garrison_posts.root
    var rows=[]
    if is_instance_valid(posts):
        for actor in posts.get_children():
            var p:Vector3=world.castle_adapter.original.to_local(actor.global_position)
            rows.append({"name":str(actor.name),"post":actor.get_meta("guard_post_id"),"position":[p.x,p.y,p.z],"role":actor.get_meta("role")})
    var expected=JSON.parse_string(FileAccess.get_file_as_string("res://data/new-city-garrison.json"))
    var passed=rows.size()==28
    for i in range(rows.size()):
        for axis in range(3):passed=passed and absf(rows[i].position[axis]-expected.rows[i].position[axis])<0.001
    var report={"passed":passed,"count":rows.size(),"rows":rows,"scope":"Native original red model instances at shared Web positions. No combat or dynamic body collision verification."}
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/godot-garrison.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify({"passed":passed,"count":rows.size()}));world.free();quit(0 if passed else 1)
