extends RefCounted
## Verified original root/seed matching, LOD0 only. Original geometry stays recoverable.
var entries:Array=[]
var report:Dictionary={}
func _index(node:Node, ids:Dictionary)->void:
    var ex:Dictionary=node.get_meta("extras",{})
    var id:String=str(ex.get("three_node_id",""))
    if not id.is_empty():ids[id]=node
    if node is Node3D and ex.has("three_visible"):node.visible=bool(ex.three_visible)
    for child in node.get_children():_index(child,ids)
func apply(source_nodes:Dictionary)->Dictionary:
    if not entries.is_empty():return report
    report={"count":0,"lod":0,"automatic_lod":false,"rows":[],"errors":[]}
    var mapping=JSON.parse_string(FileAccess.get_file_as_string("res://assets/saihoji-pines-v1/runtime-mapping.json"))
    var staged:Array=[]
    for row in mapping.rows:
        var anchor:Node3D=source_nodes.get(row.sourcePath)
        if not anchor or not ResourceLoader.exists(row.glb):
            report.errors.append({"sourcePath":row.sourcePath,"anchor_found":anchor!=null,"imported":ResourceLoader.exists(row.glb)});continue
        var candidate:Node3D=load(row.glb).instantiate()
        var ids:Dictionary={};_index(candidate,ids)
        if ids.size()!=17 or not ids.has("n0"):
            report.errors.append("candidate IDs: "+str(row.seed));candidate.free();continue
        candidate.transform=Transform3D.IDENTITY
        ids.n0.transform=Transform3D.IDENTITY
        staged.append({"anchor":anchor,"candidate":candidate,"original":anchor.transform,"parent":anchor.get_parent(),"row":row,"ids":ids,"hidden":[]})
    if staged.size()!=25:
        for e in staged:e.candidate.free()
        return report
    for e in staged:
        for child in e.anchor.get_children():
            if child is Node3D:e.hidden.append({"node":child,"visible":child.visible});child.visible=false
        e.anchor.add_child(e.candidate)
        entries.append(e)
        report.rows.append({"seed":e.row.seed,"sourcePath":e.row.sourcePath,"node_ids":e.ids.size(),"root_unchanged":e.anchor.transform==e.original,"parent_unchanged":e.anchor.get_parent()==e.parent,"candidate_root_identity":e.ids.n0.transform==Transform3D.IDENTITY,"sha256":e.row.sha256})
    report.count=entries.size()
    return report
func show_candidates(enabled:bool)->void:
    for e in entries:
        e.candidate.visible=enabled
        for old in e.hidden:old.node.visible=false if enabled else old.visible
func restore()->void:
    show_candidates(false)
    for e in entries:e.candidate.queue_free()
    entries.clear()
