extends RefCounted
var report:Dictionary={}
var target:MeshInstance3D
func bind(model:Node3D)->bool:
    var matches:Array[MeshInstance3D]=[]
    for mesh in model.find_children("*","MeshInstance3D",true,false):
        var source:String=str(mesh.get_meta("extras",{}).get("sourcePath",""))
        if mesh.name=="planet-surface" or source.get_slice("/",source.get_slice_count("/")-1).begins_with("planet-surface["):
            matches.append(mesh)
    if matches.size()!=1:
        report={"passed":false,"matched":matches.size()};push_error("Citadel seabed original planet not unique");return false
    var data=JSON.parse_string(FileAccess.get_file_as_string(preload("res://scripts/citadel_surface_variant.gd").data_path("res://data/citadel-seabed.json")))
    if not data is Dictionary:return false
    var arrays:Array=[];arrays.resize(Mesh.ARRAY_MAX)
    var vertices=PackedVector3Array();var normals=PackedVector3Array();var colors=PackedColorArray()
    # Reverse each source triangle to Godot winding; retain interpolated source colors.
    for i in range(0,data.positions.size()/3,3):
        for j in [0,2,1]:
            var k:int=(i+j)*3
            vertices.append(Vector3(data.positions[k],data.positions[k+1],data.positions[k+2]))
            normals.append(Vector3(data.normals[k],data.normals[k+1],data.normals[k+2]))
            colors.append(Color(data.colors[k],data.colors[k+1],data.colors[k+2]))
    arrays[Mesh.ARRAY_VERTEX]=vertices;arrays[Mesh.ARRAY_NORMAL]=normals;arrays[Mesh.ARRAY_COLOR]=colors
    target=matches[0]
    var material:Material=target.get_active_material(0)
    var replacement=ArrayMesh.new();replacement.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays);replacement.surface_set_material(0,material)
    target.mesh=replacement
    var m=data.matrix
    target.global_transform=model.global_transform*Transform3D(Basis(Vector3(m[0],m[1],m[2]),Vector3(m[4],m[5],m[6]),Vector3(m[8],m[9],m[10])),Vector3(m[12],m[13],m[14]))
    target.set_meta("citadel_seabed_source",data.source)
    report={"passed":true,"matched":1,"vertices":vertices.size(),"source":data.source,"scope":"Same modified original planet mesh; no ship docking or siege validation"}
    return true
