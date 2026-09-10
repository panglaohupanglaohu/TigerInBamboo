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
    var result := {"frames":301,"grips":52,"max_world_grip_error":max_error,"max_stow_error":max_stow_error,"failures":failures,"boarding_route_validated":false}
    print(JSON.stringify(result))
    var args := OS.get_cmdline_user_args()
    if not args.is_empty():
        var out := FileAccess.open(args[0],FileAccess.WRITE)
        out.store_string(JSON.stringify(result,"  "))
    ship.queue_free()
    quit(0 if failures.is_empty() else 1)
