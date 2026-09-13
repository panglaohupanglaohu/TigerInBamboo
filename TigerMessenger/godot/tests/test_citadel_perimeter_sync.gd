extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var expected=JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/pipeline/citadel-perimeter-ocean/after.json"))
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    var meshes=w.castle_adapter.west_city.find_children("citadel-oskar-grid-mountain-surface","MeshInstance3D",true,false)
    var total:int=0;var matched:int=0;var missing:Array=[];var max_error:float=0
    if meshes.size()==1 and meshes[0].is_visible_in_tree():
        var vertices:Array=[]
        for surface in range(meshes[0].mesh.get_surface_count()):
            var arrays=meshes[0].mesh.surface_get_arrays(surface)
            for v in arrays[Mesh.ARRAY_VERTEX]:vertices.append(v)
        for row in expected.rows:
            if not row.used:continue
            total+=1
            var point=Vector3(row.local[0],row.local[1],row.local[2]);var found:bool=false;var best:float=INF;var nearest:Vector3=Vector3.ZERO
            for v in vertices:
                var distance:float=point.distance_to(v)
                if distance<best:best=distance;nearest=v
                if distance<.01:found=true;break
            max_error=maxf(max_error,best)
            if found:matched+=1
            else:
                if missing.size()<8:missing.append({"i":row.i,"gap":best,"expected":str(point),"nearest":str(nearest)})
    var passed:bool=total>200 and matched==total
    var report={"tolerance_m":.01,"max_matched_error":max_error,"used_perimeter_vertices":total,"matched_current_web":matched,"missing":missing,"passed":passed,"scope":"Actual visible Godot mountain perimeter vertex positions match corrected Web mesh; local frame, not a second water model."}
    var f=FileAccess.open("res://../artifacts/pipeline/citadel-perimeter-ocean/godot-check.json",FileAccess.WRITE);f.store_string(JSON.stringify(report,"  "));f.close()
    print(JSON.stringify(report));w.free();quit(0 if passed else 1)
