extends Node
## Original Saihoji soundtrack, driven by battle events rather than render frames.
signal music_changed(track: String)
const PATHS := {
    "cue": "res://assets/audio/saihoji/storm_cue.ogg",
    "battle": "res://assets/audio/saihoji/kun_battle.ogg",
    "fleet": "res://assets/audio/saihoji/fleet_assault.ogg",
}
var players: Dictionary = {}
var started: Dictionary = {}
var battle_owns_music := false
var fleet_wanted := false
var muted := false
var fades: Dictionary = {}
var effect_streams: Dictionary = {}
var effects: Array[AudioStreamPlayer3D] = []
var effect_cooldowns: Dictionary = {}
var alarm_played := false

func _ready() -> void:
    if AudioServer.get_bus_index("BGM") < 0:
        AudioServer.add_bus()
        AudioServer.set_bus_name(AudioServer.bus_count - 1, "BGM")
    for key in PATHS:
        var imported := load(PATHS[key]) as AudioStreamOggVorbis
        var stream: AudioStreamOggVorbis = imported.duplicate() if imported != null else null
        if stream == null:
            push_error("Cannot decode original Saihoji music: " + key)
            continue
        stream.loop = key == "fleet"
        var player := AudioStreamPlayer.new()
        player.name = "OriginalMusic_" + key
        player.stream = stream
        player.bus = "BGM"
        player.volume_db = -60.0
        add_child(player)
        players[key] = player
    if AudioServer.get_bus_index("SFX") < 0:
        AudioServer.add_bus()
        AudioServer.set_bus_name(AudioServer.bus_count - 1, "SFX")
    for key in ["phalanx_alarm", "kun_step"]:
        effect_streams[key] = load("res://assets/audio/saihoji/" + key + ".wav") as AudioStreamWAV

func play_effect(key: String, position: Vector3) -> void:
    if muted or not effect_streams.has(key): return
    if key == "phalanx_alarm" and alarm_played: return
    var now := Time.get_ticks_msec()
    if now < int(effect_cooldowns.get(key, 0)): return
    effect_cooldowns[key] = now + (500 if key == "kun_step" else 100)
    if key == "phalanx_alarm": alarm_played = true
    var player: AudioStreamPlayer3D
    for existing in effects:
        if not existing.playing: player = existing; break
    if not player:
        if effects.size() >= 8: return
        player = AudioStreamPlayer3D.new()
        player.bus = "SFX"
        player.unit_size = 12.0
        player.max_distance = 180.0
        add_child(player)
        effects.append(player)
    player.stream = effect_streams[key]
    player.global_position = position
    player.play()

func cue() -> void:
    if started.get("cue", false) or started.get("battle", false): return
    battle_owns_music = true
    _fade("fleet", 0.0, 0.45, true)
    _play_once("cue", 0.52)

func begin_battle() -> void:
    battle_owns_music = true
    _fade("cue", 0.0, 0.4, true)
    _fade("fleet", 0.0, 0.45, true)
    _play_once("battle", 0.5)

func set_fleet_active(value: bool) -> void:
    fleet_wanted = value
    if not value or battle_owns_music:
        _fade("fleet", 0.0, 0.45, true)
    elif players.has("fleet"):
        if not players.fleet.playing: players.fleet.play()
        players.fleet.stream_paused = muted
        _fade("fleet", 0.46, 0.6)
        music_changed.emit("fleet")

func end_battle() -> void:
    battle_owns_music = false
    _fade("cue", 0.0, 0.35, true)
    _fade("battle", 0.0, 1.2, true)
    set_fleet_active(fleet_wanted)

func reset() -> void:
    for tween in fades.values():
        if tween: tween.kill()
    fades.clear()
    for player in players.values():
        player.stop()
        player.volume_db = -60.0
    started.clear()
    for player in effects: player.stop()
    effect_cooldowns.clear()
    alarm_played = false
    battle_owns_music = false
    fleet_wanted = false
    music_changed.emit("silence")

func set_muted(value: bool) -> void:
    muted = value
    # Per-node mute; do not change other Godot scenes' music bus state.
    for player in players.values(): player.stream_paused = value
    for player in effects: player.stream_paused = value

func _play_once(key: String, gain: float) -> void:
    if started.get(key, false) or not players.has(key): return
    started[key] = true
    players[key].play()
    players[key].stream_paused = muted
    _fade(key, gain, 0.6)
    music_changed.emit(key)

func _fade(key: String, gain: float, seconds: float, stop_after := false) -> void:
    if not players.has(key): return
    if fades.has(key) and fades[key]: fades[key].kill()
    var player: AudioStreamPlayer = players[key]
    var tween := create_tween()
    fades[key] = tween
    tween.tween_property(player, "volume_db", linear_to_db(maxf(gain, 0.001)), seconds)
    if stop_after: tween.tween_callback(player.stop)

func _exit_tree() -> void:
    reset()
