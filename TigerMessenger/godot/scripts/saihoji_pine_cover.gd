extends RefCounted
## Actual static crown projection, not AI visibility/line-of-sight concealment.
var candidates: Array[Dictionary] = []
var occupied: Array[Vector3] = []
var report: Dictionary = {}

func build(static_root: Node3D, moving_kun: Node3D, dry_points: Array[Vector3], body_radius := 0.38) -> Dictionary:
    candidates.clear(); occupied.clear()
    report = {"static_trees": 0, "crowns": 0, "dry_cells": dry_points.size(), "capacity": 0, "assigned": 0, "unassigned": 0, "moving_kun_excluded": true, "scope": "tree crown projection and conservative trunk clearance; enemy line of sight not tested"}
    if not is_instance_valid(static_root) or moving_kun.is_ancestor_of(static_root):
        report["error"] = "static surroundings unavailable or parented to Kun"
        return report
    var trees: Dictionary = {}
    for node in static_root.find_children("*", "MeshInstance3D", true, false):
        if not node.is_visible_in_tree() or moving_kun.is_ancestor_of(node): continue
        var name_text := str(node.name)
        if not name_text.contains("_crown_") and not name_text.contains("_trunk_"): continue
        var key := str(node.get_parent().get_path())
        if not trees.has(key): trees[key] = {"crowns": [], "trunks": []}
        var vertices: PackedVector3Array = node.mesh.get_faces()
        var transformed := PackedVector3Array()
        for v in vertices: transformed.append(node.global_transform * v)
        if name_text.contains("_crown_"):
            trees[key].crowns.append(transformed); report.crowns += 1
        else: trees[key].trunks.append(transformed)
    report.static_trees = trees.size()
    var all_trunks: Array = []
    for tree in trees.values(): all_trunks.append_array(tree.trunks)
    for point in dry_points:
        var up := point.normalized()
        var east := Vector3.UP.cross(up).normalized()
        var north := up.cross(east).normalized()
        var blocked := false
        for trunk in all_trunks:
            # Whole low trunk footprint plus body radius is conservative at bends.
            var low := Vector2(INF, INF)
            var high := Vector2(-INF, -INF)
            for v in trunk:
                var delta: Vector3 = v - point
                if delta.dot(up) < -1.0 or delta.dot(up) > 1.8: continue
                var q := Vector2(delta.dot(east), delta.dot(north))
                low = low.min(q); high = high.max(q)
            if low.x != INF and low.x - body_radius <= 0 and high.x + body_radius >= 0 and low.y - body_radius <= 0 and high.y + body_radius >= 0: blocked = true
        if blocked: continue
        for key in trees:
            var covered := false
            for crown in trees[key].crowns:
                for i in range(0, crown.size(), 3):
                    var a: Vector3 = crown[i] - point
                    var b: Vector3 = crown[i+1] - point
                    var c: Vector3 = crown[i+2] - point
                    if minf(a.dot(up), minf(b.dot(up), c.dot(up))) < 0.7: continue
                    if _in_triangle(Vector2(a.dot(east), a.dot(north)), Vector2(b.dot(east), b.dot(north)), Vector2(c.dot(east), c.dot(north))):
                        covered = true; break
                if covered: break
            if covered:
                candidates.append({"position": point, "tree": key, "body_radius": body_radius}); break
    report.capacity = candidates.size()
    report.shortfall_for_fifty = maxi(0, 50 - candidates.size())
    return report

func reserve(requested: Vector3, unavailable: Array[Vector3] = []) -> Vector3:
    var best := Vector3.ZERO
    var distance := INF
    for row in candidates:
        var point: Vector3 = row.position
        if point.distance_squared_to(requested) >= distance: continue
        var blocked := false
        for used in occupied + unavailable:
            if point.distance_squared_to(used) < 1.0: blocked = true; break
        if blocked: continue
        best = point; distance = point.distance_squared_to(requested)
    if best == Vector3.ZERO: report.unassigned += 1
    else: occupied.append(best); report.assigned += 1
    return best

func release_all() -> void:
    occupied.clear(); report.assigned = 0; report.unassigned = 0

func _in_triangle(a: Vector2, b: Vector2, c: Vector2) -> bool:
    var area := (b-a).cross(c-a)
    if absf(area) < 0.000001: return false
    var u := b.cross(c) / area
    var v := c.cross(a) / area
    var w := a.cross(b) / area
    return u >= 0 and v >= 0 and w >= 0
