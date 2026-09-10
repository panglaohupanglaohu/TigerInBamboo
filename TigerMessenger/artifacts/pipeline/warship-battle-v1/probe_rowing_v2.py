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

bpy.ops.wm.open_mainfile(filepath=str(s.OUT/'warship-battle-v1.blend'));scene=bpy.context.scene;obs={s.ident(o):o for o in scene.objects if s.ident(o)};records=[];ps=json.loads((s.ART/'source-poses.json').read_text())
for frame in [1,11,21,31,41,51,61,81,101,121,151,181]:
 scene.frame_set(frame);s.pose(obs,ps['frames'][frame-1],obs['add:boarding-hinge']);bpy.context.view_layer.update()
 deck=[o for k,o in obs.items() if o.type=='MESH' and not o.hide_render and (k in ['n231','n233','n253'] or k.startswith('add:deck-plank-'))];deckgeo=geo(deck)
 for i in range(26):
  handle=obs['add:oar-handle-'+str(i)];shaft=obs['n'+str(64+i*5)];body=[obs['n'+str(n)+':i'+str(i)] for n in [220,221,222,223,224,225,226,229,230]];body=[o for o in body if not o.hide_render]
  records.append({'frame':frame,'rower':i,'handleBody':crossings(geo([handle]),geo(body)),'oarDeck':crossings(geo([handle,shaft]),deckgeo),'legsDeck':crossings(geo([obs['n229:i'+str(i)],obs['n230:i'+str(i)]]),deckgeo)})
(s.ART/'rowing-clearance-v2.json').write_text(json.dumps({'samples':len(records),'frames':12,'failures':[r for r in records if r['handleBody'] or r['oarDeck'] or r['legsDeck']]},indent=2));print(json.dumps({'samples':len(records),'handleBodyFailures':sum(bool(r['handleBody']) for r in records),'oarDeckFailures':sum(bool(r['oarDeck']) for r in records),'legDeckFailures':sum(bool(r['legsDeck']) for r in records)},indent=2))
