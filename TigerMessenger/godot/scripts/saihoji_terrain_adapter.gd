extends RefCounted
## Correct original organic moss patch winding. Source archive stays untouched.
## Its XZ ring triangles point down: normals are -0.99997..-0.79741 local Y.
## Therefore the visible land above sea was missed by front-face terrain rays.
static func apply(root: Node) -> Dictionary:
    var fixed := 0
    var faces := 0
    for node in root.find_children("*", "MeshInstance3D", true, false):
        var path := str(node.get_meta("extras", {}).get("sourcePath", ""))
        if not path.begins_with("mossyGround[106]/mossy-terrain["): continue
        if node.get_meta("saihoji_winding_corrected", false): continue
        var replacement := ArrayMesh.new()
        var materials: Array = []
        for surface in node.mesh.get_surface_count():
            var arrays: Array = node.mesh.surface_get_arrays(surface)
            var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
            var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
            var down := 0
            for normal in normals:
                if normal.y < 0.0: down += 1
            if not normals.is_empty() and down == 0:
                return {"applied": true, "already_correct": true, "positions_changed": false}
            if normals.size() == 0 or down != normals.size():
                return {"applied": false, "reason": "Unexpected moss surface orientation; source inspection needed"}
            var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
            if indices.is_empty():
                for i in vertices.size(): indices.append(i)
            for i in range(0, indices.size(), 3):
                var swap := indices[i + 1]
                indices[i + 1] = indices[i + 2]
                indices[i + 2] = swap
                faces += 1
            for i in normals.size(): normals[i] = -normals[i]
            arrays[Mesh.ARRAY_INDEX] = indices
            arrays[Mesh.ARRAY_NORMAL] = normals
            replacement.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
            materials.append(node.get_active_material(surface))
        node.mesh = replacement
        for surface in materials.size(): node.set_surface_override_material(surface, materials[surface])
        node.set_meta("saihoji_winding_corrected", true)
        fixed += 1
    return {"applied": fixed > 0, "meshes": fixed, "triangles": faces, "positions_changed": false,
        "source_archive_changed": false, "reason": "Original organic terrain faces pointed below ground"}
