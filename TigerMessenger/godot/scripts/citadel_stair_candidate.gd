extends RefCounted
## Reversible construction candidate in the original tower. Does not hollow the tower shell.
var root:Node3D
var original:Node3D
var route:Array[Vector3]=[]
var floors:Array[Dictionary]=[]
var report:Dictionary={}
var active:=false
var original_visible:=true
const RADIUS=0.86
const WIDTH=0.66
const DEPTH=0.40
const GOING=0.34
const THICKNESS=0.12
const MAX_RISE=0.14
func bind(stairs:Node3D,anchors:Dictionary)->bool:
    if not is_instance_valid(stairs):return false
    original=stairs;original_visible=stairs.visible
    root=Node3D.new();root.name="ContinuousStairCandidate";stairs.get_parent().add_child(root)
    var material:Material
    for mesh in stairs.find_children("*","MeshInstance3D",true,false):
        if mesh.mesh!=null:material=mesh.get_active_material(0);break
    var base_y:float=float(anchors.interiorFloorRoutes[0].points[0][1])-2.25
    var bottom:float=float(anchors.interiorFloorRoutes[0].points[0][1])-base_y+THICKNESS*0.5
    # Stay outside the spiral while entering; a straight chord would run into ascending treads.
    _walk_segment(Vector3(0,3.55,3.5),Vector3(0,3.55,2.45),material)
    _walk_segment(Vector3(0,3.55,2.45),Vector3(1.8,3.55,2.45),material)
    _walk_segment(Vector3(1.8,3.55,2.45),Vector3(1.8,3.55,1.9),material)
    _walk_segment(Vector3(1.8,3.55,1.9),Vector3(1.8,bottom,-0.3),material)
    var entry_radius:=Vector2(1.8,-0.3).length()
    var angle_begin:=atan2(-0.3,1.8)
    var entry_first:Array=anchors.interiorFloorRoutes[0].points[0]
    var angle_finish:=atan2(float(entry_first[2]),float(entry_first[0]))
    var cursor:=Vector3(1.8,bottom,-0.3)
    for k in range(1,9):
        var a:=lerpf(angle_begin,angle_finish,float(k)/8)
        var next:=Vector3(cos(a)*entry_radius,bottom,sin(a)*entry_radius)
        _walk_segment(cursor,next,material);cursor=next
    _walk_segment(cursor,Vector3(entry_first[0],bottom,entry_first[2]),material)
    var previous_angle:=0.0
    var max_rise:=0.0;var tread_count:=0
    for f in range(anchors.interiorFloorRoutes.size()):
        var points:Array=anchors.interiorFloorRoutes[f].points
        var first:Array=points[0];var last:Array=points[-1]
        var start_y:float=float(first[1])-base_y+THICKNESS*0.5
        var end_y:float=float(last[1])-base_y+THICKNESS*0.5
        var angle_start:=atan2(float(first[2]),float(first[0]))
        var count:=maxi(1,int(ceil((end_y-start_y)/MAX_RISE)))
        # Continuous angular phase across floors avoids the old disconnected
        # landings crossing directly above the previous flight.
        if f>0:angle_start=previous_angle
        var span:=count*GOING/RADIUS
        var first_index:=route.size()
        for i in range(count+1):
            var t:=float(i)/count
            _tread(angle_start+span*t,lerpf(start_y,end_y,t),material);tread_count+=1
        max_rise=maxf(max_rise,(end_y-start_y)/count)
        floors.append({"floor":f,"start_index":first_index,"end_index":route.size()-1,"rise":(end_y-start_y)/count,"turns":span/TAU})
        previous_angle=angle_start+span
    # Finish at the actual top surface (original deck center + half thickness).
    var last_point:Vector3=route[-1]
    var deck_y:float=float(anchors.keepTop[1])-base_y+0.12
    var exit_count:=maxi(1,int(ceil((deck_y-last_point.y)/MAX_RISE)))
    for i in range(1,exit_count+1):
        _tread(previous_angle+GOING/RADIUS*i,lerpf(last_point.y,deck_y,float(i)/exit_count),material)
    var exit_point:Vector3=route[-1]
    var goal:=Vector3(float(anchors.keepTop[0]),deck_y,float(anchors.keepTop[2]))
    var bridge=MeshInstance3D.new();var bridge_box=BoxMesh.new()
    bridge_box.size=Vector3(WIDTH,THICKNESS,exit_point.distance_to(goal)+0.04);bridge.mesh=bridge_box;bridge.material_override=material;root.add_child(bridge)
    bridge.position=(exit_point+goal)*0.5-Vector3.UP*THICKNESS*0.5
    bridge.rotation.y=atan2(goal.x-exit_point.x,goal.z-exit_point.z)
    route.append(goal)
    tread_count=root.get_child_count()
    root.visible=false
    report={"built":true,"treads":tread_count,"floors":floors,"max_riser":max_rise,"width":WIDTH,"radius":RADIUS,"tower_shell_hollowed":false,"floor_heights_preserved":true,"old_angular_endpoints_preserved":false,"entry_connected":true,"exterior_approach_connected":false,"capture_deck_connected":true,"walkability_validated":false}
    return true
func _tread(angle:float,height:float,material:Material)->void:
    var point:=Vector3(cos(angle)*RADIUS,height,sin(angle)*RADIUS)
    route.append(point)
    var mesh=MeshInstance3D.new();var surface=SurfaceTool.new();surface.begin(Mesh.PRIMITIVE_TRIANGLES);surface.set_smooth_group(-1)
    var points:Array[Vector3]=[]
    var half_angle:float=GOING/RADIUS*0.5+0.003
    for y in [-THICKNESS,0.0]:
        for spec in [[RADIUS-WIDTH*0.5,-half_angle],[RADIUS+WIDTH*0.5,-half_angle],[RADIUS+WIDTH*0.5,half_angle],[RADIUS-WIDTH*0.5,half_angle]]:
            points.append(Vector3(cos(angle+spec[1])*spec[0],height+y,sin(angle+spec[1])*spec[0]))
    for face in [[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]:
        for index in [face[0],face[2],face[1],face[0],face[3],face[2]]:surface.add_vertex(points[index])
    surface.generate_normals();mesh.mesh=surface.commit();mesh.material_override=material;root.add_child(mesh)

func set_enabled(value:bool)->void:
    if not is_instance_valid(root):return
    active=value;root.visible=value;original.visible=false if value else original_visible

func _walk_segment(a:Vector3,b:Vector3,material:Material)->void:
    var count:=maxi(1,maxi(int(ceil(a.distance_to(b)/0.24)),int(ceil(absf(b.y-a.y)/MAX_RISE))))
    var delta:=b-a
    var run:=Vector2(delta.x,delta.z).length()/count
    for i in range(count+1):
        var point:=a.lerp(b,float(i)/count)
        var mesh=MeshInstance3D.new();var box=BoxMesh.new();box.size=Vector3(WIDTH,THICKNESS,maxf(run+0.06,0.12));mesh.mesh=box;mesh.material_override=material
        root.add_child(mesh);mesh.position=point-Vector3.UP*THICKNESS*0.5;mesh.rotation.y=atan2(delta.x,delta.z)
        route.append(point)
