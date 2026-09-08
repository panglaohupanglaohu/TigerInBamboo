extends RefCounted
## Bookshop-only adaptation of src/assets/toon.js addOutline. The saved GLB
## retains three_node_id but does not contain the Web inverse-hull children.
## Static shell vertices are expanded once in their original local coordinates,
## then batched into one draw. Surface meshes/materials and physics stay intact.
const SHADER = preload("res://shaders/bookshop_brush_ink.gdshader")
const BROAD_PARTS := ["n9", "n11", "n13", "n25", "n45"]
const FINE_PARTS := ["n5", "n7", "n15", "n17", "n19", "n21", "n23", "n27", "n29", "n31", "n33", "n35", "n37", "n39", "n41", "n43", "n48", "n50", "n53", "n55", "n57"]

static func attach(bookshop: Node3D) -> MeshInstance3D:
	var existing := bookshop.get_node_or_null("Bookshop_Brush_Ink") as MeshInstance3D
	if existing: return existing
	var building := bookshop.find_child("hard-to-find-bookshop", true, false)
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var count := 0
	var triangles := 0
	var min_width := INF
	var max_width := 0.0
	for node in building.find_children("*", "MeshInstance3D", true, false):
		var part := node as MeshInstance3D
		var source_id := str(part.get_meta("three_node_id", ""))
		if source_id.is_empty():
			# Godot's importer may wrap extras instead of promoting each key.
			# The saved original n<ID> names are stable; added frames contain
			# spaces and deliberately do not match this exact ID whitelist.
			source_id = str(part.name).get_slice("_", 0)
		if source_id not in BROAD_PARTS and source_id not in FINE_PARTS: continue
		var width := .025 if source_id in BROAD_PARTS else .015
		var transform := bookshop.global_transform.affine_inverse() * part.global_transform
		for s in range(part.mesh.get_surface_count()):
			var arrays := part.mesh.surface_get_arrays(s)
			var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
			var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
			if indices.is_empty():
				for i in range(vertices.size()): indices.append(i)
			for i in indices:
				var p := vertices[i]
				# Same static pressure expression as addOutline; computed once so
				# parts can share one shell despite distinct local scales/transforms.
				var wave := sin(p.dot(Vector3(12.9898, 78.233, 37.719))) * 43758.5453
				var pressure := .65 + .6 * (wave - floorf(wave))
				var expansion := width * pressure
				min_width = minf(min_width, expansion)
				max_width = maxf(max_width, expansion)
				surface.set_uv(Vector2(p.x, p.y))
				surface.set_normal((transform.basis * normals[i]).normalized())
				surface.add_vertex(transform * (p + normals[i] * expansion))
			triangles += indices.size() / 3
		count += 1
	var ink := MeshInstance3D.new()
	ink.name = "Bookshop_Brush_Ink"
	ink.mesh = surface.commit()
	var material := ShaderMaterial.new()
	material.shader = SHADER
	ink.material_override = material
	ink.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	ink.gi_mode = GeometryInstance3D.GI_MODE_DISABLED
	ink.set_meta("is_outline", true)
	ink.set_meta("source_parts", count)
	ink.set_meta("triangles", triangles)
	ink.set_meta("local_expansion_min", min_width)
	ink.set_meta("local_expansion_max", max_width)
	bookshop.add_child(ink)
	return ink
