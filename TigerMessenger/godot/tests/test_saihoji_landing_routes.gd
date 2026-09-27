extends SceneTree
var errors: Array[String] = []
var count := 0
func check(ok: bool, label: String) -> void:
    count += 1
    if not ok: errors.append(label)
func _initialize() -> void:
    var planner = load("res://scripts/saihoji_landing_planner.gd").new()
    planner.grid_spacing = 1.0
    # A U-shaped shoreline: direct movement from left to right crosses water.
    for key in [Vector2i(0,0),Vector2i(0,1),Vector2i(0,2),Vector2i(1,2),Vector2i(2,2),Vector2i(2,1),Vector2i(2,0)]:
        planner.available_cells[key] = Vector3(key.x,160.8,key.y)
    var path: Array[Vector3] = planner.route(Vector3(0,161.0,0),Vector3(2,160.8,0))
    check(path.size()==7,"shore detour uses all seven dry points")
    check(path.size()>0 and path[0]==Vector3(0,160.8,0) and path[-1]==Vector3(2,160.8,0),"endpoints projected onto actual cells")
    check(absf(planner.route_report.start_projection_distance-0.2)<0.0001,"projection distance exposed for ramp validation")
    for i in range(1,path.size()): check(absf(path[i].distance_to(path[i-1])-1.0)<0.0001,"route cannot skip water or diagonal corners")
    planner.available_cells[Vector2i(4,0)] = Vector3(4,160.8,0)
    check(planner.route(Vector3(0,160.8,0),Vector3(4,160.8,0)).is_empty(),"disconnected destination cannot be jumped")
    planner.available_cells={Vector2i(0,0):Vector3(0,160.8,0),Vector2i(1,0):Vector3(1,164.0,0)}
    check(planner.route(Vector3(0,160.8,0),Vector3(1,164.0,0)).is_empty(),"steep adjacent cell cannot be traversed")
    check(planner.route(Vector3(NAN,0,0),Vector3.ZERO).is_empty(),"nonfinite endpoints rejected")
    check(planner.route(Vector3(0,160.8,0),Vector3(0,160.8,0)).size()==1,"same cell yields one waypoint")
    planner.available_cells.clear()
    check(planner.route(Vector3.ZERO,Vector3.ONE).is_empty(),"missing terrain returns no route")
    print(JSON.stringify({"passed":errors.is_empty(),"checks":count,"errors":errors,"scope":"synthetic shoreline connectivity, not a real ship ramp traversal"}))
    quit(0 if errors.is_empty() else 1)
