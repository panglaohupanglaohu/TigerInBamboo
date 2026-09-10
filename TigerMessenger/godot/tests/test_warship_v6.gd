extends SceneTree
var failures: Array[String] = []
func _initialize() -> void: call_deferred("run")
func check(ok: bool, label: String) -> void:
    if not ok: failures.append(label)
func run() -> void:
    var adapter = load("res://scripts/saihoji_warship_adapter.gd").new()
    check(adapter.load_data(), "assembly loaded")
    var ship: Node3D = load(adapter.MODEL).instantiate()
    root.add_child(ship)
    ship.transform = Transform3D(Basis(Vector3(0.2,0.7,0.1).normalized(),0.8).scaled(Vector3.ONE*1.7),Vector3(12,140,-28))
    var row: Dictionary = adapter.bind(ship)
    check(not row.is_empty(), "actual GLB binding")
    if row.is_empty(): quit(1); return
    check(row.ids["n220"].get_child_count()==26,"26 original rowers")
    var max_error := 0.0
    var max_stow_error := 0.0
    var stow: Transform3D = adapter._transform(adapter.data.boarding.stowedMatrix)
    for frame in range(301):
        adapter.apply_frame(row,frame)
        for grip in adapter.data.grips:
            var p: Array = grip.point
            var target: Vector3 = row.ids[grip.oar].to_global(Vector3(p[0],p[1],p[2]))
            max_error = maxf(max_error,target.distance_to(row.ids[grip.hand].global_position))
        var hinge: Transform3D = row.ids["add:boarding-hinge"].transform
        max_stow_error = maxf(max_stow_error,hinge.origin.distance_to(stow.origin)+hinge.basis.x.distance_to(stow.basis.x)+hinge.basis.y.distance_to(stow.basis.y)+hinge.basis.z.distance_to(stow.basis.z))
    check(max_error<0.0001,"all 301 saved poses hands retain grips")
    check(max_stow_error<0.0001,"boarding board remains flat stowed")
    adapter.set_crew_embarked(row,0,false,"blue-0-0")
    check(not row.ids["n220:i0"].visible,"same soldier no longer appears at oar seat when ashore")
    check(row.ids["n220:i25"].visible,"shipkeeper remains aboard")
    var owned_weapons := 0
    for key in row.ids:
        var extras: Dictionary = row.ids[key].get_meta("extras",{})
        if int(extras.get("warship_crew_index",-1)) == 0:
            owned_weapons += 1
            check(not row.ids[key].visible,"departing soldier takes stored weapon")
    check(owned_weapons>0,"actual stored weapon meshes are assigned to seat0")
    adapter.set_crew_embarked(row,0,true,"blue-0-0")
    check(row.ids["n220:i0"].visible and row.crew_identity[0]=="blue-0-0","return preserves soldier identity")
    # Isolate each owner's four stages against every other visible mesh.
    var stage_cases := 0
    for seat in range(25):
        var other_visibility: Dictionary = {}
        var own_keys: Array[String] = []
        for part in range(220,231): own_keys.append("n%d:i%d" % [part,seat])
        for part in ["forearm", "hand"]:
            for side in ["L","R"]: own_keys.append("add:%s-%d%s" % [part,seat,side])
        var weapon_keys: Array[String] = []
        for key in row.ids:
            var extras: Dictionary = row.ids[key].get_meta("extras",{})
            if int(extras.get("warship_crew_index",-1)) == seat: weapon_keys.append(key)
            elif key not in own_keys: other_visibility[key] = row.ids[key].visible
        check(not weapon_keys.is_empty(), "seat%d has its own stored weapon" % seat)
        for stage in ["seated", "deck-unarmed", "deck-armed", "ashore", "seated"]:
            check(adapter.set_crew_stage(row,seat,stage,"blue-0-%d" % seat), "seat%d accepts %s" % [seat,stage])
            adapter.apply_frame(row,65)
            for key in own_keys:
                if row.ids.has(key): check(row.ids[key].visible == (stage == "seated"), "%s body stage %s" % [key,stage])
            for key in weapon_keys:
                check(row.ids[key].visible == (stage in ["seated","deck-unarmed"]), "%s weapon stage %s" % [key,stage])
                check(row.ids[key].get_meta("soldier_identity","") == "blue-0-%d" % seat, "%s keeps ownership" % key)
            for key in other_visibility:
                check(row.ids[key].visible == other_visibility[key], "seat%d leaves %s untouched during %s" % [seat,key,stage])
            check(row.crew_identity[seat] == "blue-0-%d" % seat, "identity persists across stages")
            stage_cases += 1
    var before: Dictionary = row.crew_stage.duplicate()
    var identity_before: Dictionary = row.crew_identity.duplicate()
    var visibility_before: Dictionary = {}
    for key in row.ids: visibility_before[key] = row.ids[key].visible
    check(not adapter.set_crew_stage(row,0,"flying","wrong-identity"), "invalid stage rejected")
    check(not adapter.set_crew_stage(row,-1,"seated","wrong-identity"), "negative seat rejected")
    check(not adapter.set_crew_stage(row,26,"seated","wrong-identity"), "out of range seat rejected")
    for stage in ["deck-unarmed","deck-armed","ashore"]:
        check(not adapter.set_crew_stage(row,25,stage,"wrong-identity"), "shipkeeper cannot leave: " + stage)
    check(row.crew_stage == before and row.crew_identity == identity_before, "rejected requests do not mutate stage or identity")
    for key in visibility_before: check(row.ids[key].visible == visibility_before[key], "rejected requests leave " + key)
    adapter.set_crew_stage(row,0,"deck-unarmed")
    check(row.crew_identity[0] == "blue-0-0", "omitted identity retains binding")
    adapter.set_crew_embarked(row,0,true)
    check(row.crew_stage[0] == "seated", "legacy embark delegates to seated")
    adapter.set_crew_embarked(row,0,false)
    check(row.crew_stage[0] == "ashore", "legacy disembark delegates to ashore")
    var result := {"asset":"warship-battle-v11","stage_cases":stage_cases,"stages":["seated","deck-unarmed","deck-armed","ashore"],"standing_actor_motion_validated":false,"frames":301,"grips":52,"max_world_grip_error":max_error,"max_stow_error":max_stow_error,"failures":failures,"boarding_route_validated":false}
    print(JSON.stringify(result))
    var args := OS.get_cmdline_user_args()
    if not args.is_empty():
        var out := FileAccess.open(args[0],FileAccess.WRITE)
        out.store_string(JSON.stringify(result,"  "))
    ship.queue_free()
    quit(0 if failures.is_empty() else 1)
