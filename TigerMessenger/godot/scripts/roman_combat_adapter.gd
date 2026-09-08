extends RefCounted
## Equipment + lifecycle for ONE existing gladius actor; never replaces its root.
## Rules: src/world/saihojiPhalanx.js applySoldierDamage / death presentation.
signal combat_event(event: Dictionary)
const Sword = preload("res://scripts/roman_grip_adapter.gd")
const Shield = preload("res://scripts/roman_shield_adapter.gd")
const Armor = preload("res://scripts/roman_armor_direction_adapter.gd")
var actor: Node3D
var side := ""
var unit_id := ""
var source_path := ""
var source_scene := ""
var last_error := ""
var sword = Sword.new()
var shield = Shield.new()
var armor = Armor.new()
var downed := false
var dead := false
var shield_broken := false
var arrow_hits := 0
var melee_hits := 0
var melee_cooldown := 0.0
var melee_engaged := 0.0
var siege_stage := "gather"
var fall_time := -1.0
var death_time := 0.0
var arrow_parity := 0
var _fall_angles := Vector3.ZERO
var _fall_scale := Vector3.ONE

func _owners(node: Node, result: Array[Dictionary]) -> void:
    var extras: Dictionary = node.get_meta("extras", {})
    var raw: Variant = extras.get("three_userData", node.get_meta("three_userData", {}))
    var data: Variant = JSON.parse_string(raw) if raw is String else raw
    if data is Dictionary and data.has("parts") and data.has("equipment"):
        result.append(data)
    for child in node.get_children(): _owners(child, result)

func bind(existing_actor: Node3D) -> bool:
    if is_instance_valid(actor):
        if actor == existing_actor: return true
        last_error = "One adapter owns one lifecycle; create another for a new actor."
        return false
    if not is_instance_valid(existing_actor) or not existing_actor.is_inside_tree():
        last_error = "Bind an existing actor already attached to the live scene."
        return false
    var owners: Array[Dictionary] = []
    _owners(existing_actor, owners)
    if owners.size() != 1 or owners[0].get("phalanxRole") != "gladius" or owners[0].get("helmSide") not in ["red", "blue"]:
        last_error = "Expected exact original gladius role, red/blue side and parts/equipment refs; names alone are not combat identity."
        return false
    if not sword.bind(existing_actor) or not shield.bind(existing_actor) or not armor.bind(existing_actor):
        last_error = sword.last_error + shield.last_error + armor.last_error
        sword.unbind(); shield.unbind(); armor.unbind()
        return false
    actor = existing_actor
    side = owners[0].helmSide
    unit_id = str(actor.get_meta("combat_uid", actor.get_instance_id()))
    source_path = str(actor.get_meta("extras", {}).get("sourcePath", ""))
    source_scene = actor.scene_file_path
    if not set_candidates(true):
        unbind()
        return false
    return true

func set_candidates(value: bool) -> bool:
    if not is_instance_valid(actor): return false
    var ok: bool = sword.set_enabled(value) and shield.set_enabled(value) and armor.set_enabled(value)
    if shield_broken: shield.shield.visible = false
    if not ok: last_error = sword.last_error + shield.last_error + armor.last_error
    return ok

func target_weapon(target: Node3D) -> void:
    if not is_instance_valid(actor) or not is_instance_valid(target) or dead or downed: return
    # Original aimCombatToolAt uses the weapon's +Y grip axis and the actual foe.
    var direction: Vector3 = target.global_position - sword.sword.global_position
    if direction.length_squared() < 0.00000001: return
    var local_direction: Vector3 = sword.sword.get_parent().global_basis.orthonormalized().inverse() * direction.normalized()
    sword.sword.basis = Basis(Quaternion(Vector3.UP, local_direction.normalized())) * Basis.from_scale(sword.get_rest_sword_transform().basis.get_scale())
    update_equipment()

func update_equipment() -> void:
    if sword.enabled: sword.update_grip()
    if shield.enabled: shield.update_grip()

func break_shield() -> void:
    if shield_broken or not is_instance_valid(actor) or not shield.is_bound(): return
    shield_broken = true
    shield.shield.visible = false
    combat_event.emit({"type": "shield_break", "unit": unit_id, "side": side})

func receive_hit(kind: String) -> bool:
    if not is_instance_valid(actor) or dead: return false
    if kind not in ["arrow", "melee", "pike", "vanguardBolt"]: return false
    if kind == "arrow" and not downed and not shield_broken and shield.shield.visible and siege_stage != "climb" and melee_engaged <= 0.0:
        arrow_parity += 1
        if (arrow_parity & 1) == 0:
            combat_event.emit({"type": "arrow_block", "unit": unit_id, "side": side})
            return false
    if kind == "arrow": arrow_hits += 1
    else: melee_hits += 2 if kind in ["pike", "vanguardBolt"] else 1
    if arrow_hits >= 4 or melee_hits >= 2:
        dead = true; downed = true; death_time = 3.7; _start_fall()
    elif not downed and (arrow_hits >= 2 or melee_hits >= 1):
        downed = true; _start_fall()
    combat_event.emit({"type": "hit", "unit": unit_id, "side": side, "kind": kind, "arrowHits": arrow_hits, "meleeHits": melee_hits, "downed": downed, "dead": dead})
    return true

func _start_fall() -> void:
    fall_time = 0.0
    _fall_angles = actor.basis.orthonormalized().get_euler(EULER_ORDER_XYZ)
    _fall_scale = actor.basis.get_scale()

func tick_lifecycle(dt: float) -> void:
    if not is_instance_valid(actor): return
    if fall_time >= 0.0 and fall_time < 0.28:
        fall_time += dt
        var e := minf(1.0, fall_time / 0.28)
        var angles := _fall_angles
        angles.z = (1.45 if dead else 0.95) * (1.0 - (1.0 - e) * (1.0 - e))
        actor.basis = Basis.from_euler(angles, EULER_ORDER_XYZ).scaled_local(_fall_scale)
    if dead and actor.visible:
        death_time -= dt
        if death_time <= 1.1:
            # Original death sink follows the spherical world's radial normal.
            actor.global_position -= actor.global_position.normalized() * dt * 0.55
        if death_time <= 0.0:
            actor.visible = false
            combat_event.emit({"type": "despawn_visual", "unit": unit_id, "side": side})
    update_equipment()

func snapshot() -> Dictionary:
    return {"unit": unit_id, "side": side, "sourcePath": source_path, "sourceScene": source_scene, "role": "gladius", "downed": downed, "dead": dead, "visible": actor.visible if is_instance_valid(actor) else false, "arrowHits": arrow_hits, "meleeHits": melee_hits, "shieldBroken": shield_broken, "cooldown": melee_cooldown, "fallTime": fall_time, "deathTime": death_time, "swordGripError": sword.get_grip_error(), "shieldGripError": shield.get_grip_error()}

func unbind() -> void:
    # Lifecycle owns actor visibility/placement: releasing equipment cannot revive it.
    sword.unbind(); shield.unbind(); armor.unbind()
    actor = null
