extends SceneTree
## Uses the shipped GLB and production registry, without loading a second full world.
class TestWorld extends Node3D:
    var castle_adapter:Dictionary
    var shell_candidate:Dictionary

func _initialize()->void:call_deferred("run")
func run()->void:
    var w=TestWorld.new();root.add_child(w)
    var original=Node3D.new();w.add_child(original)
    var west:Node3D=load("res://assets/art-pilots/citadel-west-city-v1.glb").instantiate()
    original.add_child(west);west.set_meta("citadel_visual_expansion",true)
    # Rotate the asset as on the sphere, so a test cannot accidentally assume global Y-up.
    original.transform=Transform3D(Basis.from_euler(Vector3(0.27,-0.4,0.18)),Vector3(12,25,-9))
    var shell=Node3D.new();w.add_child(shell)
    w.castle_adapter={"original":original};w.shell_candidate={"root":shell}
    await process_frame
    var context=load("res://scripts/citadel_collision_context.gd").new();context.bind(w)
    await physics_frame;await physics_frame
    var registered:Dictionary={}
    for shape in context.body.get_children():registered[str(shape.get_meta("source",""))]=shape
    var expected:Array=[];var excluded:Array=[];var failures:Array=[];var ray_hits:=0;var solid_count:=0
    for mesh in west.find_children("*","MeshInstance3D",true,false):
        var n:=str(mesh.name)
        var extras:Variant=mesh.get_meta("extras",{})
        var marked:bool=extras is Dictionary and extras.get("westCityWalkable",false)==true
        var named:bool=n=="west-city-bridge-deck" or (n.begins_with("west-city-") and n.ends_with("-promenade")) or n.begins_with("west-city-stair-")
        var source:=str(mesh.get_path())
        if marked or named:
            expected.append(n)
            if not registered.has(source):failures.append("Missing walking collision: "+n);continue
            var shape:CollisionShape3D=registered[source]
            if not shape.global_transform.is_equal_approx(mesh.global_transform):failures.append("Wrong transform: "+n)
            # Sample one genuine upward triangle, rather than the bounding-box center.
            # The latter can land in holes on non-rectangular paving.
            var faces:PackedVector3Array=mesh.mesh.get_faces();var sampled:=false
            for i in range(0,faces.size(),3):
                var a:=faces[i];var b:=faces[i+1];var c:=faces[i+2]
                # Godot mesh front faces use clockwise winding.
                if (c-a).cross(b-a).normalized().dot(Vector3.UP)<0.9:continue
                var p:Vector3=mesh.to_global((a+b+c)/3.0)
                var up:Vector3=mesh.global_basis.y.normalized()
                var hit=w.get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(p+up*0.05,p-up*0.05))
                var supported:=false
                if not hit.is_empty() and hit.collider==context.body:
                    var hit_shape=context.body.shape_owner_get_owner(context.body.shape_find_owner(hit.shape))
                    var hit_mesh=w.get_node_or_null(NodePath(str(hit_shape.get_meta("source",""))))
                    # Overlapping apron/promenade faces may correctly hit either registered paving mesh.
                    supported=hit_mesh is MeshInstance3D and context.is_west_city_walkable(hit_mesh) and hit.position.distance_to(p)<0.06
                if supported:ray_hits+=1
                else:failures.append("Unsupported walking face: "+n)
                sampled=true;break
            if not sampled:failures.append("No upward face: "+n)
        elif n in ["main-gate-wall","main-gate-carved-surround"] and mesh.get_parent().name=="citadel-new-main-gate":
            solid_count+=1
            if not registered.has(source):failures.append("Missing gate solid collision: "+n)
            elif not registered[source].shape is ConcavePolygonShape3D:failures.append("Gate arch needs exact concave collision: "+n)
        else:
            excluded.append(n)
            if registered.has(source):failures.append("Scenery gained collision: "+n)
    if expected.size()<5:failures.append("Too few walking meshes in actual asset")
    if not excluded.has("west-city-water-channel"):failures.append("Missing water negative control")
    if registered.size()!=expected.size()+solid_count:failures.append("Unexpected collision shape count")
    var report={"passed":failures.is_empty(),"walking_meshes":expected.size(),"gate_solid_meshes":solid_count,"supported_meshes":ray_hits,"excluded_meshes":excluded.size(),"water_excluded":not registered.keys().any(func(p):return "west-city-water-channel" in p),"failures":failures,"scope":"Actual shipped left-city mesh collision registry and one face ray per walking mesh under rotated placement. Does not establish route continuity, actor movement, building avoidance, or battle."}
    print(JSON.stringify(report))
    var out=FileAccess.open("res://../artifacts/pipeline/citadel-west-city/godot-collision.json",FileAccess.WRITE)
    if out:out.store_string(JSON.stringify(report,"  "))
    w.queue_free();await process_frame;quit(0 if failures.is_empty() else 1)
