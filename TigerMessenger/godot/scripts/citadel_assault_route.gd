extends RefCounted
## Authored Web route, visualized at the preserved castle transform.
## Displaying the line does not establish a navigable or collision-free route.
const DATA="res://data/citadel-assault-route.json"
var node:Node3D
var report:Dictionary={}
var anchors:Dictionary={}
func bind(castle:Node3D)->bool:
    if not is_instance_valid(castle) or not FileAccess.file_exists(DATA):return false
    var data=JSON.parse_string(FileAccess.get_file_as_string(DATA))
    if not data is Dictionary:return false
    anchors=data.get("anchors",{})
    if anchors.get("destination","")!="castle-top" or anchors.get("ladderPolicy","")!="disabled":return false
    var routes:Array=[anchors.get("stairRoute",[])]
    for floor_route in anchors.get("interiorFloorRoutes",[]):routes.append(floor_route.points)
    var point_count:=0
    for points in routes:
        if points.size()<2:return false
        for point in points:
            if not point is Array or point.size()!=3:return false
            for value in point:
                if not (value is float or value is int) or not is_finite(float(value)):return false
            point_count+=1
    node=Node3D.new();node.name="AuthoredCitadelAssaultRoutes";castle.add_child(node)
    node.transform=castle.get_meta("citadel_old_city_frame",Transform3D.IDENTITY)
    for i in range(routes.size()):
        var mesh=ImmediateMesh.new();mesh.surface_begin(Mesh.PRIMITIVE_LINE_STRIP)
        for point in routes[i]:mesh.surface_add_vertex(Vector3(point[0],point[1],point[2]))
        mesh.surface_end()
        var line=MeshInstance3D.new();line.mesh=mesh
        var mat=StandardMaterial3D.new();mat.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
        mat.albedo_color=Color("e6b655") if i==0 else Color("55d7ed")
        line.material_override=mat;line.cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
        node.add_child(line)
    node.visible=false
    report={"loaded":true,"point_count":point_count,"routes":routes.size(),"floors":routes.size()-1,"source_sha256":data.get("sourceSHA256",""),"destination":"castle-top","ladders":false,"walkability_validated":false,"troop_movement_integrated":false}
    return true
func set_visible(value:bool)->void:
    if is_instance_valid(node):node.visible=value
