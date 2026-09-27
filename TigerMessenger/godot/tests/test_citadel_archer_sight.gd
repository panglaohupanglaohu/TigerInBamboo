extends SceneTree
func _initialize():call_deferred("run")
func run():
    var world=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(world);await process_frame
    world.set_process(false);world.set_physics_process(false)
    var context=load("res://scripts/citadel_collision_context.gd").new();context.bind(world)
    await physics_frame;await physics_frame
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/pipeline/citadel-master-terrain/archer-sight-audit.json"))
    var city=world.castle_adapter.original.find_child("highland-west-city",true,false)
    var up=city.global_basis.y.normalized();var space=world.get_world_3d().direct_space_state
    var rows=[];var passed=true
    for row in data.rows:
        var a=row.origin;var origin=city.to_global(Vector3(a[0],a[1],a[2]));var samples=[]
        for sample in row.samples:
            var p=sample.target;var target=city.to_global(Vector3(p[0],p[1],p[2]));var count=maxi(8,int(ceil(origin.distance_to(target)/.5)))
            var previous=origin;var block={}
            for i in range(1,count+1):
                var t=float(i)/count;var next=origin.lerp(target,t)+up*(sin(PI*t)*3.2)
                var query=PhysicsRayQueryParameters3D.create(previous,next);query.hit_from_inside=true;query.hit_back_faces=true
                block=space.intersect_ray(query)
                if not block.is_empty():break
                previous=next
            var clear=block.is_empty();passed=passed and clear==sample.clear
            samples.append({"point":sample.index,"clear":clear,"web_clear":sample.clear})
        rows.append({"uid":row.uid,"samples":samples})
    var report={"passed":passed,"rows":rows,"scope":"Same Web release-pose origins and five arc targets against actual native scene collision; no native combat animation claim."}
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/archer-sight-godot.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));context.dispose();world.free();quit(0 if passed else 1)
