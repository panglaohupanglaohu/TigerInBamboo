extends SceneTree
var failures: Array[String] = []
var events: Array[String] = []
var checks := 0

func check(value: bool, message: String) -> void:
    checks += 1
    if not value: failures.append(message)

func _initialize() -> void:
    call_deferred("run")

func run() -> void:
    var audio = load("res://scripts/saihoji_battle_audio.gd").new()
    root.add_child(audio)
    audio.music_changed.connect(func(track: String): events.append(track))
    check(audio.players.size() == 3, "Three original music streams load")
    for player in audio.players.values():
        check(player.stream.get_length() > 1.0, "Original music decodes with real duration")
    check(audio.effect_streams.size() == 2, "Original alarm and descent cues decode")
    audio.play_effect("phalanx_alarm", Vector3.ZERO)
    audio.play_effect("phalanx_alarm", Vector3.ZERO)
    check(audio.alarm_played and audio.effects.size() == 1, "Alarm is once per cycle")
    audio.set_fleet_active(true)
    check(audio.players.fleet.playing, "Fleet music starts outside Saihoji")
    audio.cue()
    audio.cue()
    check(events.count("cue") == 1, "Repeated cue does not restart playback")
    audio.begin_battle()
    for i in range(120): audio.begin_battle()
    check(events.count("battle") == 1, "Per-frame battle intent cannot restart track")
    check(not audio.players.battle.stream.loop, "Battle soundtrack plays once")
    var fleet_events := events.count("fleet")
    audio.set_fleet_active(true)
    check(events.count("fleet") == fleet_events, "Fleet cannot take music ownership during battle")
    audio.set_muted(true)
    check(audio.players.battle.stream_paused, "User mute applies to battle")
    audio.set_muted(false)
    audio.reset()
    check(not audio.alarm_played, "Reset rearms positional alarm")
    for player in audio.players.values(): check(not player.playing, "Reset stops all music")
    audio.cue()
    check(events.count("cue") == 2, "New cycle rearms cue")
    audio.reset()
    var result := {"checks": checks, "failures": failures, "passed": failures.is_empty(), "scope": "Native stream load, music ownership, repeat prevention, mute and reset. Headless test; listening review still required."}
    audio.queue_free()
    await process_frame
    # Let the audio mixing thread release stopped playback resources before exit.
    await create_timer(0.15).timeout
    print(JSON.stringify(result))
    quit(0 if failures.is_empty() else 1)
