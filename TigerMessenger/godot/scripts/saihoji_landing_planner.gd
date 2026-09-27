extends RefCounted
## Explicit layout improvement: berth stays at the original point; land slots use
## one connected dry patch of the existing terrain. Never creates or lifts land.
var cells: Dictionary = {}
var available: Array[Vector3] = []
var occupied: Array[Vector3] = []
var report: Dictionary = {}
var available_cells: Dictionary = {}
var route_report: Dictionary = {}
var grid_spacing := 1.25
var body_blocked:=Callable()
var edge_clear_cache:Dictionary={}

func build(world: World3D, center: Vector3, radius := 30.0, spacing := 1.25, blocker:=Callable()) -> Dictionary:
    cells.clear(); available.clear(); occupied.clear(); available_cells.clear(); route_report.clear()
    grid_spacing = spacing
    body_blocked=blocker
    edge_clear_cache.clear()
    var blocked_cells:=0
    var up := center.normalized()
    var east := Vector3.UP.cross(up).normalized()
    var north := up.cross(east).normalized()
    var extent := int(ceil(radius / spacing))
    var sampled := 0
    for x in range(-extent, extent + 1):
        for y in range(-extent, extent + 1):
            if Vector2(x, y).length() * spacing > radius: continue
            var direction := (up * 160.0 + east * x * spacing + north * y * spacing).normalized()
            var query := PhysicsRayQueryParameters3D.create(direction * 174.0, direction * 150.0)
            var hit := world.direct_space_state.intersect_ray(query)
            sampled += 1
            if hit.is_empty(): continue
            var point: Vector3 = hit.position
            # 0.5 sea + 0.067 original maximum wave + 0.04 clearance.
            if point.length() < 160.607: continue
            if absf(Vector3(hit.normal).dot(direction)) < cos(deg_to_rad(32.0)): continue
            var feet:=point+direction*0.22
            if body_blocked.is_valid() and body_blocked.call(feet):
                blocked_cells+=1;continue
            cells[Vector2i(x, y)] = feet
    # Four-neighbour components avoid assigning troops across an intervening inlet.
    var remaining := cells.duplicate()
    var components: Array = []
    while not remaining.is_empty():
        var frontier: Array = [remaining.keys()[0]]
        remaining.erase(frontier[0])
        var component: Array[Vector3] = []
        var cursor := 0
        while cursor < frontier.size():
            var key: Vector2i = frontier[cursor]
            cursor += 1
            component.append(cells[key])
            for offset in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
                var next: Vector2i = key + offset
                if not remaining.has(next): continue
                if cells[key].distance_to(cells[next]) > spacing * 1.5: continue
                if not _edge_clear(cells[key],cells[next]):continue
                remaining.erase(next)
                frontier.append(next)
        components.append(component)
    # Reject tiny boulders; choose the nearest patch large enough for the defenders.
    var best_distance := INF
    for component in components:
        if component.size() < 60: continue
        var nearest := INF
        for point in component:
            nearest = minf(nearest, point.distance_to(up * 160.8))
        if nearest < best_distance:
            best_distance = nearest
            available.assign(component)
    var selected_points: Dictionary = {}
    for point in available: selected_points[point] = true
    for key in cells:
        if selected_points.has(cells[key]): available_cells[key] = cells[key]
    report = {"sampled": sampled, "trunk_blocked_cells":blocked_cells, "dry_cells": cells.size(), "connected_cells": available.size(),
        "components": components.size(), "geometry_changed": false, "sea_radius": 160.5,
        "min_ground_radius": 160.607, "foot_offset": 0.22, "assigned": 0, "unassigned": 0,
        "layout_revision": "Existing dry terrain slots; original berth preserved"}
    return report

## Returns only sampled dry-ground points, including the projected endpoints.
## The caller owns the ship/ramp-to-first-point transition; it must not treat
## the projection distance as a verified walkable segment across water.
func route(start: Vector3, finish: Vector3) -> Array[Vector3]:
    var result: Array[Vector3] = []
    route_report = {"found":false,"points":0,"scope":"four-neighbour dry ground with optional measured trunk clearance; ramp transition and dynamic obstacle avoidance excluded"}
    if not start.is_finite() or not finish.is_finite() or available_cells.is_empty():
        route_report.reason = "invalid endpoints or no connected dry cells"
        return result
    var start_key: Vector2i = available_cells.keys()[0]
    var end_key := start_key
    var start_distance := INF
    var end_distance := INF
    for key in available_cells:
        var point: Vector3 = available_cells[key]
        var ds := point.distance_squared_to(start)
        var de := point.distance_squared_to(finish)
        if ds < start_distance: start_distance = ds; start_key = key
        if de < end_distance: end_distance = de; end_key = key
    route_report.start_projection_distance = sqrt(start_distance)
    route_report.end_projection_distance = sqrt(end_distance)
    var frontier: Array[Vector2i] = [start_key]
    var previous: Dictionary = {start_key:start_key}
    var cursor := 0
    while cursor < frontier.size():
        var key := frontier[cursor]; cursor += 1
        if key == end_key: break
        for offset in [Vector2i.LEFT,Vector2i.RIGHT,Vector2i.UP,Vector2i.DOWN]:
            var next: Vector2i = key + offset
            if previous.has(next) or not available_cells.has(next): continue
            if available_cells[key].distance_to(available_cells[next]) > grid_spacing*1.5: continue
            if not _edge_clear(available_cells[key],available_cells[next]):continue
            previous[next] = key; frontier.append(next)
    if not previous.has(end_key):
        route_report.reason = "no dry four-neighbour route"
        return result
    var key := end_key
    while true:
        result.append(available_cells[key])
        if key == start_key: break
        key = previous[key]
    result.reverse()
    route_report.found = true; route_report.points = result.size()
    return result

func reserve(requested: Vector3) -> Vector3:
    var best := Vector3.ZERO
    var distance := INF
    for point in available:
        var candidate_distance := requested.distance_squared_to(point)
        if candidate_distance >= distance: continue
        var blocked := false
        for used in occupied:
            if point.distance_squared_to(used) < 1.0:
                blocked = true
                break
        if blocked: continue
        distance = candidate_distance
        best = point
    if best == Vector3.ZERO:
        report.unassigned += 1
        return Vector3.ZERO # Caller must expose failure, never silently place in water.
    occupied.append(best)
    report.assigned += 1
    return best

func release_all() -> void:
    occupied.clear()
    report.assigned = 0
    report.unassigned = 0

func _edge_clear(a:Vector3,b:Vector3)->bool:
    if not body_blocked.is_valid():return true
    var key:=[a,b]
    if edge_clear_cache.has(key):return edge_clear_cache[key]
    # Static trees: cache verified edges for all 50 route queries in this build.
    var clear:=true
    for t in [0.25,0.5,0.75]:
        if body_blocked.call(a.lerp(b,t)):
            clear=false;break
    edge_clear_cache[key]=clear;edge_clear_cache[[b,a]]=clear
    return clear
