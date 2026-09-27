extends SceneTree
const Pose=preload("res://scripts/roman_concealment_pose.gd")
func _initialize()->void:call_deferred("run")
func vectors(points:PackedVector3Array)->Array:
    var result:Array=[]
    for p in points:result.append([p.x,p.y,p.z])
    return result
func matrix(t:Transform3D)->Array:
    return [t.basis.x.x,t.basis.x.y,t.basis.x.z,0,t.basis.y.x,t.basis.y.y,t.basis.y.z,0,t.basis.z.x,t.basis.z.y,t.basis.z.z,0,t.origin.x,t.origin.y,t.origin.z,1]
func run()->void:
    var world=load("res://scenes/saihoji_battle_world.tscn").instantiate();root.add_child(world)
    while not world.ready_for_battle and world.load_error.is_empty():await physics_frame
    world.set_physics_process(false);world.music.set_muted(true)
    if not world.load_error.is_empty():push_error(world.load_error);quit(1);return
    var garden:Node3D=world.target_garden.node
    var audit=JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/pipeline/saihoji-target-integration/kun-cover-geometry-report.json"))
    var covers=JSON.parse_string(FileAccess.get_file_as_string("res://data/saihoji-kun-cover-points.json"))
    var data:Dictionary={"layout_sha256":FileAccess.get_sha256("res://data/saihoji-target-garden-20260919.json"),"cover_sha256":FileAccess.get_sha256("res://data/saihoji-kun-cover-points.json"),"trees":[],"models":{},"cases":[]}
    for entry in world.pine_visual.entries:
        for id in ["n8","n9"]:
            var mesh:MeshInstance3D=entry.ids.get(id)
            if not is_instance_valid(mesh):continue
            var faces:PackedVector3Array=mesh.mesh.get_faces()
            var trans:Transform3D=garden.global_transform.affine_inverse()*mesh.global_transform
            for i in faces.size():faces[i]=trans*faces[i]
            data.trees.append({"seed":entry.row.seed,"id":id,"faces":vectors(faces)})
    for role in ["gladius","spear","longbow"]:
        var actor:Node3D=world.prefabs[role].instantiate();world.add_child(actor)
        var ids:Dictionary={};world._candidate_index(actor,ids)
        var pose=Pose.new();pose.bind(actor,ids)
        for weight in [0.0,1.0]:
            pose.update(weight)
            var label:String="conceal_lean" if weight>0 else "neutral"
            var models:Array=[]
            for mesh in actor.find_children("*","MeshInstance3D",true,false):
                if not mesh.is_visible_in_tree() or mesh.mesh==null:continue
                var faces:PackedVector3Array=mesh.mesh.get_faces()
                var trans:Transform3D=actor.global_transform.affine_inverse()*mesh.global_transform
                for i in faces.size():faces[i]=trans*faces[i]
                models.append({"name":str(mesh.name),"faces":vectors(faces)})
            data.models[role+":"+label]=models
            for row in audit.all_cases:
                if row.role!=role or row.pose!=label or row.trunk_overlap_candidates.is_empty():continue
                var cover:Dictionary=covers.points.filter(func(c):return c.id==row.id)[0]
                var hit:Dictionary=world.target_garden.sample_support(Vector2(cover.localPoint[0],cover.localPoint[2]))
                var up:Vector3=hit.normal
                var forward:Vector3=garden.global_basis.z.normalized();forward=forward.slide(up).normalized()
                var basis:=Basis(up.cross(forward).normalized(),up,forward)*Basis(Vector3.UP,deg_to_rad(float(row.yaw_degrees)))
                var transform:=Transform3D(basis,hit.position+up*float(world.foot_offsets[role]))
                data.cases.append({"id":row.id,"role":role,"pose":label,"yaw_degrees":row.yaw_degrees,"matrix":matrix(garden.global_transform.affine_inverse()*transform),"candidate_meshes":row.trunk_overlap_candidates})
        actor.queue_free();await process_frame
    FileAccess.open("/tmp/tigermessenger-kun-contact-geometry.json",FileAccess.WRITE).store_string(JSON.stringify(data))
    print("KUN_CONTACT_EXPORT cases=",data.cases.size()," models=",data.models.size()," trees=",data.trees.size())
    world.queue_free();await process_frame;quit()
