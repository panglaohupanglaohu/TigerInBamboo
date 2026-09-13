extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var roots=w.model.find_children("citadel-plaza-retaining-wall","Node3D",true,false).filter(func(n):return n.is_visible_in_tree())
    var triangles=0;var meshes=[]
    if roots.size()==1:
        meshes=roots[0].find_children("*","MeshInstance3D",true,false)
        for m in meshes:
            for i in range(m.mesh.get_surface_count()):
                var a=m.mesh.surface_get_arrays(i);var ids=a[Mesh.ARRAY_INDEX];triangles+=(ids.size() if ids!=null and ids.size()>0 else a[Mesh.ARRAY_VERTEX].size())/3
    var report={"roots":roots.size(),"meshes":meshes.size(),"triangles":triangles,"passed":roots.size()==1 and meshes.size()==2 and triangles==1232}
    FileAccess.open("res://../artifacts/pipeline/citadel-plaza-retaining/godot-geometry.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));w.free();quit(0 if report.passed else 1)
