extends RefCounted
var report:Dictionary={}
var targets:Array=[]
func bind(model:Node3D)->bool:
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-front-coast.json"))
    var bindings=[]
    for part in data.parts:
        var matches=[]
        for mesh in model.find_children("*","MeshInstance3D",true,false):
            var source:String=str(mesh.get_meta("extras",{}).get("sourcePath",""))
            if (part.name=="camp-flat-patch" and source.begins_with("starting-camp[") and source.ends_with("/camp-flat-patch[%d]"%int(part.ordinal))) or (part.name!="camp-flat-patch" and source.begins_with(part.name+"[") and not source.contains("/")):
                matches.append(mesh)
        if matches.size()!=1:
            report={"passed":false,"name":part.name,"ordinal":part.ordinal,"matches":matches.size()};return false
        bindings.append([matches[0],part])
    for binding in bindings:
        var target:MeshInstance3D=binding[0];var part:Dictionary=binding[1]
        var vertices=PackedVector3Array();var normals=PackedVector3Array();var colors=PackedColorArray();var indices=PackedInt32Array()
        for i in range(0,part.positions.size(),3):
            vertices.append(Vector3(part.positions[i],part.positions[i+1],part.positions[i+2]))
            normals.append(Vector3(part.normals[i],part.normals[i+1],part.normals[i+2]))
            if part.colors!=null:colors.append(Color(part.colors[i],part.colors[i+1],part.colors[i+2]))
        var source_indices=part.indices if part.indices!=null else range(vertices.size())
        # Three/Blender CCW triangles -> Godot CW front faces.
        for i in range(0,source_indices.size(),3):
            for j in [0,2,1]:indices.append(int(source_indices[i+j]))
        var arrays=[];arrays.resize(Mesh.ARRAY_MAX);arrays[Mesh.ARRAY_VERTEX]=vertices;arrays[Mesh.ARRAY_NORMAL]=normals;arrays[Mesh.ARRAY_INDEX]=indices
        if not colors.is_empty():arrays[Mesh.ARRAY_COLOR]=colors
        var material=target.get_active_material(0)
        var geometry=ArrayMesh.new();geometry.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays);geometry.surface_set_material(0,material);target.mesh=geometry
        var m=part.matrix
        target.global_transform=model.global_transform*Transform3D(Basis(Vector3(m[0],m[1],m[2]),Vector3(m[4],m[5],m[6]),Vector3(m[8],m[9],m[10])),Vector3(m[12],m[13],m[14]))
        target.set_meta("front_coast_source",data.source);targets.append(target)
    report={"passed":true,"parts":targets.size(),"source":data.source,"scope":"Shared Blender coast geometry replaces original ground nodes; no character or story changes."}
    return true
