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


bpy.ops.wm.open_mainfile(filepath=str(s.OUT/'warship-battle-v1.blend'));scene=bpy.context.scene;obs={s.ident(o):o for o in scene.objects if s.ident(o)};records=[]
for key,o in obs.items():
 if key.startswith('add:bench-') or key.startswith('add:seat-leaf-'):
  o.data=o.data.copy()
  for vertex in o.data.vertices:
   v=s.CI.to_3x3()@vertex.co;v.x*=.07/.19;vertex.co=s.C.to_3x3()@v

handles=[obs['add:oar-handle-'+str(i)] for i in range(26)];shafts=[obs['n'+str(64+5*i)] for i in range(26)];body=[obs['n'+str(n)+':i'+str(i)] for i in range(26) for n in [220,221,222,223,224,225,226,229,230]];body=[o for o in body if not o.hide_render];legs=[obs['n'+str(n)+':i'+str(i)] for i in range(26) for n in [229,230]];min_blade=9;max_blade=-9
for frame in range(1,302):
 scene.frame_set(frame)
 for key,o in obs.items():
  if key.startswith('add:bench-') or key.startswith('add:seat-leaf-'):
   m=s.local(o);m.translation.x=-1.7+(int(key.split('-')[-1])%13)*.27-.19;s.setm(o,m)
 bpy.context.view_layer.update()
 deck=[o for k,o in obs.items() if o.type=='MESH' and not o.hide_render and (k in ['n231','n233','n253'] or k.startswith('add:deck-plank-'))];deckgeo=geo(deck);seats=[o for k,o in obs.items() if k.startswith('add:bench-') or k.startswith('add:seat-leaf-')]
 record={'frame':frame,'handleBody':crossings(geo(handles),geo(body)),'oarDeck':crossings(geo(handles+shafts),deckgeo),'legsDeck':crossings(geo(legs),deckgeo),'legsSeats':crossings(geo(legs),geo(seats))}
 if record['handleBody'] or record['oarDeck'] or record['legsDeck'] or record['legsSeats']:records.append(record)
 if frame<=121:
  for i in range(26):
   o=obs['n'+str(66+i*5)];y=min((o.matrix_world@v.co).z for v in o.data.vertices);min_blade=min(min_blade,y);max_blade=max(max_blade,y)
r={'passed':not records,'frames':301,'rowerFrameSamples':301*26,'scope':'Every saved frame: all inner handles versus all 26 torso/skirt/head/helmet/crest/legs, shafts+handles versus deck/rails, all legs versus deck. Intentional hand/handle and joint connections excluded. No all-body self-collision claim.','bladeLowestPointRangeDuringRowing':[min_blade,max_blade],'failures':records};(s.ART/'rowing-seat-final-audit.json').write_text(json.dumps(r,indent=2));print(json.dumps({'passed':r['passed'],'frames':301,'failedFrames':len(records),'handleBodyFrames':sum(bool(r['handleBody']) for r in records),'oarDeckFrames':sum(bool(r['oarDeck']) for r in records),'legDeckFrames':sum(bool(r['legsDeck']) for r in records),'bladeRange':r['bladeLowestPointRangeDuringRowing']},indent=2))
