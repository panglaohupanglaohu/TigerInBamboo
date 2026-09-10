import bpy,json,importlib.util
from pathlib import Path
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2];sp=importlib.util.spec_from_file_location('ship',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(sp);sp.loader.exec_module(s)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/models/optimized/warship-battle-v9/warship-battle-v9.blend'));sc=bpy.context.scene;obs={s.ident(o):o for o in sc.objects if s.ident(o)};root=obs['n0']
def shape(o):
 m=s.rootmat(o,root);v=[m@(s.CI.to_3x3()@p.co) for p in o.data.vertices];bounds=[tuple(min(p[k] for p in v) for k in range(3)),tuple(max(p[k] for p in v) for k in range(3))];return bounds,BVHTree.FromPolygons(v,[list(p.vertices) for p in o.data.polygons])
def hit(a,b):return all(a[0][0][k]<b[0][1][k]-1e-5 and b[0][0][k]<a[0][1][k]-1e-5 for k in range(3)) and bool(a[1].overlap(b[1]))
weapons={k:shape(o) for k,o in obs.items() if k.startswith('add:stored-weapon-')};inter=[]
for i,(ka,va) in enumerate(weapons.items()):
 for kb,vb in list(weapons.items())[i+1:]:
  if hit(va,vb):inter.append([ka,kb])
crew={k:o for k,o in obs.items() if o.type=='MESH' and (':i' in k or k.startswith('add:hand-') or k.startswith('add:forearm-'))};collisions=[]
for f in [1,61,81,101,121,151,181,195,211,241,301]:
 sc.frame_set(f);bpy.context.view_layer.update()
 for k,o in crew.items():
  shaped=shape(o)
  for kw,weapon in weapons.items():
   if hit(shaped,weapon):collisions.append([f,k,kw])
r={'weaponCount':len(weapons),'weaponIntersections':inter,'sampledFrames':11,'crewWeaponIntersections':collisions,'bounds':{k:v[0] for k,v in weapons.items()},'scope':'Triangle surface overlaps, 11 representative saved poses; not swept continuous-volume clearance'};(ROOT/'artifacts/pipeline/warship-roman-crew/weapon-clearance.json').write_text(json.dumps(r,indent=2));print(json.dumps({'weaponIntersections':inter,'crewWeaponIntersections':collisions}),flush=True)
