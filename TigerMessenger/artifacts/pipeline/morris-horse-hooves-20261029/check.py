import bpy,math,json
from pathlib import Path
r=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger');b=r/'artifacts/pipeline/morris-horse-hooves-20261029'
bpy.ops.wm.open_mainfile(filepath=str(r/'assets/models/morris-horse/horse-v13.blend'))
a=bpy.data.objects['MorrisHorseRig'];samples=0
for i in range(16):
 for p in a.pose.bones:
  if any(k in p.name for k in ['upper','lower','cannon','neck','tail']):
   p.rotation_mode='XYZ';p.rotation_euler.x=.35*math.sin(i*.5+len(p.name))
 bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
 for o in bpy.data.objects:
  if o.type=='MESH':
   m=o.evaluated_get(dg).to_mesh()
   for v in list(m.vertices)[::7]:
    assert all(math.isfinite(c) for c in v.co);samples+=1
   o.evaluated_get(dg).to_mesh_clear()
(b/'finite-audit.json').write_text(json.dumps({'poses':16,'finiteSamples':samples,'bones':len(a.pose.bones),'scope':'finite evaluated deformation only, not gait/grounding/appearance acceptance'},indent=2))
