extends RefCounted
func bind(model: Node3D) -> Dictionary:
	if model.has_node("CrystalNavigationSpan"): return {"already_bound":true}
	var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/crystal-navigation-span.json"))
	if not data is Dictionary: return {"passed":false}
	var d=data.opening.direction
	var direction=Vector3(d[0],d[1],d[2]).normalized()
	var trams=model.find_children("christchurch-tram-system","Node3D",true,false)
	if trams.size()!=1: return {"passed":false,"reason":"tram root missing or ambiguous"}
	var retired=[]
	for node in trams[0].find_children("*","MeshInstance3D",true,false):
		var size=node.mesh.get_aabb().size
		# Identify original narrow vertical columns geometrically, not generic Mesh names.
		if abs(size.x-.55)>.025 or abs(size.z-.55)>.025 or size.y<.5: continue
		var local_to_model:Transform3D=node.transform
		var parent=node.get_parent()
		while parent!=model and parent is Node3D:
			local_to_model=parent.transform*local_to_model
			parent=parent.get_parent()
		if local_to_model.origin.normalized().angle_to(direction)*160<12: retired.append(node)
	if retired.is_empty(): return {"passed":false,"reason":"no exact original piers matched"}
	var span=Node3D.new();span.name="CrystalNavigationSpan"
	for item in data.meshes:
		var vertices=PackedVector3Array();var normals=PackedVector3Array()
		for i in range(item.positions.size()/3):
			vertices.append(Vector3(item.positions[i*3],item.positions[i*3+1],item.positions[i*3+2]))
			normals.append(Vector3(item.normals[i*3],item.normals[i*3+1],item.normals[i*3+2]))
		var indices=PackedInt32Array()
		if item.indices==null:
			for i in vertices.size(): indices.append(i)
		else: indices=PackedInt32Array(item.indices)
		for i in range(0,indices.size(),3):
			var temp=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=temp
		var arrays=[];arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX]=vertices;arrays[Mesh.ARRAY_NORMAL]=normals;arrays[Mesh.ARRAY_INDEX]=indices
		var mesh=ArrayMesh.new();mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
		var mat=StandardMaterial3D.new();mat.albedo_color=Color(item.color[0],item.color[1],item.color[2]);mat.roughness=1;mat.cull_mode=BaseMaterial3D.CULL_DISABLED
		var node=MeshInstance3D.new();node.name=item.name;node.mesh=mesh;node.material_override=mat
		var m=item.matrix
		node.transform=Transform3D(Basis(Vector3(m[0],m[1],m[2]),Vector3(m[4],m[5],m[6]),Vector3(m[8],m[9],m[10])),Vector3(m[12],m[13],m[14]))
		span.add_child(node)
	model.add_child(span)
	for node in retired: node.visible=false
	return {"passed":true,"retired_piers":retired.size(),"replacement_meshes":span.get_child_count()}
