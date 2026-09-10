extends RefCounted
## Original SOCCO seats and rear door, with terrain-solved ramp and real ordered paths.
const ACTIVE=[0,1,2,4,5,8,9]
var rows:Array=[]
var report:Dictionary={"crafts":[],"unsupported_samples":0,"craft_surface_misses":0,"terrain_support_samples":0,"completed_exits":0,"completed_entries":0}
func index(node:Node,ids:Dictionary)->void:
    var extra:Dictionary=node.get_meta("extras",{})
    var id:String=str(extra.get("three_node_id",""))
    if not id.is_empty():ids[id]=node
    if node is Node3D and (extra.get("candidate_hidden_outline",false) or extra.get("source_visible",true)==false):node.visible=false
    for child in node.get_children():index(child,ids)
func add(craft:Node3D)->Dictionary:
    var ids:Dictionary={};index(craft,ids)
    var row={"node":craft,"ids":ids,"angle":PI/2,"open_angle":0.0,"valid":false,"target":Transform3D.IDENTITY,"triangles":[],"surface_grid":{},"busy":"","exit_order":[],"reason":""}
    if ids.size()<127 or not ids.has("n87"):row.reason="original SOCCO node bindings missing"
    rows.append(row);return row
func seat(row:Dictionary,occupant:int)->Vector3:
    var anchor:Node3D=row.ids["n%d"%(109+ACTIVE[occupant])]
    var x:float=anchor.position.x
    return row.node.to_local(anchor.global_position)+Vector3(0.12 if x<0 else -0.09,0,0)
func set_angle(row:Dictionary,angle:float)->void:
    row.angle=angle;row.ids.n87.rotation.x=angle
func sample_ground(world:World3D,point:Vector3)->Dictionary:
    var d:=point.normalized();var query:=PhysicsRayQueryParameters3D.create(d*174.0,d*150.0)
    query.collision_mask=1
    var hit:=world.direct_space_state.intersect_ray(query)
    if hit.is_empty() or Vector3(hit.position).length()<160.607:return {}
    return hit
func solve(row:Dictionary,world:World3D,candidates:Array,preferred:Vector3,facing:Vector3,other_targets:Array)->bool:
    var sorted:=candidates.duplicate();sorted.sort_custom(func(a,b):return a.distance_squared_to(preferred)<b.distance_squared_to(preferred))
    for point in sorted:
        var spaced:=true
        for used in other_targets:
            if point.distance_to(used)<7.0:spaced=false
        if not spaced:continue
        var ground:=sample_ground(world,point)
        if ground.is_empty():continue
        var up:Vector3=Vector3(ground.position).normalized()
        var front:Vector3=(facing-ground.position).slide(up).normalized()
        if front.length()<0.1:continue
        var basis:=Basis(up.cross(front).normalized(),up,front)
        var pose:=Transform3D(basis,Vector3(ground.position)+up*2.0)
        # Fit the entire occupied hull above existing terrain, not just its centre.
        var lift_needed:float=0.0
        for x in [-1.0,0.0,1.0]:
            for z in [-2.7,-1.5,0.0,1.5,3.0]:
                var sample:=sample_ground(world,pose*Vector3(x,-2,z))
                if sample.is_empty():continue
                var local_sample:Vector3=pose.affine_inverse()*Vector3(sample.position)
                lift_needed=maxf(lift_needed,local_sample.y+2.02)
        pose.origin+=up*lift_needed
        var angle:float=-0.2
        var good:=true
        for iteration in range(4):
            var local_tip:=Vector3(0,-1.4+2.9*sin(angle)-0.01*cos(angle),-2.62-2.9*cos(angle)-0.01*sin(angle))
            var hit:=sample_ground(world,pose*local_tip)
            if hit.is_empty():good=false;break
            var local_ground:Vector3=pose.affine_inverse()*Vector3(hit.position)
            var ratio:float=(local_ground.y+1.4)/sqrt(2.9*2.9+0.01*0.01)
            if absf(ratio)>1:good=false;break
            angle=asin(ratio)+atan(0.01/2.9)
            if absf(angle)>deg_to_rad(25):good=false;break
        if not good:continue
        # Both lanes must touch genuine dry land beyond the ramp, never ocean.
        for lane in [-0.4,0.43]:
            for extra in [0.0,0.5,1.0]:
                if sample_ground(world,pose*Vector3(lane,-2,-2.62-2.9*cos(angle)-extra)).is_empty():good=false
        if not good:continue
        # Reject humps intersecting the sloping deck between hinge and tip.
        for lane in [-0.65,0.0,0.65]:
            for step in range(1,15):
                var distance:float=2.9*float(step)/15.0
                var ramp_point:=Vector3(lane,-1.4+distance*sin(angle),-2.62-distance*cos(angle))
                var sample:=sample_ground(world,pose*ramp_point)
                if sample.is_empty():good=false;break
                var ground_local:Vector3=pose.affine_inverse()*Vector3(sample.position)
                if ground_local.y>ramp_point.y-0.012:good=false;break
        if not good:continue
        row.target=pose;row.open_angle=angle;row.valid=true
        report.crafts.append({"target":pose.origin,"ramp_angle":angle,"ground_changed":false,"seats":ACTIVE})
        return true
    row.reason="No dry reachable rear-ramp berth at original station";return false
func cache_surface(row:Dictionary)->void:
    row.triangles.clear();row.surface_grid.clear()
    for node in row.node.find_children("*","MeshInstance3D",true,false):
        if not node.is_visible_in_tree():continue
        var trans:Transform3D=row.node.global_transform.affine_inverse()*node.global_transform
        var faces:PackedVector3Array=node.mesh.get_faces()
        for i in range(0,faces.size(),3):
            var a:Vector3=trans*faces[i];var b:Vector3=trans*faces[i+1];var c:Vector3=trans*faces[i+2]
            if maxf(a.y,maxf(b.y,c.y))<0.0:
                row.triangles.append([a,b,c])
                for x in range(int(floor(minf(a.x,minf(b.x,c.x))*4)),int(floor(maxf(a.x,maxf(b.x,c.x))*4))+1):
                    for z in range(int(floor(minf(a.z,minf(b.z,c.z))*4)),int(floor(maxf(a.z,maxf(b.z,c.z))*4))+1):
                        var key:=Vector2i(x,z)
                        if not row.surface_grid.has(key):row.surface_grid[key]=[]
                        row.surface_grid[key].append([a,b,c])
func support(row:Dictionary,local:Vector3)->float:
    var height:float=-INF
    for tri in row.surface_grid.get(Vector2i(int(floor(local.x*4)),int(floor(local.z*4))),[]):
        var point=Geometry3D.segment_intersects_triangle(Vector3(local.x,0,local.z),Vector3(local.x,-3,local.z),tri[0],tri[1],tri[2])
        if point!=null:height=maxf(height,point.y)
    return height
func standing(row:Dictionary,local:Vector3,boot_corners:Array)->Vector3:
    var root_y:float=-INF
    for corner in boot_corners:
        var p:Vector3=local+Vector3(-corner.x,0,-corner.z)
        var height:=support(row,p)
        if height==-INF:continue
        root_y=maxf(root_y,height-corner.y+0.001)
    if root_y==-INF:
        report.craft_surface_misses+=1;return Vector3(INF,INF,INF)
    return Vector3(local.x,root_y,local.z)
func reset()->void:
    rows.clear();report={"crafts":[],"unsupported_samples":0,"craft_surface_misses":0,"terrain_support_samples":0,"completed_exits":0,"completed_entries":0}
