extends RefCounted
## Shared Web geometry in Kun-island local coordinates. Static ambush cover is separate.
const DATA := "res://data/saihoji-target-garden-20260919.json"
var report: Dictionary = {}
var node: Node3D
var support_faces := PackedVector3Array()
var support_pools: Array = []

func _matrix(values: Array) -> Transform3D:
    return Transform3D(Basis(Vector3(values[0],values[1],values[2]), Vector3(values[4],values[5],values[6]), Vector3(values[8],values[9],values[10])), Vector3(values[12],values[13],values[14]))

func apply(island: Node3D, pine_entries: Array) -> Dictionary:
    if is_instance_valid(node): return report
    if not FileAccess.file_exists(DATA):
        report = {"applied":false,"reason":"shared target garden data missing"}
        return report
    var data = JSON.parse_string(FileAccess.get_file_as_string(DATA))
    node = Node3D.new(); node.name = "SaihojiApprovedTargetGarden"; island.add_child(node)
    var hidden: Array[String] = []
    for old in island.find_children("*", "MeshInstance3D", true, false):
        var source_path: String = str(old.get_meta("extras",{}).get("sourcePath",str(old.name)))
        var source_name: String = source_path.get_file().get_slice("[",0)
        var prefix_match: bool = data.get("replaceSourcePrefixes",[]).any(func(prefix):return source_path.begins_with(str(prefix)))
        if source_name in data.get("replaceNames",[]) or prefix_match:
            old.visible = false; hidden.append(source_name)
    support_pools = data.get("pools",[])
    var triangles := 0
    for row in data.meshes:
        var vertices := PackedVector3Array(); var normals := PackedVector3Array(); var colors := PackedColorArray()
        for i in range(0,row.positions.size(),3):
            vertices.append(Vector3(row.positions[i],row.positions[i+1],row.positions[i+2]))
            if row.get("normals",[]).size()==row.positions.size(): normals.append(Vector3(row.normals[i],row.normals[i+1],row.normals[i+2]))
            if row.get("colors",[]).size()==row.positions.size(): colors.append(Color(row.colors[i],row.colors[i+1],row.colors[i+2]))
        # Three uses counterclockwise fronts; Godot uses clockwise fronts.
        var indices := PackedInt32Array()
        for i in range(0,vertices.size(),3): indices.append_array([i,i+2,i+1])
        var arrays := []; arrays.resize(Mesh.ARRAY_MAX)
        arrays[Mesh.ARRAY_VERTEX]=vertices; arrays[Mesh.ARRAY_INDEX]=indices
        if not normals.is_empty(): arrays[Mesh.ARRAY_NORMAL]=normals
        if not colors.is_empty(): arrays[Mesh.ARRAY_COLOR]=colors
        # Only the low-detail crust and moss beds support feet. Shrubs, pool
        # surfaces and decorative stepping stones cannot become false ground.
        var source_name := str(row.get("name",""))
        if source_name == "leviathan-crust-plate" or source_name.begins_with("leviathan-moss-bed-"):
            support_faces.append_array(vertices)
        var mesh := ArrayMesh.new(); mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
        var mat := StandardMaterial3D.new()
        var rgb: Array = row.material.get("color",[1.0,1.0,1.0])
        mat.albedo_color=Color(rgb[0],rgb[1],rgb[2]).linear_to_srgb()
        mat.roughness=float(row.material.get("roughness",1.0)); mat.metallic=0.0
        mat.vertex_color_use_as_albedo=not colors.is_empty(); mat.vertex_color_is_srgb=false
        mesh.surface_set_material(0,mat)
        var instance := MeshInstance3D.new(); instance.name=str(row.get("name","")) if not str(row.get("name","")).is_empty() else "TargetGardenMesh"; instance.mesh=mesh; node.add_child(instance)
        triangles += vertices.size()/3
    var moved := 0
    for tree in data.get("trees",[]):
        for entry in pine_entries:
            if int(entry.row.seed)==int(tree.seed):
                entry.anchor.global_transform=island.global_transform*_matrix(tree.matrix)
                moved+=1; break
    report={"applied":true,"revision":data.get("revision","20260919-v2"),"meshes":node.get_child_count(),"triangles":triangles,"pools":data.get("pools",[]).size(),"trees_repositioned":moved,"hidden_originals":hidden,"coordinates":"Kun island local","static_ambush_cover_unchanged":true,"visual_only":true}
    return report


func sample_support(local_xz: Vector2, pool_margin := 0.32) -> Dictionary:
    # Queries remain in island coordinates; moving/rotating Kun never leaves
    # cached world triangles behind. Margin is in island units, not metres.
    if not is_instance_valid(node): return {}
    for pool in support_pools:
        var dx:float=(local_xz.x-float(pool.x))/(float(pool.rx)+pool_margin)
        var dz:float=(local_xz.y-float(pool.z))/(float(pool.rz)+pool_margin)
        if dx*dx+dz*dz<=1.0:return {}
    var origin:=Vector3(local_xz.x,100.0,local_xz.y)
    var best_y:float=-INF
    var best:=Vector3.ZERO
    var normal:=Vector3.UP
    for i in range(0,support_faces.size(),3):
        var a:=support_faces[i];var b:=support_faces[i+1];var c:=support_faces[i+2]
        var hit=Geometry3D.ray_intersects_triangle(origin,Vector3.DOWN,a,b,c)
        if hit==null or hit.y<=best_y:continue
        var n:Vector3=(b-a).cross(c-a).normalized()
        if n.y<0.0:n=-n
        if n.y<cos(deg_to_rad(32.0)):continue
        best=hit;best_y=hit.y;normal=n
    if best_y==-INF:return {}
    var world_normal:Vector3=(node.global_basis.inverse().transposed()*normal).normalized()
    return {"local_position":best,"position":node.to_global(best),"normal":world_normal,
        "frame":node.global_transform,"source":"shared Kun crust/moss mesh"}

func carry_between_frames(world_position:Vector3, previous_frame:Transform3D)->Vector3:
    return node.global_transform*(previous_frame.affine_inverse()*world_position)
