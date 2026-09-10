"""Read-only-source V12 sliding wooden gangplank candidate, with explicit collision evidence."""
import bpy,json,hashlib,importlib.util,math,os
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
P=Path(__file__).resolve().parents[2];O=P/'assets/models/optimized/warship-battle-v12';A=P/'artifacts/pipeline/warship-boarding-v12';O.mkdir(exist_ok=True);A.mkdir(exist_ok=True)
sp=importlib.util.spec_from_file_location('s',P/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(sp);sp.loader.exec_module(s)
B=P/'assets/models/optimized/warship-battle-v11';before=hashlib.sha256((B/'warship-battle-v11.glb').read_bytes()).hexdigest();bpy.ops.wm.open_mainfile(filepath=str(B/'warship-battle-v11.blend'));sc=bpy.context.scene;sc.frame_set(1);obs={s.ident(o):o for o in sc.objects if s.ident(o)};root=obs['n0'];a=json.loads((B/'warship-battle-v11.assembly.json').read_text());removed=[]
for k,o in list(obs.items()):
 if k.startswith('add:boarding-'):
  removed.append(k);bpy.data.objects.remove(o,do_unlink=True)
for f in [a['restTransforms']]+[x['transforms'] for x in a['poseFrames']]:
 for k in removed:f.pop(k,None)
a['addedNodes']=[n for n in a['addedNodes'] if n['id'] not in removed]
wood=obs['n231'].data.materials[0];added=[]
def box(k,center,size):
 vv,ff=s.v.box_geometry(size);o=s.mesh(k,[(x+center[0],y+center[1],z+center[2]) for x,y,z in vv],ff,root,wood,k);added.append(o);return o
# Each leaf stays horizontal; nested timber leaves slide from the bow-side deck.
for i in range(3):box('add:boarding-slide-'+str(i),(2.05,.84-i*.026,.38),(.40,.022,.60))
obs={s.ident(o):o for o in sc.objects if s.ident(o)}
def setpose(frame,progress):
 for k,v in a['poseFrames'][frame]['transforms'].items():
  if k in obs:s.setm(obs[k],s.mat(v))
 for i,o in enumerate(added):s.setm(o,Matrix.Translation(Vector((0,0,i*.55*progress))))
 bpy.context.view_layer.update()
def hidden(o):
 while o:
  if o.get('candidateHidden') or o.get('candidate_hidden_source_geometry') or o.get('three_visible') is False:return True
  o=o.parent
 return False
def shape(o):
 m=s.rootmat(o,root);v=[m@(s.CI.to_3x3()@q.co) for q in o.data.vertices];lo=[min(q[i] for q in v) for i in range(3)];hi=[max(q[i] for q in v) for i in range(3)];return lo,hi,BVHTree.FromPolygons(v,[list(f.vertices) for f in o.data.polygons])
# A single intermediate tread halves the deck-to-board rise; its underside
# follows the real original deck corner heights without changing the deck.
setpose(180,0)
originalShapes=[shape(o) for o in obs.values() if o.type=='MESH' and not hidden(o) and o not in added]
bottom=[]
for x,z in [(1.63,.18),(1.85,.18),(1.85,.58),(1.63,.58)]:
 y=.663
 for lo,hi,bv in originalShapes:
  h=bv.ray_cast(Vector((x,.74,z)),Vector((0,-1,0)),.20)
  if h[0] is not None:y=max(y,h[0].y)
 bottom.append((x,y+.001,z))
vv=bottom+[(x,.758,z) for x,y,z in bottom];ff=[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
access=s.mesh('Bow gangplank access tread',vv,ff,root,wood,'add:bow-board-access-tread');obs[s.ident(access)]=access
hits=[]
for step in range(65):
 t=step/64;setpose(180+round(31*t),t);other=[(k,shape(o)) for k,o in obs.items() if o.type=='MESH' and o not in added and not hidden(o)]
 for o in added:
  lo,hi,bv=shape(o)
  for k,(ol,oh,ob) in other:
   if all(lo[i]<oh[i]-1e-6 and ol[i]<hi[i]-1e-6 for i in range(3)):
    pairs=bv.overlap(ob)
    if pairs:hits.append({'step':step,'t':t,'board':s.ident(o),'obstacle':k,'trianglePairs':len(pairs)})
# Exact translation swept box of each axis-aligned leaf against frozen
# deployed obstacles. This covers between-sample leaf positions for static hull.
sweptHits=[];setpose(211,1)
for i,o in enumerate(added):
 lo,hi,bv=shape(o);lo[2]-=i*.55;vv,ff=s.v.box_geometry(tuple(hi[k]-lo[k] for k in range(3)));center=Vector(tuple((hi[k]+lo[k])/2 for k in range(3)));sweep=BVHTree.FromPolygons([Vector(v)+center for v in vv],ff)
 for k,ob in obs.items():
  if ob.type!='MESH' or ob in added or hidden(ob):continue
  ol,oh,obv=shape(ob)
  if all(lo[k]<oh[k]-1e-6 and ol[k]<hi[k]-1e-6 for k in range(3)):
   pairs=sweep.overlap(obv)
   if pairs:sweptHits.append({'leaf':i,'obstacle':k,'trianglePairs':len(pairs)})
# Read-only compact-person clearance proxy on the fully deployed leaves.
setpose(211,1);personHits=[];unsupported=[];shapes=[(k,shape(o)) for k,o in obs.items() if o.type=='MESH' and not hidden(o)]
for j in range(65):
 z=.16+j/64*1.50;top=0
 for k,(lo,hi,bv) in shapes:
  hit=bv.ray_cast(Vector((2.05,1.15,z)),Vector((0,-1,0)),.65)
  if hit[0] is not None:top=max(top,hit[0].y)
 if top==0:unsupported.append(j);continue
 vv=[Vector((2.05+.12*math.cos(q*math.tau/16),top+h,z+.12*math.sin(q*math.tau/16))) for h in [.025,1.30] for q in range(16)];ff=[tuple(range(15,-1,-1)),tuple(range(16,32))]+[(q,(q+1)%16,(q+1)%16+16,q+16) for q in range(16)];pb=BVHTree.FromPolygons(vv,ff)
 for k,(lo,hi,bv) in shapes:
  if hi[1]<=top+.024 or lo[1]>=top+1.30 or hi[0]<2.05-.12 or lo[0]>2.05+.12 or hi[2]<z-.12 or lo[2]>z+.12:continue
  pairs=pb.overlap(bv)
  if pairs:personHits.append({'sample':j,'obstacle':k,'trianglePairs':len(pairs)})
# Retain original crew/oar poses and store only new slide transforms.
for f in a['poseFrames']:
 ix=a['poseFrames'].index(f);t=max(0,min(1,(ix-180)/31))
 for i,o in enumerate(added):f['transforms'][s.ident(o)]=s.flat(Matrix.Translation(Vector((0,0,i*.55*t))))
setpose(180,0)
a['restTransforms']={k:s.flat(s.local(o)) for k,o in obs.items()};a['boarding']={'mode':'horizontal-timber-slide-candidate','rootPoint':[2.05,.851,.08],'length':1.70,'gateWidth':.40,'requiredStopped':True,'runtimeGroundMustSetAngle':True,'geometryRevalidationRequired':True,'boardingValidated':False,'removedPreviousBoardNodes':removed};a['stage']='v12 horizontal sliding gangplank, unintegrated physical candidate';a['runtimeIntegrated']=False;a['readyForBattle']=False
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(O/'warship-battle-v12.blend'));s.export_warship(list(obs.values()),O/'warship-battle-v12.glb');(O/'warship-battle-v12.assembly.json').write_text(json.dumps(a,separators=(',',':')))
report={'sourceSha256':before,'candidateSha256':hashlib.sha256((O/'warship-battle-v12.glb').read_bytes()).hexdigest(),'sampleCount':65,'sweepSampling':'65 evenly spaced translation samples; exact triangle surface intersections per sample, not mathematical continuous sweep. Contacts count per frame and pair, not distinct defects.','intersections':hits,'translationSweptVolumesAgainstDeployedSnapshot':sweptHits,'compactHumanProxy':{'radiusLocal':.12,'heightLocal':1.30,'samples':65,'routeX':2.05,'routeZ':[.16,1.66],'surfaceIntersections':personHits,'unsupportedSamples':unsupported,'scope':'Cylinder covers compact torso/legs at actual world scale, not posed limbs or held weapons; no deck-to-board access or shore support certification.'},'sourcePreserved':hashlib.sha256((B/'warship-battle-v11.glb').read_bytes()).hexdigest()==before,'physicalBoardingValidated':False,'shoreSupportValidated':False,'limitations':['One intermediate access tread added at y .758 before board top .851; physical posed foot placement still needs verification.','Human foot/leg swept clearance not certified.','Sliding leaves overlap in plan but are vertically separated; timber bearing mechanics unverified.']};(A/'report.json').write_text(json.dumps(report,indent=2));print('V12_AUDIT',len(hits),sorted(set(x['obstacle'] for x in hits)),flush=True)
if os.environ.get('WARSHIP_AUDIT_ONLY'):raise SystemExit(0)
# Candidate render at stowed and deployed poses, with original studio.
s.v.studio(sc);sc.render.resolution_x=1200;sc.render.resolution_y=850;sc.render.image_settings.file_format='PNG'
for name,t in [('stowed',0),('deployed',1)]:
 setpose(180+round(31*t),t);center=Vector((1.6,-.55,.95));sc.camera.location=center+Vector((3,-4,2.5));sc.camera.rotation_euler=(center-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.ortho_scale=3.9;sc.render.filepath=str(A/(name+'.png'));bpy.ops.render.render(write_still=True)
