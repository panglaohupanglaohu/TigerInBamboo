extends Node3D
var day: Node3D
var night: Node3D
var camera: Camera3D
var environment: Environment
var sun: DirectionalLight3D
var label: Label
var street_lights: Array[OmniLight3D] = []
var ground_faces: Array[PackedVector3Array] = []
var batches: Array[MeshInstance3D] = []
var batched_sources: Array[MeshInstance3D] = []
var reflection_probe: ReflectionProbe
var water_material: ShaderMaterial
var wave_clock: float=0.0
var blue := false
var material_cache: Dictionary = {}
var terrain: Node3D
var report: Dictionary = {"scope":"Isolated original factory vs WFC blue-night candidate; no world deployment or navigation acceptance.","views":[],"camera":{"position":[38,38,70],"target":[0,20,0],"fov":48},"original_layout_preserved":false}
func _ready() -> void:
    if "--capture" in OS.get_cmdline_user_args(): get_tree().root.unfocusable=true
    get_tree().root.content_scale_size=Vector2i(1280,960)
    get_tree().root.content_scale_mode=Window.CONTENT_SCALE_MODE_VIEWPORT
    day=load("res://assets/original.glb").instantiate()
    night=load("res://assets/candidate.glb").instantiate()
    add_child(day)
    add_child(night)
    for node in night.find_children("*", "Node3D", true, false):
        if node.name=="citadel-continuous-mountain-terrain-system": node.visible=false
    terrain=load("res://assets/terrain-blue.glb").instantiate()
    night.add_child(terrain)
    adapt(day,false)
    adapt(night,true)
    camera=Camera3D.new()
    add_child(camera)
    camera.position=Vector3(38,38,70)
    camera.look_at(Vector3(0,20,0))
    camera.fov=48
    camera.far=600
    camera.current=true
    var world=WorldEnvironment.new()
    environment=Environment.new()
    world.environment=environment
    add_child(world)
    environment.background_mode=Environment.BG_COLOR
    environment.ambient_light_source=Environment.AMBIENT_SOURCE_COLOR
    environment.tonemap_mode=Environment.TONE_MAPPER_FILMIC
    sun=DirectionalLight3D.new()
    add_child(sun)
    sun.rotation_degrees=Vector3(-42,-28,0)
    sun.shadow_enabled=true
    report["layering"]=load("res://stage.gd").install(night)
    collect_ground()
    report["original_tree_grounding"]=[]
    report["plant_variants"]=[]
    for tree in night.find_children("*","Node3D",true,false):
        var parts=String(tree.name).split("-")
        if not String(tree.name).begins_with("highland-mountain-vegetation-") or not String(tree.name).trim_prefix("highland-mountain-vegetation-").is_valid_int():continue
        var before=tree.global_position
        var foot=ground_hit(Vector3(before.x,180,before.z),300.0)
        if foot!=null:
            tree.global_position=foot
            for child in tree.get_children():
                if child is Node3D:child.visible=false
            var number=int(String(tree.name).trim_prefix("highland-mountain-vegetation-"))
            var variant="cypress" if number%4==1 else "broadleaf"
            var replacement=load("res://assets/"+variant+"-reference-v1.glb").instantiate()
            tree.add_child(replacement)
            replacement.scale=Vector3.ONE*0.9
            report.plant_variants.append({"original_root":String(tree.name),"variant":variant})
            report.original_tree_grounding.append({"name":String(tree.name),"before_y":before.y,"after_y":foot.y})

    # Reuse actual low-level luminous window anchors, separated into small light pools.
    var anchors: Array[Vector3] = []
    for node in night.find_children("*", "MeshInstance3D", true, false):
        if not "window" in String(node.name).to_lower(): continue
        var pos: Vector3 = node.global_transform * node.get_aabb().get_center()
        if pos.y < 2 or pos.y > 21: continue
        anchors.append(pos)
    anchors.sort_custom(func(a: Vector3,b: Vector3): return a.z > b.z)
    var selected: Array[Vector3] = []
    for pos in anchors:
        var separated := true
        for existing in selected:
            if existing.distance_to(pos) < 7.0: separated=false
        if not separated: continue
        var outward=Vector3(pos.x,0,pos.z).normalized()
        var foot=ground_hit(pos+outward*2.1+Vector3(0,-0.6,0))
        if foot==null: continue
        selected.append(pos)
        var fixture=load("res://assets/lamp.glb").instantiate()
        night.add_child(fixture)
        fixture.global_position=foot
        fixture.scale=Vector3.ONE*1.4
        for mesh in fixture.find_children("*","MeshInstance3D",true,false):
            for surf in range(mesh.mesh.get_surface_count()):
                var mat=mesh.get_active_material(surf).duplicate() as StandardMaterial3D
                mat.shading_mode=BaseMaterial3D.SHADING_MODE_PER_PIXEL
                if String(mesh.name)=="n5":
                    mat.emission_enabled=true
                    mat.emission=Color("ffb969")
                    mat.emission_energy_multiplier=2.0
                mesh.set_surface_override_material(surf,mat)

        var lamp=OmniLight3D.new()
        night.add_child(lamp)
        lamp.global_position=foot + Vector3(0.48,1.95,0)*1.4
        lamp.light_color=Color("ff822e") if selected.size()%4!=0 else Color("f38696")
        lamp.light_energy=2.4
        lamp.omni_range=7.0
        lamp.omni_attenuation=1.4
        lamp.shadow_enabled=true
        street_lights.append(lamp)
        if selected.size()==6: break
    report["street_anchors"]=selected.map(func(v:Vector3):return [v.x,v.y,v.z])
    report["lamp_count"]=street_lights.size()
    report["garden_pockets"]=[]
    for loc in [Vector3(-17,12,19),Vector3(17,12,18),Vector3(-10,12,19),Vector3(8,12,21)]:
        var foot=ground_hit(loc)
        if foot==null:continue
        var variant="cypress" if report.garden_pockets.size()==2 else "broadleaf"
        var tree=load("res://assets/"+variant+"-reference-v1.glb").instantiate()
        night.add_child(tree)
        tree.position=foot
        tree.scale=Vector3.ONE*0.85
        report.garden_pockets.append([foot.x,foot.y,foot.z])
        for mesh in tree.find_children("*","MeshInstance3D",true,false):
            for surf in range(mesh.mesh.get_surface_count()):
                var mat=mesh.get_active_material(surf).duplicate() as StandardMaterial3D
                mat.shading_mode=BaseMaterial3D.SHADING_MODE_PER_PIXEL
                mat.roughness=0.95
                mesh.set_surface_override_material(surf,mat)
    build_batches()
    for water in night.find_children("*","MeshInstance3D",true,false):
        if String(water.name)=="highland-waterfront-water":
            var mat=ShaderMaterial.new()
            mat.shader=load("res://water.gdshader")
            water.material_override=mat
            water_material=mat
            water.layers=2
    var probe=ReflectionProbe.new()
    add_child(probe)
    probe.position=Vector3(0,8,30)
    probe.size=Vector3(100,100,140)
    probe.cull_mask=1
    probe.intensity=2.0
    reflection_probe=probe
    probe.update_mode=ReflectionProbe.UPDATE_ONCE
    report["reflection"]={"method":"Scene cubemap probe plus screen-space reflection on original curved water; opaque procedural ripple normals","probe_position":[0,8,30],"limitations":"SSR misses offscreen surfaces; probe is a spatial approximation, refresh required for dynamic world changes"}
    environment.ssr_enabled=true
    environment.ssr_max_steps=128
    environment.ssao_enabled=true
    environment.glow_enabled=true
    environment.glow_intensity=0.45
    var ui=CanvasLayer.new()
    add_child(ui)
    label=Label.new()
    label.position=Vector2(24,20)
    label.add_theme_font_size_override("font_size",22)
    ui.add_child(label)
    set_blue(true)
    if "--capture" in OS.get_cmdline_user_args(): call_deferred("capture")
