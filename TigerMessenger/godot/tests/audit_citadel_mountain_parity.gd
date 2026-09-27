extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1600,1000)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    w.set_process(false);w.set_physics_process(false)
    var city=w.castle_adapter.original.find_child("highland-west-city",true,false)
    w.camera.global_position=city.to_global(Vector3(100,30,68))
    w.camera.look_at(city.to_global(Vector3(61,19,24)),city.global_basis.y.normalized());w.camera.fov=55
    var results:Array=[]
    for uv in [Vector2(.14,.18),Vector2(.18,.26),Vector2(.21,.34),Vector2(.26,.44),Vector2(.17,.60)]:
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
                if mesh.mesh.surface_get_primitive_type(surface)!=Mesh.PRIMITIVE_TRIANGLES:continue
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
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/mountain-parity-native-rays.json",FileAccess.WRITE).store_string(JSON.stringify(results,"  "))
    var released=w.castle_adapter.original.find_child("CitadelReleasedLayout",true,false)
    var visible_terrain=[]
    for n in w.model.find_children("citadel-oskar-grid-mountain-surface","MeshInstance3D",true,false):
        if n.is_visible_in_tree():visible_terrain.append(str(n.get_path()))
    var grade=w.old_harbor_grade_adapter.replacement
    var preserved=[]
    for n in grade.get_children():
        if n is Node3D and n.is_visible_in_tree():preserved.append(str(n.name))
    var passed=visible_terrain.size()==1 and "/CitadelReleasedLayout/" in visible_terrain[0]
    for i in range(3):passed=passed and results[i].hits.is_empty()
    for i in range(3,5):passed=passed and results[i].hits.size()>0 and "/CitadelReleasedLayout/" in results[i].hits[0].path
    passed=passed and "citadel-old-shore-approach" in preserved and "old-harbor-scene" in preserved
    var web=JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/pipeline/citadel-master-terrain/mountain-parity-web-rays.json"))
    var forests=[]
    for spec in web.forests:
        var meshes=0;var vertices=0;var groups=0
        for group in w.model.find_children(spec.name,"Node3D",true,false):
            if not group.is_visible_in_tree():continue
            groups+=1
            for mesh in group.find_children("*","MeshInstance3D",true,false):
                if not mesh.is_visible_in_tree():continue
                meshes+=1
                for surface in range(mesh.mesh.get_surface_count()):vertices+=mesh.mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX].size()
        var ok=vertices==spec.vertices and meshes==spec.meshes and (groups==1 if spec.meshes>0 else true)
        passed=passed and ok;forests.append({"name":spec.name,"passed":ok,"groups":groups,"meshes":meshes,"vertices":vertices,"web":spec})
    var report={"passed":passed,"forests":forests,"visible_mountain":visible_terrain,"retired":released.get_meta("retired_old_harbor_terrain",[]),"preserved_grade_children":preserved,"rays":results,"scope":"Current native triangle silhouettes at five fixed-camera probes; one current mountain, old harbor and approach retained. Does not certify full terrain or gameplay."}
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/mountain-parity-report.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    if OS.get_cmdline_user_args().has("--capture"):
        for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
        w.assault_route.set_visible(false);w.window_lights.set_enabled(true)
        await process_frame;await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-master-terrain/mountain-parity-after-godot.png")
    print(JSON.stringify(report));w.queue_free();await process_frame;quit(0 if passed else 1)
