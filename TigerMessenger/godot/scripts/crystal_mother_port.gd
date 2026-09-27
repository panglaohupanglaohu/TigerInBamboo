extends Node3D
## Same measured quay/lift geometry as the browser. Ship is moored here;
## Godot player boarding and inter-city navigation are not implemented by this adapter.
var elapsed := 0.0
var low := 0.0
var high := 0.0
var up_axis := Vector3.UP
var lift: AnimatableBody3D
var part_count := 0
func build() -> int:
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/crystal-mother-port.json"))
	low = float(data.low); high = float(data.high)
	up_axis = Vector3(data.up[0],data.up[1],data.up[2])
	lift = AnimatableBody3D.new(); lift.name = "MotherPortLift"; add_child(lift)
	for part in data.parts:
		var vertices := PackedVector3Array()
		var normals := PackedVector3Array()
		for i in range(part.positions.size()/3):
			vertices.append(Vector3(part.positions[i*3],part.positions[i*3+1],part.positions[i*3+2]))
			normals.append(Vector3(part.normals[i*3],part.normals[i*3+1],part.normals[i*3+2]))
		var indices := PackedInt32Array(part.indices)
		for i in range(0,indices.size(),3):
			var swap := indices[i+1]; indices[i+1]=indices[i+2]; indices[i+2]=swap
		var arrays := []; arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX]=vertices; arrays[Mesh.ARRAY_NORMAL]=normals; arrays[Mesh.ARRAY_INDEX]=indices
		var mesh := ArrayMesh.new(); mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
		var material := StandardMaterial3D.new()
		material.albedo_color=Color(part.color[0],part.color[1],part.color[2]); material.roughness=1.0
		mesh.surface_set_material(0,material)
		var node := MeshInstance3D.new(); node.name=str(part.name); node.mesh=mesh
		var parent: Node3D = lift if bool(part.dynamic) else self
		parent.add_child(node)
		if bool(part.collision):
			var body: PhysicsBody3D = lift
			if not bool(part.dynamic): body=StaticBody3D.new(); add_child(body)
			var shape := CollisionShape3D.new(); shape.shape=mesh.create_convex_shape(); body.add_child(shape)
		part_count+=1
	var boat: Node3D = load("res://assets/warship-battle-v11/warship-battle-v11.glb").instantiate()
	boat.name="CrystalMotherPortFerry"; add_child(boat)
	var q: Array = data.boatQuaternion
	boat.quaternion=Quaternion(q[0],q[1],q[2],q[3]); boat.scale=Vector3.ONE*float(data.boatScale)
	var p: Array=data.boatPosition; boat.position=Vector3(p[0],p[1],p[2])
	var adapter=preload("res://scripts/saihoji_warship_adapter.gd").new()
	var row: Dictionary=adapter.bind(boat)
	if not row.is_empty(): adapter.apply_frame(row,180)
	return part_count
func _physics_process(delta: float) -> void:
	elapsed+=delta
	if not is_instance_valid(lift): return
	var t := fposmod(elapsed,26.0)
	var fraction := 0.0
	if t>=5.0 and t<11.0: fraction=(t-5.0)/6.0
	elif t>=11.0 and t<17.0: fraction=1.0
	elif t>=17.0 and t<23.0: fraction=1.0-(t-17.0)/6.0
	fraction=fraction*fraction*(3.0-2.0*fraction)
	lift.position=up_axis*((high-low)*fraction)
