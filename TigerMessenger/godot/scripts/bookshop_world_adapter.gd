extends RefCounted
## Restore the actual Web sign's MeshBasicMaterial semantics only.
const SIGN_PATH := "hard-to-find-bookshop[76]/Group[22]/bookshop-sign-text[2]"
var sign: MeshInstance3D
var original_override: Material
var adapted: StandardMaterial3D
var enabled := false
var last_error := ""

func bind(model: Node) -> bool:
	unbind()
	var matches: Array[MeshInstance3D] = []
	for node in model.find_children("*", "MeshInstance3D", true, false):
		if str(node.get_meta("extras", {}).get("sourcePath", "")) == SIGN_PATH:
			matches.append(node)
	if matches.size() != 1:
		last_error = "Expected one exact original bookshop sign; found %d" % matches.size()
		return false
	var target := matches[0]
	if target.mesh.get_surface_count() != 1 or target.material_override != null:
		last_error = "Unexpected bookshop sign material contract"
		return false
	var source := target.get_active_material(0) as StandardMaterial3D
	# glTF BLEND may import as alpha-depth-prepass; retain that importer choice.
	if source == null or source.albedo_texture == null or source.transparency not in [BaseMaterial3D.TRANSPARENCY_ALPHA, BaseMaterial3D.TRANSPARENCY_ALPHA_DEPTH_PRE_PASS]:
		last_error = "Bookshop sign must retain its original transparent canvas texture"
		return false
	sign = target
	original_override = sign.get_surface_override_material(0)
	adapted = source.duplicate()
	adapted.resource_name = "OriginalBookshopSign_MeshBasicMaterial"
	adapted.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	last_error = ""
	return true

func set_enabled(value: bool) -> bool:
	if not is_instance_valid(sign): return false
	sign.set_surface_override_material(0, adapted if value else original_override)
	enabled = value
	return true

func unbind() -> void:
	if is_instance_valid(sign): sign.set_surface_override_material(0, original_override)
	sign = null
	original_override = null
	adapted = null
	enabled = false
