extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    root.size=Vector2i(1440,1000)
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    w.set_process(false);w.set_physics_process(false)
    for ui in w.find_children("*","CanvasLayer",true,false):ui.visible=false
    w.assault_route.set_visible(false)
    var frame:Transform3D=w.castle_adapter.original.find_child("highland-west-city",true,false).global_transform
    w.camera.global_position=frame*Vector3(35,26,109)
    w.camera.look_at(frame*Vector3(61,5,74),frame.basis.y.normalized())
    w.camera.fov=48
    var paving=w.castle_adapter.original.find_child("west-city-plaza-paving-ring",true,false)
    assert(paving is MeshInstance3D)
    var triangles=0
    for surface in range(paving.mesh.get_surface_count()):
        var arrays=paving.mesh.surface_get_arrays(surface)
        triangles+=(arrays[Mesh.ARRAY_INDEX].size() if arrays[Mesh.ARRAY_INDEX]!=null and arrays[Mesh.ARRAY_INDEX].size()>0 else arrays[Mesh.ARRAY_VERTEX].size())/3
    assert(triangles==4590)
    print("Native new plaza paving triangles: ",triangles)
    var pads:Array=[];var foundations:Array=[]
    for n in w.castle_adapter.original.find_children("*","MeshInstance3D",true,false):
        if n.name=="contour-step-0":pads.append({"path":str(n.get_path()),"layers":n.layers})
        if n.name=="highland-town-foundation-platform":foundations.append({"path":str(n.get_path()),"visible":n.is_visible_in_tree()})
    print(JSON.stringify({"foundation_rendering":foundations,"edit_pad_rendering":pads}))
    var out="res://../artifacts/pipeline/citadel-new-plaza-paving/"
    w.window_lights.set_enabled(true)
    var materials=[]
    for i in range(paving.mesh.get_surface_count()):
        var m=paving.get_active_material(i)
        materials.append({"class":m.get_class(),"name":m.resource_name,"transparency":m.transparency if m is StandardMaterial3D else -1})
    print(JSON.stringify({"paving_transform":str(paving.global_transform),"materials":materials}))
    for variant in ["normal","hidden","unshaded"]:
        if variant=="hidden":paving.hide()
        if variant=="unshaded":
            paving.show()
            for i in range(paving.mesh.get_surface_count()):
                var m=paving.get_active_material(i).duplicate()
                m.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
                paving.set_surface_override_material(i,m)
        await process_frame
        await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png(out+"native-debug-"+variant+".png")
    print("Captured actual citadel world, production day/night toggle, same castle-local camera")
    w.queue_free();await process_frame;quit()
