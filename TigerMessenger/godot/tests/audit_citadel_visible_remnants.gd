extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1152,720)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    w.set_process(false);w.set_physics_process(false)
    var frame:Transform3D=w.castle_adapter.original.global_transform
    w.camera.global_position=frame*Vector3(0,24,150)
    w.camera.look_at(frame*Vector3(16,15,12),frame.basis.y.normalized());w.camera.fov=50
    var report:Array=[]
    for pixel in [Vector2(160,470),Vector2(80,505),Vector2(322,389)]:
        var screen_pixel:Vector2=pixel*w.camera.get_viewport().get_visible_rect().size/Vector2(1152,720)
        var origin:Vector3=w.camera.project_ray_origin(screen_pixel)
        var direction:Vector3=w.camera.project_ray_normal(screen_pixel)
        var hits:Array=[]
        for node in w.find_children("*","MeshInstance3D",true,false):
            if not node.is_visible_in_tree() or node.layers==0 or node.mesh==null:continue
            var inv:Transform3D=node.global_transform.affine_inverse()
            var local_origin:Vector3=inv*origin
            var local_direction:Vector3=(inv.basis*direction).normalized()
            var nearest:float=INF
            var point:Vector3
            for surface in range(node.mesh.get_surface_count()):
                var a:Array=node.mesh.surface_get_arrays(surface)
                var v:PackedVector3Array=a[Mesh.ARRAY_VERTEX]
                var index:PackedInt32Array=a[Mesh.ARRAY_INDEX] if a[Mesh.ARRAY_INDEX]!=null else PackedInt32Array()
                var count:int=index.size() if not index.is_empty() else v.size()
                for i in range(0,count-2,3):
                    var ia:int=index[i] if not index.is_empty() else i
                    var ib:int=index[i+1] if not index.is_empty() else i+1
                    var ic:int=index[i+2] if not index.is_empty() else i+2
                    var h=Geometry3D.ray_intersects_triangle(local_origin,local_direction,v[ia],v[ib],v[ic])
                    if h!=null:
                        var wp:Vector3=node.global_transform*h
                        var d:float=origin.distance_to(wp)
                        if d<nearest:nearest=d;point=wp
            if nearest<INF:hits.append({"path":str(node.get_path()),"distance":nearest,"castle_local":frame.affine_inverse()*point,"extras":node.get_meta("extras",{})})
        hits.sort_custom(func(a,b):return a.distance<b.distance)
        report.append({"pixel":pixel,"hits":hits.slice(0,5)})
    FileAccess.open("res://../artifacts/pipeline/citadel-cove-retirement/godot-remnants.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    print(JSON.stringify(report));w.queue_free();await process_frame;quit()
