extends Node
## Original Saihoji timing/event core. No spawns, collisions, damage or fake landing.
## Adapter owns actual geometry, hit evidence and actor lifecycle. Blue defenders are
## the user's explicit narrative revision of the source's red-then-blue transition.
signal event_emitted(event: Dictionary)
const RADIUS := 160.0
const PRELUDE := 2.8
const STATION_WAIT := 3.0
const STATION_DRIFT := 26.0
const STATION_COOLDOWN := 150.0
var phase := "at_castle"
var whale_phase := "buried"
var assault_phase := "idle"
var running := false
var clock := 0.0
var round_id := 0
var _fleet: Dictionary = {}
var _blue: Dictionary = {}
var _heavy: Dictionary = {}
var _seen: Dictionary = {}
var _landed: Dictionary = {}
var _ships_sent := 0
var _quiet := 0.0
var _ship_due := 0.0
var _prelude_time := 0.0
var _hits := 0
var _sink_step := 0
var _formation := false
var _settle_dir := Vector3.ZERO
var _settle_time := 0.0
var _fleet_dir := Vector3.ZERO
var _fleet_present := false
var _swept: Array[Dictionary] = []
var _mission_dir := Vector3.ZERO
var _whale_lift := 0.0
var _departed := false
var _final_scan := false
var _withdrawn := false
var _returned := false
var _swallow_ready := 0.0
var _threats: Dictionary = {}
var _music := ""

func configure(fleet_ids: Array, blue_ids: Array, heavy_ids: Array) -> bool:
    if running: return false
    var combined: Dictionary = {}
    for ids in [fleet_ids, blue_ids, heavy_ids]:
        for id in ids:
            if not id is String or id.is_empty() or combined.has(id): return false
            combined[id] = true
    if fleet_ids.is_empty() or blue_ids.is_empty(): return false
    _fleet = _id_set(fleet_ids); _blue = _id_set(blue_ids); _heavy = _id_set(heavy_ids)
    return true

func _id_set(ids: Array) -> Dictionary:
    var result: Dictionary = {}
    for id in ids: result[id] = true
    return result

func start() -> bool:
    if running or _fleet.is_empty() or _blue.is_empty(): return false
    _clear_round()
    round_id += 1
    running = true
    _emit("round_started", {"defender_faction": "blue", "narrative_revision": true})
    return true

func _emit(kind: String, data: Dictionary = {}) -> void:
    var event := data.duplicate(true)
    event["type"] = kind; event["round_id"] = round_id; event["time"] = clock
    event_emitted.emit(event)

func _bgm(cue: String) -> void:
    if cue == _music: return
    _music = cue
    _emit("bgm_intent", {"cue": cue, "restart": false})

func tick(delta: float, observation: Dictionary) -> void:
    if not running or not is_finite(delta) or delta <= 0.0: return
    clock += delta
    _fleet_present = bool(observation.get("fleet_present", false))
    var d: Vector3 = observation.get("fleet_ground_dir", Vector3.ZERO)
    _fleet_dir = d.normalized() if d.is_finite() and d.length_squared() > 0.00001 else Vector3.ZERO
    if not _fleet_present or _fleet_dir == Vector3.ZERO:
        _settle_time = 0.0; _settle_dir = Vector3.ZERO
    elif _settle_dir == Vector3.ZERO or _settle_dir.distance_to(_fleet_dir) * RADIUS > STATION_DRIFT:
        _settle_dir = _fleet_dir; _settle_time = 0.0
    else: _settle_time += delta
    _whale_lift = clampf(float(observation.get("whale_lift", _whale_lift)), 0.0, 1.0)
    var near := _fleet_present and bool(observation.get("near", false))
    var far := bool(observation.get("far", false))
    if phase == "at_castle":
        _quiet = 0.0 if bool(observation.get("drum_active", true)) else _quiet + delta
        if _quiet > 1.6:
            phase = "sail_out"; _ship_due = clock + 0.4
    if phase == "sail_out" and _ships_sent < 2 and clock >= _ship_due:
        var ship_id := "saihoji-warship-%d" % _ships_sent
        _ships_sent += 1; _ship_due = clock + 16.0
        _emit("ship_departure_requested", {"ship_id": ship_id, "faction": "blue"})
    if whale_phase == "buried" and near:
        whale_phase = "prelude"; _prelude_time = 0.0; _bgm("kun_prelude_once")
    elif whale_phase == "prelude":
        if far:
            whale_phase = "buried"; _prelude_time = 0.0; _bgm("")
        elif near:
            _prelude_time += delta
            if _prelude_time >= PRELUDE:
                whale_phase = "rising"; _bgm("kun_storm_once")
                _emit("whale_lift_requested", {"target": 1.0, "suction": 1.0})
    elif whale_phase == "rising" and _whale_lift > 0.92:
        whale_phase = "resisting"; _emit("whale_risen")
    if _formation and whale_phase == "resisting" and phase == "fight":
        if not _seen.has("internal:resistance"):
            _seen["internal:resistance"] = true
            _emit("resistance_enabled", {"faction": "blue", "target_ids": _fleet.keys()})
    if whale_phase == "resisting" and _sink_step >= 6 and _whale_lift < 0.08:
        whale_phase = "returning"; _bgm("")
    if whale_phase == "returning" and _whale_lift < 0.03 and not _returned:
        _returned = true; phase = "withdrawal"
        _emit("whale_returned")
        _emit("withdrawal_requested", {"hold_seconds": 3.2, "faction": "blue"})
    if _returned:
        if far: _departed = true
        if _departed and near: _final_scan = true
        if _final_scan and far and _withdrawn and assault_phase in ["idle", "done"]:
            phase = "complete"; running = false; _bgm(""); _emit("round_completed")

