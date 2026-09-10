extends SceneTree
var world
const OUT="/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/saihoji-pines-v1/"
func _initialize():call_deferred("run")
func gather_bounds(node:Node,bounds:Array)->void:
    if node is MeshInstance3D and node.is_visible_in_tree():bounds.append(node.global_transform*node.get_aabb())
    for child in node.get_children():gather_bounds(child,bounds)
func capture(label:String,box:AABB):
    var center=box.get_center();var up=center.normalized();var side=up.cross(Vector3.UP).normalized()
    var span=maxf(box.size.length(),8.0)
    world.camera.global_position=center+(up*0.6+side*0.75+up.cross(side)*0.45).normalized()*span*0.9
    world.camera.look_at(center,up);world.camera.far=1500.0;world.camera.near=0.1
    for i in 4:await process_frame
    await RenderingServer.frame_post_draw
    get_root().get_texture().get_image().save_png(OUT+label+".png")
    return {"camera":str(world.camera.global_transform),"bounds":str(box),"draw_calls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),"primitives":Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)}
func run():
    world=load("res://scenes/saihoji_battle_world.tscn").instantiate();root.add_child(world)
    for i in 240:
        await process_frame
        if world.ready_for_battle:break
    world.set_process(false);world.set_physics_process(false)
    for layer in world.find_children("*","CanvasLayer",true,false):layer.visible=false
    var report=world.pine_visual.report.duplicate(true);report.load_error=world.load_error
    if report.count!=25:
        FileAccess.open(OUT+"godot-layout-report.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));quit(1);return
    var boxes:Array=[]
    var material_rows:Array=[]
    for e in world.pine_visual.entries:
        gather_bounds(e.candidate,boxes)
        for mesh in e.candidate.find_children("*","MeshInstance3D",true,false):
            if not mesh.is_visible_in_tree():continue
            for si in mesh.mesh.get_surface_count():
                var mat=mesh.get_active_material(si)
                material_rows.append({"seed":e.row.seed,"material":mat.resource_name,"albedo":str(mat.albedo_color),"vertex_color":mat.vertex_color_use_as_albedo,"actual_linear":Array([mat.albedo_color.srgb_to_linear().r,mat.albedo_color.srgb_to_linear().g,mat.albedo_color.srgb_to_linear().b,mat.albedo_color.a]),"expected_linear":e.row.palette.get(mat.resource_name,[])})
    var all:AABB=boxes[0]
    for box in boxes:all=all.merge(box)
    var near_boxes:Array=[];gather_bounds(world.pine_visual.entries[0].candidate,near_boxes)
    var near:AABB=near_boxes[0]
    for box in near_boxes:near=near.merge(box)
    report.materials=material_rows;report.far=await capture("godot-six-gardens-after",all);report.near=await capture("godot-pine-near-after",near)
    world.pine_visual.show_candidates(false)
    report.near_original=await capture("godot-pine-near-before",near)
    report.far_original=await capture("godot-six-gardens-before",all)
    world.pine_visual.show_candidates(true)
    report.parents_follow_kun=world.pine_visual.entries.all(func(e):return world.kun.is_ancestor_of(e.anchor))
    report.tree_collision_modified=false;report.automatic_lod=false
    report.scope="25 LOD0 roots/seed/material and original layout GPU check, not full battle/FPS/nav acceptance"
    FileAccess.open(OUT+"godot-layout-report.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    quit()
