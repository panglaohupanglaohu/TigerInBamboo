class_name CastleWorldAdapter
extends RefCounted
## Opt-in static shared-edge WFC output at the original castle placement.
## Does not provide Godot WFC editing, navigation, combat, or animated windows.
const CANDIDATE_PATH := "res://assets/art-pilots/castle-shared-edge-town-v1.glb"
const SOURCE_PATH := "castleContainer[69]"
const ASSEMBLY_PATH := "castleContainer[69]/odyssey-citadel-mountain-valley-assembly[4]"
var enabled := false
var last_error := ""
var original: Node3D
var candidate: Node3D
var _model: Node3D
var _layers: Array[Dictionary] = []

func bind(model: Node3D) -> bool:
    if model == _model and is_bound(): return true
    unbind()
    if not is_instance_valid(model):
        last_error = "Original world root is missing."
        return false
    var roots: Array[Node3D] = []
    var assemblies: Array[Node3D] = []
    _find_source(model, SOURCE_PATH, roots)
    _find_source(model, ASSEMBLY_PATH, assemblies)
    if roots.size() != 1 or assemblies.size() != 1 or assemblies[0].get_parent() != roots[0]:
        last_error = "Expected one original mountain-valley castle at the preserved sourcePath."
        return false
    var found: Array[Dictionary] = []
    for i in range(12):
        var name := "citadel-layer-%d" % i
        var layer := assemblies[0].get_node_or_null(NodePath(name)) as Node3D
        if layer == null or layer.is_set_as_top_level():
            last_error = "Original castle town layer missing: " + name
            return false
        found.append({"node":layer, "visible":layer.visible, "transform":layer.transform})
    original = roots[0]
    _model = model
    _layers = found
    last_error = ""
    return true

func _find_source(node: Node, path: String, output: Array[Node3D]) -> void:
    var extras: Variant = node.get_meta("extras", {})
    if node is Node3D and extras is Dictionary and extras.get("sourcePath", "") == path:
        output.append(node)
    for child in node.get_children(): _find_source(child, path, output)

func is_bound() -> bool:
    if not is_instance_valid(_model) or not is_instance_valid(original) or not _model.is_ancestor_of(original): return false
    if _layers.size() != 12: return false
    for row in _layers:
        if not is_instance_valid(row.node) or not original.is_ancestor_of(row.node): return false
    return true

func set_enabled(value: bool) -> bool:
    if not value:
        if enabled: _restore()
        enabled = false
        return is_bound()
    if not is_bound():
        last_error = "Bind the original world before enabling the castle candidate."
        return false
    if enabled: return true
    if not is_instance_valid(candidate):
        var packed := load(CANDIDATE_PATH) as PackedScene
        if packed == null:
            last_error = "Shared-edge castle candidate has not been imported."
            return false
        var instance := packed.instantiate() as Node3D
        if instance == null:
            last_error = "Castle candidate requires a 3D root."
            return false
        var town := instance.get_node_or_null("castle-shared-edge-town-candidate") as Node3D
        if town == null or not instance.transform.is_equal_approx(Transform3D.IDENTITY) or not town.transform.is_equal_approx(Transform3D.IDENTITY):
            instance.free()
            last_error = "Castle candidate must retain an identity placement root."
            return false
        for i in range(12):
            if not town.get_node_or_null("citadel-layer-%d" % i) is Node3D:
                instance.free()
                last_error = "Castle candidate is missing an original town layer."
                return false
        candidate = instance
        candidate.name = "SharedEdgeCastleCandidate"
        _adapt_materials(candidate)
        original.add_child(candidate)
        candidate.transform = Transform3D.IDENTITY
    for row in _layers: row.node.visible = false
    candidate.visible = true
    enabled = true
    last_error = ""
    return true

func _adapt_materials(node: Node) -> void:
    if node is MeshInstance3D and node.mesh != null:
        for i in range(node.mesh.get_surface_count()):
            var arrays: Array = node.mesh.surface_get_arrays(i)
            if arrays[Mesh.ARRAY_COLOR] != null and arrays[Mesh.ARRAY_COLOR].size() > 0:
                var material: Material = node.get_active_material(i)
                if material is StandardMaterial3D:
                    var adapted := material.duplicate() as StandardMaterial3D
                    adapted.vertex_color_use_as_albedo = true
                    adapted.vertex_color_is_srgb = false
                    node.set_surface_override_material(i, adapted)
    for child in node.get_children(): _adapt_materials(child)

func _restore() -> void:
    if is_instance_valid(candidate): candidate.visible = false
    for row in _layers:
        if is_instance_valid(row.node): row.node.visible = row.visible

func focus_position() -> Vector3:
    return original.global_position if is_instance_valid(original) else Vector3.ZERO

func unbind() -> void:
    if enabled: _restore()
    if is_instance_valid(candidate): candidate.free()
    candidate = null
    enabled = false
    original = null
    _model = null
    _layers.clear()
