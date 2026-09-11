extends RefCounted
var ocean:MeshInstance3D
func bind(model:Node3D)->void:
    if is_instance_valid(ocean):return
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/original-ocean.json"))
    if not data is Dictionary:return
    var arrays:Array=[];arrays.resize(Mesh.ARRAY_MAX)
    var vertices=PackedVector3Array();var normals=PackedVector3Array();var colors=PackedColorArray();var uv=PackedVector2Array();var uv2=PackedVector2Array()
    for i in range(data.positions.size()/3):
        vertices.append(Vector3(data.positions[i*3],data.positions[i*3+1],data.positions[i*3+2]))
        normals.append(Vector3(data.normals[i*3],data.normals[i*3+1],data.normals[i*3+2]))
        colors.append(Color(data.water0[i*4],data.water0[i*4+1],data.water0[i*4+2],data.water0[i*4+3]))
        uv.append(Vector2(data.water1[i*4],data.water1[i*4+1]));uv2.append(Vector2(data.water1[i*4+2],data.water1[i*4+3]))
    arrays[Mesh.ARRAY_VERTEX]=vertices;arrays[Mesh.ARRAY_NORMAL]=normals;arrays[Mesh.ARRAY_COLOR]=colors;arrays[Mesh.ARRAY_TEX_UV]=uv;arrays[Mesh.ARRAY_TEX_UV2]=uv2
    # Godot triangle winding is opposite to the source Three.js GLB chart.
    var indices=PackedInt32Array(data.indices)
    for i in range(0,indices.size(),3):var t=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=t
    arrays[Mesh.ARRAY_INDEX]=indices
    var mesh=ArrayMesh.new();mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
    var material=ShaderMaterial.new();material.shader=preload("res://shaders/original_curved_ocean.gdshader")
    material.set_shader_parameter("water_color",Vector3(data.color[0],data.color[1],data.color[2]));material.set_shader_parameter("opacity",data.opacity)
    ocean=MeshInstance3D.new();ocean.name="Original_Curved_Ocean_Runtime";ocean.mesh=mesh;ocean.material_override=material;ocean.cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    var m=data.matrix;ocean.transform=Transform3D(Basis(Vector3(m[0],m[1],m[2]),Vector3(m[4],m[5],m[6]),Vector3(m[8],m[9],m[10])),Vector3(m[12],m[13],m[14]))
    ocean.set_meta("source",data.source);ocean.set_meta("source_vertices",vertices.size());model.add_child(ocean)
