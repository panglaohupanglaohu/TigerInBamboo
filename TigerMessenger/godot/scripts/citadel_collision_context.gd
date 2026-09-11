extends RefCounted
var body:StaticBody3D
func bind(w:Node3D)->void:
    if is_instance_valid(body):return
    body=StaticBody3D.new();body.name="CitadelTraversalSurfaces";w.add_child(body)
    for mesh in w.castle_adapter.original.find_children("*","MeshInstance3D",true,false):
        var parent=mesh.get_parent()
        var visual_expansion=false
        while parent!=null and parent!=w.castle_adapter.original:
            if parent.get_meta("citadel_visual_expansion",false): visual_expansion=true;break
            parent=parent.get_parent()
        # Visual additions are opt-in: only authored walking meshes gain physics.
        # Keep scenery, buildings, water and distant terrain outside traversal queries.
        if visual_expansion and not is_west_city_walkable(mesh) and not is_main_gate_solid(mesh) and not is_processional_solid(mesh):continue
        if not mesh.is_visible_in_tree() or mesh.mesh==null or mesh.mesh is ImmediateMesh or w.shell_candidate.root.is_ancestor_of(mesh):continue
        var mat=mesh.get_active_material(0)
        if mat is BaseMaterial3D and mat.transparency!=BaseMaterial3D.TRANSPARENCY_DISABLED:continue
        var shape=CollisionShape3D.new()
        if mesh.mesh is BoxMesh:
            var box=BoxShape3D.new();box.size=mesh.mesh.size;shape.shape=box
        else:shape.shape=mesh.mesh.create_trimesh_shape()
        body.add_child(shape);shape.global_transform=mesh.global_transform;shape.set_meta("source",str(mesh.get_path()))

func is_west_city_walkable(mesh:MeshInstance3D)->bool:
    var extras:Variant=mesh.get_meta("extras",{})
    if extras is Dictionary and extras.get("westCityWalkable",false)==true:return true
    if mesh.get_meta("westCityWalkable",false)==true:return true
    # Compatibility with the first GLB export, before explicit mesh extras.
    var source_name:=str(mesh.name)
    return source_name=="west-city-bridge-deck" or (source_name.begins_with("west-city-") and source_name.ends_with("-promenade")) or source_name.begins_with("west-city-stair-")

func dispose()->void:
    if is_instance_valid(body):body.free()
    body=null

func is_main_gate_solid(mesh:MeshInstance3D)->bool:
    # Exact extruded arch geometry preserves the opening; banners have no collision.
    if str(mesh.name) not in ["main-gate-wall","main-gate-carved-surround"]:return false
    var ancestor:Node=mesh.get_parent()
    while ancestor!=null:
        if str(ancestor.name)=="citadel-new-main-gate":return true
        ancestor=ancestor.get_parent()
    return false

func is_processional_solid(mesh:MeshInstance3D)->bool:
    # Only the merged stone barriers; fabric, poles and emblems remain decoration.
    if str(mesh.name)=="tower-interior-solid" and str(mesh.get_parent().name)=="citadel-tower-interior-structure":return true
    if str(mesh.name)=="court-solid-stone" and str(mesh.get_parent().name)=="citadel-court-structure":return true
    if str(mesh.name) not in ["processional-solid-stone","processional-solid-coping"]:return false
    return str(mesh.get_parent().name)=="citadel-processional-stonework"
