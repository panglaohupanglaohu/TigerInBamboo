extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var rows=[]
    for m in w.model.find_children("*","MeshInstance3D",true,false):
        if not str(m.name) in ["citadel-oskar-grid-mountain-surface","citadel-coastal-cliff-seal","highland-ravine-wall-west"]:continue
        var row={"path":str(m.get_path()),"visible":m.is_visible_in_tree(),"layers":m.layers,"aabb":str(m.get_aabb()),"surfaces":[]}
        for i in range(m.mesh.get_surface_count()):
            var a=m.mesh.surface_get_arrays(i);var colors=a[Mesh.ARRAY_COLOR];var normals=a[Mesh.ARRAY_NORMAL];var avg=Color(0,0,0,0);var zero=0
            if colors!=null:
                for c in colors:avg+=c
                avg/=maxi(1,colors.size())
            if normals!=null:
                for n in normals:
                    if n.length()<0.01:zero+=1
            var mat=m.get_active_material(i)
            row.surfaces.append({"vertices":a[Mesh.ARRAY_VERTEX].size(),"colors":colors.size() if colors!=null else 0,"color":str(avg),"zeroNormals":zero,"material":mat.get_class(),"shader":mat.shader.resource_path if mat is ShaderMaterial else "standard","override":str(m.material_override)})
        rows.append(row)
    var data={"rows":rows,"harbor":w.old_harbor_grade_adapter.report}
    print(JSON.stringify(data));FileAccess.open("res://../artifacts/pipeline/citadel-terrain-render/audit.json",FileAccess.WRITE).store_string(JSON.stringify(data,"  "))
    w.free();quit()
