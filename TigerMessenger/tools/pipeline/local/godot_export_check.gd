extends SceneTree
## Imports only the fresh worker candidate in a private minimal Godot project.
var failures: Array[String] = []
var nodes := 0
var meshes := 0
var triangles := 0
var materials: Dictionary = {}
var original_ids: Array[String] = []
var hidden_outline_nodes := 0
var bounds := AABB()
var first_mesh := true

func _initialize() -> void:
    call_deferred("run")

func check(condition: bool, message: String) -> void:
    if not condition: failures.append(message)

func inspect(node: Node) -> void:
    if node is Node3D:
        nodes += 1
        check(node.global_transform.is_finite(), "Nonfinite node transform: " + str(node.name))
        var extras: Dictionary = node.get_meta("extras", {})
        if extras.has("three_node_id"): original_ids.append(str(extras.three_node_id))
        if extras.get("candidateHiddenOutline", false): hidden_outline_nodes += 1
    if node is MeshInstance3D:
        meshes += 1
        check(node.mesh != null, "Missing mesh: " + str(node.name))
        if node.mesh != null:
            var faces: PackedVector3Array = node.mesh.get_faces()
            check(not faces.is_empty(), "Empty mesh faces: " + str(node.name))
            check(faces.size() % 3 == 0, "Incomplete triangle data")
            triangles += faces.size() / 3
            for point in faces:
                check(point.is_finite(), "Nonfinite mesh coordinate")
                var world_point: Vector3 = node.global_transform * point
                bounds = AABB(world_point, Vector3.ZERO) if first_mesh else bounds.expand(world_point)
                first_mesh = false
            for surface in node.mesh.get_surface_count():
                var material: Material = node.get_active_material(surface)
                check(material != null, "Missing surface material")
                if material == null: continue
                materials[material.resource_name] = true
                if material is BaseMaterial3D:
                    var color: Color = material.albedo_color
                    check(is_finite(color.r) and is_finite(color.g) and is_finite(color.b) and is_finite(color.a), "Nonfinite material color")
                    check(is_finite(material.roughness) and is_finite(material.metallic), "Nonfinite material factors")
    for child in node.get_children(): inspect(child)

func run() -> void:
    var args := OS.get_cmdline_user_args()
    var report_path := ""
    var expected_path := ""
    for i in range(args.size() - 1):
        if args[i] == "--report": report_path = args[i + 1]
        if args[i] == "--expected": expected_path = args[i + 1]
    var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(expected_path))
    if not parsed is Dictionary or not parsed.get("passed", false):
        push_error("A passing Blender roundtrip report is required")
        quit(1)
        return
    var expected: Dictionary = parsed.source
    var packed = load("res://candidate.glb") as PackedScene
    if packed == null:
        push_error("Newly exported candidate cannot load")
        quit(1)
        return
    var model := packed.instantiate() as Node3D
    root.add_child(model)
    await process_frame
    inspect(model)
    var allowed_scene_wrapper := nodes == int(expected.nodes) + 1 and model.transform.is_equal_approx(Transform3D.IDENTITY) and not model is MeshInstance3D
    check(nodes == int(expected.nodes) or allowed_scene_wrapper, "Godot node count differs from Blender export")
    check(meshes == int(expected.mesh_objects), "Godot mesh count differs from Blender export")
    check(triangles == int(expected.triangles), "Godot triangle count differs from Blender export")
    var expected_materials: Array = expected.materials.duplicate()
    expected_materials.sort()
    var actual_materials: Array = materials.keys()
    actual_materials.sort()
    check(actual_materials == expected_materials, "Godot material identities differ from Blender export")
    original_ids.sort()
    var expected_ids: Array = expected.original_node_ids.duplicate()
    expected_ids.sort()
    check(original_ids == expected_ids, "Original node IDs differ in Godot")
    check(hidden_outline_nodes == expected.hidden_outline_nodes.size(), "Hidden-outline extras lost in Godot")
    # Blender Z-up to glTF/Godot Y-up is (x, y, z) -> (x, z, -y).
    var low: Array = expected.bounds_min
    var high: Array = expected.bounds_max
    var expected_min := Vector3(low[0], low[2], -high[1])
    var expected_max := Vector3(high[0], high[2], -low[1])
    var bound_error := 0.0
    for axis in range(3):
        bound_error = maxf(bound_error, absf(bounds.position[axis] - expected_min[axis]))
        bound_error = maxf(bound_error, absf(bounds.end[axis] - expected_max[axis]))
    check(not first_mesh and bound_error <= 0.0001, "Godot world bounds differ from Blender export")
    var report := {"passed": failures.is_empty(), "failures": failures,
        "godot_version": Engine.get_version_info().string,
        "nodes": nodes, "identity_scene_wrapper": allowed_scene_wrapper,
        "mesh_objects": meshes, "triangles": triangles, "materials": actual_materials,
        "original_node_ids": original_ids, "hidden_outline_nodes": hidden_outline_nodes,
        "bounds_min": [bounds.position.x, bounds.position.y, bounds.position.z],
        "bounds_max": [bounds.end.x, bounds.end.y, bounds.end.z], "maximum_bound_error": bound_error,
        "finite_geometry_materials": failures.is_empty(), "visual_approved": false,
        "scope": "Fresh Blender-exported GLB imported/instantiated in isolated minimal Godot project; no runtime adapters, art or gameplay acceptance"}
    var file := FileAccess.open(report_path, FileAccess.WRITE)
    file.store_string(JSON.stringify(report, "  "))
    print("EXPORTED_CANDIDATE_GODOT ", JSON.stringify(report))
    model.queue_free()
    await process_frame
    quit(0 if failures.is_empty() else 1)
