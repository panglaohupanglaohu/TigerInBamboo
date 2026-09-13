extends RefCounted
## Guarded kinematic hop traversal; retains rigid original legs. Not final walking animation.
var actor:Node3D
var pose=preload("res://scripts/roman_carry_pose.gd").new()
var route:Array[Vector3]=[]
var pieces:Array=[]
var up:Vector3
var lowest:=INF
var index:=0
var phase:="idle"
var progress:=0.0
var role:String
var checks:=0
var completed_steps:=0
var blocked:Dictionary={}
var start_basis:Basis
var end_basis:Basis
var step_start:Vector3
var step_end:Vector3
var space:PhysicsDirectSpaceState3D
var route_frame:Transform3D
var follow_support:=false
var soles:Array[Vector3]=[]
var landing_basis:Basis
var max_plant_adjustment:=0.0
func bind(world:Node3D,kind:String,path_root:Node3D=null,local_route:Array=[],surface_following:bool=false)->bool:
    var frame_root:Node3D=path_root if path_root!=null else world.stair_candidate.root
    var route_points:Array=local_route if not local_route.is_empty() else world.stair_candidate.route
    if route_points.size()<2:return false
    follow_support=surface_following
    role=kind;space=world.get_world_3d().direct_space_state;route_frame=frame_root.global_transform
    var path="res://assets/roman-family-v1/romanSoldier_%s_blue"%role
    actor=load(path+".glb").instantiate();world.add_child(actor)
    if not pose.bind(actor,role,JSON.parse_string(FileAccess.get_file_as_string(path+".assembly.json"))):return false
    pose.set_enabled(true)
    for mesh in actor.find_children("*","MeshInstance3D",true,false):
        if not mesh.is_visible_in_tree():continue
        var transform:Transform3D=actor.global_transform.affine_inverse()*mesh.global_transform
        var points=PackedVector3Array()
        for surface in range(mesh.mesh.get_surface_count()):
            for p in mesh.mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX]:
                var q:Vector3=transform*p;points.append(q);lowest=minf(lowest,q.y)
        if points.size()>=4:
            var shape=ConvexPolygonShape3D.new();shape.points=points;pieces.append({"shape":shape,"name":str(mesh.name)})
    for piece in pieces:
        for p in piece.shape.points:
            if p.y<lowest+0.06:soles.append(p)
    up=frame_root.global_basis.y.normalized()
    for p in route_points:
        var q:Vector3=frame_root.to_global(p)
        if route.is_empty() or route[-1].distance_to(q)>0.001:route.append(q)
    # Land toward the open edge of the tread: heels may overhang downhill,
    # but must not enter the next riser. Preserve the authored geometric route separately.
    var authored:Array[Vector3]=route.duplicate()
    for i in range(route.size()):
        var delta:Vector3=Vector3.ZERO
        if i>0 and absf((authored[i]-authored[i-1]).dot(up))>0.03:delta=authored[i]-authored[i-1]
        elif i<route.size()-1 and absf((authored[i+1]-authored[i]).dot(up))>0.03:delta=authored[i+1]-authored[i]
        if delta.length()>0:route[i]-=delta.slide(up).normalized()*signf(delta.dot(up))*(0.14 if delta.dot(up)>0 else 0.1)
    var direction:Vector3=(route[1]-route[0]).slide(up).normalized()
    var hit=_support(route[0])
    var normal:Vector3=Vector3(hit.normal).normalized() if follow_support and not hit.is_empty() else up
    direction=direction.slide(normal).normalized()
    actor.global_transform=_plant(route[0],Basis(direction,normal,direction.cross(normal)))
    phase="turn";_prepare_segment();return true
func _plant(surface:Vector3,basis:Basis)->Transform3D:
    var pose_transform=Transform3D(basis,surface+basis.y*(-lowest+0.015))
    if not follow_support:return pose_transform
    # A rigid pair of feet can straddle two differently oriented surfaces.
    # Keep the highest sole contact clear; the full actor collision sweep still
    # rejects overlaps, and a lift beyond one normal riser is not accepted.
    var lift:=0.0
    for sole in soles:
        var foot:Vector3=pose_transform*sole
        var hit=space.intersect_ray(PhysicsRayQueryParameters3D.create(foot+up*0.18,foot-up*0.12))
        if not hit.is_empty():lift=maxf(lift,(Vector3(hit.position)-foot).dot(up)+0.015)
    if lift<=0.18:
        pose_transform.origin+=up*lift;max_plant_adjustment=maxf(max_plant_adjustment,lift)
    return pose_transform
func _support(point:Vector3)->Dictionary:
    return space.intersect_ray(PhysicsRayQueryParameters3D.create(point+up*0.17,point-up*0.25))
