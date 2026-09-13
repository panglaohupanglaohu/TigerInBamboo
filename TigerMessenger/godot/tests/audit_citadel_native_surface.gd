extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1440,900)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    w.set_process(false);w.set_physics_process(false)
    var frame:Transform3D=w.castle_adapter.original.global_transform
    w.camera.global_position=frame*Vector3(0,34,170)
    w.camera.look_at(frame*Vector3(-6,14,42),frame.basis.y.normalized());w.camera.fov=52
    var results:Array=[]
    for uv in [Vector2(.145,.41),Vector2(.27,.61),Vector2(.585,.92)]:
        var pixel=uv*Vector2(root.get_visible_rect().size)
        var origin=w.camera.project_ray_origin(pixel);var direction=w.camera.project_ray_normal(pixel)
        var hits:Array=[]
        for mesh in w.find_children("*","MeshInstance3D",true,false):
            if not mesh.is_visible_in_tree() or mesh.layers==0 or mesh.mesh==null:continue
            var inverse=mesh.global_transform.affine_inverse()
            var local_origin=inverse*origin;var local_direction=(inverse.basis*direction).normalized()
            if mesh.mesh.get_aabb().intersects_ray(local_origin,local_direction)==null:continue
            var nearest:float=INF;var surface_index:int=-1;var vertex_colors:Array=[];var vertex_normals:Array=[]
            for surface in range(mesh.mesh.get_surface_count()):
                var arrays=mesh.mesh.surface_get_arrays(surface)
                var vs:PackedVector3Array=arrays[Mesh.ARRAY_VERTEX]
                var ix=arrays[Mesh.ARRAY_INDEX]
                var count:int=ix.size() if ix!=null and ix.size()>0 else vs.size()
                for k in range(0,count-2,3):
                    var ids=[k,k+1,k+2] if ix==null or ix.size()==0 else [ix[k],ix[k+1],ix[k+2]]
                    var hit=Geometry3D.ray_intersects_triangle(local_origin,local_direction,vs[ids[0]],vs[ids[1]],vs[ids[2]])
                    if hit!=null:
                        var distance:float=origin.distance_to(mesh.global_transform*hit)
                        if distance<nearest:
                            nearest=distance;surface_index=surface
                            vertex_colors=[];vertex_normals=[]
                            for id in ids:
                                if arrays[Mesh.ARRAY_COLOR]!=null:vertex_colors.append(str(arrays[Mesh.ARRAY_COLOR][id]))
                                if arrays[Mesh.ARRAY_NORMAL]!=null:vertex_normals.append(str(arrays[Mesh.ARRAY_NORMAL][id]))
            if nearest<INF:
                var material=mesh.get_active_material(surface_index)
                hits.append({"path":str(mesh.get_path()),"distance":nearest,"source":mesh.get_meta("extras",{}),"material":material.resource_path if material else "none","vertex_colors":vertex_colors,"vertex_normals":vertex_normals,"class":material.get_class() if material else "none"})
        hits.sort_custom(func(a,b):return a.distance<b.distance)
        results.append({"uv":[uv.x,uv.y],"hits":hits.slice(0,5)})
    FileAccess.open("res://../artifacts/pipeline/citadel-common-water-diagnosis/godot-surface-rays.json",FileAccess.WRITE).store_string(JSON.stringify(results,"  "))
    print(JSON.stringify(results));w.queue_free();await process_frame;quit()
