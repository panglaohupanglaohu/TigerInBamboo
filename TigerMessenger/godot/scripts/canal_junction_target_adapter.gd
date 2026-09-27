extends RefCounted
## Full local-space castle/base replacement at the original canal junction.
## Keep the source hierarchy for identity/behavior references; retire its visual
## subtree, including the old canal-town-reflection, only after asset validation.
const ASSET := "res://assets/art-pilots/canal-junction-target-v1.glb"
const SOURCE_PATH := "castleContainer-canal-junction[84]"
const SOURCE_NAME := "castleContainer-canal-junction"
const META_KEY := "canal_junction_target_adapter"
var original: Node3D
var candidate: Node3D
var original_visible := true
var model_root: Node
var last_error := ""

func bind(model: Node, asset_path: String = ASSET) -> bool:
	if is_instance_valid(candidate):
		if model == model_root: return true
		last_error = "Canal junction adapter is already bound to another world"
		return false
	if model.has_meta(META_KEY):
		last_error = "Canal junction target already bound"
		return false
	var matches: Array[Node3D] = []
	for node in model.find_children("*", "Node3D", true, false):
		if str(node.get_meta("extras", {}).get("sourcePath", "")) == SOURCE_PATH:
			matches.append(node)
	if matches.size() != 1 or str(matches[0].name) != SOURCE_NAME:
		last_error = "Expected one exact original canal junction root; found %d" % matches.size()
		return false
	var source := matches[0]
	if not ResourceLoader.exists(asset_path):
		last_error = "Canal junction target asset not imported; original retained"
		return false
	var packed := load(asset_path) as PackedScene
	if not packed:
		last_error = "Canal junction target is not a scene; original retained"
		return false
	var instance := packed.instantiate()
	if not instance is Node3D:
		instance.free()
		last_error = "Canal junction target is not 3D; original retained"
		return false
	var replacement := instance as Node3D
	var meshes: Array[Node] = replacement.find_children("*", "MeshInstance3D", true, false)
	if replacement is MeshInstance3D: meshes.append(replacement)
	var has_geometry := false
	for mesh_node in meshes:
		if mesh_node.mesh and mesh_node.mesh.get_surface_count() > 0:
			has_geometry = true
			break
	if not has_geometry:
		replacement.free()
		last_error = "Canal junction target has no geometry; original retained"
		return false
	# The asset contract is root-local geometry, not the inner assembly's scale.
	replacement.name = "CanalJunction_TargetV1"
	replacement.transform = source.transform
	source.get_parent().add_child(replacement)
	original = source
	original_visible = source.visible
	candidate = replacement
	model_root = model
	original.visible = false
	model.set_meta(META_KEY, self)
	last_error = ""
	return true

func unbind() -> void:
	if is_instance_valid(original): original.visible = original_visible
	if is_instance_valid(candidate): candidate.free()
	if is_instance_valid(model_root) and model_root.has_meta(META_KEY):
		if model_root.get_meta(META_KEY) == self: model_root.remove_meta(META_KEY)
	original = null
	candidate = null
	model_root = null
