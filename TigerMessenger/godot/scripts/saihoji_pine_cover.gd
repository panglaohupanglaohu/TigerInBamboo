extends RefCounted
## Actual static crown projection, not AI visibility/line-of-sight concealment.
var candidates: Array[Dictionary] = []
var occupied: Array[Vector3] = []
var report: Dictionary = {}
var trunk_triangles:Array=[]
var trunk_bounds:Array[AABB]=[]

func build(static_root: Node3D, moving_kun: Node3D, dry_points: Array[Vector3], body_radius := 0.38) -> Dictionary:
    candidates.clear(); occupied.clear()
    report = {"static_trees": 0, "crowns": 0, "dry_cells": dry_points.size(), "capacity": 0, "assigned": 0, "unassigned": 0, "moving_kun_excluded": true, "scope": "actual crown ray clearance >=1.22m; trunk triangles and 1m packing; enemy line of sight not tested"}
    if not is_instance_valid(static_root) or moving_kun.is_ancestor_of(static_root):
        report["error"] = "static surroundings unavailable or parented to Kun"
        return report
    var trees: Dictionary = {}
    for node in static_root.find_children("*", "MeshInstance3D", true, false):
        if not node.is_visible_in_tree() or moving_kun.is_ancestor_of(node): continue
        var name_text := str(node.name)
        var is_crown := name_text.contains("_crown_")
        var is_trunk := name_text.contains("_trunk_")
        var tree_root: Node = node.get_parent()
        # v3 reuses the real optimized GLBs: material batches n8/n9 are
        # trunk/branches, n10/n11/n12 are the three foliage shades. Resolve
        # those only below the explicitly named pine holder, never arbitrary n10.
        var holder: Node = node.get_parent()
        while holder!=null and holder!=static_root and not str(holder.name).contains("_original_pine_"):
            holder=holder.get_parent()
        if holder!=null and holder!=static_root:
            tree_root=holder
            var batch := name_text.get_slice(".",0).get_slice("_",0)
            is_crown = is_crown or batch in ["n10","n11","n12"]
            is_trunk = is_trunk or batch in ["n8","n9"]
        if not is_crown and not is_trunk: continue
        var key := str(tree_root.get_path())
        if not trees.has(key): trees[key] = {"crowns": [], "trunks": []}
        var vertices: PackedVector3Array = node.mesh.get_faces()
        var transformed := PackedVector3Array()
        for v in vertices: transformed.append(node.global_transform * v)
        if is_crown:
            trees[key].crowns.append(transformed); report.crowns += 1
        else: trees[key].trunks.append(transformed)
    report.static_trees = trees.size()
    trunk_triangles.clear();trunk_bounds.clear()
    for tree in trees.values():trunk_triangles.append_array(tree.trunks)
    for trunk in trunk_triangles:
        var bounds:=AABB(trunk[0],Vector3.ZERO)
        for vertex in trunk:bounds=bounds.expand(vertex)
        trunk_bounds.append(bounds)
    for point in dry_points:
        var up := point.normalized()
        if blocks_body(point,body_radius):continue
        var roof := INF
        var covering_tree := ""
        for key in trees:
            for crown in trees[key].crowns:
                for i in range(0, crown.size(), 3):
                    var hit = Geometry3D.ray_intersects_triangle(point,up,crown[i],crown[i+1],crown[i+2])
                    if hit != null:
                        var height: float = (hit-point).dot(up)
                        if height < roof:
                            roof=height; covering_tree=key
        if roof!=INF and roof>=1.22:
            candidates.append({"position":point,"tree":covering_tree,"body_radius":body_radius,"clearance":roof})
    report.raw_candidates = candidates.size()
    # Pack before assigning soldiers: nearest-first assignment can consume the
    # only space of a neighbouring slot. Keep measured points and 1m spacing.
    var best: Array[Dictionary] = []
    var random := RandomNumberGenerator.new()
    random.seed = 20260920
    for attempt in range(192):
        var order := candidates.duplicate()
        for i in range(order.size()-1,0,-1):
            var j := random.randi_range(0,i)
            var temp = order[i]; order[i]=order[j]; order[j]=temp
        var selected: Array[Dictionary] = []
        for candidate in order:
            var conflict := false
            for other in selected:
                if Vector3(candidate.position).distance_to(other.position)<1.0: conflict=true; break
            if not conflict: selected.append(candidate)
        if selected.size()>best.size(): best=selected
    candidates=best
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

func _edge_distance(a: Vector2, b: Vector2) -> float:
    var edge := b-a
    return (a+edge*clampf(-a.dot(edge)/maxf(edge.length_squared(),0.000001),0.0,1.0)).length()

func blocks_body(point:Vector3,body_radius:float=0.38)->bool:
    var up:=point.normalized()
    var east:=Vector3.UP.cross(up).normalized()
    var north:=up.cross(east).normalized()
    for ti in trunk_triangles.size():
        if not trunk_bounds[ti].grow(body_radius).intersects_segment(point-up*0.3,point+up*1.4):continue
        var trunk:PackedVector3Array=trunk_triangles[ti]
        for i in range(0,trunk.size(),3):
            var a:Vector3=trunk[i]-point
            var b:Vector3=trunk[i+1]-point
            var c:Vector3=trunk[i+2]-point
            if maxf(a.dot(up),maxf(b.dot(up),c.dot(up))) < -0.3:continue
            if minf(a.dot(up),minf(b.dot(up),c.dot(up))) > 1.4:continue
            var aa:=Vector2(a.dot(east),a.dot(north))
            var bb:=Vector2(b.dot(east),b.dot(north))
            var cc:=Vector2(c.dot(east),c.dot(north))
            if _in_triangle(aa,bb,cc) or _edge_distance(aa,bb)<body_radius or _edge_distance(bb,cc)<body_radius or _edge_distance(cc,aa)<body_radius:return true
    return false
