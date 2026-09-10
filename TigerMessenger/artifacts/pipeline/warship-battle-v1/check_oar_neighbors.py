import bpy,math,json,importlib.util
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_ray_tri
ROOT=Path(__file__).resolve().parents[3];spec=importlib.util.spec_from_file_location('ship',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
def geo(obs):
 vs=[];fs=[];names=[]
 for o in obs:
  o.data.calc_loop_triangles();off=len(vs);vs.extend(o.matrix_world@v.co for v in o.data.vertices)
  for t in o.data.loop_triangles:fs.append(tuple(i+off for i in t.vertices));names.append(s.ident(o) or o.name)
 return vs,fs,names,BVHTree.FromPolygons(vs,fs,all_triangles=True)
def crossings(a,b):
 av,af,an,ab=a;bv,bf,bn,bb=b;hits=set()
 for ai,bi in ab.overlap(bb):
  A=[av[i] for i in af[ai]];B=[bv[i] for i in bf[bi]];found=False
  for poly,target in [(A,B),(B,A)]:
   for p,q in zip(poly,poly[1:]+poly[:1]):
    d=q-p
    if d.length<1e-8:continue
    hit=intersect_ray_tri(*target,d.normalized(),p,True)
    if hit is not None and 2e-5<(hit-p).dot(d.normalized())<d.length-2e-5:found=True;break
   if found:break
  if found:hits.add((an[ai],bn[bi]))
 return sorted(hits)



bpy.ops.wm.open_mainfile(filepath=str(s.OUT/'warship-battle-v1.blend'));scene=bpy.context.scene;obs={s.ident(o):o for o in scene.objects if s.ident(o)};records=[];parts=[obs['n'+str(n+5*i)] for i in range(26) for n in [64,66]]
for frame in range(1,302):
 scene.frame_set(frame);bpy.context.view_layer.update();g=geo(parts);hits=crossings(g,g);hits=[h for h in hits if (int(h[0][1:])-64)//5 != (int(h[1][1:])-64)//5]
 if hits:records.append({'frame':frame,'pairs':hits})
r={'passed':not records,'frames':301,'scope':'Different original oars: shaft and blade triangle-face intersections over every saved frame. Same-oar connections excluded.','failures':records};(s.ART/'oar-neighbor-validation.json').write_text(json.dumps(r,indent=2));print(json.dumps({'passed':not records,'failedFrames':len(records)}))
