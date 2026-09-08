extends Node3D
var day: Node3D
var night: Node3D
var camera: Camera3D
var environment: Environment
var sun: DirectionalLight3D
var label: Label
var blue := false
var material_cache: Dictionary = {}
var terrain: Node3D
var report: Dictionary = {"scope":"Isolated original factory vs WFC blue-night candidate; no world deployment or navigation acceptance.","views":[],"camera":{"position":[38,38,70],"target":[0,20,0],"fov":48},"original_layout_preserved":true}
func _ready() -> void:
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
    for pos in [Vector3(-8,12,14),Vector3(8,18,-3)]:
        var lamp=OmniLight3D.new()
        night.add_child(lamp)
        lamp.position=pos
        lamp.light_color=Color("ffbc72")
        lamp.light_energy=2.2
        lamp.omni_range=22
        lamp.shadow_enabled=false
    var ui=CanvasLayer.new()
    add_child(ui)
    label=Label.new()
    label.position=Vector2(24,20)
    label.add_theme_font_size_override("font_size",22)
    ui.add_child(label)
    set_blue(false)
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
                    elif role=="plant": mat.albedo_color=mat.albedo_color.lerp(Color("164557"),0.55)
                    elif role=="water":
                        mat.albedo_color=Color("183655")
                        mat.roughness=0.2
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
    label.text="蓝夜候选 · WFC + Blender 远山 | 空格切换" if blue else "原工厂日景 · Godot 同镜头 | 空格切换"
func _unhandled_key_input(event: InputEvent) -> void:
    if event.is_action_pressed("ui_accept"): set_blue(not blue)
func capture() -> void:
    for value in [false,true]:
        set_blue(value)
        for i in range(8): await get_tree().process_frame
        await RenderingServer.frame_post_draw
        var file="../blue-night.png" if value else "../original-day.png"
        get_viewport().get_texture().get_image().save_png(ProjectSettings.globalize_path("res://"+file))
        report.views.append({"blue":value,"file":file,"draw_calls":RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME),"rendered_objects":RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME),"primitives":RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME),"viewport":str(get_viewport().size),"material_resources":material_cache.size(),"real_lights":3 if value else 1,"shadow_lights":1})
    report["window_materials"]=[]
    for key in material_cache:
        if ":window:true" in key:
            var m=material_cache[key]
            report.window_materials.append({"albedo":str(m.albedo_color),"emission":str(m.emission),"energy":m.emission_energy_multiplier})
    var f=FileAccess.open("res://../godot-report.json",FileAccess.WRITE)
    f.store_string(JSON.stringify(report,"  "))
    get_tree().quit()
