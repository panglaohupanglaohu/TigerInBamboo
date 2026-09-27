extends RefCounted
## Replaces the archived green ring without modifying the source GLB.
static func apply(source_nodes:Dictionary)->Dictionary:
    var old:Node3D=source_nodes.get("saihoji-scree-rocks[107]")
    if old:old.visible=false
    var ground:Node3D=source_nodes.get("mossyGround[106]")
    if not ground:return {"applied":false,"reason":"source terrain missing"}
    if ground.has_node("GrayShoreStones"):return {"applied":true,"already_present":true}
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/saihoji-shore-stones.json"))
    var group:=Node3D.new();group.name="GrayShoreStones";ground.add_child(group)
    var source:=SphereMesh.new();source.radius=1.0;source.height=2.0;source.radial_segments=7;source.rings=2
    var faces:=source.get_faces()
    var surface:=SurfaceTool.new();surface.begin(Mesh.PRIMITIVE_TRIANGLES)
    for i in range(0,faces.size(),3):
        var normal:Vector3=(faces[i+2]-faces[i]).cross(faces[i+1]-faces[i]).normalized()
        for j in range(3):surface.set_normal(normal);surface.add_vertex(faces[i+j])
    var geometry:=surface.commit()
    var palette:Dictionary={}
    for row in data.rocks:
        var rock:=MeshInstance3D.new();rock.mesh=geometry
        if not palette.has(row.color):
            var mat:=StandardMaterial3D.new();mat.albedo_color=Color(row.color);mat.roughness=1.0;palette[row.color]=mat
        rock.material_override=palette[row.color];group.add_child(rock)
        rock.position=Vector3(row.position[0],row.position[1],row.position[2])
        rock.scale=Vector3(row.scale[0],row.scale[1],row.scale[2]);rock.rotation.y=row.yaw
    return {"applied":true,"legacy_ring_hidden":old!=null,"count":data.rocks.size(),"source":data.source,"collision":"decorative low shore rocks; existing landing terrain unchanged"}
