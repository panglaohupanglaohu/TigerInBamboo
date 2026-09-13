extends RefCounted
var report:Dictionary={}
var targets:Array[MeshInstance3D]=[]
func bind(model:Node3D)->bool:
    var path=preload("res://scripts/citadel_surface_variant.gd").data_path("res://data/camp-shallows.json")
    var data=JSON.parse_string(FileAccess.get_file_as_string(path))
    if not data is Dictionary:return false
    var bindings:Array=[]
    # Resolve every source identity before replacing any mesh; preserve sand and colliders.
    for patch in data.patches:
        var matches:Array[MeshInstance3D]=[]
        for mesh in model.find_children("*","MeshInstance3D",true,false):
            var source:String=str(mesh.get_meta("extras",{}).get("sourcePath",""))
            if source.begins_with("starting-camp[") and source.ends_with("/"+patch.suffix):matches.append(mesh)
        if matches.size()!=1:
            report={"passed":false,"suffix":patch.suffix,"matched":matches.size()};return false
        bindings.append([matches[0],patch])
    for binding in bindings:
        var target:MeshInstance3D=binding[0];var patch:Dictionary=binding[1]
        var arrays:Array=[];arrays.resize(Mesh.ARRAY_MAX)
        var vertices=PackedVector3Array();var normals=PackedVector3Array();var indices=PackedInt32Array()
        for i in range(0,patch.positions.size(),3):
            vertices.append(Vector3(patch.positions[i],patch.positions[i+1],patch.positions[i+2]))
            normals.append(Vector3(patch.normals[i],patch.normals[i+1],patch.normals[i+2]))
        for i in range(0,patch.indices.size(),3):
            for j in [0,2,1]:indices.append(int(patch.indices[i+j]))
        arrays[Mesh.ARRAY_VERTEX]=vertices;arrays[Mesh.ARRAY_NORMAL]=normals;arrays[Mesh.ARRAY_INDEX]=indices
        var material=target.get_active_material(0)
        var replacement=ArrayMesh.new();replacement.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays);replacement.surface_set_material(0,material)
        target.mesh=replacement
        var m=patch.matrix
        target.global_transform=model.global_transform*Transform3D(Basis(Vector3(m[0],m[1],m[2]),Vector3(m[4],m[5],m[6]),Vector3(m[8],m[9],m[10])),Vector3(m[12],m[13],m[14]))
        targets.append(target)
    report={"passed":targets.size()==11,"patches":targets.size(),"source":data.source,"scope":"Original shallow decoration only; terrain, sand and collision unchanged"}
    return report.passed