func adapt(root: Node3D, is_blue: bool) -> void:
    for n in root.find_children("*", "Node3D", true, false):
        var low=String(n.name).to_lower()
        if low.begins_with("highland-light-volumes") or low.begins_with("highland-hero-cloud") or low.begins_with("backlit-highlight"):
            n.visible=false # Source procedural billboard shaders have no glTF equivalent; same exclusion in both views.
        if n is not MeshInstance3D: continue
        for i in range(n.mesh.get_surface_count()):
            var original=n.get_active_material(i)
            if not original is StandardMaterial3D: continue
            var ancestry=String(n.get_parent().name).to_lower()+"/"+String(n.get_parent().get_parent().name).to_lower()
            var role="base"
            if "window" in low or "CitadelWindow" in original.resource_name: role="window"
            elif "canopy" in low or "grass" in low or "vegetation" in low or "vegetation" in ancestry: role="plant"
            elif "citadel-oskar-grid-mountain-surface" in low or "ravine-walls" in ancestry: role="mountain"
            elif "waterfront-water" in low: role="water"
            var peach=absi(String(n.get_path()).hash())%4==0
            var key=str(original.get_instance_id())+":"+role+":"+str(is_blue)
            if role=="window" and is_blue: key+=":"+str(peach)
            if not material_cache.has(key):
                var mat=original.duplicate() as StandardMaterial3D
                mat.shading_mode=BaseMaterial3D.SHADING_MODE_PER_PIXEL
                var arrays=n.mesh.surface_get_arrays(i)
                mat.vertex_color_use_as_albedo=arrays[Mesh.ARRAY_COLOR]!=null and arrays[Mesh.ARRAY_COLOR].size()>0
                mat.vertex_color_is_srgb=false
                mat.roughness=0.88
                if is_blue:
                    if role=="mountain":
                        mat.vertex_color_use_as_albedo=false
                        mat.albedo_color=Color("173451")
                        mat.emission_enabled=false
                    elif role=="window":
                        mat.vertex_color_use_as_albedo=false
                        var warm=Color("ff982e") if not peach else Color("eb457e")
                        mat.albedo_color=warm
                        mat.emission_enabled=true
                        mat.emission=warm
                        mat.emission_energy_multiplier=0.55
                        mat.albedo_texture=null
                        mat.emission_texture=null
                    elif role=="plant":
                        mat.vertex_color_use_as_albedo=false
                        mat.albedo_color=Color("295c43")
                    elif role=="water":
                        mat.vertex_color_use_as_albedo=false
                        mat.albedo_color=Color("183655")
                        mat.transparency=BaseMaterial3D.TRANSPARENCY_DISABLED
                        mat.metallic=0.72
                        mat.roughness=0.12
                        mat.cull_mode=BaseMaterial3D.CULL_DISABLED
                    else:
                        mat.emission_enabled=false
                        if mat.albedo_color.r>0.25 and mat.albedo_color.g>0.2:
                            mat.albedo_color=mat.albedo_color.lerp(Color("e4e4e1"),0.48)
                material_cache[key]=mat
            n.set_surface_override_material(i,material_cache[key])
