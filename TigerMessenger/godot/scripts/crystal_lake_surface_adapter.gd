extends RefCounted

# Replace only the two lake surface geometries. Keep imported transforms,
# materials, shoreline extent, creatures and all other original children.
func bind(model: Node3D) -> int:
	var roots = model.find_children("city-sea-lake", "Node3D", true, false)
	if roots.size() != 1:
		push_warning("Crystal lake: expected exactly one original lake root")
		return 0
	var data = JSON.parse_string(FileAccess.get_file_as_string("res://data/crystal-lake-surfaces.json"))
	if not data is Dictionary: return 0
	var root: Node3D = roots[0]
	var count := 0
	for layer in data.layers:
		var node = root.get_child(int(layer.index))
		if not node is MeshInstance3D: return count
		var old_material = node.get_active_material(0)
		var vertices := PackedVector3Array()
		var normals := PackedVector3Array()
		var uv := PackedVector2Array()
		for i in range(layer.positions.size() / 3):
			vertices.append(Vector3(layer.positions[i*3],layer.positions[i*3+1],layer.positions[i*3+2]))
			normals.append(Vector3(layer.normals[i*3],layer.normals[i*3+1],layer.normals[i*3+2]))
			uv.append(Vector2(layer.uv[i*2],layer.uv[i*2+1]))
		var indices := PackedInt32Array(layer.indices)
		for i in range(0,indices.size(),3):
			var temp := indices[i+1]
			indices[i+1]=indices[i+2];indices[i+2]=temp
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX]=vertices;arrays[Mesh.ARRAY_NORMAL]=normals
		arrays[Mesh.ARRAY_TEX_UV]=uv;arrays[Mesh.ARRAY_INDEX]=indices
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
		mesh.surface_set_material(0,old_material)
		node.mesh=mesh
		node.set_meta("crystal_water_radial_fix",true)
		count+=1
	return count
