extends RefCounted
## Keep original carrier roots and deploy two ropes from actual mechanical guides.
const DIR := "res://assets/gatepod-escort-v1/"
const SHARED_MODEL := "pod-41-7"
var pods: Array = []
var report: Dictionary = {}

func apply(members: Array) -> Dictionary:
    if not pods.is_empty(): return report
    var staged: Array = []
    for member in members:
        var source := str(member.get_meta("extras", {}).get("sourcePath", member.name))
        var variant := ""
        for key in ["pod-55-2", "pod-41-7", "pod-08-9"]:
            if source.contains(key): variant = key
        if variant.is_empty() or not ResourceLoader.exists(DIR + SHARED_MODEL + ".glb"):
            for row in staged: row.candidate.free()
            return {"applied":false,"reason":"Missing exact original escort variant","source":source}
        var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(DIR + SHARED_MODEL + ".assembly.json"))
        var scene: PackedScene = load(DIR + SHARED_MODEL + ".glb")
        var candidate := scene.instantiate()
        var ids: Dictionary = {}
        _index(candidate, ids)
        if not ids.has("n0") or not ids.has("add:rope-anchor-left") or not ids.has("add:rope-anchor-right"):
            candidate.free()
            for row in staged: row.candidate.free()
            return {"applied":false,"reason":"Original root or winch anchors missing"}
        staged.append({"candidate":candidate,"anchor":member,"ids":ids,"data":data,"variant":variant,"last_frame":-1})
    for row in staged:
        var original: Array = []
        for child in row.anchor.get_children():
            if child is Node3D:
                original.append({"node":child,"visible":child.visible})
                child.visible=false
        row.anchor.add_child(row.candidate)
        row.candidate.transform=Transform3D.IDENTITY
        # The existing world carrier already owns .62/.55/.58 scale.
        row.ids.n0.transform=Transform3D.IDENTITY
        _materials(row.candidate)
        row["original"]=original
        pods.append(row)
    report={"applied":true,"variants":[SHARED_MODEL],"instance_ids":pods.map(func(row):return row.variant),"shared_model":SHARED_MODEL,"anchors_per_pod":2,
        "original_roots_preserved":true,"root_scale_applied_once":true,"scope":"Visual carriers and actual guide endpoints; world owns ropes, troops and route"}
    return report

func _index(node:Node, ids:Dictionary)->void:
    var extra:Dictionary=node.get_meta("extras",{})
    var key:String=str(extra.get("three_node_id",extra.get("gatepod_added_id","")))
    if not key.is_empty():ids[key]=node
    for child in node.get_children():_index(child,ids)

func _materials(node:Node)->void:
    var extra:Dictionary=node.get_meta("extras",{})
    if node is Node3D and extra.get("candidateHidden",false):node.visible=false
    if node is MeshInstance3D:
        for surface in node.mesh.get_surface_count():
            var material=node.get_active_material(surface)
            var arrays:Array=node.mesh.surface_get_arrays(surface)
            if material is StandardMaterial3D and arrays[Mesh.ARRAY_COLOR]!=null and arrays[Mesh.ARRAY_COLOR].size()>0:
                var copy:StandardMaterial3D=material.duplicate()
                copy.vertex_color_use_as_albedo=true;copy.vertex_color_is_srgb=false
                node.set_surface_override_material(surface,copy)
    for child in node.get_children():_materials(child)

func rope_anchor(index:int,seat:int)->Vector3:
    if index<0 or index>=pods.size() or seat not in [0,1]:return Vector3.ZERO
    return pods[index].ids["add:rope-anchor-left" if seat==0 else "add:rope-anchor-right"].global_position

func set_deployment(index:int,amount:float)->void:
    if index<0 or index>=pods.size():return
    var row:Dictionary=pods[index]
    var frame:=clampi(int(round(clampf(amount,0.0,1.0)*60.0)),0,60)
    if row.last_frame==frame:return
    row.last_frame=frame
    var pose:Dictionary=row.data.poseFrames[frame].transforms
    for key in pose:
        if key=="n0" or not row.ids.has(key):continue
        var a:Array=pose[key]
        row.ids[key].transform=Transform3D(Basis(Vector3(a[0],a[1],a[2]),Vector3(a[4],a[5],a[6]),Vector3(a[8],a[9],a[10])),Vector3(a[12],a[13],a[14]))

func reset()->void:
    for index in pods.size():set_deployment(index,0.0)
