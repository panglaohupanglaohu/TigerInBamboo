import bpy,json,importlib.util
from pathlib import Path
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2];sp=importlib.util.spec_from_file_location('ship',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(sp);sp.loader.exec_module(s)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/models/optimized/warship-battle-v10/warship-battle-v10.blend'));sc=bpy.context.scene;obs={s.ident(o):o for o in sc.objects if s.ident(o)};root=obs['n0']
def shape(o):
 m=s.rootmat(o,root);v=[m@(s.CI.to_3x3()@p.co) for p in o.data.vertices];bounds=[tuple(min(p[k] for p in v) for k in range(3)),tuple(max(p[k] for p in v) for k in range(3))];return bounds,BVHTree.FromPolygons(v,[list(p.vertices) for p in o.data.polygons])
def hit(a,b):return all(a[0][0][k]<b[0][1][k]-1e-5 and b[0][0][k]<a[0][1][k]-1e-5 for k in range(3)) and bool(a[1].overlap(b[1]))
weapons={k:shape(o) for k,o in obs.items() if k.startswith('add:stored-weapon-')};inter=[]
for i,(ka,va) in enumerate(weapons.items()):
 for kb,vb in list(weapons.items())[i+1:]:
  if hit(va,vb):inter.append([ka,kb])
obstacleIds=['n1','n233','n253','n273','n275','n277','n279','n281','n283']+['n'+str(n) for n in list(range(235,252,2))+list(range(255,272,2))]
obstacles={k:shape(obs[k]) for k in obstacleIds if k in obs and obs[k].type=='MESH'};obstacleHits=[]
crew={k:o for k,o in obs.items() if o.type=='MESH' and (':i' in k or k.startswith('add:hand-') or k.startswith('add:forearm-'))};collisions=[]
for f in range(1,302):
 sc.frame_set(f);bpy.context.view_layer.update()
 for k,o in crew.items():
  shaped=shape(o)
  for ko,obstacle in obstacles.items():
   if hit(shaped,obstacle):obstacleHits.append([f,k,ko])
  for kw,weapon in weapons.items():
   if hit(shaped,weapon):collisions.append([f,k,kw])
r={'weaponCount':len(weapons),'weaponIntersections':inter,'sampledFrames':301,'crewWeaponIntersections':collisions,'crewHullRailCargoIntersections':obstacleHits,'bounds':{k:v[0] for k,v in weapons.items()},'scope':'Triangle surface overlaps, 301 saved poses; not swept continuous-volume clearance'};(ROOT/'artifacts/pipeline/warship-roman-crew/weapon-clearance.json').write_text(json.dumps(r,indent=2));print(json.dumps({'weaponIntersections':inter,'crewWeaponIntersections':collisions,'crewHullRailCargoIntersections':obstacleHits}),flush=True)
