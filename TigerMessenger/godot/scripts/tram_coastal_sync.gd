extends RefCounted
## Replace the archived 2026-09-08 tram line (tunnel route through the holy city)
## with the current Web default: coastal holy-city leg, stone arcade and stations.
## Geometry only; tram motion and riding are not migrated. --legacy-tram keeps the old line.
const GLB_PATH := "res://assets/art-pilots/tram-system-coastal-v1.glb"
const ROUTE_PATH := "res://data/tram-coastal-route-v1.json"

static func enabled()->bool:return not OS.get_cmdline_user_args().has("--legacy-tram")

static func apply(model:Node3D)->Dictionary:
	var report:={"enabled":enabled(),"old_hidden":0,"new_meshes":0,"stations":0}
	if not enabled():return report
	var old:Array=model.find_children("christchurch-tram-system*","Node3D",true,false)
	var parent:Node=model
	var xf:=Transform3D.IDENTITY
	for node in old:
		if str(node.name).begins_with("christchurch-tram-system-coastal"):continue
		node.visible=false;report.old_hidden+=1;parent=node.get_parent();xf=node.transform
	var coastal:Node3D=load(GLB_PATH).instantiate()
	coastal.name="TramSystemCoastalV1"
	coastal.transform=xf
	parent.add_child(coastal)
	for mesh in coastal.find_children("*","MeshInstance3D",true,false):
		report.new_meshes+=1
		for surface in mesh.mesh.get_surface_count():
			var arrays:Array=mesh.mesh.surface_get_arrays(surface)
			if arrays[Mesh.ARRAY_COLOR]!=null and arrays[Mesh.ARRAY_COLOR].size()>0:
				var material=mesh.get_active_material(surface)
				if material is StandardMaterial3D:
					var adapted=material.duplicate();adapted.vertex_color_use_as_albedo=true;adapted.vertex_color_is_srgb=false
					mesh.set_surface_override_material(surface,adapted)
	var route=JSON.parse_string(FileAccess.get_file_as_string(ROUTE_PATH))
	if route is Dictionary:
		coastal.set_meta("tram_route",route)
		report.stations=route.stations.size()
	report["node"]=coastal
	return report
