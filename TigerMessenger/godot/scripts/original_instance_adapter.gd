extends RefCounted
## Restore the original export-expanded instances, preserving the source nodes.
## Snapshot geometry only. Future per-instance animation must call refresh().
var batches: Array[Dictionary] = []

func _material_signature(mat: Material) -> String:
    if mat == null: return "null"
    var values: Array = [mat.get_class()]
    for property in mat.get_property_list():
        var key: String = property.name
        if property.usage & PROPERTY_USAGE_STORAGE and not key.begins_with("resource_") and key != "script":
            values.append([key,mat.get(key)])
    return var_to_str(values)

func apply(model: Node3D, manifest: Dictionary) -> Dictionary:
    var indexed: Dictionary = {}
    for node in model.find_children("*", "Node3D", true, false):
        var path: String = str(node.get_meta("extras",{}).get("sourcePath",""))
        if not path.is_empty(): indexed[path] = node
    var result := {"groups":0,"instances":0,"surfaces_before":0,"surfaces_after":0,"skipped":[],"scope":"Original archive instances; no new character or morph batching"}
    for row in manifest.groups:
        var parent: Node3D = indexed.get(row.sourcePath)
        if parent == null or parent.has_meta("original_instance_batch"): continue
        var originals: Array[MeshInstance3D] = []
        for child in parent.get_children():
            if child is MeshInstance3D and not child.has_meta("extras"): originals.append(child)
        if originals.size() != int(row.count):
            result.skipped.append({"path":row.sourcePath,"reason":"instance count"});continue
        var first: MeshInstance3D = originals[0]
        var signatures: Array[String] = []
        for surface in first.mesh.get_surface_count(): signatures.append(_material_signature(first.get_active_material(surface)))
        var valid: bool = first.mesh.get_blend_shape_count() == 0 and first.skin == null
        for i in originals.size():
            var node := originals[i]
            var m: Array = row.matrices[i]
            var expected := Transform3D(Basis(Vector3(m[0],m[1],m[2]),Vector3(m[4],m[5],m[6]),Vector3(m[8],m[9],m[10])),Vector3(m[12],m[13],m[14]))
            valid = valid and node.mesh == first.mesh and node.skin == null and node.get_child_count() == 0 and node.visible and node.transform.is_equal_approx(expected) and node.transform.basis.determinant() > 0
            valid = valid and node.cast_shadow == first.cast_shadow and node.layers == first.layers and node.material_overlay == first.material_overlay and node.transparency == first.transparency
            for surface in node.mesh.get_surface_count():
                valid = valid and _material_signature(node.get_active_material(surface)) == signatures[surface]
        if not valid:
            result.skipped.append({"path":row.sourcePath,"reason":"geometry, material or original transform differs"});continue
        var mesh: ArrayMesh = first.mesh.duplicate()
        for surface in mesh.get_surface_count(): mesh.surface_set_material(surface,first.get_active_material(surface))
        var multi := MultiMesh.new()
        multi.transform_format = MultiMesh.TRANSFORM_3D
        multi.mesh = mesh; multi.instance_count = originals.size()
        var instance := MultiMeshInstance3D.new()
        instance.name = "OriginalGPUInstances"; instance.multimesh = multi
        instance.cast_shadow = first.cast_shadow; instance.layers = first.layers
        instance.material_overlay = first.material_overlay; instance.transparency = first.transparency
        parent.add_child(instance)
        var bounds: AABB = originals[0].transform * mesh.get_aabb()
        for i in originals.size():
            multi.set_instance_transform(i,originals[i].transform)
            bounds = bounds.merge(originals[i].transform * mesh.get_aabb())
            originals[i].visible = false
        multi.custom_aabb = bounds
        parent.set_meta("original_instance_batch",true)
        batches.append({"parent":parent,"instance":instance,"originals":originals})
        result.groups += 1; result.instances += originals.size()
        result.surfaces_before += mesh.get_surface_count() * originals.size()
        result.surfaces_after += mesh.get_surface_count()
    return result

func refresh() -> void:
    for batch in batches:
        var multi: MultiMesh = batch.instance.multimesh
        var bounds: AABB = batch.originals[0].transform * multi.mesh.get_aabb()
        for i in batch.originals.size():
            multi.set_instance_transform(i,batch.originals[i].transform)
            bounds = bounds.merge(batch.originals[i].transform * multi.mesh.get_aabb())
        multi.custom_aabb = bounds

func restore() -> void:
    for batch in batches:
        for original in batch.originals: original.visible = true
        batch.instance.queue_free();batch.parent.remove_meta("original_instance_batch")
    batches.clear()
