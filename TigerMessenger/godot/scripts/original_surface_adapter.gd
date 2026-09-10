extends RefCounted
## Rejoin the six identical-material quad surfaces of original box meshes.
## Keep all vertices, indices, attributes and scene nodes. No welding or decimation.
const PREFIXES := ["christchurch-tram-system[62]", "castleContainer[69]", "castleContainer-canal-junction[84]"]
var changes: Array[Dictionary] = []

func apply(model: Node3D) -> Dictionary:
    var report := {"nodes":0,"surfaces_before":0,"surfaces_after":0,"vertices_before":0,"vertices_after":0,"indices_before":0,"indices_after":0,"scope":"Only original opaque same-material six-quad boxes; no morphs, skin, LOD reduction or node merging"}
    var cache: Dictionary = {}
    for node in model.find_children("*","MeshInstance3D",true,false):
        var path: String = str(node.get_meta("extras",{}).get("sourcePath",""))
        var allowed := false
        for prefix in PREFIXES:
            if path.begins_with(prefix+"/"): allowed=true
        if not allowed or node.has_meta("original_surface_compacted") or node.skin != null or node.material_override != null: continue
        var source: ArrayMesh = node.mesh as ArrayMesh
        if source == null or source.get_surface_count()!=6 or source.get_blend_shape_count()!=0: continue
        var material: Material = node.get_active_material(0)
        if not material is StandardMaterial3D or material.transparency!=BaseMaterial3D.TRANSPARENCY_DISABLED: continue
        var overrides: Array = []
        var valid := true
        var buffers: Array[Array] = []
        for surface in range(6):
            overrides.append(node.get_surface_override_material(surface))
            if node.get_active_material(surface) != material: valid=false;break
            if source.surface_get_primitive_type(surface)!=Mesh.PRIMITIVE_TRIANGLES: valid=false;break
            var arrays: Array = source.surface_get_arrays(surface)
            if arrays[Mesh.ARRAY_VERTEX].size() not in [4,6] or arrays[Mesh.ARRAY_INDEX]==null or arrays[Mesh.ARRAY_INDEX].size()!=6: valid=false;break
            for channel in range(Mesh.ARRAY_CUSTOM0,Mesh.ARRAY_INDEX):
                if arrays[channel]!=null: valid=false
            if not buffers.is_empty():
                for channel in Mesh.ARRAY_MAX:
                    if typeof(arrays[channel])!=typeof(buffers[0][channel]): valid=false
            buffers.append(arrays)
        if not valid: continue
        var key := str(source.get_instance_id())+":"+str(material.get_instance_id())
        var compact: ArrayMesh = cache.get(key)
        if compact == null:
            var merged: Array = buffers[0].duplicate(true)
            for surface in range(1,6):
                var offset: int = merged[Mesh.ARRAY_VERTEX].size()
                for channel in range(Mesh.ARRAY_INDEX):
                    if merged[channel]!=null:
                        var values = merged[channel];values.append_array(buffers[surface][channel]);merged[channel]=values
                var indices: PackedInt32Array = merged[Mesh.ARRAY_INDEX]
                for index in buffers[surface][Mesh.ARRAY_INDEX]: indices.append(index+offset)
                merged[Mesh.ARRAY_INDEX]=indices
            compact=ArrayMesh.new();compact.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,merged)
            compact.surface_set_material(0,material);cache[key]=compact
        changes.append({"node":node,"mesh":source,"overrides":overrides})
        node.mesh=compact;node.set_surface_override_material(0,null)
        node.set_meta("original_surface_compacted",true)
        report.nodes+=1;report.surfaces_before+=6;report.surfaces_after+=1
        var vertex_count: int = 0
        for arrays in buffers: vertex_count += arrays[Mesh.ARRAY_VERTEX].size()
        report.vertices_before+=vertex_count;report.vertices_after+=vertex_count;report.indices_before+=36;report.indices_after+=36
    return report

func restore() -> void:
    for change in changes:
        change.node.mesh=change.mesh
        for surface in change.overrides.size(): change.node.set_surface_override_material(surface,change.overrides[surface])
        change.node.remove_meta("original_surface_compacted")
    changes.clear()
