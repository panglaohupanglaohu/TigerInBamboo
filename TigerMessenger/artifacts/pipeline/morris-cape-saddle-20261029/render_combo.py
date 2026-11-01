import bpy,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[3];out=Path(__file__).parent
bpy.ops.wm.open_mainfile(filepath=str(R/'assets/models/morris-princess/princess-v18-mounted.blend'))
p=bpy.data.objects['MorrisPrincess'];p.location=(0,.045,1.071)
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(R/'assets/models/morris-horse/horse-v13.glb'));added=set(bpy.data.objects)-before
for o in added:
 if o.parent is None:o.scale=(.45,.45,.45)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Combo studio');scene.world.color=(.35,.35,.35)
for pos,pow in [((3,-4,5),650),((-3,1,3),400)]:
 bpy.ops.object.light_add(type='AREA',location=pos);bpy.context.object.data.energy=pow;bpy.context.object.data.size=4
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=2.5
for name,pos in [('side',(4,0,1.2)),('back',(0,4,1.2)),('rear-quarter',(3,4,1.6))]:
 cam.location=pos;cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/('combo-'+name+'.png'));bpy.ops.render.render(write_still=True)
