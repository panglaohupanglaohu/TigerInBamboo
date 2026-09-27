import bpy, json, math
from pathlib import Path
from mathutils import Vector
base=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
asset=base/'assets/models/optimized/highland-gate'
out=base/'artifacts/pipeline/highland-gate-thirty-rounds'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(asset/'highland-gate-r30.glb'))
meshes=[o for o in bpy.data.objects if o.type=='MESH']
bad=sum(not math.isfinite(c) for o in meshes for v in o.data.vertices for c in v.co)
if bad: raise ValueError('Nonfinite imported geometry')
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=16
scene.render.resolution_x=1200;scene.render.resolution_y=800;scene.render.resolution_percentage=100
world=bpy.data.worlds.new('Highland pale daylight');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.78,.88,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65;scene.world=world
light=bpy.data.lights.new('Sun','SUN');light.energy=2.3;light.angle=.12;obj=bpy.data.objects.new('Sun',light);scene.collection.objects.link(obj);obj.rotation_euler=(.4,-.55,-.5)
camdata=bpy.data.cameras.new('Gate reference camera');cam=bpy.data.objects.new('Gate reference camera',camdata);scene.collection.objects.link(cam);cam.location=(-24,60,17);cam.rotation_euler=(Vector((0,0,12))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=34;scene.camera=cam
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(asset/'highland-gate-r30.blend'))
report={'meshes':len(meshes),'nonfinite':bad,'vertices':sum(len(o.data.vertices)for o in meshes),'packed_images':sum(bool(i.packed_file)for i in bpy.data.images),'scope':'Independent background archive of actual Web geometry; not a replacement of foreground Blender session or native gameplay'}
(out/'r30-blender.json').write_text(json.dumps(report,indent=2))
scene.render.filepath=str(out/'r30-blender.png');bpy.ops.render.render(write_still=True)
