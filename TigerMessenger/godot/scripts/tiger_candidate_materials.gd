extends RefCounted
static func adapt(node: Node) -> int:
    var hidden := 0
    var extras: Dictionary = node.get_meta("extras", {})
    if extras.get("candidateHiddenOutline",false) and node is GeometryInstance3D:
        node.visible=false
        hidden+=1
    for child in node.get_children(): hidden+=adapt(child)
    return hidden
