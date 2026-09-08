extends Node
## Original gladius-only updateSiege subset. No transport, routing, projectiles,
## ladder spawning, siege timeline or replacement battlefield rules are supplied.
signal combat_event(event: Dictionary)
const Adapter = preload("res://scripts/roman_combat_adapter.gd")
const MELEE_RANGE := 1.7
const MELEE_COOLDOWN := 1.15
var units: Array = []
var time := 0.0
var random_value: Callable
var rng := RandomNumberGenerator.new()

func _init() -> void: rng.seed = 7

func register_actor(actor: Node3D):
    for unit in units:
        if unit.actor == actor: return unit
    var unit = Adapter.new()
    if not unit.bind(actor):
        push_warning(unit.last_error)
        return null
    unit.combat_event.connect(_record)
    units.append(unit)
    _record({"type": "registered", "unit": unit.unit_id, "side": unit.side, "sourcePath": unit.source_path})
    return unit

func unregister_actor(actor: Node3D) -> void:
    for unit in units.duplicate():
        if unit.actor == actor:
            unit.unbind()
            units.erase(unit)

func _record(event: Dictionary) -> void:
    var row := event.duplicate()
    row["time"] = time
    combat_event.emit(row)

func _process(dt: float) -> void: step(minf(dt, 0.05))

func _next_cooldown() -> float:
    var r: float = random_value.call() if random_value.is_valid() else rng.randf()
    return MELEE_COOLDOWN * (0.8 + clampf(r, 0.0, 1.0) * 0.5)

func step(dt: float) -> void:
    if not is_finite(dt) or dt <= 0.0: return
    time += dt
    for unit in units.duplicate():
        if not is_instance_valid(unit.actor) or not unit.actor.is_inside_tree():
            unit.unbind(); units.erase(unit)
        elif unit.actor.is_visible_in_tree() and not unit.dead:
            unit.melee_engaged = maxf(0.0, unit.melee_engaged - dt)
    var reds: Array = units.filter(func(unit): return unit.side == "red" and unit.actor.is_visible_in_tree() and not unit.dead)
    var blues: Array = units.filter(func(unit): return unit.side == "blue" and unit.actor.is_visible_in_tree() and not unit.dead)
    # Preserve source update order and asymmetric defensive range.
    _fight(reds, blues, true, dt)
    _fight(blues, reds, false, dt)
    for unit in units: unit.tick_lifecycle(dt)

func _fight(attackers: Array, targets: Array, defending_red: bool, dt: float) -> void:
    for unit in attackers:
        if unit.downed or (not defending_red and unit.siege_stage == "climb"): continue
        if not defending_red:
            unit.melee_cooldown -= dt
            if unit.melee_cooldown > 0.0: continue
        var foe = null
        var best := MELEE_RANGE * MELEE_RANGE * (1.4 if defending_red else 1.0)
        for target in targets:
            var d: float = unit.actor.global_position.distance_squared_to(target.actor.global_position)
            if d < best: best = d; foe = target
        if foe == null: continue
        unit.target_weapon(foe.actor)
        if defending_red:
            unit.melee_cooldown -= dt
            if unit.melee_cooldown > 0.0: continue
        unit.melee_cooldown = _next_cooldown()
        unit.melee_engaged = 1.4; foe.melee_engaged = 1.4
        _record({"type": "melee_attack", "attacker": unit.unit_id, "defender": foe.unit_id, "distance": sqrt(best), "cooldown": unit.melee_cooldown})
        foe.receive_hit("melee")

func _exit_tree() -> void:
    for unit in units: unit.unbind()
    units.clear()
