extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/old-harbor-ocean-grade.json")).mountainForest
    var roots=w.model.find_children("citadel-mountain-cypress-groves","Node3D",true,false).filter(func(n):return n.is_visible_in_tree())
    var round=w.model.find_children("highland-canopy-groves","Node3D",true,false).filter(func(n):return n.is_visible_in_tree())
    var meshes=roots[0].find_children("*","MeshInstance3D",true,false) if roots.size()==1 else []
    var triangles=0
    for m in meshes:
        for i in range(m.mesh.get_surface_count()):
            var a=m.mesh.surface_get_arrays(i);var ids=a[Mesh.ARRAY_INDEX];triangles+=(ids.size() if ids!=null and ids.size()>0 else a[Mesh.ARRAY_VERTEX].size())/3
    var round_meshes=round[0].find_children("*","MeshInstance3D",true,false).size() if round.size()==1 else 0
    var round_triangles=0
    if round.size()==1:
        for m in round[0].find_children("*","MeshInstance3D",true,false):
            for i in range(m.mesh.get_surface_count()):
                var a=m.mesh.surface_get_arrays(i);var ids=a[Mesh.ARRAY_INDEX];round_triangles+=(ids.size() if ids!=null and ids.size()>0 else a[Mesh.ARRAY_VERTEX].size())/3
    var report={"round_triangles":round_triangles,"cypress_roots":roots.size(),"round_roots":round.size(),"round_instances":round_meshes,"cypress_meshes":meshes.size(),"cypress_triangles":triangles,"trees":data.cypress.size()}
    report.passed=roots.size()==1 and (round.size()==1 if data.retainedRound.size()>0 else round.size()<=1) and meshes.size()==4 and triangles==data.cypress.size()*160 and round_triangles==data.retainedRound.size()*80
    FileAccess.open("res://../artifacts/pipeline/citadel-mountain-forest/godot-test.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));w.free();quit(0 if report.passed else 1)
