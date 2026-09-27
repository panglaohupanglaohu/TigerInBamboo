extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
	root.size=Vector2i(1440,1000)
	var review=load("res://scenes/crystal_v7_review.tscn").instantiate();root.add_child(review)
	await process_frame
	var rounds:=[1,2,3]
	for arg in OS.get_cmdline_user_args():
		if arg.is_valid_int():rounds=[int(arg)]
	var reports:=[]
	for r in rounds:
		review.set_round(r)
		await process_frame
		await process_frame
		var meshes:=0;var vertices:=0;var invalid:=0;var towers:=0;var swamps:=0
		for o in review.model.find_children("*","Node3D",true,false):
			if str(o.name).begins_with("moebius-grand-community-tower") or str(o.name).begins_with("moebius-trackside-gold-"):towers+=1
			if str(o.name).begins_with("moebius-swamp-placement"):swamps+=1
			if o is MeshInstance3D:
				meshes+=1
				for s in o.mesh.get_surface_count():
					var a=o.mesh.surface_get_arrays(s)
					for v in a[Mesh.ARRAY_VERTEX]:
						vertices+=1
						if not v.is_finite():invalid+=1
		var result={"round":r,"meshes":meshes,"vertices":vertices,"nonfinite_vertices":invalid,"towers":towers,"swamp_roots":swamps,"camera":str(review.camera.transform),"scope":"Native art scene only; no route, boarding or full-campaign acceptance"}
		assert(towers==3 and swamps==1 and invalid==0)
		if DisplayServer.get_name()!="headless":
			await RenderingServer.frame_post_draw
			var path="res://../artifacts/pipeline/crystal-v7-three-rounds/godot-r%02d.png"%r
			var err=root.get_texture().get_image().save_png(path);assert(err==OK)
		var file=FileAccess.open("res://../artifacts/pipeline/crystal-v7-three-rounds/godot-r%02d.json"%r,FileAccess.WRITE)
		file.store_string(JSON.stringify(result,"  "));reports.append(result)
	print(JSON.stringify(reports));quit()
