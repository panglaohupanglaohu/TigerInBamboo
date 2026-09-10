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
bpy.ops.wm.open_mainfile(filepath=str(s.OUT/'warship-battle-v1.blend'));scene=bpy.context.scene;scene.frame_set(241);bpy.context.view_layer.update();boatobs=[o for o in scene.objects if o.type=='MESH' and not o.hide_render and s.ident(o)];bg=geo(boatobs);support=geo([o for o in boatobs if s.ident(o) in ['n231','add:bow-landing'] or s.ident(o).startswith('add:deck-plank-') or s.ident(o).startswith('add:boarding-plank-')]);before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/optimized/roman-family-v1/romanSoldier_gladius_blue.glb'));new=set(scene.objects)-before;roots=[o for o in new if not o.parent];control=bpy.data.objects.new('REVIEW boarder control',None);scene.collection.objects.link(control)
for o in roots:o.parent=control
walker=[o for o in new if o.type=='MESH'];records=[]

spec=importlib.util.spec_from_file_location('roman',ROOT/'tools/pipeline/build_roman_family_blender.py');roman=importlib.util.module_from_spec(spec);spec.loader.exec_module(roman)
nodes={roman.ident(o):o for o in new if roman.ident(o)};skin=nodes['n18'].data.materials[0]
# Review-only narrow carry: shield held close ahead, sword upright beside right shoulder.
left=Vector((.18,.26,0));shieldrot=Matrix.Rotation(-math.pi/2,4,'Y')
roman.setm(nodes['n32'],Matrix.Translation(left-shieldrot.to_3x3()@Vector((-.055,0,0)))@shieldrot)
roman.arm(nodes,'L',(0,.305,.067),left,(0,1,0),skin,hint=(.1,-1,-.2))
right=Vector((.115,.25,-.028));axis=Vector((.08,.996,0)).normalized()
roman.setm(nodes['n50'],Matrix.Translation(right-axis*.04)@Vector((0,1,0)).rotation_difference(axis).to_matrix().to_4x4());roman.arm(nodes,'R',(0,.305,-.067),right,axis,skin,hint=(.6,-1,.2))

# Explicit review-only carry pose, same original soldier geometry, no model scaling trick.
route=[]
for j in range(127):route.append((-1.25+j*2.90/126,-.18,0))
for j in range(1,33):
 t=j/32;angle=t*math.pi/2
 route.append((1.65+.29*math.sin(angle),-.18+.48*(1-math.cos(angle)),-angle))
for j in range(1,71):route.append((1.94,.30+j*1.49/70,-math.pi/2))
# Arms/hand to weapon are intended, but armor, head, legs must not intersect shield or sword.
def ancestors(o):
 while o is not None:
  yield o;o=o.parent
weapon=[o for o in walker if any(s.ident(p) in ['n32','n50'] for p in ancestors(o))]
body=[o for o in walker if o not in weapon and ('hand' not in o.name.lower()) and ('forearm' not in o.name.lower()) and s.ident(o) not in ['n18','n21']]
s.setm(control,Matrix.Diagonal((1/1.7,1/1.7,1/1.7,1)));bpy.context.view_layer.update();selfhits=crossings(geo(weapon),geo(body))
for j,(x,z,yaw) in enumerate(route):
 floor=.663 if z<.48 else .664+.019*math.cos(.12)-(z-.48)*math.tan(.12)
 s.setm(control,Matrix.Translation((x,floor-.0094164694,z))@Matrix.Rotation(yaw,4,'Y')@Matrix.Diagonal((1/1.7,1/1.7,1/1.7,1)));bpy.context.view_layer.update();lift=0
 for key in ['n24','n27']:
  foot=nodes[key]
  foot.data.calc_loop_triangles();points=[vertex.co for vertex in foot.data.vertices]
  for tri in foot.data.loop_triangles:
   vv=[foot.data.vertices[k].co for k in tri.vertices];points.extend([(vv[0]+vv[1]+vv[2])/3,*[(vv[k]+vv[(k+1)%3])/2 for k in range(3)]])
  for point in points:
   p=foot.matrix_world@point;hit=support[3].ray_cast(Vector((p.x,p.y,4)),Vector((0,0,-1)),5)
   if hit[0] is not None:lift=max(lift,hit[0].z+.003-p.z)
 m=s.local(control);m.translation.y+=lift;s.setm(control,m);bpy.context.view_layer.update();hits=crossings(bg,geo(walker));records.append({'footLift':lift,'sample':j,'x':x,'y':floor-.0094164694+lift,'z':z,'yaw':yaw,'contacts':hits})
(s.ART/'boarding-path-validation.json').write_text(json.dumps({'carryTransforms':{roman.ident(o):roman.flat(roman.local(o)) for o in new if roman.ident(o)},'selfContacts':selfhits,'samples':records},indent=2));print(json.dumps({'samples':len(records),'clear':sum(not r['contacts'] for r in records),'failed':[{k:v for k,v in r.items() if k!='y'} for r in records if r['contacts']],'selfContacts':selfhits},indent=2))

# Save a separate review scene, never bake the troop into the ship GLB.
passed=not selfhits and not any(r['contacts'] for r in records)
contract={'status':'sampled_path_passed' if passed else 'blocked','shipGLB':s.sha(s.OUT/'warship-battle-v1.glb'),'actorGLB':str((ROOT/'assets/models/optimized/roman-family-v1/romanSoldier_gladius_blue.glb').relative_to(ROOT)),'actorSHA256':s.sha(ROOT/'assets/models/optimized/roman-family-v1/romanSoldier_gladius_blue.glb'),'coordinates':'Three ship-local; +X bow,+Y up; actor +X facing','testedShipWorldScale':1.7,'actorParentLocalScale':1/1.7,'boardingPoseFrame':241,'carryTransforms':{roman.ident(o):roman.flat(roman.local(o)) for o in new if roman.ident(o)},'path':[{k:v for k,v in r.items() if k!='contacts'} for r in records],'maxFootSupportLift':max(r['footLift'] for r in records),'limitations':['Single actual blue gladius actor, retained whole body, armor, shield and sword; no 25-agent scheduling.','Runtime must ground-fit the board and use foot support/IK. Route is only for the tested .12 rad board.','Pose uses same source geometry and grip endpoints, but is an authored carry pose, not imported battle animation.']}
(s.OUT/'boarding-path.json').write_text(json.dumps(contract,indent=2))
if passed:
 for o in boatobs:
  o.animation_data_clear()
 for o in list(scene.objects):
  if o not in new and o!=control and o.animation_data:o.animation_data_clear()
 for o in new:o['reviewOnly']=True
 for j,r in enumerate(records):
  s.setm(control,Matrix.Translation((r['x'],r['y'],r['z']))@Matrix.Rotation(r['yaw'],4,'Y')@Matrix.Diagonal((1/1.7,1/1.7,1/1.7,1)));control.keyframe_insert('location',frame=j+1);control.keyframe_insert('rotation_euler',frame=j+1);control.keyframe_insert('scale',frame=j+1)
 for layer in control.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for key in fc.keyframe_points:key.interpolation='LINEAR'
 scene.frame_start=1;scene.frame_end=len(records);scene.render.fps=30;scene.frame_set(78);bpy.ops.wm.save_as_mainfile(filepath=str(s.ART/'boarding-review.blend'))
 for name,frame in [('boarding-pass-mast',78),('boarding-turn',145),('boarding-on-board',197)]:
  scene.frame_set(frame);bpy.context.view_layer.update();s.g.render(name+'.png',direction=(4,-5,3))
