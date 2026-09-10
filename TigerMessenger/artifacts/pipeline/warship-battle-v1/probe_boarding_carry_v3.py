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
bpy.ops.wm.open_mainfile(filepath=str(s.OUT/'warship-battle-v1.blend'));scene=bpy.context.scene;scene.frame_set(241);bpy.context.view_layer.update();boatobs=[o for o in scene.objects if o.type=='MESH' and not o.hide_render and s.ident(o)];bg=geo(boatobs);before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/optimized/roman-family-v1/romanSoldier_gladius_blue.glb'));new=set(scene.objects)-before;roots=[o for o in new if not o.parent];control=bpy.data.objects.new('REVIEW boarder control',None);scene.collection.objects.link(control)
for o in roots:o.parent=control
walker=[o for o in new if o.type=='MESH'];records=[]

spec=importlib.util.spec_from_file_location('roman',ROOT/'tools/pipeline/build_roman_family_blender.py');roman=importlib.util.module_from_spec(spec);spec.loader.exec_module(roman)
nodes={roman.ident(o):o for o in new if roman.ident(o)};skin=nodes['n18'].data.materials[0]
# Review-only narrow carry: shield held close ahead, sword upright beside right shoulder.
left=Vector((.10,.26,0));shieldrot=Matrix.Rotation(-math.pi/2,4,'Y')
roman.setm(nodes['n32'],Matrix.Translation(left-shieldrot.to_3x3()@Vector((-.055,0,0)))@shieldrot)
roman.arm(nodes,'L',(0,.305,.067),left,(0,1,0),skin,hint=(.1,-1,-.2))
right=Vector((.115,.25,-.028));axis=Vector((.08,.996,0)).normalized()
roman.setm(nodes['n50'],Matrix.Translation(right-axis*.04)@Vector((0,1,0)).rotation_difference(axis).to_matrix().to_4x4());roman.arm(nodes,'R',(0,.305,-.067),right,axis,skin,hint=(.6,-1,.2))
for xi in range(17):
 x=.30+xi*.025
 for z in [-.16,-.17,-.18,-.19]:
  for yaw in [-.2,-.1,0,.1,.2]:
   s.setm(control,Matrix.Translation((x,.663-.0094164694,z))@Matrix.Rotation(yaw,4,'Y')@Matrix.Diagonal((1/1.7,1/1.7,1/1.7,1)));bpy.context.view_layer.update();hits=crossings(bg,geo(walker));records.append({'xi':xi,'x':x,'z':z,'yaw':yaw,'contacts':hits})
(s.ART/'boarding-carry-v3-probe.json').write_text(json.dumps({'carryTransforms':{roman.ident(o):roman.flat(roman.local(o)) for o in new if roman.ident(o)},'samples':records},indent=2));print(json.dumps({'samples':len(records),'clear':sum(not r['contacts'] for r in records),'clearPerX':{str(x):sum(not r['contacts'] for r in records if r['xi']==x) for x in range(17)}},indent=2))
