extends SceneTree
## Real mixer capture, muted only inside this isolated test process.
var results: Array = []
func _initialize() -> void:
    call_deferred("run")

func run() -> void:
    AudioServer.set_bus_mute(0, true)
    var music = load("res://scripts/saihoji_battle_audio.gd").new()
    root.add_child(music)
    var capture := AudioEffectCapture.new()
    capture.buffer_length = 5.0
    var bus := AudioServer.get_bus_index("BGM")
    AudioServer.add_bus_effect(bus, capture)
    for key in ["fleet", "cue", "battle"]:
        music.reset()
        capture.clear_buffer()
        match key:
            "fleet": music.set_fleet_active(true)
            "cue": music.cue()
            "battle": music.begin_battle()
        await create_timer(3.0).timeout
        var samples := capture.get_buffer(capture.get_frames_available())
        var peak := 0.0
        var energy := 0.0
        for sample in samples:
            peak = maxf(peak, maxf(absf(sample.x), absf(sample.y)))
            energy += sample.length_squared()
        var rms := sqrt(energy / maxf(1.0, samples.size() * 2.0))
        results.append({"track": key, "frames": samples.size(), "peak": peak, "rms": rms,
            "passed": samples.size() > 1000 and rms > 0.00001 and peak < 1.0})
    music.reset()
    await create_timer(0.5).timeout
    capture.clear_buffer()
    await create_timer(0.2).timeout
    var tail := capture.get_buffer(capture.get_frames_available())
    var tail_peak := 0.0
    for sample in tail: tail_peak = maxf(tail_peak, maxf(absf(sample.x), absf(sample.y)))
    var passed := results.all(func(row): return row.passed) and tail_peak < 0.00001
    print(JSON.stringify({"passed":passed,"tracks":results,"reset_tail_peak":tail_peak,
        "audio_driver":AudioServer.get_driver_name(),"scope":"First 3 seconds per source track: real BGM bus samples, clipping and reset silence; not subjective listening acceptance"}))
    AudioServer.remove_bus_effect(bus, 0)
    music.queue_free()
    await create_timer(0.4).timeout
    quit(0 if passed else 1)
