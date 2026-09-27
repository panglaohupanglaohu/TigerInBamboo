extends Node
## Local regional music and explicit story-event ownership. No proximity-started battles.
signal owner_changed(key:String)
const MUSIC_RANGE:float=30.0
const EVENT_RANGE:float=70.0
const TRACKS={"siege":"res://assets/audio/citadel/siege.ogg","infiltration":"res://assets/audio/citadel/infiltration.ogg"}
var city:Node3D
var listener:Node3D
var music:AudioStreamPlayer
var events:Dictionary={}
var players:Dictionary={}
var music_owner:String=""
var muted:bool=false
var last_point:Vector3
var has_listener:bool=false
func bind(source:Node3D,ear:Node3D)->void:
    city=source;listener=ear
    music=AudioStreamPlayer.new();music.name="CitadelElderBGM"
    music.stream=load("res://assets/audio/citadel/elder-remembrance.ogg")
    add_child(music);players["elder"]=music
    for key in TRACKS:
        var player=AudioStreamPlayer.new()
        player.name="CitadelEvent_"+key
        var imported=load(TRACKS[key])
        if imported==null:
            push_error("Missing citadel event track: "+key)
            player.free()
            continue
        var stream=imported.duplicate()
        stream.loop=true
        player.stream=stream;add_child(player);players[key]=player
func set_event(key:String,active:bool,source:Node3D=null)->bool:
    if not players.has(key):return false
    if active:
        if not is_instance_valid(source):return false
        events[key]=weakref(source)
    else:
        events.erase(key)
        players[key].stop()
    _refresh()
    return true
func reset_events()->void:
    events.clear()
    for key in TRACKS:
        if players.has(key):players[key].stop()
    _refresh()
func set_muted(value:bool)->void:
    muted=value;_refresh()
func _refresh()->void:
    if has_listener:update_listener(last_point)
func update_listener(point:Vector3)->void:
    last_point=point;has_listener=true
    if not is_instance_valid(city) or music==null:
        for player in players.values():player.stop()
        music_owner=""
        return
    var distance=point.distance_to(city.to_global(Vector3(60,4,71.5)))
    var next:String=""
    if not muted and city.is_visible_in_tree():
        if distance<MUSIC_RANGE:next="elder"
        # Explicit handoff: infiltration outranks siege, both outrank regional music.
        for key in ["siege","infiltration"]:
            if not events.has(key):continue
            var source=events[key].get_ref()
            if not is_instance_valid(source):
                events.erase(key);continue
            if source.is_visible_in_tree() and point.distance_to(source.global_position)<=EVENT_RANGE:next=key
    for key in players:
        var player=players[key]
        if key!=next:
            if player.playing:player.stream_paused=true
        else:
            player.stream_paused=false
            player.volume_db=linear_to_db(maxf(0.0001,0.5*clampf((MUSIC_RANGE-distance)/5,0,1))) if key=="elder" else -6.0
            if not player.playing:player.play()
            if key=="elder" and player.get_playback_position()>=349:player.seek(0)
    if next!=music_owner:music_owner=next;owner_changed.emit(music_owner)
func _process(_dt:float)->void:
    if is_instance_valid(listener):update_listener(listener.global_position)
func _exit_tree()->void:
    for player in players.values():player.stop()
    events.clear()
