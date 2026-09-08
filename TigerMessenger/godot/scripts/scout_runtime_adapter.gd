extends RefCounted
## Exact model callback: src/world/planetV8/tripleGateScout.js:190-199.
## This adapter owns local animation and anchors, not flight AI or player input.
var aircraft: Node3D
var nodes: Dictionary = {}
var beacon: MeshInstance3D
var beacon_material: StandardMaterial3D
var beacon_light: OmniLight3D
var mounted := false
var base_position := Vector3.ZERO
var up := Vector3.UP
var last_delta := 0.0
var pulse := 1.0

func bind(model: Node3D) -> void:
    _collect(model)
    aircraft = nodes.get("n0")
    beacon = nodes.get("n43")
    if beacon:
        var original := beacon.get_active_material(0) as StandardMaterial3D
        beacon_material = original.duplicate() if original else StandardMaterial3D.new()
        beacon.material_override = beacon_material
    # Original n44 is a Three PointLight archived as an empty anchor.
    var light_anchor: Node3D = nodes.get("n44")
    if light_anchor:
        beacon_light = OmniLight3D.new()
        beacon_light.name = "OriginalScoutBeaconLight"
        beacon_light.light_color = Color.html("ff9a43")
        beacon_light.light_energy = 0.65
        beacon_light.omni_range = 5.0
        beacon_light.omni_attenuation = 2.0
        light_anchor.add_child(beacon_light)

func _collect(node: Node) -> void:
    var extras: Dictionary = node.get_meta("extras", {})
    if extras.has("three_node_id"): nodes[str(extras.three_node_id)] = node
    for child in node.get_children(): _collect(child)

func configure_hover(position: Vector3, radial_up: Vector3) -> void:
    base_position = position
    up = radial_up
    mounted = true

func update_original(time: float, delta: float) -> void:
    if not mounted or not is_instance_valid(aircraft): return
    var bob := sin(time * 1.7 + 0.35) * 0.32
    aircraft.position = base_position + up * bob
    pulse = 0.78 + 0.22 * sin(time * 5.2)
    if beacon_material:
        var color := beacon_material.albedo_color
        color.a = pulse
        beacon_material.albedo_color = color
        # Original MeshBasicMaterial is opaque: preserve that setting rather
        # than invent a blinking mesh. The point light carries visible pulsing.
    if beacon_light: beacon_light.light_energy = 0.45 + pulse * 0.35
    last_delta = delta

func update_defense_light(flash_remaining: float, manual: bool = false) -> void:
    # scoutDefense.js:519-524: model callback runs first, manual exits before override.
    if not manual and beacon_light:
        beacon_light.light_energy = 1.4 if flash_remaining > 0.0 else 0.55

func cockpit_world_position() -> Vector3:
    return nodes["n45"].global_position

func muzzle_world_positions() -> Array[Vector3]:
    return [nodes["n31"].global_position, nodes["n34"].global_position]
