extends SceneTree
var failures: Array[String] = []
var reports: Array = []
func _initialize() -> void: call_deferred("run")
func check(ok: bool, label: String) -> void:
    if not ok: failures.append(label)
func index(node:Node,result:Dictionary)->void:
    var extras:Dictionary=node.get_meta("extras",{})
    var id:String=str(extras.get("three_node_id",extras.get("roman_family_added_id","")))
    if not id.is_empty():result[id]=node
    if node is Node3D and (extras.get("candidateHidden",false) or not extras.get("three_visible",true)):node.visible=false
    for child in node.get_children():index(child,result)
func points(node:Node3D,actor:Node3D)->PackedVector3Array:
    var out:=PackedVector3Array()
    var meshes:Array=node.find_children("*","MeshInstance3D",true,false)
    if node is MeshInstance3D:meshes.append(node)
    for mesh in meshes:
        if not mesh.is_visible_in_tree():continue
        for surface in mesh.mesh.get_surface_count():
            for vertex in mesh.mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX]:
                out.append(actor.to_local(mesh.to_global(vertex)))
    return out
func run()->void:
    root.size=Vector2i(1400,850)
    var scene:=Node3D.new();root.add_child(scene)
    var env:=WorldEnvironment.new();env.environment=Environment.new()
    env.environment.background_mode=Environment.BG_COLOR;env.environment.background_color=Color("71818a")
    env.environment.ambient_light_source=Environment.AMBIENT_SOURCE_COLOR
    env.environment.ambient_light_color=Color.WHITE;env.environment.ambient_light_energy=0.6;scene.add_child(env)
    var light:=DirectionalLight3D.new();scene.add_child(light);light.rotation_degrees=Vector3(-45,-35,0);light.light_energy=1.8
    var camera:=Camera3D.new();scene.add_child(camera);camera.position=Vector3(1.8,1.0,3.4);camera.look_at(Vector3(0,0.4,0));camera.projection=Camera3D.PROJECTION_ORTHOGONAL;camera.size=2.8;camera.current=true
    var floor_mesh:=MeshInstance3D.new();floor_mesh.mesh=PlaneMesh.new();floor_mesh.mesh.size=Vector2(6,4);scene.add_child(floor_mesh)
    for role in ["gladius","spear","longbow"]:
        var actor:Node3D=load("res://assets/roman-family-v1/romanSoldier_%s_blue.glb"%role).instantiate();scene.add_child(actor)
        actor.position.x=(reports.size()-1)*0.85
        var nodes:Dictionary={};index(actor,nodes)
        var controller=load("res://scripts/roman_concealment_pose.gd").new()
        check(controller.bind(actor,nodes),role+" binds source nodes")
        var soles:Array=[]
        for id in ["n23","n26"]:soles.append(points(nodes[id],actor))
        var low:=INF
        for set in soles:
            for point in set:low=minf(low,point.y)
        actor.position.y=-low
        var rest:Array=[]
        for node in controller.parts:rest.append(node.transform)
        var hand:Node3D=nodes["add:handL"]
        var other:Node3D=nodes["add:handR"]
        var original_hand:Transform3D=nodes["n2"].global_transform.affine_inverse()*hand.global_transform
        var original_right:Transform3D=nodes["n2"].global_transform.affine_inverse()*other.global_transform
        var equipment:Node3D=nodes["n17"].get_parent().get_child(0)
        var grip_relation:Transform3D=hand.global_transform.affine_inverse()*equipment.global_transform
        var baseline_head:float=-INF
        for point in points(nodes["n7"],actor):baseline_head=maxf(baseline_head,point.y)
        var max_sole_error:=0.0;var max_grip_error:=0.0;var max_scale_error:=0.0
        for step in range(101):
            controller.update(step/100.0)
            for side in range(2):
                var current:=points(nodes[["n23","n26"][side]],actor)
                for i in current.size():max_sole_error=maxf(max_sole_error,current[i].distance_to(soles[side][i]))
            var left_relative:Transform3D=nodes["n2"].global_transform.affine_inverse()*hand.global_transform
            var right_relative:Transform3D=nodes["n2"].global_transform.affine_inverse()*other.global_transform
            var relative_equipment:Transform3D=hand.global_transform.affine_inverse()*equipment.global_transform
            max_grip_error=maxf(max_grip_error,relative_equipment.origin.distance_to(grip_relation.origin))
            max_grip_error=maxf(max_grip_error,left_relative.origin.distance_to(original_hand.origin))
            max_grip_error=maxf(max_grip_error,right_relative.origin.distance_to(original_right.origin))
            for i in controller.parts.size():max_scale_error=maxf(max_scale_error,controller.parts[i].transform.basis.get_scale().distance_to(rest[i].basis.get_scale()))
        var current_head:float=-INF
        for point in points(nodes["n7"],actor):current_head=maxf(current_head,point.y)
        var lowered:float=baseline_head-current_head
        check(max_sole_error<0.00001,role+" feet fixed")
        check(max_grip_error<0.00001,role+" upper assembly rigid")
        check(max_scale_error<0.00001,role+" no body scaling")
        check(lowered>0,role+" head lowered by hip hinge")
        controller.reset()
        for i in controller.parts.size():check(controller.parts[i].transform.is_equal_approx(rest[i]),role+" neutral restored")
        controller.update(1.0)
        reports.append({"role":role,"frames":101,"sole_error":max_sole_error,"hand_relative_error":max_grip_error,"scale_error":max_scale_error,"head_lowered":lowered})
    await process_frame
    await RenderingServer.frame_post_draw
    var args:=OS.get_cmdline_user_args()
    var output:String=args[0] if not args.is_empty() else "../artifacts/pipeline/roman-concealment"
    DirAccess.make_dir_recursive_absolute(output)
    root.get_texture().get_image().save_png(output+"/three-roles-ready.png")
    var report:={"pose":"rigid-leg forward hip hinge; not a knee crouch","failures":failures,"roles":reports}
    FileAccess.open(output+"/report.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)
