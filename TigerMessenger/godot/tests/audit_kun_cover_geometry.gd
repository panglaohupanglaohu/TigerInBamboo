extends SceneTree
## Read-only conservative mesh-footprint audit, not collision certification.
const Pose = preload("res://scripts/roman_concealment_pose.gd")
const SPECIAL = ["pine-1247-cover-0", "pine-3020-cover-45", "pine-4101-cover-48"]
var garden: Node3D
var trunks: Array = []
var pools: Array = []

func _initialize() -> void: call_deferred("run")

func mesh_points(mesh: MeshInstance3D, frame: Node3D) -> PackedVector3Array:
    var result := PackedVector3Array()
    for surface in mesh.mesh.get_surface_count():
        for v in mesh.mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX]:
            result.append(frame.to_local(mesh.to_global(v)))
    return result

func hull(points: PackedVector3Array) -> PackedVector2Array:
    var flat := PackedVector2Array()
    for v in points: flat.append(Vector2(v.x,v.z))
    return Geometry2D.convex_hull(flat) if flat.size() >= 3 else PackedVector2Array()

func overlaps(a: PackedVector2Array, b: PackedVector2Array) -> bool:
    return a.size() >= 3 and b.size() >= 3 and not Geometry2D.intersect_polygons(a,b).is_empty()

func bounds(poly: PackedVector2Array) -> Rect2:
    if poly.is_empty(): return Rect2()
    var rect := Rect2(poly[0],Vector2.ZERO)
    for point in poly: rect=rect.expand(point)
    return rect

func is_foot(mesh: Node, ids: Dictionary) -> bool:
    for id in ["n23","n26"]:
        if ids.has(id) and (mesh == ids[id] or ids[id].is_ancestor_of(mesh)): return true
    return false

