extends SceneTree
func _initialize()->void:call_deferred("run")
func vec(a:Array)->Vector3:return Vector3(a[0],a[1],a[2])
func run()->void:
    root.size=Vector2i(1500,1000)
    var wide="--wide" in OS.get_cmdline_user_args()
    var reverse="--reverse" in OS.get_cmdline_user_args()
    var deck="--deck" in OS.get_cmdline_user_args()
    var full_board="--full-board" in OS.get_cmdline_user_args() or deck
    var tag=("wide-" if wide else "")+("deck-" if deck else ("full-board-" if full_board else ""))+("reverse-" if reverse else "")
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-boarding-r04%s-candidate.json" % ("-wide" if wide else "")))
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    w.set_process(false);w.set_physics_process(false)
    var city=w.castle_adapter.original.find_child("highland-west-city",true,false)
    var ship=w.front_harbor_berth_adapter.ship
    var q=data.native.quaternion
    ship.global_transform=city.global_transform*Transform3D(Basis(Quaternion(q[0],q[1],q[2],q[3])).scaled(vec(data.native.scale)),vec(data.native.position))
    var adapter=w.front_harbor_berth_adapter.adapter
    var row=adapter.bind(ship)
    if not adapter.pose_boarding(row,1.0,deg_to_rad(data.landing.degrees)):quit(1);return
    row.ids["add:boarding-hinge"].rotate_object_local(Vector3.BACK,data.landing.roll)
    if wide:
        var controller=load("res://scripts/citadel_boarding_candidate.gd").new()
        if not controller.bind(adapter,row,data.landing):quit(1);return
        if "--motion" in OS.get_cmdline_user_args():
            var web=JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/pipeline/citadel-master-terrain/surroundings-r04-web-motion.json"))
            var max_error=0.0
            var identity_before=JSON.stringify([row.crew_state,row.crew_identity,row.crew_stage])
            for check in web.checks:
                if not controller.set_progress(check.progress):quit(1);return
                var expected=adapter._transform(check.hingeMatrix)
                var actual=row.ids["add:boarding-hinge"].transform
                max_error=maxf(max_error,actual.origin.distance_to(expected.origin))
                for axis in range(3):max_error=maxf(max_error,actual.basis[axis].distance_to(expected.basis[axis]))
            var stable=identity_before==JSON.stringify([row.crew_state,row.crew_identity,row.crew_stage])
            var parity={"samples":web.checks.size(),"maximum_matrix_error":max_error,"crew_state_unchanged":stable,"passed":max_error<0.00001 and stable,"scope":"Engine hinge transform parity and original crew state; not native dynamic collision sweep."}
            FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/surroundings-r04-godot-motion.json",FileAccess.WRITE).store_string(JSON.stringify(parity,"  "))
            if not parity.passed:quit(1);return
        controller.set_progress(1.0)
    var actual_tip=city.to_local(row.ids["add:boarding-hinge"].to_global(Vector3(0,.024,1.35)))
    print("Native actual board tip city-local: ",actual_tip," expected Web: ",data.landing.lanes[1].local)
    var arrays=[];arrays.resize(Mesh.ARRAY_MAX)
    var vertices=PackedVector3Array();for p in data.landing.vertices:vertices.append(vec(p))
    var indices=PackedInt32Array(data.landing.indices)
    for i in range(0,indices.size(),3):var n=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=n
    arrays[Mesh.ARRAY_VERTEX]=vertices;arrays[Mesh.ARRAY_INDEX]=indices
    var mesh=ArrayMesh.new();mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
    var shoe=MeshInstance3D.new();shoe.name="BoardingBearingCandidate";shoe.mesh=mesh;w.castle_adapter.original.add_child(shoe);shoe.global_transform=city.global_transform
    var material=StandardMaterial3D.new();material.albedo_color=Color("785438");material.cull_mode=BaseMaterial3D.CULL_DISABLED;shoe.material_override=material
    var step=MeshInstance3D.new();step.name="BoardingStepCandidate";var box=BoxMesh.new();box.size=vec(data.step.size);step.mesh=box;step.material_override=material;w.castle_adapter.original.add_child(step);step.global_transform=city.global_transform*Transform3D(Basis.IDENTITY,vec(data.step.center))
    w.traversal_context.dispose();w.traversal_context.bind(w)
    await physics_frame;await physics_frame
    var points=[]
    if deck:
        var boat_root=row.ids["n0"]
        var hinge_root=boat_root.to_local(row.ids["add:boarding-hinge"].global_position)
        # The central slots hold the original weapons. Follow the existing
        # starboard aisle, then turn across the bow transfer deck to the hinge.
        var aisle=0.36
        for i in range(11):points.append(city.to_local(boat_root.to_global(Vector3(lerpf(1.0,hinge_root.x,float(i)/10),.664,aisle))))
        # Plant on the transfer timber, then step across the hinge clearance;
        # the moving joint itself is deliberately not a standing surface.
        for i in range(1,7):points.append(city.to_local(boat_root.to_global(Vector3(hinge_root.x,.664,lerpf(aisle,hinge_root.z-.08,float(i)/6)))))
    if full_board:
        var hinge=row.ids["add:boarding-hinge"]
        var seam_start=hinge.to_local(city.to_global(vec(data.native.route[0])))
        var segments=maxi(1,int(ceil((seam_start.z-0.03)/0.08)))
        for i in range(segments):
            var z=lerpf(0.03,seam_start.z,float(i)/segments)
            points.append(city.to_local(hinge.to_global(Vector3(0,.019,z))))
    for p in data.native.route:points.append(vec(p))
    var deck_surfaces=[]
    if deck:
        var up=city.global_basis.y.normalized()
        var space=w.get_world_3d().direct_space_state
        for i in range(17):
            var point=city.to_global(points[i])
            var hit=space.intersect_ray(PhysicsRayQueryParameters3D.create(point+up*.4,point-up*.3))
            if hit.is_empty():push_error("Missing deck floor at "+str(i));quit(1);return
            var collider:CollisionObject3D=hit.collider
            var owner=collider.shape_owner_get_owner(collider.shape_find_owner(hit.shape))
            points[i]=city.to_local(hit.position)
            var probe=PhysicsRayQueryParameters3D.create(point+up*.4,point-up*.3);probe.hit_back_faces=true
            var double_hit=space.intersect_ray(probe)
            var double_source=""
            if not double_hit.is_empty():
                var dc:CollisionObject3D=double_hit.collider
                double_source=str(dc.shape_owner_get_owner(dc.shape_find_owner(double_hit.shape)).get_meta("source",""))
            deck_surfaces.append({"index":i,"position":str(points[i]),"surface":str(owner.get_meta("source",owner.get_path())),"backface_probe":double_source})
    if reverse:points.reverse()
    var walker=load("res://scripts/citadel_roman_traversal.gd").new()
    if not walker.bind(w,"gladius",city,points,true):quit(1);return
    for i in range(60*60):
        walker.tick(1.0/60.0)
        if walker.phase in ["arrived","blocked"]:break
    var report=walker.evidence();report["scope"]="Original Godot gladius mesh and guarded rigid-leg traversal across the final 0.9m board/shoe/step/quay seam. Not full deck access, natural gait, ship deployment or production boarding."
    if full_board:report["scope"]="Original gladius from the original board hinge across its full deployed length and shore seam. Does not certify deck access, deployment, natural gait or production boarding."
    if deck:report["scope"]="Original gladius from forward centre deck through bow transfer landing, deployed board and quay. Does not certify all seats, deployment, natural gait or production boarding."
    report["direction"]="quay_to_board" if reverse else "board_to_quay"
    report["max_swing_adjustment"]=walker.max_swing_adjustment
    report["deck_surfaces"]=deck_surfaces
    var hinge_node=row.ids["add:boarding-hinge"]
    var support=walker._support(walker.route[walker.index])
    report["support"]={"position":str(city.to_local(support.position)),"normal_in_city":str(city.global_basis.inverse()*support.normal),"collider":str(support.collider.get_meta("source",support.collider.get_path()))} if not support.is_empty() else {}
    report["actor_in_board"]=str(hinge_node.global_transform.affine_inverse()*walker.actor.global_transform)
    var part_bounds={}
    for piece in walker.pieces:
        if piece.name not in ["shield-boss","n24","n33","Gold_Lower_Bracket"]:continue
        var low=Vector3(INF,INF,INF);var high=Vector3(-INF,-INF,-INF)
        for p in piece.shape.points:
            var point=hinge_node.to_local(walker.actor.to_global(p));low=low.min(point);high=high.max(point)
        part_bounds[piece.name]={"min":str(low),"max":str(high)}
    report["parts_in_board"]=part_bounds
    var lo=Vector3(INF,INF,INF);var hi=Vector3(-INF,-INF,-INF)
    for piece in walker.pieces:
        for p in piece.shape.points:lo=lo.min(p);hi=hi.max(p)
    report["carry_bounds"]={"minimum":str(lo),"maximum":str(hi),"width":hi.z-lo.z,"centered_width":2.0*maxf(absf(lo.z),absf(hi.z))}
    report["passed"]=walker.phase=="arrived"
    var out="res://../artifacts/pipeline/citadel-master-terrain/"
    FileAccess.open(out+"surroundings-r04-"+tag+"godot-seam.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
    w.assault_route.set_visible(false)
    w.camera.global_position=city.to_global(Vector3(55,-1,119));w.camera.look_at(city.to_global(Vector3(49.6,-5,110.3)),city.global_basis.y.normalized());w.camera.fov=45
    await process_frame;await RenderingServer.frame_post_draw
    root.get_texture().get_image().save_png(out+"surroundings-r04-"+tag+"godot-seam.png")
    print(JSON.stringify(report));w.free();quit(0 if report.passed else 1)
