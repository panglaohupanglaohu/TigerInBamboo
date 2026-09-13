extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var audio=w.get_node("CitadelElderRegionAudio");audio.set_process(false)
    var center=audio.city.to_global(Vector3(60,4,71.5))
    audio.update_listener(center+Vector3(201,0,0));var outside=not audio.music.playing
    audio.update_listener(center+Vector3(190,0,0));var inside=audio.music.playing
    audio.update_listener(center+Vector3(201,0,0));var exit=not audio.music.playing
    var result={"passed":outside and inside and exit,"outside":outside,"inside":inside,"exit":exit,"scope":"Godot inspection camera listener, exact same 200m region; not full native battle music arbitration."}
    FileAccess.open("res://../artifacts/pipeline/citadel-round-pedestal/audio-godot.json",FileAccess.WRITE).store_string(JSON.stringify(result,"  "))
    print(JSON.stringify(result));w.free();quit(0 if result.passed else 1)
