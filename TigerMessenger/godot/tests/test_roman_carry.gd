extends SceneTree
func _initialize()->void:call_deferred("run")
func bounds(actor:Node3D)->AABB:
    var b=AABB();var seeded:=false
    for m in actor.find_children("*","MeshInstance3D",true,false):
        if not m.is_visible_in_tree():continue
        var next:AABB=actor.global_transform.affine_inverse()*m.global_transform*m.get_aabb()
        b=b.merge(next) if seeded else next;seeded=true
    return b
func run()->void:
    var report:Dictionary={"roles":{},"passed":true,"scope":"Approved Blender family carry grip, visible bounds and restoration. Not staircase movement or weapon collision acceptance."}
    for role in ["gladius","spear","longbow"]:
        var path="res://assets/roman-family-v1/romanSoldier_%s_blue"%role
        var actor=load(path+".glb").instantiate();root.add_child(actor)
        var data=JSON.parse_string(FileAccess.get_file_as_string(path+".assembly.json"))
        var pose=load("res://scripts/roman_carry_pose.gd").new()
        if not pose.bind(actor,role,data):push_error("Carry bind failed: "+role);quit(1);return
        var before=bounds(actor);var neutral:Dictionary={}
        for id in pose.nodes:neutral[id]={"transform":pose.nodes[id].transform,"visible":pose.nodes[id].visible}
        pose.set_enabled(true)
        var max_error:=0.0;var string_error:=0.0
        for i in range(61):
            actor.rotation.y=float(i)*TAU/60;pose.update();max_error=maxf(max_error,pose.grip_error());string_error=maxf(string_error,pose.string_error())
        var carried=bounds(actor)
        pose.set_enabled(false)
        var restored:=true
        for id in neutral:
            if not pose.nodes[id].transform.is_equal_approx(neutral[id].transform) or pose.nodes[id].visible!=neutral[id].visible:restored=false
        report.roles[role]={"grip_error":max_error,"string_error":string_error,"restored":restored,"before":before,"carry":carried,"carry_width_z":carried.size.z,"carry_height":carried.size.y}
        report.passed=report.passed and restored and max_error<0.00002 and string_error<0.00002
        actor.queue_free()
    FileAccess.open("res://../artifacts/pipeline/citadel-entry/roman-carry.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));await process_frame;quit(0 if report.passed else 1)
