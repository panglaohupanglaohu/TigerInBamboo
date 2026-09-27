extends SceneTree
var checks:Array=[]
func check(label:String,condition:bool)->void:
    checks.append({"name":label,"passed":condition})
func _initialize()->void:call_deferred("run")
func run()->void:
    var world=load("res://scenes/original_world.tscn").instantiate()
    root.add_child(world)
    await process_frame
    var audio=world.citadel_audio
    if audio==null:push_error("Missing scene audio binding");quit(1);return
    audio.set_process(false)
    var center=audio.city.to_global(Vector3(60,4,71.5))
    var source=Node3D.new();world.add_child(source);source.global_position=center
    audio.update_listener(center)
    await process_frame
    check("regional starts within 30",audio.music_owner=="elder" and audio.music.playing and not audio.music.stream_paused)
    world.citadel_music_event.emit("siege",true,source)
    check("real scene signal switches to original siege track",audio.music_owner=="siege" and audio.music.stream_paused and audio.players.siege.playing)
    world.citadel_music_event.emit("infiltration",true,source)
    check("infiltration takes over without siege overlap",audio.music_owner=="infiltration" and audio.players.siege.stream_paused)
    world.citadel_music_event.emit("infiltration",false,source)
    check("ending infiltration restores still active siege",audio.music_owner=="siege")
    audio.update_listener(center+Vector3(100,0,0))
    check("leaving event range silences all",audio.music_owner=="" and audio.players.siege.stream_paused)
    audio.update_listener(center)
    check("returning resumes active event",audio.music_owner=="siege")
    world.citadel_music_reset.emit()
    check("reset restores regional only",audio.music_owner=="elder" and not audio.players.siege.playing)
    audio.update_listener(center+Vector3(30,0,0))
    check("30m boundary excludes regional music",audio.music_owner=="")
    audio.update_listener(center)
    audio.set_muted(true);check("mute silences regional",audio.music_owner=="" and audio.music.stream_paused)
    audio.set_muted(false)
    world.citadel_music_event.emit("siege",true,source)
    source.free();audio.update_listener(center)
    check("deleted event source releases ownership",audio.music_owner=="elder")
    var passed=true
    for item in checks:passed=passed and item.passed
    var file=FileAccess.open("res://../artifacts/pipeline/citadel-coastal-tram-target/godot-event-audio-check.json",FileAccess.WRITE)
    file.store_string(JSON.stringify({"passed":passed,"checks":checks,"scope":"Actual original_world signal/controller wiring and imported audio streams. No complete Godot siege gameplay trigger exists yet."},"  "))
    print(JSON.stringify({"passed":passed,"checks":checks}))
    world.queue_free();await process_frame;quit(0 if passed else 1)
