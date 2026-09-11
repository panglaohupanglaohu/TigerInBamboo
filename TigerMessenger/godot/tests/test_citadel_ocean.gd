extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var ocean=w.ocean_adapter.ocean
    var arrays=ocean.mesh.surface_get_arrays(0)
    var vertices:PackedVector3Array=arrays[Mesh.ARRAY_VERTEX]
    var indices:PackedInt32Array=arrays[Mesh.ARRAY_INDEX]
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/original-ocean.json"))
    var exact:bool=vertices.size()*3==data.positions.size()
    for i in range(vertices.size()):
        if vertices[i].distance_to(Vector3(data.positions[i*3],data.positions[i*3+1],data.positions[i*3+2]))>0.0001:exact=false
    var platforms={}
    var valid:bool=exact
    for name in ["west-city-harbor-quay","west-city-harbor-boarding-deck"]:
        var matches=w.castle_adapter.west_city.find_children(name,"MeshInstance3D",true,false)
        if matches.size()!=1:
            valid=false
            platforms[name]={"count":matches.size()}
            continue
        var quay=matches[0]
        var bounds: AABB=quay.get_aabb()
        var min_clearance:=INF;var samples:=0
        for x in [bounds.position.x,bounds.end.x]:
            for z in [bounds.position.z,bounds.end.z]:
                var top_y:float=-INF
                for vertex in quay.mesh.get_faces():
                    if absf(vertex.x-x)<0.0001 and absf(vertex.z-z)<0.0001:top_y=maxf(top_y,vertex.y)
                if top_y==-INF:continue
                var q:Vector3=ocean.to_local(quay.to_global(Vector3(x,top_y,z)))
                var radial=q.normalized();var nearest=INF
                for i in range(0,indices.size(),3):
                    var hit=Geometry3D.ray_intersects_triangle(q+radial*5,-radial,vertices[indices[i]],vertices[indices[i+1]],vertices[indices[i+2]])
                    if hit!=null:nearest=minf(nearest,(q+radial*5).distance_to(hit))
                if nearest<INF:samples+=1;min_clearance=minf(min_clearance,nearest-5-0.067)
        platforms[name]={"samples":samples,"clearance_with_max_wave":min_clearance}
        valid=valid and samples==4 and min_clearance>0.1
    var report={"source_positions_exact":exact,"vertices":vertices.size(),"triangles":indices.size()/3,"platforms":platforms,"passed":valid,"scope":"Source ocean geometry and four corners of each quay and boarding deck above maximum wave; not boat docking, character traversal or full combat"}
    FileAccess.open("res://../artifacts/pipeline/citadel-plaza-horse/godot-ocean.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));w.queue_free();await process_frame;quit(0 if report.passed else 1)
