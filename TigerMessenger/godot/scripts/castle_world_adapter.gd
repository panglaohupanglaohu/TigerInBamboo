class_name CastleWorldAdapter
extends RefCounted
## Opt-in static shared-edge WFC output at the original castle placement.
## Does not provide Godot WFC editing, navigation, combat, or animated windows.
const CANDIDATE_PATH := "res://assets/art-pilots/castle-hillside-town-v2.glb"
const WEST_CITY_PATH := "res://assets/art-pilots/citadel-west-city-v1.glb"
const OLD_CITY_OFFSET := Vector3(-52, 0, 0)
const OLD_CITY_YAW := PI / 6.0
const SOURCE_PATH := "castleContainer[69]"
const ASSEMBLY_PATH := "castleContainer[69]/odyssey-citadel-mountain-valley-assembly[4]"
var enabled := false
var last_error := ""
var original: Node3D
var candidate: Node3D
var west_city: Node3D
var trojan_horse: Node3D
var original_horse: Node3D
var _horse_original_visible:=true
var _west_replaced: Array[Dictionary] = []
var _west_vegetation:Array[Dictionary]=[]
var _model: Node3D
var _layers: Array[Dictionary] = []
var _old_placement: Array[Dictionary] = []
var _old_orientation: Array[Dictionary] = []

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
    # Translate archived content once, preserving the spherical world/sourcePath root.
    # This is layout, independent of the optional WFC replacement toggle.
    for child in original.get_children():
        if child is Node3D:
            _old_placement.append({"node":child,"transform":child.transform})
            child.position += OLD_CITY_OFFSET
    # Match Web mainCastle direct-child rotation; keep the new export outside this frame.
    var yaw_transform:=Transform3D(Basis(Vector3.UP,OLD_CITY_YAW),Vector3.ZERO)
    for child in assemblies[0].get_children():
        if child is Node3D:
            _old_orientation.append({"node":child,"transform":child.transform})
            child.transform=yaw_transform*child.transform
    for foundation in original.find_children("highland-town-foundation-platform","Node3D",true,false):
        _old_orientation.append({"node":foundation,"transform":foundation.transform})
        foundation.rotate_y(OLD_CITY_YAW)
    original.set_meta("citadel_old_city_offset", OLD_CITY_OFFSET)
    original.set_meta("citadel_old_city_frame",Transform3D(yaw_transform.basis,OLD_CITY_OFFSET))
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
        candidate.transform = Transform3D(Basis.IDENTITY, OLD_CITY_OFFSET)
    for row in _layers: row.node.visible = false
    candidate.visible = true
    _mount_west_city()
    enabled = true
    last_error = ""
    return true

func _mount_west_city() -> void:
    if not is_instance_valid(west_city):
        var packed := load(WEST_CITY_PATH) as PackedScene
        if packed == null:
            push_warning("West city asset is not imported yet")
            return
        west_city = packed.instantiate() as Node3D
        west_city.name = "WestCityWFC"
        west_city.set_meta("citadel_visual_expansion", true)
        _adapt_materials(west_city)
        # The export is in original castle local coordinates, not world space.
        original.add_child(west_city)
        west_city.transform = Transform3D.IDENTITY
        for node in original.find_children("*", "Node3D", true, false):
            if west_city.is_ancestor_of(node) or node == west_city: continue
            if node.name in ["citadel-oskar-grid-mountain-surface", "backlit-highlight-citadel-oskar-grid-mountain-surface", "highland-ravine-wall-east"]:
                _west_replaced.append({"node":node,"visible":node.visible})
        # A relocated export is the same Web asset, but Godot receives only its static pose.
        # Hide the archived sibling only when its replacement and identity match uniquely.
        var horses=west_city.find_children("citadel-trojan-horse","Node3D",true,false)
        var archived:Array[Node3D]=[]
        _find_source(_model,"citadel-trojan-horse[73]",archived)
        if horses.size()==1 and archived.size()==1:
            trojan_horse=horses[0];original_horse=archived[0]
            _horse_original_visible=original_horse.visible
        elif not horses.is_empty():
            for horse in horses:horse.visible=false
            push_warning("Relocated Trojan horse not uniquely matched; retained archived horse")
        for root_name in ["old-harbor-scene","citadel-navona-canal-plaza","navona-harbor-causeway"]:
            var replacements=west_city.find_children(root_name,"Node3D",true,false)
            var originals:Array[Node3D]=[]
            for node in _model.find_children("*","Node3D",true,false):
                if west_city.is_ancestor_of(node):continue
                var source:String=str(node.get_meta("extras",{}).get("sourcePath",""))
                if source.begins_with(root_name+"[") and not source.contains("/"):originals.append(node)
            if replacements.size()==1 and originals.size()==1:
                _west_replaced.append({"node":originals[0],"visible":originals[0].visible})
            else:
                for replacement in replacements:replacement.visible=false
                push_warning("Relocated harbor object not uniquely matched: "+root_name)
        _west_vegetation=preload("res://scripts/west_city_vegetation.gd").new().prepare(original)
    for row in _west_replaced: row.node.visible = false
    for row in _west_vegetation:row.node.mesh=row.candidate
    west_city.visible = true
    if is_instance_valid(trojan_horse) and is_instance_valid(original_horse):
        original_horse.visible=false
        trojan_horse.visible=true

func _adapt_materials(node: Node) -> void:
    if node is MeshInstance3D and node.mesh != null:
        if node.name=="citadel-oskar-grid-mountain-surface":
            var terrain_material:=ShaderMaterial.new()
            terrain_material.shader=preload("res://shaders/citadel_terrain_color.gdshader")
            for surface in range(node.mesh.get_surface_count()):node.set_surface_override_material(surface,terrain_material)
            return
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
    if is_instance_valid(west_city): west_city.visible = false
    if is_instance_valid(original_horse):original_horse.visible=_horse_original_visible
    for row in _west_replaced:
        if is_instance_valid(row.node): row.node.visible = row.visible
    for row in _west_vegetation:
        if is_instance_valid(row.node):row.node.mesh=row.original
    for row in _layers:
        if is_instance_valid(row.node): row.node.visible = row.visible

func focus_position() -> Vector3:
    return original.to_global(OLD_CITY_OFFSET) if is_instance_valid(original) else Vector3.ZERO

func unbind() -> void:
    if enabled: _restore()
    if is_instance_valid(candidate): candidate.free()
    if is_instance_valid(west_city): west_city.free()
    # Reverse captures in case the separately named foundation is also an assembly child.
    for i in range(_old_orientation.size()-1,-1,-1):
        var row:Dictionary=_old_orientation[i]
        if is_instance_valid(row.node):row.node.transform=row.transform
    _old_orientation.clear()
    for row in _old_placement:
        if is_instance_valid(row.node): row.node.transform = row.transform
    _old_placement.clear()
    if is_instance_valid(original):
        original.remove_meta("citadel_old_city_offset")
        original.remove_meta("citadel_old_city_frame")
    trojan_horse=null;original_horse=null
    west_city = null
    _west_replaced.clear()
    _west_vegetation.clear()
    candidate = null
    enabled = false
    original = null
    _model = null
    _layers.clear()
