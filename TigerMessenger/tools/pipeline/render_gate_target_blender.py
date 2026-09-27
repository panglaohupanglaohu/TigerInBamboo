import bpy
from mathutils import Vector
from pathlib import Path
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
s=bpy.context.scene;target=Vector((-2,5,15))
for o in list(s.objects):
 if o.type in ('CAMERA','LIGHT'):bpy.data.objects.remove(o,do_unlink=True)
d=bpy.data.cameras.new('Gate_Target_Camera');o=bpy.data.objects.new('Gate_Target_Camera',d);s.collection.objects.link(o);o.location=(55,96,42);o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler();d.lens=44;s.camera=o
ld=bpy.data.lights.new('Gate_Dusk_Sun','SUN');ld.energy=2.4;ld.color=(1,.72,.48);ld.angle=.14;lo=bpy.data.objects.new('Gate_Dusk_Sun',ld);s.collection.objects.link(lo);lo.rotation_euler=(-.65,.5,-.55)
ld=bpy.data.lights.new('Gate_Sky_Fill','AREA');ld.energy=50000;ld.color=(.48,.58,1);ld.size=40;lo=bpy.data.objects.new('Gate_Sky_Fill',ld);s.collection.objects.link(lo);lo.location=(30,-25,45);lo.rotation_euler=(target-lo.location).to_track_quat('-Z','Y').to_euler()
s.world=bpy.data.worlds.new('GateReviewDusk');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.11,.2,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.5
s.render.engine='CYCLES';s.cycles.samples=24;s.render.resolution_x=1500;s.render.resolution_y=1100;s.render.resolution_percentage=100;s.render.filepath=str(ROOT/'artifacts/pipeline/gate-of-sighs-build/blender-final.png')
bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(ROOT/'assets/models/optimized/gate-of-sighs/gate-of-sighs-v1.blend'),{s},fake_user=True)