func report_landing(ship_id: String) -> bool:
    if not running or phase != "sail_out": return false
    var index := ["saihoji-warship-0", "saihoji-warship-1"].find(ship_id)
    if index < 0 or index >= _ships_sent or _landed.has(ship_id): return false
    _landed[ship_id] = true; _emit("ship_landed", {"ship_id": ship_id})
    if _landed.size() == 2: phase = "fight"; _emit("formation_requested")
    return true

func report_formation_ready() -> bool:
    if not running or phase != "fight" or _formation: return false
    _formation = true; _emit("formation_ready"); return true

func report_fleet_hit(event_id: String, shooter_id: String, aircraft_id: String, kind: String = "arrow") -> bool:
    if not running or not _fleet_present or not _blue.has(shooter_id) or not _fleet.has(aircraft_id): return false
    if kind not in ["arrow", "javelin"] or not _unique("hit", event_id): return false
    _threats[shooter_id] = clock
    _hits += 1
    _emit("fleet_hit", {"shooter_id": shooter_id, "aircraft_id": aircraft_id, "kind": kind, "hits": _hits})
    var next_step := mini(6, int(_hits / 50))
    if next_step > _sink_step:
        _sink_step = next_step
        _emit("suction_changed", {"step": _sink_step, "suction": 1.0 - _sink_step / 6.0})
        _emit("whale_lift_requested", {"target": 1.0 - _sink_step / 6.0})
    _request_assault()
    return true

func _request_assault() -> void:
    if assault_phase not in ["idle", "done"] or not _fleet_present: return
    if _fleet_dir == Vector3.ZERO or _settle_time < STATION_WAIT: return
    if _settle_dir.distance_to(_fleet_dir) * RADIUS > STATION_DRIFT: return
    for spot in _swept:
        if clock - float(spot.time) < STATION_COOLDOWN and _fleet_dir.dot(spot.direction) > 0.985: return
    _mission_dir = _fleet_dir; assault_phase = "approach"
    _emit("assault_requested", {"direction": _mission_dir, "threat_ids": _threats.keys(), "heavy_ids": _heavy.keys()})
    if _music == "": _bgm("fleet_assault")

func report_assault_stage(next_stage: String) -> bool:
    if not running: return false
    var permitted := {"approach": ["insert", "withdraw"], "insert": ["combat", "withdraw"], "combat": ["withdraw"], "withdraw": ["extract"], "extract": ["done"]}
    if not permitted.has(assault_phase) or next_stage not in permitted[assault_phase]: return false
    assault_phase = next_stage
    _emit("assault_stage", {"stage": next_stage})
    if next_stage == "done":
        _swept.append({"direction": _mission_dir, "time": clock})
        if _music == "fleet_assault": _bgm("")
    return true

func report_whale_swallow(event_id: String, enemy_ids: Array) -> bool:
    if not running or whale_phase != "resisting" or assault_phase not in ["insert", "combat"] or clock < _swallow_ready: return false
    if enemy_ids.is_empty() or enemy_ids.size() > 3: return false
    var targets: Dictionary = {}
    for id in enemy_ids:
        if not _heavy.has(id) or targets.has(id): return false
        targets[id] = true
    if not _unique("swallow", event_id): return false
    # The adapter must establish mouth cone/range and available/alive status first.
    _swallow_ready = clock + 9.0
    _emit("whale_swallow", {"enemy_ids": enemy_ids.duplicate(), "cooldown": 9.0})
    return true

func report_withdrawal_complete() -> bool:
    if not running or phase != "withdrawal" or _withdrawn: return false
    _withdrawn = true; _emit("withdrawal_complete"); return true

func _unique(kind: String, id: String) -> bool:
    if id.is_empty(): return false
    var key := kind + ":" + id
    if _seen.has(key): return false
    _seen[key] = true; return true

func stop(reason: String = "stopped") -> void:
    if not running: return
    running = false; phase = "stopped"; _bgm("")
    _emit("cleanup_requested", {"reason": reason})

func reset() -> void:
    running = false; _bgm(""); _emit("cleanup_requested", {"reason": "reset"})
    _clear_round()

func _clear_round() -> void:
    phase = "at_castle"; whale_phase = "buried"; assault_phase = "idle"
    _seen.clear(); _landed.clear(); _threats.clear(); _swept.clear()
    _ships_sent = 0; _quiet = 0.0; _ship_due = 0.0; _prelude_time = 0.0
    _hits = 0; _sink_step = 0; _formation = false; _settle_time = 0.0
    _settle_dir = Vector3.ZERO; _fleet_dir = Vector3.ZERO; _mission_dir = Vector3.ZERO
    _fleet_present = false; _whale_lift = 0.0; _departed = false; _final_scan = false
    _withdrawn = false; _returned = false; _swallow_ready = 0.0; _music = ""

func snapshot() -> Dictionary:
    return {"phase": phase, "whale_phase": whale_phase, "assault_phase": assault_phase,
        "running": running, "round_id": round_id, "hits": _hits, "sink_step": _sink_step,
        "ships_sent": _ships_sent, "landed": _landed.keys(), "formation": _formation,
        "threat_ids": _threats.keys(), "music": _music}
