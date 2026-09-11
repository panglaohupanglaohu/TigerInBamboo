extends RefCounted
## Find actual town triangles crossing the retained tower. No importer mesh-number dependency.
var source:MeshInstance3D
var candidate:CSGMesh3D
var report:Dictionary={}
var changes:Array[Dictionary]=[]
var volumes:Array[AABB]=[]
var tower:Node3D
var active:=false

func bind(town:Node3D,tower_node:Node3D)->bool:
    unbind()
    if not is_instance_valid(town) or not is_instance_valid(tower_node):
        report={"bound":false,"error":"Town or original tower missing","geometry_verified":false}
        return false
    tower=tower_node
    # Protect the actual five-floor shaft; only open the entrance corridor at its own level.
    var high:=5.1
    for mesh in tower.find_children("*","MeshInstance3D",true,false):
        if mesh.mesh==null:continue
        var box:AABB=tower.global_transform.affine_inverse()*mesh.global_transform*mesh.get_aabb()
        high=maxf(high,box.end.y)
    volumes=[AABB(Vector3(-3.35,3.1,-3.0),Vector3(6.7,high-3.1,6.0)),AABB(Vector3(-0.875,3.1,2.95),Vector3(1.75,2.8,0.8))]
    var scanned:=0;var overlaps:=0
    var found:Array[MeshInstance3D]=[]
    for mesh in town.find_children("*","MeshInstance3D",true,false):
        if mesh.mesh==null or mesh.mesh is ImmediateMesh:continue
        scanned+=1
        var local:Transform3D=tower.global_transform.affine_inverse()*mesh.global_transform
        var bounds:AABB=local*mesh.get_aabb()
        if not volumes.any(func(v):return v.intersects(bounds)):continue
        var count:=_overlaps(mesh.mesh,local)
        if count>0:found.append(mesh);overlaps+=count
    for mesh in found:
        var replacement=CSGMesh3D.new();replacement.name="TownTowerClearance"
        replacement.mesh=mesh.mesh.duplicate()
        for surface in range(mesh.mesh.get_surface_count()):replacement.mesh.surface_set_material(surface,mesh.get_active_material(surface))
        # Preserve mesh override material where the importer supplied one.
        replacement.material=mesh.material_override
        mesh.get_parent().add_child(replacement);replacement.transform=mesh.transform
        replacement.use_collision=true
        var local:Transform3D=replacement.global_transform.affine_inverse()*tower.global_transform
        for volume in volumes:
            var cut=CSGBox3D.new();cut.operation=CSGShape3D.OPERATION_SUBTRACTION;cut.size=volume.size
            replacement.add_child(cut);cut.transform=local*Transform3D(Basis.IDENTITY,volume.get_center())
        changes.append({"source":mesh,"candidate":replacement,"visible":mesh.visible})
    if not changes.is_empty():source=changes[0].source;candidate=changes[0].candidate
    report={"bound":true,"scanned_meshes":scanned,"overlap_triangles_before":overlaps,"replacement_meshes":changes.size(),"method":"Triangle-volume intersection in retained tower coordinates; CSG shaft and entrance subtraction only where required","geometry_verified":overlaps==0,"verified_empty_without_cut":overlaps==0,"visual_verified":false}
    set_enabled(false)
    return true

func _overlaps(mesh:Mesh,transform:Transform3D)->int:
    var count:=0
    for surface in range(mesh.get_surface_count()):
        var arrays:Array=mesh.surface_get_arrays(surface)
        var vertices:PackedVector3Array=arrays[Mesh.ARRAY_VERTEX]
        var indices:PackedInt32Array=arrays[Mesh.ARRAY_INDEX] if arrays[Mesh.ARRAY_INDEX]!=null else PackedInt32Array()
        var length:int=indices.size() if not indices.is_empty() else vertices.size()
        for i in range(0,length-2,3):
            var triangle:Array[Vector3]=[]
            for j in range(3):triangle.append(transform*vertices[indices[i+j] if not indices.is_empty() else i+j])
            for volume in volumes:
                if _triangle_inside(triangle,volume.grow(-0.002)):
                    count+=1;break
    return count

func _triangle_inside(triangle:Array[Vector3],box:AABB)->bool:
    # Clip the real triangle against all six planes. An AABB overlap alone is not proof.
    var polygon:Array[Vector3]=triangle.duplicate()
    for axis in range(3):
        for upper in [false,true]:
            var output:Array[Vector3]=[]
            if polygon.is_empty():return false
            var bound:float=box.end[axis] if upper else box.position[axis]
            var previous:Vector3=polygon[-1]
            var previous_inside:bool=previous[axis]<=bound if upper else previous[axis]>=bound
            for point in polygon:
                var inside:bool=point[axis]<=bound if upper else point[axis]>=bound
                if inside!=previous_inside:
                    var t:float=(bound-previous[axis])/(point[axis]-previous[axis])
                    output.append(previous.lerp(point,t))
                if inside:output.append(point)
                previous=point;previous_inside=inside
            polygon=output
    return polygon.size()>=3

func verify_geometry()->bool:
    if not report.get("bound",false):return false
    var remaining:=0;var missing:=0
    for row in changes:
        var baked:Array=row.candidate.get_meshes()
        if baked.size()<2:missing+=1;continue
        var transform:Transform3D=tower.global_transform.affine_inverse()*row.candidate.global_transform*baked[0]
        remaining+=_overlaps(baked[1],transform)
    report.remaining_overlap_triangles=remaining
    report.missing_baked_meshes=missing
    report.geometry_verified=remaining==0 and missing==0
    return report.geometry_verified

func set_enabled(value:bool)->void:
    active=value
    for row in changes:
        if is_instance_valid(row.source):row.source.visible=false if value else row.visible
        if is_instance_valid(row.candidate):
            row.candidate.visible=value
            row.candidate.collision_layer=5 if value else 0
            row.candidate.use_collision=value

func unbind()->void:
    set_enabled(false)
    for row in changes:
        if is_instance_valid(row.candidate):row.candidate.free()
    changes.clear();volumes.clear();source=null;candidate=null;tower=null;report={}