func set_blue(value: bool) -> void:
    blue=value
    day.visible=not blue
    night.visible=blue
    environment.background_color=Color("133969") if blue else Color("becdd0")
    environment.ambient_light_color=Color("80b7dd") if blue else Color("dbe4ec")
    environment.ambient_light_energy=0.22 if blue else 0.42
    environment.fog_enabled=blue
    environment.fog_light_color=Color("2b6995")
    environment.fog_light_energy=0.4
    environment.fog_density=0.0025
    sun.light_color=Color("8abcf4") if blue else Color("fff0d1")
    sun.light_energy=0.35 if blue else 0.7
    label.text="蓝夜第四轮 · 1总览 / 2水岸 / 3侧面 / L街灯 / 空格日夜" if blue else "原工厂日景 · Godot 同镜头 | 空格切换"
func _unhandled_key_input(event: InputEvent) -> void:
    if "--capture" in OS.get_cmdline_user_args(): return
    if event.is_action_pressed("ui_accept"): set_blue(not blue)
    if event is InputEventKey and event.pressed:
        if event.keycode==KEY_1:
            camera.position=Vector3(38,38,70)
            camera.look_at(Vector3(0,20,0))
        elif event.keycode==KEY_2:
            camera.position=Vector3(10,10,53)
            camera.look_at(Vector3(0,12,8))
        elif event.keycode==KEY_3:
            camera.position=Vector3(-40,26,58)
            camera.look_at(Vector3(0,16,0))
    if event is InputEventKey and event.pressed and event.keycode==KEY_L:
        for lamp in street_lights: lamp.visible=not lamp.visible
