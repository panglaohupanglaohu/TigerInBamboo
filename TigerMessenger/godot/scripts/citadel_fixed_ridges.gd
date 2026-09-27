extends RefCounted
## Authored line endpoints exported from the released Web mountain; no camera input.
static func mount(parent:Node3D)->MeshInstance3D:
    var file="res://data/citadel-fixed-ridges.json"
    if not FileAccess.file_exists(file):return null
    var data=JSON.parse_string(FileAccess.get_file_as_string(file))
    if not data is Dictionary or data.get("frame","")!="castleContainer":return null
    var positions=data.get("positions",[])
    if positions.is_empty() or positions.size()%6!=0:return null
    var vertices=PackedVector3Array()
    for i in range(0,positions.size(),3):vertices.append(Vector3(positions[i],positions[i+1],positions[i+2]))
    var arrays=[];arrays.resize(Mesh.ARRAY_MAX);arrays[Mesh.ARRAY_VERTEX]=vertices
    var mesh=ArrayMesh.new();mesh.add_surface_from_arrays(Mesh.PRIMITIVE_LINES,arrays)
    var material=StandardMaterial3D.new();material.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
    material.albedo_color=Color(data.day);material.albedo_color.a=.82
    material.transparency=BaseMaterial3D.TRANSPARENCY_ALPHA
    material.depth_draw_mode=BaseMaterial3D.DEPTH_DRAW_DISABLED
    mesh.surface_set_material(0,material)
    var node=MeshInstance3D.new();node.name="citadel-fixed-ridge-lines";node.mesh=mesh
    node.cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    node.set_meta("skipColliders",true);node.set_meta("ridge_day",data.day);node.set_meta("ridge_night",data.night)
    parent.add_child(node);return node
