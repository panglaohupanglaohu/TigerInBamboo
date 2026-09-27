extends RefCounted
## Static five-zone world scenery around the original Saihoji garden on Kun.
## Five real moss surfaces support the static ambush troops above high water.
## The asset is deliberately a world child, never a Kun/garden-island child.
const MODEL := "res://assets/saihoji-surroundings-v3/saihoji-surroundings-v3.glb"
var node: Node3D

func apply(world_root: Node3D, hub: Vector3, east: Vector3, north: Vector3) -> Dictionary:
    if is_instance_valid(node):
        return {"applied": true, "already_present": true, "node": node.name}
    if not ResourceLoader.exists(MODEL):
        return {"applied": false, "reason": "five-zone concealment GLB missing"}
    node = load(MODEL).instantiate()
    node.name = "Saihoji Five Static Concealment Regions"
    node.set_meta("visual_only", false)
    node.set_meta("reveal_contract", "remains on planet while Kun and garden rise through central opening")
    world_root.add_child(node)
    # The GLB uses local X/Z ground; align its Y-up axis to this spherical world's normal.
    node.transform = Transform3D(Basis(east, hub, north), hub * 160.65)
    # Spread the existing low-poly pines into broad ambush groves. Preserve
    # vertical clearance rather than shrinking the soldier beneath foliage.
    for holder in node.find_children("*", "Node3D", true, false):
        if str(holder.name).contains("_original_pine_"):
            holder.scale *= Vector3(1.9,1.0,1.9)
    preload("res://scripts/saihoji_pine_adapter.gd").new().apply_palette(node)
    var terrain_count := 0
    for mesh in node.find_children("*", "MeshInstance3D", true, false):
        if not str(mesh.name).contains("continuous_moss"): continue
        var body := StaticBody3D.new()
        body.name = "WalkableMoss"
        mesh.add_child(body)
        var shape := CollisionShape3D.new()
        shape.shape = mesh.mesh.create_trimesh_shape()
        body.add_child(shape)
        terrain_count += 1
    node.set_meta("visual_only", false)
    return {
        "ground_collision_meshes": terrain_count,
        "applied": true,
        "zones": ["moss-entry", "master-stones", "dry-cascade", "moss-islands", "return-view"],
        "tree_source": "five existing optimized Saihoji pine GLBs",
        "scale_contract": {"original_kun_island": [15.04, 7.72], "external_footprint": [18.4, 16.0], "central_opening": [9.0, 7.0]},
        "central_clearing_preserved": true,
        "collision": "five actual moss surfaces above high water; original terrain retained",
        "reveal": "static perimeter remains on planet while Kun and garden island rise"
    }
