import bpy, json, math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'project/assets/terrain.glb'))
def smooth(v):
 v=max(0.,min(1.,v));return v*v*(3-2*v)
def lift(p):
 distance=math.hypot(p.x,p.y)
 return smooth((distance-33)/18)*smooth((p.z-5)/12)*(12+8*smooth((p.y+8)/30)+5*smooth((p.x-20)/25))
changes=[]
for o in bpy.data.objects:
 if o.type!='MESH' or 'citadel-oskar-grid-mountain-surface' not in o.name: continue
 o.data=o.data.copy();inv=o.matrix_world.inverted();count=0;maximum=0.;protected=0
 for v in o.data.vertices:
  w=o.matrix_world@v.co;delta=lift(w)
  if math.hypot(w.x,w.y)<=33 or w.z<=5: protected+=1;assert delta==0
  if delta>0:
   w.z+=delta;v.co=inv@w;count+=1;maximum=max(maximum,delta)
 o.data.update();changes.append(dict(name=o.name,modifiedVertices=count,protectedVertices=protected,maxLift=maximum))
assert changes and any(c['modifiedVertices'] for c in changes)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'terrain-blue-night-v1.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'project/assets/terrain-blue.glb'),export_format='GLB',export_extras=True)
(root/'terrain-report.json').write_text(json.dumps({'passed':True,'scope':'Only original mountain surface and matching highlight geometry; building/shore foundations protected. Vegetation refinement still pending.','changed':changes,'protectedRule':'radial distance <=33 or height <=5 untouched','source':'project/assets/terrain.glb','output':'project/assets/terrain-blue.glb'},indent=2))
