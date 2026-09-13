import bpy, math, json, os
BASE = "/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/citadel-battle-blender"
sc = bpy.context.scene
w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
nt = w.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
out = nt.nodes.new("ShaderNodeOutputWorld")
bg = nt.nodes.new("ShaderNodeBackground")
geo = nt.nodes.new("ShaderNodeNewGeometry")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
mr = nt.nodes.new("ShaderNodeMapRange")
ramp = nt.nodes.new("ShaderNodeValToRGB")
mr.inputs['From Min'].default_value = -0.16
mr.inputs['From Max'].default_value = 0.62
nt.links.new(geo.outputs['Incoming'], sep.inputs['Vector'])
nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
ramp.color_ramp.elements[0].color = (0.24,0.47,0.64,1)
ramp.color_ramp.elements[1].color = (0.03,0.095,0.32,1)
nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 2.2
nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
info = {"links": [(l.from_node.bl_idname, l.from_socket.name, l.to_node.bl_idname, l.to_socket.name) for l in nt.links],
        "world": w.name, "scene_world": sc.world.name if sc.world else None}
cam_d = bpy.data.cameras.new("C"); cam_d.clip_end = 4000
cam = bpy.data.objects.new("C", cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0,-30,6); cam.rotation_euler = (math.radians(84),0,0)
sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 320, 180
for tag, vt in (("agx","AgX"), ("std","Standard")):
    try: sc.view_settings.view_transform = vt
    except Exception: pass
    sc.render.filepath = os.path.join(BASE, "sky_%s.png" % tag)
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(sc.render.filepath)
    px = list(img.pixels[:])
    info["px_"+tag] = [round(px[i],4) for i in range(0, 12)]
    info["max_"+tag] = round(max(px), 4)
    bpy.data.images.remove(img)
print("SKY_PROBE", json.dumps(info))
