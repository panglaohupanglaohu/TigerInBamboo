import bpy
import math
from math import pi
from mathutils import Vector, Matrix, Euler
import sys
from pathlib import Path

# Setup camera and render settings
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'CYCLES'
if scene.render.engine == 'CYCLES':
    scene.cycles.samples = 32
    scene.cycles.device = 'CPU'

scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100

# Set view transform to Standard for vibrant accurate sRGB color rendition
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'

# Remove existing cameras and lights, hide floor
for o in list(scene.objects):
    if o.type in ['CAMERA', 'LIGHT']:
        bpy.data.objects.remove(o, do_unlink=True)
    elif 'floor' in o.name.lower() or 'ground' in o.name.lower() or 'studio' in o.name.lower():
        o.hide_render = True

# Create camera
cam_data = bpy.data.cameras.new('TargetCam')
cam_data.type = 'PERSP'
cam_data.lens = 85 # Portrait lens for minimal perspective distortion
cam_obj = bpy.data.objects.new('TargetCam', cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj

# Create key, fill, and rim lights
key_data = bpy.data.lights.new('KeyLight', 'SUN')
key_data.energy = 1.1
key_data.color = (1.0, 0.98, 0.95)
key_obj = bpy.data.objects.new('KeyLight', key_data)
key_obj.rotation_euler = Euler((math.radians(45), math.radians(15), math.radians(-35)), 'XYZ')
scene.collection.objects.link(key_obj)

fill_data = bpy.data.lights.new('FillLight', 'SUN')
fill_data.energy = 0.65
fill_data.color = (0.94, 0.96, 1.0)
fill_obj = bpy.data.objects.new('FillLight', fill_data)
fill_obj.rotation_euler = Euler((math.radians(30), math.radians(-20), math.radians(140)), 'XYZ')
scene.collection.objects.link(fill_obj)

rim_data = bpy.data.lights.new('RimLight', 'SUN')
rim_data.energy = 0.45
rim_data.color = (1.0, 0.96, 0.88)
rim_obj = bpy.data.objects.new('RimLight', rim_data)
rim_obj.rotation_euler = Euler((math.radians(-35), math.radians(25), math.radians(215)), 'XYZ')
scene.collection.objects.link(rim_obj)

# Set world background: Camera sees warm parchment (#f4eedf), ambient lighting is soft
if not scene.world:
    scene.world = bpy.data.worlds.new("World")
scene.world.use_nodes = True
tree = scene.world.node_tree
tree.nodes.clear()

node_out = tree.nodes.new('ShaderNodeOutputWorld')
node_mix = tree.nodes.new('ShaderNodeMixShader')
node_light_path = tree.nodes.new('ShaderNodeLightPath')
node_bg_cam = tree.nodes.new('ShaderNodeBackground')
node_bg_env = tree.nodes.new('ShaderNodeBackground')

# Camera sees exact warm parchment tone (#f4eedf)
node_bg_cam.inputs['Color'].default_value = (0.957, 0.933, 0.875, 1.0)
node_bg_cam.inputs['Strength'].default_value = 1.0

# Environment ambient light is soft so dark materials keep rich contrast
node_bg_env.inputs['Color'].default_value = (0.957, 0.933, 0.875, 1.0)
node_bg_env.inputs['Strength'].default_value = 0.22

tree.links.new(node_light_path.outputs['Is Camera Ray'], node_mix.inputs['Fac'])
tree.links.new(node_bg_env.outputs['Background'], node_mix.inputs[1])
tree.links.new(node_bg_cam.outputs['Background'], node_mix.inputs[2])
tree.links.new(node_mix.outputs['Shader'], node_out.inputs['Surface'])

# Target center of courier head (in courier blend, head is around y=1.635)
head_center = Vector((0, 0.05, 1.635)) # will adjust based on actual head object

# Find head object if exists
head_obj = bpy.data.objects.get('head')
if head_obj:
    head_center = head_obj.matrix_world.translation.copy()
    head_center.z += 0.05

print(f"Target head center: {head_center}")

views = [
    ('front', Vector((0, -0.75, 0)), 'Front View'),
    ('profile', Vector((-0.75, 0, 0)), 'Profile View'),
    ('three_quarter', Vector((-0.55, -0.55, 0.08)), 'Three-Quarter View')
]

out_dir = Path(sys.argv[sys.argv.index('--out') + 1]) if '--out' in sys.argv else Path('./temp_renders')
out_dir.mkdir(parents=True, exist_ok=True)

for name, offset, desc in views:
    cam_pos = head_center + offset
    cam_pos.z += 0.02
    cam_obj.location = cam_pos
    direction = head_center - cam_pos
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()
    
    out_file = out_dir / f"{name}.png"
    scene.render.filepath = str(out_file)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {desc} to {out_file}")

