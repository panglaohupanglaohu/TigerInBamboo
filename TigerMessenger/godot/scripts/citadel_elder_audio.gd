extends Node
# Inspection worlds use the active camera as their audio listener.
var city:Node3D
var listener:Node3D
var music:AudioStreamPlayer
func bind(source:Node3D,ear:Node3D)->void:
    city=source;listener=ear
    music=AudioStreamPlayer.new();music.name="CitadelElderBGM"
    music.stream=load("res://assets/audio/citadel/elder-remembrance.ogg")
    add_child(music)
func update_listener(point:Vector3)->void:
    if not is_instance_valid(city) or music==null:return
    var distance=point.distance_to(city.to_global(Vector3(60,4,71.5)))
    if distance>200 or not city.is_visible_in_tree():
        if music.playing:music.stop()
        return
    music.volume_db=linear_to_db(maxf(0.0001,0.5*clampf((200-distance)/10,0,1)))
    if not music.playing:music.play()
    elif music.get_playback_position()>=349:music.seek(0)
func _process(_dt:float)->void:
    if is_instance_valid(listener):update_listener(listener.global_position)
