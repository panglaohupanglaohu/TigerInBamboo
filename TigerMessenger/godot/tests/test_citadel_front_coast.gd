extends SceneTree
func _initialize():call_deferred("run")
func run():
    root.size=Vector2i(1600,1000)
    var world=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(world);await process_frame
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-front-coast.json"))
    var report=world.get_meta("front_coast_report",{});var checked=0;var max_error=0.0
    for mesh in world.model.find_children("*","MeshInstance3D",true,false):
        if not mesh.has_meta("front_coast_source"):continue
        var source:String=str(mesh.get_meta("extras",{}).get("sourcePath",""))
        for part in data.parts:
            if not ((part.name=="camp-flat-patch" and source.ends_with("/camp-flat-patch[%d]"%int(part.ordinal))) or (part.name!="camp-flat-patch" and source.begins_with(part.name+"[") and not source.contains("/"))):continue
            var vertices=mesh.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
            assert(vertices.size()*3==part.positions.size())
            var m=part.matrix
            var frame=Transform3D(Basis(Vector3(m[0],m[1],m[2]),Vector3(m[4],m[5],m[6]),Vector3(m[8],m[9],m[10])),Vector3(m[12],m[13],m[14]))
            for i in range(vertices.size()):
                var expected=world.model.to_global(frame*Vector3(part.positions[i*3],part.positions[i*3+1],part.positions[i*3+2]))
                max_error=maxf(max_error,expected.distance_to(mesh.to_global(vertices[i])));checked+=1
    var expected_vertices=0
    for part in data.parts:expected_vertices+=part.positions.size()/3
    report.expected_vertices=expected_vertices
    report.checked_vertices=checked;report.max_world_error=max_error;report.passed=report.get("passed",false) and report.parts==data.parts.size() and checked==expected_vertices and max_error<.001
    report.scope="Actual native released scene matches shared Blender world vertices; not boat dynamics or full campaign."
    FileAccess.open("res://../artifacts/pipeline/citadel-master-terrain/front-coast-godot.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    if OS.get_cmdline_user_args().has("--capture"):
        world.set_process(false);world.set_physics_process(false)
        for ui in world.find_children("*","CanvasLayer",true,false):ui.visible=false
        world.assault_route.set_visible(false)
        var city=world.castle_adapter.original.find_child("highland-west-city",true,false)
        world.camera.global_position=city.to_global(Vector3(85,15,140))
        world.camera.look_at(city.to_global(Vector3(56,0,106)),city.global_basis.y.normalized());world.camera.fov=55
        world.window_lights.set_enabled(false)
        await process_frame;await RenderingServer.frame_post_draw
        root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-master-terrain/front-coast-godot.png")
    print(JSON.stringify(report));world.free();quit(0 if report.passed else 1)
