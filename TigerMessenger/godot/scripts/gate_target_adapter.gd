extends RefCounted
## Approved gate architecture in the original seat's local Y-up coordinates.
## Original pods keep their hierarchy and basis, at revised tower-clear berths.
const ASSET := "res://assets/art-pilots/gate-of-sighs-v1.glb"
const GATE_PATH := "cyber-megalithic-twin-gates[109]"
const SEAT_PATH := GATE_PATH + "/gate-seat-root[0]"
const BUILDING_PARTS := ["gate-arch-0[0]", "gate-arch-1[1]", "gate-arch-2[2]", "leftTowerGroup[3]", "rightTowerGroup[4]", "channel-pier-L[5]", "channel-pier-R[6]"]
var seat: Node3D
var candidate: Node3D
var site: Node3D
var dressing: Node3D
var pact: Node
var original_seat_transform: Transform3D
var original_parts: Array[Node3D] = []
var original_visibility: Array[bool] = []
var relocated_pods: Array[Node3D] = []
var original_pod_positions: Array[Vector3] = []
const POD_BERTHS := {
	"gate-pod-pod-55-2[0]": Vector3(-33, 22, 9.5),
	"gate-pod-pod-41-7[1]": Vector3(-34, 17.5, -7)
}
var last_error := ""

func bind(model: Node) -> bool:
	if is_instance_valid(candidate): return true
	if model.has_meta("gate_target_adapter"):
		last_error = "Gate target already bound"
		return false
	var sources: Dictionary = {}
	for node in model.find_children("*", "Node3D", true, false):
		var path := str(node.get_meta("extras", {}).get("sourcePath", ""))
		if path == GATE_PATH or path.begins_with(SEAT_PATH):
			if sources.has(path):
				last_error = "Duplicate original gate identity: " + path
				return false
			sources[path] = node
	seat = sources.get(SEAT_PATH) as Node3D
	if not seat or seat.get_parent() != sources.get(GATE_PATH) or str(seat.name) != "gate-seat-root":
		last_error = "Missing exact original gate/seat identity"
		return false
	var pending: Array[Node3D] = []
	for suffix in BUILDING_PARTS:
		var part := sources.get(SEAT_PATH + "/" + suffix) as Node3D
		if not part or part.get_parent() != seat:
			last_error = "Missing original gate building part: " + suffix
			return false
		pending.append(part)
	var pods := sources.get(SEAT_PATH + "/gate-pod-squadron[7]") as Node3D
	if not pods or pods.get_parent() != seat:
		last_error = "Missing original gate pod squadron"
		return false
	var pending_pods: Array[Node3D] = []
	for suffix in POD_BERTHS:
		var pod := sources.get(SEAT_PATH + "/gate-pod-squadron[7]/" + suffix) as Node3D
		if not pod or pod.get_parent() != pods:
			last_error = "Missing exact original gate pod: " + suffix
			return false
		pending_pods.append(pod)
	if not ResourceLoader.exists(ASSET):
		last_error = "Gate target asset not imported; originals retained"
		return false
	var packed := load(ASSET) as PackedScene
	if not packed:
		last_error = "Gate target asset is not a scene; originals retained"
		return false
	var replacement := packed.instantiate() as Node3D
	if not replacement or replacement.find_children("*", "MeshInstance3D", true, false).is_empty():
		if replacement: replacement.free()
		last_error = "Gate target has no geometry; originals retained"
		return false
	replacement.name = "GateOfSighs_TargetV1"
	replacement.transform = Transform3D.IDENTITY
	original_seat_transform = seat.transform
	var placement: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/gate-site-placement.json"))
	var q: Array = placement["quaternion"]
	var p: Array = placement["origin"]
	seat.transform = Transform3D(Basis(Quaternion(q[0], q[1], q[2], q[3])), Vector3(p[0], p[1], p[2]))
	var site_scene := load("res://assets/art-pilots/gate-site-v1.glb") as PackedScene
	if site_scene:
		site = site_scene.instantiate() as Node3D
		site.name = "GateCanyonSite"
		seat.get_parent().add_child(site)
		site.transform = seat.transform
	seat.add_child(replacement)
	candidate = replacement
	var dressing_path := "res://assets/art-pilots/gate-dressing-v1.glb"
	if ResourceLoader.exists(dressing_path):
		var dressing_scene := load(dressing_path) as PackedScene
		if dressing_scene:
			dressing = dressing_scene.instantiate() as Node3D
			dressing.name = "GateDressing"
			replacement.add_child(dressing)
			dressing.transform = Transform3D.IDENTITY
	var lights = preload("res://scripts/gate_lighting.gd").new()
	lights.name = "GateLighting"
	replacement.add_child(lights)
	var meeting := Node3D.new()
	meeting.name = "GateHeroMeeting"
	meeting.position = Vector3(-25, 3.26, -18.5)
	replacement.add_child(meeting)
	for role in ["odysseus", "achilles"]:
		var hero_path: String = "res://assets/art-pilots/gate-" + role + ".glb"
		if ResourceLoader.exists(hero_path):
			var hero_scene := load(hero_path) as PackedScene
			if hero_scene:
				var hero := hero_scene.instantiate() as Node3D
				meeting.add_child(hero)
				hero.position = Vector3(-0.5, 0, 0) if role == "odysseus" else Vector3(0.55, 0, 0.12)
	pact = preload("res://scripts/gate_pact.gd").new()
	pact.name = "GatePact"
	replacement.add_child(pact)
	if not pact.bind(meeting): push_error(pact.last_error)
	original_parts = pending
	for part in original_parts:
		original_visibility.append(part.visible)
		part.visible = false
	# Revised authored berths clear the wider towers. Keep each craft's
	# original basis, scale and descendants; only translate its direct root.
	relocated_pods = pending_pods
	for i in relocated_pods.size():
		original_pod_positions.append(relocated_pods[i].position)
		relocated_pods[i].position = POD_BERTHS.values()[i]
	model.set_meta("gate_target_adapter", self)
	last_error = ""
	return true

func unbind() -> void:
	if is_instance_valid(dressing): dressing.free()
	dressing = null
	if is_instance_valid(pact): pact.reset()
	pact = null
	if is_instance_valid(site): site.free()
	site = null
	if is_instance_valid(seat): seat.transform = original_seat_transform
	for i in relocated_pods.size():
		if is_instance_valid(relocated_pods[i]): relocated_pods[i].position = original_pod_positions[i]
	relocated_pods.clear()
	original_pod_positions.clear()
	for i in original_parts.size():
		if is_instance_valid(original_parts[i]): original_parts[i].visible = original_visibility[i]
	if is_instance_valid(candidate): candidate.free()
	candidate = null
	original_parts.clear()
	original_visibility.clear()
	if is_instance_valid(seat):
		var model := seat.get_parent()
		while model:
			if model.has_meta("gate_target_adapter") and model.get_meta("gate_target_adapter") == self:
				model.remove_meta("gate_target_adapter")
				break
			model = model.get_parent()
	seat = null
