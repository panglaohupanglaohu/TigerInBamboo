extends RefCounted
## Static five-zone world scenery around the original Saihoji garden on Kun.
## It is visual-only: the original root-support mesh remains the walkable ground.
## The asset is deliberately a world child, never a Kun/garden-island child.
const MODEL := "res://assets/saihoji-surroundings-v2/saihoji-surroundings-v2.glb"
var node: Node3D

func apply(world_root: Node3D, hub: Vector3, east: Vector3, north: Vector3) -> Dictionary:
    if is_instance_valid(node):
        return {"applied": true, "already_present": true, "node": node.name}
    if not ResourceLoader.exists(MODEL):
        return {"applied": false, "reason": "five-zone concealment GLB missing"}
    node = load(MODEL).instantiate()
    node.name = "Saihoji Five Static Concealment Regions"
    node.set_meta("visual_only", true)
    node.set_meta("reveal_contract", "remains on planet while Kun and garden rise through central opening")
    world_root.add_child(node)
    # The GLB uses local X/Z ground; align its Y-up axis to this spherical world's normal.
    node.transform = Transform3D(Basis(east, hub, north), hub * 160.0)
    return {
        "applied": true,
        "zones": ["moss-entry", "master-stones", "dry-cascade", "moss-islands", "return-view"],
        "central_clearing_preserved": true,
        "collision": "original root-support only",
        "reveal": "static perimeter remains on planet while Kun and garden island rise"
    }
