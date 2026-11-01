import bpy,json
from pathlib import Path
base=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
out=base/'artifacts/pipeline/courier-no-goggles-20261028'
bpy.ops.wm.open_mainfile(filepath=str(base/'artifacts/pipeline/courier-blender-threeview-20261008/v2/courier-v2.blend'))
removed=[o.name for o in bpy.data.objects if o.name.startswith('goggle_')]
assert len(removed)==6,removed
for name in removed:bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'courier-no-goggles.blend'))
for name in ['body','head','legL','legR','kneeL','kneeR','armL','armR','elbowL','elbowR','handL','handR','letter']:
 e=bpy.data.objects.get(name);assert e is not None,name
 kids=[o for o in e.children if o.type=='MESH']
 if len(kids)>1:
  bpy.ops.object.select_all(action='DESELECT')
  for o in kids:o.select_set(True)
  bpy.context.view_layer.objects.active=kids[0];bpy.ops.object.join();bpy.context.object.name=name+'_mesh'
bpy.ops.export_scene.gltf(filepath=str(base/'assets/models/courier-blender-v2/courier-no-goggles.glb'),export_format='GLB',export_extras=True,export_apply=True)
(out/'build.json').write_text(json.dumps({'removed':removed,'source':'original pre-merge v2 blend','chinChanged':False,'otherGeometryChanged':False},indent=2))
