extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/pipeline/citadel-residual-shore/hills-web.json"))
    var reports:Array=[]
    for source in data:
        var found=w.model.find_children(source.name,"MeshInstance3D",true,false)
        var report={"name":source.name,"matches":found.size(),"samples":source.points.size(),"unmatched":0,"max_error":0.0}
        if found.size()==1:
            var mesh:MeshInstance3D=found[0];var vertices:Array[Vector3]=[]
            for surface in range(mesh.mesh.get_surface_count()):
                for p in mesh.mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX]:vertices.append(w.model.to_local(mesh.to_global(p)))
            for row in source.points:
                var p=Vector3(row.world[0],row.world[1],row.world[2]);var best:float=INF
                for v in vertices:best=minf(best,p.distance_to(v))
                report.max_error=maxf(report.max_error,best)
                if best>.02:report.unmatched+=1
        reports.append(report)
    FileAccess.open("res://../artifacts/pipeline/citadel-residual-shore/hills-godot.json",FileAccess.WRITE).store_string(JSON.stringify(reports,"  "));print(JSON.stringify(reports));w.free();quit()