func _prepare_segment()->void:
    if index>=route.size()-1:phase="arrived";return
    var a=_support(route[index]);var b=_support(route[index+1])
    if a.is_empty() or b.is_empty():phase="blocked";blocked={"reason":"missing_support","point":index};return
    var a_up:Vector3=Vector3(a.normal).normalized() if follow_support else up
    var b_up:Vector3=Vector3(b.normal).normalized() if follow_support else up
    start_basis=actor.global_basis
    var direction:Vector3=(route[index+1]-route[index]).slide(up).normalized()
    var da=direction.slide(a_up).normalized();var db=direction.slide(b_up).normalized()
    end_basis=Basis(da,a_up,da.cross(a_up)).orthonormalized()
    landing_basis=Basis(db,b_up,db.cross(b_up)).orthonormalized()
    step_start=_plant(Vector3(a.position),end_basis).origin
    step_end=_plant(Vector3(b.position),landing_basis).origin
    if follow_support:step_start+=up*maxf(0.0,(actor.global_position-step_start).dot(up))
    progress=0.0;phase="turn"
func _free(transform:Transform3D)->bool:
    for piece in pieces:
        var query=PhysicsShapeQueryParameters3D.new();query.shape=piece.shape;query.transform=transform;query.margin=0.001
        checks+=1
        var hits=space.intersect_shape(query,1)
        if not hits.is_empty():
            var hit=hits[0];var collider:CollisionObject3D=hit.collider
            var owner=collider.shape_owner_get_owner(collider.shape_find_owner(hit.shape))
            var obstacle_node=actor.get_parent().get_node_or_null(NodePath(str(owner.get_meta("source",""))))
            blocked={"progress":progress,"route_position":route_frame.affine_inverse()*route[index],"obstacle_bounds":obstacle_node.transform*obstacle_node.get_aabb() if obstacle_node is MeshInstance3D else AABB(),"reason":"mesh_overlap","part":piece.name,"point":index,"phase":phase,"obstacle":str(owner.get_meta("source",owner.get_path()))};return false
    return true
func _move_checked(target:Transform3D)->bool:
    var old:=actor.global_transform
    var count:=maxi(1,maxi(int(ceil(old.origin.distance_to(target.origin)/0.01)),int(ceil(old.basis.get_rotation_quaternion().angle_to(target.basis.get_rotation_quaternion())/deg_to_rad(2)))))
    for i in range(1,count+1):
        var next:Transform3D=old.interpolate_with(target,float(i)/count)
        if not _free(next):phase="blocked";return false
        actor.global_transform=next
    return true
func tick(dt:float)->void:
    if phase not in ["turn","hop"]:return
    if phase=="turn":
        var angle:=start_basis.get_rotation_quaternion().angle_to(end_basis.get_rotation_quaternion())
        progress=minf(1,progress+dt/maxf(0.08,angle/1.5))
        var turn_fraction=clampf((progress-0.25)/0.5,0,1) if follow_support else progress
        var turn_lift=0.18*(sin(PI*0.5*progress/0.25) if progress<0.25 else (1.0 if progress<=0.75 else cos(PI*0.5*(progress-0.75)/0.25))) if follow_support else sin(PI*progress)*(0.1 if role=="gladius" else 0.01)
        if not _move_checked(Transform3D(Basis(start_basis.get_rotation_quaternion().slerp(end_basis.get_rotation_quaternion(),turn_fraction)),step_start+up*turn_lift)):return
        if progress>=1:phase="hop";progress=0.0
    else:
        progress=minf(1,progress+dt/0.48)
        var height:float=maxf(step_start.dot(up),step_end.dot(up))+(0.1 if role=="gladius" else 0.01)
        var p:Vector3
        if progress<0.25:
            p=step_start+up*(height-step_start.dot(up))*sin(PI*0.5*progress/0.25)
        elif progress<0.75:
            p=step_start.lerp(step_end,(progress-0.25)/0.5);p+=up*(height-p.dot(up))
        else:
            p=step_end+up*(height-step_end.dot(up))*cos(PI*0.5*(progress-0.75)/0.25)
        var move_basis=Basis(end_basis.get_rotation_quaternion().slerp(landing_basis.get_rotation_quaternion(),clampf((progress-0.25)/0.5,0,1)))
        if not _move_checked(Transform3D(move_basis,p)):return
        if progress>=1:
            completed_steps+=1;index+=1;_prepare_segment()
func evidence()->Dictionary:
    return {"surface_following":follow_support,"max_plant_adjustment":max_plant_adjustment,"role":role,"phase":phase,"point":index,"route_points":route.size(),"completed_steps":completed_steps,"step_clearance":0.1 if role=="gladius" else 0.01,"geometry_queries":checks,"blocked":blocked,"scope":"One actual carried actor, Lift-advance-land stylized step with original rigid legs, 0.01m / 2 degree discrete collision guards; no final articulated gait, no peer avoidance or siege."}
func dispose()->void:
    if is_instance_valid(actor):actor.queue_free()
    phase="idle"
