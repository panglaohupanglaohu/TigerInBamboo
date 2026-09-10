extends RefCounted
## Replays the saved v6 poses without rebuilding the original 26 rowers.
const MODEL := "res://assets/warship-battle-v8/warship-battle-v8.glb"
const ASSEMBLY := "res://assets/warship-battle-v8/warship-battle-v8.assembly.json"
var data: Dictionary = {}
var decoded: Dictionary = {}
var report: Dictionary = {"asset":"warship-battle-v8", "instances":0, "rowers_per_ship":26, "boarding_validated":false}

func load_data() -> bool:
    if not data.is_empty(): return true
    var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(ASSEMBLY))
    if not parsed is Dictionary: return false
    data = parsed
    report.saved_pose_frames = data.get("poseFrames", []).size()
    return report.saved_pose_frames == 301

func bind(node: Node3D) -> Dictionary:
    if not load_data(): return {}
    var ids: Dictionary = {}
    _index(node, ids)
    for key in ["n0", "n219", "n220", "n63", "n188", "add:hand-0L", "add:hand-25R", "add:boarding-hinge"]:
        if not ids.has(key): push_error("Warship v6 missing " + key); return {}
    node.set_meta("warship_revision", "warship-battle-v8")
    var row := {"node":node, "ids":ids, "time":0.0, "last_frame":-1, "crew_state":{}, "crew_identity":{}}
    apply_frame(row, 0)
    report.instances += 1
    return row

func _index(node: Node, ids: Dictionary) -> void:
    var extras: Dictionary = node.get_meta("extras", {})
    var key := str(extras.get("three_node_id", extras.get("three_instance_key", extras.get("warship_added_id", ""))))
    if not key.is_empty(): ids[key] = node
    if node is Node3D and (extras.get("candidateHidden", false) or extras.get("candidate_hidden_source_geometry", false) or not extras.get("three_visible", true)): node.visible = false
    if node is MeshInstance3D and node.mesh:
        for surface in node.mesh.get_surface_count():
            var arrays: Array = node.mesh.surface_get_arrays(surface)
            var mat: Material = node.get_active_material(surface)
            if arrays[Mesh.ARRAY_COLOR] != null and not arrays[Mesh.ARRAY_COLOR].is_empty() and mat is StandardMaterial3D:
                var copy: StandardMaterial3D = mat.duplicate()
                copy.vertex_color_use_as_albedo = true
                copy.vertex_color_is_srgb = false
                node.set_surface_override_material(surface, copy)
    for child in node.get_children(): _index(child, ids)

func _transform(a: Array) -> Transform3D:
    return Transform3D(Basis(Vector3(a[0],a[1],a[2]),Vector3(a[4],a[5],a[6]),Vector3(a[8],a[9],a[10])),Vector3(a[12],a[13],a[14]))

func apply_frame(row: Dictionary, frame: int) -> void:
    frame = clampi(frame, 0, data.poseFrames.size()-1)
    if row.last_frame == frame: return
    if not decoded.has(frame):
        var values: Dictionary = {}
        for key in data.poseFrames[frame].transforms:
            if key != "n0": values[key] = _transform(data.poseFrames[frame].transforms[key])
        decoded[frame] = values
    for key in decoded[frame]:
        if row.ids.has(key): row.ids[key].transform = decoded[frame][key]
    # The old deployment sequence is not valid for the v6 deck. Keep its board stowed.
    row.ids["add:boarding-hinge"].transform = _transform(data.boarding.stowedMatrix)
    for seat in row.crew_state:
        if not row.crew_state[seat]:
            var oar_key := "n%d" % (63+int(seat)*5)
            row.ids[oar_key].transform = _transform(data.poseFrames[180].transforms[oar_key])
    row.last_frame = frame

func tick(row: Dictionary, delta: float, moving: bool) -> void:
    if not moving: apply_frame(row, 180); return
    row.time += delta
    var phase: float = TAU + fposmod(float(row.time)*6.2, TAU)
    var best := 1
    var distance := INF
    for i in range(1,180):
        var candidate: float = absf(float(data.poseFrames[i].sourcePhase)-phase)
        if candidate < distance: best = i; distance = candidate
    apply_frame(row, best)

func reset() -> void:
    report.instances = 0

# The standing actor and seated drawing share one soldier identity, never two units.
func set_crew_embarked(row: Dictionary, seat: int, embarked: bool, identity: String = "") -> void:
    if not identity.is_empty(): row.crew_identity[seat] = identity
    if row.crew_state.get(seat, null) == embarked: return
    row.crew_state[seat] = embarked
    for part in range(220,231):
        var key := "n%d:i%d" % [part,seat]
        if row.ids.has(key): row.ids[key].visible = embarked
    for part in ["forearm", "hand"]:
        for side in ["L","R"]:
            var key := "add:%s-%d%s" % [part,seat,side]
            if row.ids.has(key): row.ids[key].visible = embarked
    for key in row.ids:
        var node: Node = row.ids[key]
        var extras: Dictionary = node.get_meta("extras",{})
        if int(extras.get("warship_crew_index",-1)) == seat:
            node.visible = embarked
            node.set_meta("soldier_identity",identity)
    row.last_frame = -1
