extends RefCounted
var body:StaticBody3D
func bind(w:Node3D)->void:
    if is_instance_valid(body):return
    body=StaticBody3D.new();body.name="CitadelTraversalSurfaces";w.add_child(body)
    for mesh in w.castle_adapter.original.find_children("*","MeshInstance3D",true,false):
        if not mesh.is_visible_in_tree() or mesh.mesh==null or mesh.mesh is ImmediateMesh or w.shell_candidate.root.is_ancestor_of(mesh):continue
        var mat=mesh.get_active_material(0)
        if mat is BaseMaterial3D and mat.transparency!=BaseMaterial3D.TRANSPARENCY_DISABLED:continue
        var shape=CollisionShape3D.new()
        if mesh.mesh is BoxMesh:
            var box=BoxShape3D.new();box.size=mesh.mesh.size;shape.shape=box
        else:shape.shape=mesh.mesh.create_trimesh_shape()
        body.add_child(shape);shape.global_transform=mesh.global_transform;shape.set_meta("source",str(mesh.get_path()))
