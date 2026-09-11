extends RefCounted
## Preserve archived meshes for rollback; clear obsolete vegetation in new town footprint.
func prepare(castle:Node3D)->Array[Dictionary]:
    var changes:Array[Dictionary]=[]
    for node in castle.find_children("*","MeshInstance3D",true,false):
        var parent:Node=node.get_parent()
        var in_vegetation:=false
        while parent!=null and parent!=castle:
            if parent.name in ["highland-mountain-slope-vegetation","highland-canopy-groves","highland-slope-shrub-vegetation"]:in_vegetation=true;break
            parent=parent.get_parent()
        if not in_vegetation:continue
        var original:Mesh=node.mesh
        var candidate=ArrayMesh.new()
        var removed:=0
        var transform:Transform3D=castle.global_transform.affine_inverse()*node.global_transform
        for surface in range(original.get_surface_count()):
            var arrays:Array=original.surface_get_arrays(surface)
            var vertices:PackedVector3Array=arrays[Mesh.ARRAY_VERTEX]
            var indices:PackedInt32Array=arrays[Mesh.ARRAY_INDEX] if arrays[Mesh.ARRAY_INDEX]!=null else PackedInt32Array()
            if indices.is_empty():
                for i in range(vertices.size()):indices.append(i)
            var kept=PackedInt32Array()
            for i in range(0,indices.size(),3):
                var touches:=false
                for j in range(3):
                    var p:Vector3=transform*vertices[indices[i+j]]
                    if p.x>=-8 and p.x<=24 and p.z>=-1 and p.z<=61:touches=true
                if touches:removed+=1
                else:
                    kept.append(indices[i]);kept.append(indices[i+1]);kept.append(indices[i+2])
            if not kept.is_empty():
                arrays[Mesh.ARRAY_INDEX]=kept
                candidate.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
                candidate.surface_set_material(candidate.get_surface_count()-1,original.surface_get_material(surface))
        if removed>0:changes.append({"node":node,"original":original,"candidate":candidate,"removed_triangles":removed})
    return changes
