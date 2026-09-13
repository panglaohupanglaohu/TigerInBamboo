extends RefCounted
## Explicit candidate controller. Uses original crew adapter and Blender geometry.
var adapter
var row:Dictionary
var landing:Dictionary
var anchor:Vector3
func create_lifecycle():
    var gate=preload("res://scripts/citadel_boarding_gate.gd").new()
    gate.bind(Callable(self,"set_progress"));return gate
func bind(source_adapter, source_row:Dictionary, descriptor:Dictionary)->bool:
    adapter=source_adapter;row=source_row;landing=descriptor
    for change in landing.widthAdjustment.changes:
        if not row.ids.has(change.id):return false
    anchor=adapter._transform(adapter.data.poseFrames[210].transforms["add:boarding-hinge"]).origin
    for change in landing.widthAdjustment.changes:
        if change.has("geometry"):
            var node=row.ids[change.id]
            if not node is MeshInstance3D:return false
            var material=node.get_active_material(0)
            var box=BoxMesh.new();var size=change.geometry.boxSize
            box.size=Vector3(size[0],size[1],size[2]);node.mesh=box;node.material_override=material
    return set_progress(0.0)
func set_progress(value:float)->bool:
    if not is_finite(value):return false
    var progress=clampf(value,0,1)
    if not adapter.pose_boarding(row,progress,deg_to_rad(landing.degrees)):return false
    for change in landing.widthAdjustment.changes:row.ids[change.id].transform=adapter._transform(change.matrix)
    var eased=progress*progress*(3.0-2.0*progress)
    var rotation=Basis(Vector3.RIGHT,-PI/2+(deg_to_rad(landing.degrees)+PI/2)*eased)*Basis(Vector3.BACK,landing.roll*eased)
    row.ids["add:boarding-hinge"].transform=Transform3D(rotation,anchor)
    return true
