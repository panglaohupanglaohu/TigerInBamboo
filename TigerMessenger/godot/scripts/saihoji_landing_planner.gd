extends RefCounted
## Explicit layout improvement: berth stays at the original point; land slots use
## one connected dry patch of the existing terrain. Never creates or lifts land.
var cells: Dictionary = {}
var available: Array[Vector3] = []
var occupied: Array[Vector3] = []
var report: Dictionary = {}

func build(world: World3D, center: Vector3, radius := 30.0, spacing := 1.25) -> Dictionary:
    cells.clear(); available.clear(); occupied.clear()
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
            cells[Vector2i(x, y)] = point + direction * 0.22
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
    report = {"sampled": sampled, "dry_cells": cells.size(), "connected_cells": available.size(),
        "components": components.size(), "geometry_changed": false, "sea_radius": 160.5,
        "min_ground_radius": 160.607, "foot_offset": 0.22, "assigned": 0, "unassigned": 0,
        "layout_revision": "Existing dry terrain slots; original berth preserved"}
    return report

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
