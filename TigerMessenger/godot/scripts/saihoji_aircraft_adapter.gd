extends RefCounted
## Visual candidate under each original moving fleet root. Flight/hits stay in world.
const PATH := "res://assets/moebius-aircraft-v1/moebius-aircraft-v1.glb"
var aircraft: Array = []
var report: Dictionary = {}

func apply(members: Array) -> Dictionary:
    if not aircraft.is_empty(): return report
    if not ResourceLoader.exists(PATH): return {"applied": false, "reason": "Candidate not imported"}
    var prefab: PackedScene = load(PATH)
    var staged: Array = []
    for member in members:
        var candidate := prefab.instantiate()
        var ids: Dictionary = {}
        _index(candidate, ids)
        if ids.size() != 67 or not ids.has("n0"):
            candidate.free()
            for row in staged: row.candidate.free()
            return {"applied": false, "reason": "Expected all 67 original aircraft nodes"}
        staged.append({"candidate": candidate, "ids": ids, "anchor": member})
    for row in staged:
        var original: Array = []
        for child in row.anchor.get_children():
            if child is Node3D:
                original.append({"node": child, "visible": child.visible})
                child.visible = false
        row.candidate.name = "BlenderAircraftCandidate"
        row.anchor.add_child(row.candidate)
        row.candidate.transform = Transform3D.IDENTITY
        _materials_and_visibility(row.candidate)
        row["original"] = original
        aircraft.append(row)
    report = {"applied": true, "members": aircraft.size(), "original_nodes_per_member": 67,
        "original_moving_roots_preserved": true, "scan_nodes_initially_hidden": true,
        "scope": "Geometry, palette, flame and cockpit pulse. Route/hits/scan landing remain world-owned"}
    return report

func _index(node: Node, ids: Dictionary) -> void:
    var extras: Dictionary = node.get_meta("extras", {})
    if extras.has("three_node_id"): ids[extras.three_node_id] = node
    for child in node.get_children(): _index(child, ids)

func _materials_and_visibility(node: Node) -> void:
    var extras: Dictionary = node.get_meta("extras", {})
    if node is Node3D and (extras.get("source_visible", true) == false or extras.get("candidate_hidden_outline", false)):
        node.visible = false
    if node is MeshInstance3D:
        for surface in node.mesh.get_surface_count():
            var material = node.get_active_material(surface)
            if material is StandardMaterial3D:
                var copy: StandardMaterial3D = material.duplicate()
                var arrays: Array = node.mesh.surface_get_arrays(surface)
                if arrays[Mesh.ARRAY_COLOR] != null and arrays[Mesh.ARRAY_COLOR].size() > 0:
                    copy.vertex_color_use_as_albedo = true
                    copy.vertex_color_is_srgb = false
                node.set_surface_override_material(surface, copy)
    for child in node.get_children(): _materials_and_visibility(child)

func tick(time: float, suction: float, foraging: bool) -> void:
    # Original updateAircraftHover visual formula; no route or root position changes.
    var wound_dim := 0.35 + 0.65 * clampf(suction, 0.0, 1.0)
    var pulse := 0.75 + sin(time * 16.0 * (1.35 if foraging else 1.0)) * 0.3
    var cockpit_pulse := 0.85 + sin(time * 8.0) * 0.15
    for row in aircraft:
        for index in range(56, 62):
            var flame: Node3D = row.ids["n%d" % index]
            flame.scale = Vector3(1.0, pulse * wound_dim, 1.0)
            if flame is MeshInstance3D:
                for surface in flame.mesh.get_surface_count():
                    var material = flame.get_active_material(surface)
                    if material is StandardMaterial3D:
                        var color: Color = material.albedo_color
                        color.a = ((0.75 + pulse * 0.2) if color.r > 0.9 and color.g < 0.4 else (0.4 + pulse * 0.25)) * wound_dim
                        material.albedo_color = color
        row.ids.n53.scale = Vector3.ONE * (0.95 + cockpit_pulse * 0.15)
        row.ids.n54.scale = Vector3.ONE * (0.85 + cockpit_pulse * 0.35) * (0.6 + 0.4 * wound_dim)

func restore() -> void:
    for row in aircraft:
        for previous in row.original:
            if is_instance_valid(previous.node): previous.node.visible = previous.visible
        if is_instance_valid(row.candidate): row.candidate.queue_free()
    aircraft.clear()
    report = {}
