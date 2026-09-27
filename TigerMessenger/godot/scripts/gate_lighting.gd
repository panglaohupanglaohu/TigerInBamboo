extends Node3D
## Same gate-local lamp locations and shared-clock phase convention as Web.
## The current original-world viewer has no clock; a host can call set_phase().
@export_range(0.0, 1.0) var time_of_day := 0.5
var bounce: OmniLight3D
var lamps: Array[OmniLight3D] = []
func _ready() -> void:
	bounce = OmniLight3D.new()
	bounce.name = "GateSunsetBounce"
	bounce.position = Vector3(20, 35, -30)
	bounce.light_color = Color("ffa36f")
	bounce.omni_range = 125
	bounce.shadow_enabled = false
	add_child(bounce)
	for p in [Vector3(-28, 5, -23), Vector3(-18, 5, -23)]:
		var lamp := OmniLight3D.new()
		lamp.position = p
		lamp.light_color = Color("ffba63")
		lamp.omni_range = 11
		lamp.shadow_enabled = false
		add_child(lamp)
		lamps.append(lamp)
	set_phase(time_of_day)
func set_phase(phase: float) -> void:
	time_of_day = fposmod(phase, 1.0)
	if not is_instance_valid(bounce): return
	var dusk := maxf(0, 1 - absf(time_of_day - 0.75) / 0.11)
	var dawn := maxf(0, 1 - absf(time_of_day - 0.28) / 0.08)
	var night := 1 - smoothstep(-0.15, 0.25, sin((time_of_day - 0.25) * TAU))
	bounce.light_energy = 1.5 * maxf(dusk, dawn * 0.6)
	for lamp in lamps: lamp.light_energy = 1.2 * night
