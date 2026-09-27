extends Node
## Native counterpart of gateHeroes.js and the isolated pact chapter rules.
## This does not start or save the global rescue campaign.
const RANGE := 9.0
var heroes: Dictionary = {}
var rest: Dictionary = {}
var meeting: Node3D
var courier: Node3D
var chapter := 0
var started := false
var elapsed := -1.0
var stage := "waiting"
var accepted_count := 0
var last_rejection := ""
var last_error := ""

func _exact(root: Node, target: String) -> Node3D:
	var matches: Array[Node3D] = []
	if str(root.name) == target and root is Node3D: matches.append(root)
	for node in root.find_children("*", "Node3D", true, false):
		if str(node.name) == target: matches.append(node)
	return matches[0] if matches.size() == 1 else null

func bind(anchor: Node3D) -> bool:
	if meeting == anchor and not heroes.is_empty(): return true
	reset()
	heroes.clear()
	rest.clear()
	meeting = null
	for role in ["odysseus", "achilles"]:
		var actor := _exact(anchor, role)
		if not actor:
			last_error = "Missing unique imported hero: " + role
			return false
		var parts: Dictionary = {}
		for part in ["armL", "armR", "head"]:
			var node := _exact(actor, role + "_" + part)
			if not node:
				last_error = "Missing unique imported hero joint: " + role + "_" + part
				return false
			parts[part] = node
			rest[node] = node.transform
		heroes[role] = parts
	meeting = anchor
	last_error = ""
	return true

func begin_chapter_test(actor: Node3D) -> bool:
	reset()
	if not is_instance_valid(meeting) or not is_instance_valid(actor): return false
	courier = actor
	chapter = 1 # Explicit fixture: already carrying the bookshop letter.
	started = true
	return true

func interact() -> bool:
	last_rejection = ""
	if not started or chapter != 1:
		last_rejection = "未携书店密信，或本章已经交付。"
		return false
	if not is_instance_valid(courier) or not is_instance_valid(meeting):
		last_rejection = "信使或会面位置尚未就绪。"
		return false
	var distance := courier.global_position.distance_to(meeting.global_position)
	if not is_finite(distance) or distance > RANGE:
		last_rejection = "请步行靠近两位英雄（9 米内）。"
		return false
	chapter = 2
	accepted_count += 1
	elapsed = 0.0
	set_stage("receiving", 0.0)
	return true

func _process(delta: float) -> void:
	advance(delta)

func advance(delta: float) -> void:
	if elapsed < 0 or not is_finite(delta) or delta < 0: return
	elapsed += delta
	if elapsed < 1.0: set_stage("receiving", elapsed)
	elif elapsed < 3.5: set_stage("reading", elapsed)
	elif elapsed < 4.5: set_stage("acknowledging", elapsed - 3.5)
	else:
		set_stage("waiting", 0.0)
		elapsed = -1.0

func _turn(node: Node3D, axis: Vector3, angle: float) -> void:
	node.basis = node.basis * Basis(axis, angle)

func set_stage(value: String, time := 0.0, weight := 1.0) -> void:
	for node in rest:
		if is_instance_valid(node): node.transform = rest[node]
	stage = value
	var w := clampf(weight, 0, 1)
	var wave := sin(clampf(time, 0, 1) * PI)
	for role in heroes:
		var parts: Dictionary = heroes[role]
		_turn(parts.head, Vector3.RIGHT, (0.13 if stage == "reading" else wave * 0.15 if stage == "acknowledging" else 0.0) * w)
		if role == "odysseus":
			var reach := 0.20 if stage == "receiving" else -0.08 if stage == "reading" else 0.0
			_turn(parts.armR, Vector3.RIGHT, reach * w)
			_turn(parts.armL, Vector3.RIGHT, reach * 0.6 * w)
			if stage == "acknowledging": _turn(parts.armL, Vector3.BACK, -0.08 * wave * w)
		elif stage == "acknowledging": _turn(parts.armR, Vector3.RIGHT, -0.09 * wave * w)

func reset() -> void:
	for node in rest:
		if is_instance_valid(node): node.transform = rest[node]
	stage = "waiting"
	elapsed = -1.0
	chapter = 0
	started = false
	accepted_count = 0
	courier = null
	last_rejection = ""
