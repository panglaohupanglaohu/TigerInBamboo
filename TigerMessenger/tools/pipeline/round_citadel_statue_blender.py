import bpy, math, json
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
folder=ROOT/'assets/models/optimized/citadel-statue';out=ROOT/'artifacts/pipeline/citadel-round-pedestal';out.mkdir(parents=True,exist_ok=True)
name='TigerMessenger_Round_Statue_Review'
scene=bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
for o in list(scene.objects):bpy.data.objects.remove(o,do_unlink=True)
bpy.context.window.scene=scene
with bpy.data.libraries.load(str(folder/'citadel-soldier-statue-r03.blend'),link=False) as (a,b):
 b.objects=[n for n in a.objects if n.startswith(('soldier-statue-','pedestal-')) or n=='figure-carved-plinth']
for o in b.objects:
 if o:scene.collection.objects.link(o)
report=[]
for o in list(scene.objects):
 if not (o.name.startswith('pedestal-') or o.name.startswith('figure-carved-plinth')):continue
 pts=[o.matrix_world@v.co for v in o.data.vertices];lo=min(v.z for v in pts);hi=max(v.z for v in pts);r=max(max(abs(v.x),abs(v.y)) for v in pts)
 mat=o.data.materials[0];label=o.name.split('.')[0];bpy.data.objects.remove(o,do_unlink=True)
 bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=r,depth=hi-lo,location=(0,0,(hi+lo)/2))
 n=bpy.context.object;n.name=label;n.data.materials.append(mat)
 n.data.transform(n.matrix_world);n.matrix_world=Matrix.Identity(4)
 report.append({'name':label,'radius':r,'bottom':lo,'top':hi})
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(folder/'citadel-soldier-statue-r04.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_yup=True)
world=bpy.data.worlds.new('Round statue world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.22,.28,1);scene.world=world
for label,loc,power in [('key',(-5,-7,10),1800),('fill',(5,0,8),1100)]:
 d=bpy.data.lights.new(label,'AREA');d.energy=power;d.size=6;o=bpy.data.objects.new(label,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,3))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('review-camera');cam=bpy.data.objects.new('review-camera',d);scene.collection.objects.link(cam);cam.location=(9,-14,8);cam.rotation_euler=(Vector((0,0,3.2))-cam.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=8.4;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.render.resolution_x=700;scene.render.resolution_y=850;scene.render.resolution_percentage=100;scene.render.filepath=str(out/'blender-r04.png');bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(str(folder/'citadel-soldier-statue-r04.blend'),{scene},fake_user=True)
(out/'pedestal.json').write_text(json.dumps(report,indent=2))
print('Round pedestal exported; original soldier sculpture preserved.')
