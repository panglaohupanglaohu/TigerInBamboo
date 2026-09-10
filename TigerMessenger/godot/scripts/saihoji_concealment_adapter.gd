extends RefCounted
## Supplemental five-zone perimeter for the original Saihoji garden on Kun.
## It is visual-only: the original root-support mesh remains the walkable ground.
const MODEL := "res://assets/saihoji-concealment-v1/saihoji-concealment-v1.glb"
var node: Node3D

func apply(garden_island: Node3D) -> Dictionary:
    if is_instance_valid(node):
        return {"applied": true, "already_present": true, "node": node.name}
    if not ResourceLoader.exists(MODEL):
        return {"applied": false, "reason": "five-zone concealment GLB missing"}
    node = load(MODEL).instantiate()
    node.name = "Saihoji Five-Zone Concealment"
    node.set_meta("visual_only", true)
    node.set_meta("reveal_contract", "follows original garden island when Kun lifts")
    garden_island.add_child(node)
    # Blender GLB is authored in the original garden's local unit scale.
    node.transform = Transform3D.IDENTITY
    return {
        "applied": true,
        "zones": ["moss-entry", "master-stones", "dry-cascade", "moss-islands", "return-view"],
        "central_clearing_preserved": true,
        "collision": "original root-support only",
        "reveal": "perimeter moves with Kun and garden island"
    }
