extends RefCounted
## The archive contains the 73 x 49 original ocean shell, including canyon inflow.
## Only its lost ShaderMaterial is restored; no replacement sphere or terrain lift.
const OceanShader = preload("res://shaders/saihoji_original_ocean.gdshader")

static func apply(root: Node) -> Dictionary:
    for node in root.find_children("*", "MeshInstance3D", true, false):
        if str(node.name) != "planet-v8-curved-ocean":
            continue
        var mesh: Mesh = node.mesh
        var count := 0
        var indices := 0
        for surface in mesh.get_surface_count():
            count += mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX].size()
            indices += mesh.surface_get_arrays(surface)[Mesh.ARRAY_INDEX].size()
        # Original GLB has unused pole vertices 72 and 3504. Godot removes those two.
        if count not in [3575, 3577] or indices != 20304:
            return {"applied": false, "reason": "Unexpected ocean topology; do not infer official water mask", "vertices": count}
        var material := ShaderMaterial.new()
        material.shader = OceanShader
        for surface in mesh.get_surface_count():
            node.set_surface_override_material(surface, material)
        node.visible = true
        return {"applied": true, "vertices": count, "geometry_preserved": true, "sea_radius": 160.5, "wave_max": 0.067}
    return {"applied": false, "reason": "Original ocean node absent"}
