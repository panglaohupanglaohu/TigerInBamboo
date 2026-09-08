extends Node3D
## Bounded original-algorithm integration scene, NOT the global battlefield.
const Runtime = preload("res://scripts/roman_combat_runtime.gd")
var runtime
var events: Array[Dictionary] = []
var actors: Array[Node3D] = []
var status: Label

func _ready() -> void:
    var camera := Camera3D.new()
    camera.position = Vector3(5, 164, 7)
    add_child(camera)
    camera.look_at(Vector3(0, 160.4, 0))
    camera.current = true
    var light := DirectionalLight3D.new()
    light.rotation_degrees = Vector3(-50, -35, 0)
    light.light_energy = 1.8
    add_child(light)
    var env := WorldEnvironment.new()
    env.environment = Environment.new()
    env.environment.background_mode = Environment.BG_COLOR
    env.environment.background_color = Color("d9e4df")
    env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.environment.ambient_light_color = Color.WHITE
    env.environment.ambient_light_energy = 0.7
    add_child(env)
    var ground := MeshInstance3D.new()
    var plane := PlaneMesh.new(); plane.size = Vector2(8, 8)
    ground.mesh = plane; ground.position.y = 159.98
    var mat := StandardMaterial3D.new(); mat.albedo_color = Color("879b83")
    ground.material_override = mat
    add_child(ground)
    var ui := CanvasLayer.new(); add_child(ui)
    var box := VBoxContainer.new(); box.position = Vector2(20, 20); ui.add_child(box)
    var title := Label.new()
    title.text = "红蓝短剑兵 · 原近战规则子集\n认可盔甲与握盾接入真实受伤/倒地流程\n验证场景：尚未接入全球运兵与攻城路线"
    box.add_child(title)
    var reset := Button.new(); reset.text = "重新验证两组交战"; reset.pressed.connect(reset_encounter); box.add_child(reset)
    status = Label.new(); box.add_child(status)
    reset_encounter()

func reset_encounter() -> void:
    if is_instance_valid(runtime): runtime.free()
    for actor in actors:
        if is_instance_valid(actor): actor.free()
    actors.clear(); events.clear()
    runtime = Runtime.new(); runtime.name = "OriginalGladiusCombatSubset"; add_child(runtime)
    runtime.combat_event.connect(func(row): events.append(row))
    for pair in range(2):
        for side in ["red", "blue"]:
            var actor = load("res://assets/supplemental/romanSoldier_gladius_%s.glb" % side).instantiate() as Node3D
            actor.set_meta("combat_uid", "%s-%s" % [side, pair])
            actor.position = Vector3(-0.65 if side == "red" else 0.65, 160, -2 if pair == 0 else 2)
            if side == "blue": actor.rotation.y = PI
            add_child(actor); actors.append(actor)
            var unit = runtime.register_actor(actor)
            if unit == null: continue
            # Initial cooldown is scenario state; both sides retain source attack rules.
            if pair == 1 and side == "red": unit.melee_cooldown = 0.8

func _process(_dt: float) -> void:
    if not is_instance_valid(runtime): return
    var lines: Array[String] = []
    for unit in runtime.units:
        lines.append("%s：%s" % [unit.unit_id, "消失" if not unit.actor.visible else "阵亡" if unit.dead else "倒地" if unit.downed else "战斗中"])
    status.text = "\n".join(lines)
