extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var ocean=w.ocean_adapter.ocean
    var arrays=ocean.mesh.surface_get_arrays(0)
    var vertices:PackedVector3Array=arrays[Mesh.ARRAY_VERTEX]
    var indices:PackedInt32Array=arrays[Mesh.ARRAY_INDEX]
    var data=JSON.parse_string(FileAccess.get_file_as_string(preload("res://scripts/citadel_surface_variant.gd").data_path("res://data/original-ocean.json")))
    var exact:bool=vertices.size()*3==data.positions.size()
    for i in range(vertices.size()):
        if vertices[i].distance_to(Vector3(data.positions[i*3],data.positions[i*3+1],data.positions[i*3+2]))>0.0001:exact=false
    var masks_exact:bool=true
    var water_color:PackedColorArray=arrays[Mesh.ARRAY_COLOR]
    var packed_uv:PackedVector2Array=arrays[Mesh.ARRAY_TEX_UV]
    var packed_uv2:PackedVector2Array=arrays[Mesh.ARRAY_TEX_UV2]
    for i in range(vertices.size()):
        if absf(water_color[i].r-data.water0[i*4])>.005 or absf(water_color[i].g-data.water0[i*4+1])>.005 or absf(water_color[i].b-data.water0[i*4+2])>.005 or absf(water_color[i].a-data.water0[i*4+3])>.005:masks_exact=false
        if packed_uv[i].distance_to(Vector2(data.water1[i*4],data.water1[i*4+1]))>.001 or packed_uv2[i].distance_to(Vector2(data.water1[i*4+2],data.water1[i*4+3]))>.001:masks_exact=false
    var winding_exact:bool=indices.size()==data.indices.size()
    for i in range(0,indices.size(),3):
        if indices[i]!=data.indices[i] or indices[i+1]!=data.indices[i+2] or indices[i+2]!=data.indices[i+1]:winding_exact=false
    var platforms={}
    var valid:bool=exact and masks_exact and winding_exact
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
    var route_data=JSON.parse_string(FileAccess.get_file_as_string(preload("res://scripts/citadel_surface_variant.gd").data_path("res://data/citadel-front-harbor-route.json")))
    var hosts=w.castle_adapter.west_city.find_children("highland-west-city","Node3D",true,false)
    var front_samples:int=0;var front_min:float=INF
    if hosts.size()==1:
        var host:Node3D=hosts[0]
        for x in [30.0,45.0]:
            for z in [94.0,98.0]:
                var q:Vector3=ocean.to_local(host.to_global(Vector3(x,route_data.approach.dockY,z)))
                var radial:Vector3=q.normalized();var nearest:float=INF
                for i in range(0,indices.size(),3):
                    var hit=Geometry3D.ray_intersects_triangle(q+radial*5,-radial,vertices[indices[i]],vertices[indices[i+1]],vertices[indices[i+2]])
                    if hit!=null:nearest=minf(nearest,(q+radial*5).distance_to(hit))
                if nearest<INF:front_samples+=1;front_min=minf(front_min,nearest-5-.067)
    platforms["front-harbor-quay"]={"samples":front_samples,"clearance_with_max_wave":front_min}
    valid=valid and front_samples==4 and front_min>.1
    var report={"source_positions_exact":exact,"water_channels_match":masks_exact,"source_winding_reversed_correctly":winding_exact,"vertices":vertices.size(),"triangles":indices.size()/3,"platforms":platforms,"passed":valid,"scope":"Source ocean geometry and four corners of each quay and boarding deck above maximum wave; not boat docking, character traversal or full combat"}
    FileAccess.open("res://../artifacts/pipeline/citadel-common-frame/godot-ocean.json" if OS.get_cmdline_user_args().has("--common-frame") else "res://../artifacts/pipeline/citadel-ocean-sync/godot-ocean.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));w.queue_free();await process_frame;quit(0 if report.passed else 1)