func capture() -> void:
    set_blue(true)
    label.visible=false
    report.views=[]
    for mode in ["batched","shore-reflection","side"]:
        set_batches(mode!="unbatched")
        for lamp in street_lights:lamp.shadow_enabled=mode!="shore-no-shadow"
        environment.ssr_enabled=mode!="shore-no-reflection"
        reflection_probe.intensity=0.0 if mode=="shore-no-reflection" else 2.0
        water_material.set_shader_parameter("wave_time",0.9 if mode=="shore-wave" else 0.0)
        if mode.begins_with("shore"):
            camera.position=Vector3(10,10,53)
            camera.look_at(Vector3(0,12,8))
        elif mode=="side":
            camera.position=Vector3(-40,26,58)
            camera.look_at(Vector3(0,16,0))
        else:
            camera.position=Vector3(38,38,70)
            camera.look_at(Vector3(0,20,0))
        reflection_probe.update_mode=ReflectionProbe.UPDATE_ALWAYS
        for i in range(8):await get_tree().process_frame
        reflection_probe.update_mode=ReflectionProbe.UPDATE_ONCE
        for i in range(16):await get_tree().process_frame
        var frame_times=[]
        for i in range(30):
            var start=Time.get_ticks_usec()
            await get_tree().process_frame
            frame_times.append((Time.get_ticks_usec()-start)/1000.0)
        frame_times.sort()
        await RenderingServer.frame_post_draw
        get_viewport().get_texture().get_image().save_png(ProjectSettings.globalize_path("res://../"+mode+".png"))
        report.views.append({"mode":mode,"camera_position":[camera.position.x,camera.position.y,camera.position.z],"draw_calls":RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME),"primitives":RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME),"frame_median_ms":frame_times[15],"ssr":environment.ssr_enabled,"local_shadows":mode!="shore-no-shadow"})
    report["scope"]="Layering iteration 1: isolated four-level city candidate; full gameplay/navigation not implemented."
    FileAccess.open("res://../godot-report.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    reflection_probe.queue_free()
    for i in range(4):await get_tree().process_frame
    get_tree().quit()
func build_batches() -> void:
    var groups={}
    for mesh in night.find_children("*","MeshInstance3D",true,false):
        if not mesh.is_visible_in_tree() or mesh.get_child_count()>0 or "water" in String(mesh.name).to_lower():continue
        var eligible=true
        for i in range(mesh.mesh.get_surface_count()):
            var mat=mesh.get_active_material(i)
            if not mat is StandardMaterial3D or mat.transparency!=BaseMaterial3D.TRANSPARENCY_DISABLED:eligible=false
        if not eligible:continue
        for i in range(mesh.mesh.get_surface_count()):
            var mat=mesh.get_active_material(i)
            var key=str(mat.get_instance_id())+":"+str(mesh.cast_shadow)
            if not groups.has(key):
                var tool=SurfaceTool.new()
                tool.begin(Mesh.PRIMITIVE_TRIANGLES)
                tool.set_material(mat)
                groups[key]={"tool":tool,"shadow":mesh.cast_shadow}
            groups[key].tool.append_from(mesh.mesh,i,night.global_transform.affine_inverse()*mesh.global_transform)
        batched_sources.append(mesh)
    for key in groups:
        var mesh=MeshInstance3D.new()
        mesh.mesh=groups[key].tool.commit()
        mesh.cast_shadow=groups[key].shadow
        night.add_child(mesh)
        batches.append(mesh)
    report["batching"]={"source_meshes":batched_sources.size(),"batches":batches.size(),"scope":"Static opaque leaf meshes only; transparent surfaces and water retained separately"}
    set_batches(true)
func set_batches(value:bool) -> void:
    for mesh in batches:mesh.visible=value
    for mesh in batched_sources:mesh.visible=not value
func _process(dt:float) -> void:
    if "--capture" in OS.get_cmdline_user_args():return
    wave_clock+=dt
    if water_material:water_material.set_shader_parameter("wave_time",wave_clock)
func collect_ground() -> void:
    for mesh in night.find_children("*","MeshInstance3D",true,false):
        if not mesh.is_visible_in_tree() or "water" in String(mesh.name).to_lower():continue
        var parent_node=mesh
        var vegetation=false
        while parent_node!=night and parent_node!=null:
            var tag=String(parent_node.name).to_lower()
            if "canopy" in tag or "vegetation" in tag or "grass" in tag or "tree" in tag:vegetation=true
            parent_node=parent_node.get_parent()
        if vegetation:continue
        var vertices=mesh.mesh.get_faces()
        for i in range(0,vertices.size(),3):
            var a=mesh.global_transform*vertices[i]
            var b=mesh.global_transform*vertices[i+1]
            var c=mesh.global_transform*vertices[i+2]
            if abs((b-a).cross(c-a).normalized().y)>0.65 or "mountain-surface" in String(mesh.name):ground_faces.append(PackedVector3Array([a,b,c]))
func ground_hit(origin: Vector3, max_distance: float=10.0):
    var closest=null
    for face in ground_faces:
        var hit=Geometry3D.ray_intersects_triangle(origin,Vector3.DOWN,face[0],face[1],face[2])
        if hit!=null and origin.y-hit.y<max_distance and (closest==null or hit.y>closest.y):closest=hit
    return closest

