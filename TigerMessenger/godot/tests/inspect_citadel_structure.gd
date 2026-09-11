extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var tower=w.landmarks["塔内旋梯"].get_parent()
    print("TOWER_CLEARANCE "+JSON.stringify(w.town_cavity.report))
    for row in w.town_cavity.changes:
        var obstruction:MeshInstance3D=row.source
        print("OBSTRUCTION "+str(obstruction.get_meta("extras",{}))+" bounds="+str(obstruction.get_aabb())+" tower_transform="+str(tower.global_transform.affine_inverse()*obstruction.global_transform))
    for n in tower.get_children():
        if str(n.name).contains("Candidate"):continue
        var meshes=n.find_children("*","MeshInstance3D",true,false)
        if n is MeshInstance3D:meshes.push_front(n)
        if str(n.name).contains("tower") or str(n.name).contains("chamber") or str(n.name).contains("band") or str(n.name).contains("capture"):
            print(str(n.name)+" "+n.get_class()+" transform="+str(n.transform))
            for m in meshes.slice(0,2):print("  "+str(m.name)+" "+str(m.get_aabb())+" "+str(m.transform))
    for role in ["gladius","spear","longbow"]:
        var actor=load("res://assets/roman-family-v1/romanSoldier_%s_blue.glb"%role).instantiate();root.add_child(actor)
        var bounds=AABB();var seeded:=false
        for mesh in actor.find_children("*","MeshInstance3D",true,false):
            if not mesh.is_visible_in_tree():continue
            var b:AABB=actor.global_transform.affine_inverse()*mesh.global_transform*mesh.get_aabb()
            bounds=bounds.merge(b) if seeded else b;seeded=true
        print("ACTOR "+role+" "+str(bounds));actor.queue_free()
    w.queue_free();await process_frame;quit()