func run() -> void:
    var world = load("res://scenes/saihoji_battle_world.tscn").instantiate()
    root.add_child(world)
    while not world.ready_for_battle and world.load_error.is_empty(): await physics_frame
    world.set_physics_process(false); world.music.set_muted(true)
    if not world.load_error.is_empty(): push_error(world.load_error); quit(1); return
    garden = world.target_garden.node
    var covers = JSON.parse_string(FileAccess.get_file_as_string("res://data/saihoji-kun-cover-points.json"))
    for pool in world.target_garden.support_pools:
        var polygon := PackedVector2Array()
        # Circumscribed 64-gon: never underestimates the source ellipse.
        for i in 64:
            var angle := TAU*i/64.0
            polygon.append(Vector2(pool.x+pool.rx*cos(angle)/cos(PI/64),pool.z+pool.rz*sin(angle)/cos(PI/64)))
        pools.append(polygon)
    for entry in world.pine_visual.entries:
        for id in ["n8","n9"]:
            var mesh: MeshInstance3D = entry.ids.get(id)
            if not is_instance_valid(mesh): continue
            # Keep per-triangle bounds to avoid a hull across disconnected branches.
            var faces: PackedVector3Array = mesh.mesh.get_faces()
            for i in range(0,faces.size(),3):
                var triangle := PackedVector3Array()
                for j in 3: triangle.append(garden.to_local(mesh.to_global(faces[i+j])))
                var poly := hull(triangle)
                trunks.append({"seed":entry.row.seed,"polygon":poly,"bounds":bounds(poly),"min_y":minf(triangle[0].y,minf(triangle[1].y,triangle[2].y)),"max_y":maxf(triangle[0].y,maxf(triangle[1].y,triangle[2].y))})
    var results: Array = []
    for role in ["gladius","spear","longbow"]:
        var actor: Node3D = world.prefabs[role].instantiate(); world.add_child(actor)
        var ids: Dictionary = {}; world._candidate_index(actor,ids)
        var pose = Pose.new(); pose.bind(actor,ids)
        for crouch in [0.0,1.0]:
            pose.update(crouch)
            for yaw in [0,90,180,270]:
                for row in covers.points:
                    var hit: Dictionary = world.target_garden.sample_support(Vector2(row.localPoint[0],row.localPoint[2]))
                    if hit.is_empty(): results.append({"id":row.id,"role":role,"unsupported":true}); continue
                    # Preserve production prefab metre scale; never inherit island 0.5 scale.
                    var up: Vector3 = hit.normal
                    var forward: Vector3 = garden.global_basis.z.normalized()
                    forward = (forward-up*forward.dot(up)).normalized()
                    var basis := Basis(up.cross(forward).normalized(),up,forward)*Basis(Vector3.UP,deg_to_rad(yaw))
                    actor.global_transform = Transform3D(basis,hit.position+up*float(world.foot_offsets[role]))
                    var pool_meshes: Array = []; var foot_pool_meshes: Array = []; var tree_meshes: Array = []
                    for mesh in actor.find_children("*","MeshInstance3D",true,false):
                        if not mesh.is_visible_in_tree() or mesh.mesh == null: continue
                        var points := mesh_points(mesh,garden)
                        var poly := hull(points)
                        var rect := bounds(poly)
                        var low := INF; var high := -INF
                        for p in points: low=minf(low,p.y); high=maxf(high,p.y)
                        if pools.any(func(p):return overlaps(poly,p)):
                            pool_meshes.append(str(mesh.name))
                            if is_foot(mesh,ids): foot_pool_meshes.append(str(mesh.name))
                        for trunk in trunks:
                            if high < trunk.min_y or low > trunk.max_y: continue
                            if not rect.intersects(trunk.bounds,true): continue
                            if overlaps(poly,trunk.polygon):
                                tree_meshes.append({"mesh":str(mesh.name),"pine_seed":trunk.seed}); break
                    results.append({"id":row.id,"role":role,"pose":"conceal_lean" if crouch>0 else "neutral","yaw_degrees":yaw,"pool_overhang_meshes":pool_meshes,"foot_pool_overlap_candidates":foot_pool_meshes,"trunk_overlap_candidates":tree_meshes})
        actor.queue_free(); await process_frame
    var suspects: Array = results.filter(func(r):return r.get("unsupported",false) or not r.foot_pool_overlap_candidates.is_empty() or not r.trunk_overlap_candidates.is_empty())
    var result := {"layout_sha256":FileAccess.get_sha256("res://data/saihoji-target-garden-20260919.json"),"cover_sha256":FileAccess.get_sha256("res://data/saihoji-kun-cover-points.json"),"audit_completed":results.size()==1200,"cases":results.size(),"candidate_cases":suspects.size(),"island_world_axis_lengths":[garden.global_basis.x.length(),garden.global_basis.y.length(),garden.global_basis.z.length()],"prefab_scale":"production world metres, unscaled orthonormal actor basis","scope":"50 points x 3 actual GLB prefabs x neutral/production conceal lean x four headings; pool ellipse and per-triangle real n8/n9 projected geometry; overlapping convex mesh footprints are conservative candidates, not proven penetration; no combat animation sweep, foliage or inter-soldier collision","special_points":results.filter(func(r):return r.id in SPECIAL),"candidate_details":suspects,"all_cases":results}
    var path := OS.get_environment("KUN_COVER_GEOMETRY_REPORT")
    if path.is_empty(): path="res://../artifacts/pipeline/saihoji-target-integration/kun-cover-geometry-report.json"
    var file := FileAccess.open(path,FileAccess.WRITE)
    if file == null: push_error("Cannot write audit report: "+path);quit(1);return
    file.store_string(JSON.stringify(result,"  "));file.close()
    print("KUN_COVER_GEOMETRY cases=%d conservative_candidates=%d report=%s" % [results.size(),suspects.size(),path])
    world.queue_free(); await process_frame; quit(0 if result.audit_completed else 1)
