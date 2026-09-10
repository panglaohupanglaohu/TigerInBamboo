extends RefCounted
## Carry pose for the approved Blender family, using its published hand/grip anchors.
var actor:Node3D
var nodes:Dictionary={}
var saved:Dictionary={}
var anchors:Dictionary={}
var role:String
var active:=false
func bind(value:Node3D,kind:String,assembly:Dictionary)->bool:
    if active or actor!=null or kind not in ["gladius","spear","longbow"]:return false
    actor=value;role=kind;anchors=assembly.get("anchors",{})
    _index(actor)
    for id in ["n2","n17","n20","n23","n26"]:
        if not nodes.has(id):return false
    for key in ["handL","handR","weaponGrip"]:
        if not anchors.has(key) or not nodes.has(anchors[key].nodeId):return false
    if role!="longbow" and (not anchors.has("shieldGrip") or not nodes.has(anchors.shieldGrip.nodeId)):return false
    var ids=["n2","n17","n20","n23","n26",anchors.weaponGrip.nodeId]
    if role!="longbow":ids.append(anchors.shieldGrip.nodeId)
    if role=="longbow":
        for id in ["n67","n63","n65",anchors.nock.nodeId]:ids.append(id)
    for id in ids:
        if nodes.has(id):saved[id]={"transform":nodes[id].transform,"visible":nodes[id].visible,"parent":nodes[id].get_parent()}
    return true
func _index(n:Node)->void:
    var extras:Dictionary=n.get_meta("extras",{})
    var id:String=str(extras.get("three_node_id",extras.get("roman_family_added_id",extras.get("id",""))))
    if id.is_empty() and str(n.name).begins_with("n") and str(n.name).get_slice("_",0).substr(1).is_valid_int():id=str(n.name).get_slice("_",0)
    if n is Node3D and (extras.get("candidateHidden",false) or not extras.get("three_visible",true)):n.visible=false
    if n is Node3D and not id.is_empty():nodes[id]=n
    for child in n.get_children():_index(child)
func _point(key:String)->Vector3:
    var a:Dictionary=anchors[key];var p:Array=a.point
    return nodes[a.nodeId].to_global(Vector3(p[0],p[1],p[2]))
func _grip(hand:String,equipment:String)->void:
    var a:Dictionary=anchors[equipment];var n:Node3D=nodes[a.nodeId];var p:Array=a.point
    n.position=n.get_parent().to_local(_point(hand))-n.basis*Vector3(p[0],p[1],p[2])
func set_enabled(value:bool)->void:
    if value==active:return
    if not value:
        for id in saved:
            nodes[id].transform=saved[id].transform;nodes[id].visible=saved[id].visible
        active=false;return
    active=true;update()
func update()->void:
    if not active:return
    for id in saved:
        if nodes[id].get_parent()!=saved[id].parent:set_enabled(false);return
    nodes.n2.rotation=Vector3.ZERO
    nodes.n17.rotation=Vector3(0,0,1.2 if role=="longbow" else 0.22)
    nodes.n20.rotation=Vector3(0,0,0.22)
    nodes.n17.position.z=saved.n17.transform.origin.z if role=="longbow" else 0.02
    nodes.n20.position.z=-0.02
    nodes.n23.rotation=Vector3(0,0,0.04);nodes.n26.rotation=Vector3(0,0,-0.04)
    var weapon:Node3D=nodes[anchors.weaponGrip.nodeId]
    weapon.rotation=Vector3(0,0,-0.28) if role=="spear" else Vector3.ZERO
    if role!="longbow":
        nodes[anchors.shieldGrip.nodeId].rotation=Vector3(0,-PI*0.5,0)
        _grip("handL","shieldGrip")
    elif nodes.has("n67"):nodes.n67.visible=false
    _grip("handL" if role=="longbow" else "handR","weaponGrip")
    if role=="longbow":
        var top:=_point("bowTipTop");var bottom:=_point("bowTipBottom");var middle:Vector3=(top+bottom)*0.5
        var nock:Node3D=nodes[anchors.nock.nodeId];nock.position=nock.get_parent().to_local(middle)
        for spec in [["n63",top],["n65",bottom]]:
            var string:Node3D=nodes[spec[0]]
            var a:Vector3=string.get_parent().to_local(spec[1]);var b:Vector3=string.get_parent().to_local(middle)
            string.transform=Transform3D(Basis(Quaternion(Vector3.UP,(b-a).normalized())).scaled_local(Vector3(saved[spec[0]].transform.basis.get_scale().x,a.distance_to(b),saved[spec[0]].transform.basis.get_scale().z)),(a+b)*0.5)
func grip_error()->float:
    var error:=_point("handL" if role=="longbow" else "handR").distance_to(_point("weaponGrip"))
    if role!="longbow":error=maxf(error,_point("handL").distance_to(_point("shieldGrip")))
    return error

func string_error()->float:
    if role!="longbow":return 0.0
    var error:=0.0
    for spec in [["n63","bowTipTop"],["n65","bowTipBottom"]]:
        var n:Node3D=nodes[spec[0]]
        var a:=n.to_global(Vector3(0,-0.5,0));var b:=n.to_global(Vector3(0,0.5,0))
        error=maxf(error,minf(a.distance_to(_point(spec[1])),b.distance_to(_point(spec[1]))))
        error=maxf(error,minf(a.distance_to(_point("nock")),b.distance_to(_point("nock"))))
    return error
