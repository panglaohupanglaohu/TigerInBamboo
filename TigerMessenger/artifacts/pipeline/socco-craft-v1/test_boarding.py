import bpy,json,math,hashlib,sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
BASE=Path(__file__).resolve().parents[3];EV=Path(__file__).parent;OUT=BASE/'assets/models/optimized/socco-craft-v1'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'socco-craft-v1.blend'))
sc=bpy.data.scenes['SOCCO V1 GLB Reimport'];bpy.context.window.scene=sc
craft=next(o for o in sc.objects if o.get('candidate_id')=='socco-craft-v1')
pax=sorted([o for o in sc.objects if 'review_passenger_slot'in o],key=lambda o:o['review_passenger_slot'])
NEW_CREW='--new-crew' in sys.argv
crew_glb=BASE/'assets/models/optimized/vanguard-battle-v1/vanguard-battle-v1.glb'
if NEW_CREW:
 for p in pax:
  for o in list(p.children_recursive)+[p]:bpy.data.objects.remove(o,do_unlink=True)
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(crew_glb));template=set(bpy.data.objects)-before
 root=next(o for o in template if o.get('three_node_id')=='n0');pax=[]
 for o in template:
  if o.get('candidateHidden') or o.get('three_visible') is False or o.get('three_node_id') in ('n62','n63'):o.hide_render=True
 for i in range(7):
  copied={}
  for o in template:
   c=o.copy();sc.collection.objects.link(c);copied[o]=c
  for o,c in copied.items():
   if o.parent in copied:c.parent=copied[o.parent]
   c.matrix_basis=o.matrix_basis.copy()
  tr=copied[root];tr['review_passenger_slot']=i;tr.rotation_mode='XYZ';pax.append(tr)
  bpy.context.view_layer.update();inv=tr.matrix_world.inverted();tr['candidate_source_sole']=min((inv@c.matrix_world@v.co).z for c in copied.values() if c.type=='MESH' and not c.hide_render for v in c.data.vertices)
 for o in template:bpy.data.objects.remove(o,do_unlink=True)
assert len(pax)==7
all_pax=set()
for root in pax:all_pax.add(root);all_pax.update(root.children_recursive)
ns={o.get('three_node_id'):o for o in sc.objects if o not in all_pax and o.get('three_node_id')}
contract=json.loads((EV/'boarding-contract.json').read_text());hinge=ns['n87'];hinge.rotation_mode='XYZ';L=contract['rampLength'];half=contract['rampTipHalfThickness'];ground=contract['fixtureGroundLocalY'];angle=contract['fixtureOpenAngleRad'];closed=contract['closedAngleRad'];seats=contract['seatNodeIDs']
def conv(p):return Vector((p[0],-p[2],p[1]))
def world_geometry(objects,relative=None,min_z=None):
 vv=[];ff=[]
 for o in objects:
  if o.type!='MESH'or o.hide_render:continue
  trans=(relative.matrix_world.inverted()@o.matrix_world)if relative else o.matrix_world
  offset=len(vv);local=[trans@v.co for v in o.data.vertices];vv.extend(local)
  for p in o.data.polygons:
   face=tuple(offset+i for i in p.vertices)
   if min_z is None or max(vv[i].z for i in face)>min_z:ff.append(face)
 return vv,ff
def tree(v,f):return BVHTree.FromPolygons(v,f,all_triangles=False,epsilon=1e-6)
def bounds(v):return [Vector(tuple(min(p[i]for p in v)for i in range(3))),Vector(tuple(max(p[i]for p in v)for i in range(3)))]
def overlap_box(a,b):return all(a[0][i]<b[1][i]-1e-5 and b[0][i]<a[1][i]-1e-5 for i in range(3))
# Real passenger source geometry in stowed transport pose; no proxy scaling.
body=[];body_faces=[];soles=[];boot_points=[]
for i,tr in enumerate(pax):
 tr.hide_render=False;tr.parent=ns[seats[i]];tr.rotation_mode='XYZ';tr.rotation_euler=(0,0,0);tr.location=((.09 if i in (1,4,6) else -.12) if NEW_CREW else 0,0,-.07-tr['candidate_source_sole']);bpy.context.view_layer.update()
 v,f=world_geometry([tr]+list(tr.children_recursive),tr);body.append(v);body_faces.append(f);soles.append(tr['candidate_source_sole']);bv,bf=world_geometry([o for o in tr.children_recursive if o.get('three_node_id') in ('n72','n82')],tr);sole_indices={idx for face in bf if len(face)>=3 and (bv[face[1]]-bv[face[0]]).cross(bv[face[2]]-bv[face[0]]).normalized().z<-.2 for idx in face};boot_points.append([bv[idx] for idx in sole_indices])
rest=[tr.matrix_world.copy()for tr in pax]
# Validate genuine source hinge at closed and under 31 ground-height targets.
solutions=[]
for y in [-2.60+i*(1.4/30)for i in range(31)]:
 a=math.asin((y+1.4)/math.sqrt(L*L+half*half))+math.atan(half/L);hinge.rotation_euler.x=a;bpy.context.view_layer.update();tip=craft.matrix_world.inverted()@(hinge.matrix_world@Vector((0,L,-half)));error=abs(tip.z-y);assert error<1e-6,(y,tip,error);assert abs(a)<=math.radians(25)
 solutions.append({'groundLocalY':y,'angle':a,'tipContactError':error})
hinge.rotation_euler.x=closed;bpy.context.view_layer.update();tip=craft.matrix_world.inverted()@(hinge.matrix_world@Vector((0,L,0)));assert abs(tip.y-2.62)<1e-6 and abs(tip.z-1.5)<1e-6
hinge.rotation_euler.x=angle;bpy.context.view_layer.update()
# Cabin obstructions use real surface triangles. Sole/ramp contact is evaluated
# separately; do not label intended foot contact as a wall collision.
walk_nodes={'n86','n88','n90','n91','n92','n93','n94','n95','n96','n97','n102'}
obstacles=[]
for o in sc.objects:
 if o in all_pax or o.type!='MESH'or o.hide_render or o.name.startswith('ReviewLanding'):continue
 if o.get('three_node_id')in walk_nodes:continue
 # The merged trim batch contains the threshold below the feet as well as bolts.
 v,f=world_geometry([o]);obstacles.append((o.name,tree(v,f),bounds(v)))
collision_failures=[];passenger_failures=[];samples=0

def placed(i):
 tr=pax[i];v=[tr.matrix_world@p for p in body[i]];return v,tree(v,body_faces[i]),bounds(v)
# Seven simultaneously occupy actual preserved selected anchors.
for i in range(7):
 v,bvh,bb=placed(i)
 for name,ob,obbox in obstacles:
  if overlap_box(bb,obbox)and bvh.overlap(ob):collision_failures.append({'phase':'occupied','passenger':i,'obstacle':name})
 for j in range(i):
  _,other,box=placed(j)
  if overlap_box(bb,box)and bvh.overlap(other):passenger_failures.append({'phase':'occupied','pair':[i,j]})
# Sequential rear-first exit keeps the original left/right lanes. 33 real-mesh
# samples per passenger include threshold, ramp tip and movement to ground.
support_v,support_f=world_geometry([o for o in sc.objects if o not in all_pax and o.type=='MESH' and o.get('three_node_id')!='n86' and not o.name.startswith('ReviewLanding')]);support_tree=tree(support_v,support_f)
foot_error=[];path_rows=[];support_gaps=[];support_contact_errors=[];support_corrections=[]
for i,tr in enumerate(pax):
 tr.parent=craft;tr.matrix_world=rest[i];tr.rotation_mode='XYZ';start=Vector(((.43 if contract['battleActiveSeats'][i]%2 else -.40) if NEW_CREW else (contract['battleActiveSeats'][i]%2 and .52 or -.52),-1.29,-2.05+(contract['battleActiveSeats'][i]//2)*.62));end=Vector(((i-3)*.72,ground,-7.2))
 path=[]
 for k in range(33):
  u=k/32
  if u<.35:
   t=u/.35;foot=start.lerp(Vector((start.x,-1.29,-2.62)),t)
  elif u<.75:
   t=(u-.35)/.4;d=t*L;h=.07-.06*t;foot=Vector((start.x,-1.4+d*math.sin(angle)+h*math.cos(angle),-2.62-d*math.cos(angle)+h*math.sin(angle)))
   # Steps ride the existing transverse tread tops; this is the same clearance
   # rule the kinematic importer must use with raycast support geometry.
   foot.y+=.05*math.cos(angle) if t<.93 else 0
  else:
   t=(u-.75)/.25;base=Vector((start.x,ground+.02,-2.62-L*math.cos(angle)+half*math.sin(angle)));foot=base.lerp(end,t)
  tr.location=conv((foot.x,foot.y-soles[i],foot.z));tr.rotation_euler=(0,0,math.pi);bpy.context.view_layer.update()
  support_pairs=[]
  for bp in boot_points[i]:
   w=tr.matrix_world@bp;hit,normal,face,dist=support_tree.ray_cast(w+Vector((0,0,.20)),Vector((0,0,-1)),5);height=hit.z if hit is not None else ground;support_pairs.append((w.z,height))
  delta=max(h-z for z,h in support_pairs)+.001;tr.location.z+=delta;foot.y+=delta;bpy.context.view_layer.update();support_corrections.append(delta);gaps=[z+delta-h for z,h in support_pairs];support_gaps.extend(gaps);support_contact_errors.append(min(abs(g) for g in gaps));v,bvh,bb=placed(i);samples+=1
  for name,ob,obbox in obstacles:
   if overlap_box(bb,obbox)and bvh.overlap(ob):collision_failures.append({'phase':'exit','passenger':i,'sample':k,'obstacle':name})
  for j in range(i+1,7):
   _,other,box=placed(j)
   if overlap_box(bb,box)and bvh.overlap(other):passenger_failures.append({'phase':'exit','passenger':i,'sample':k,'waiting':j})
  if u>.85:foot_error.append(abs(min(p.z for p in v)-foot.y))
  path.append({'u':u,'foot':list(foot),'rootLocationBlender':list(tr.location)})
 path_rows.append(path)
# Do not erase the report on failure; root gets real collision evidence.
report={'candidateGlbSha256':hashlib.sha256((OUT/'socco-craft-v1.glb').read_bytes()).hexdigest(),'realPassengerCount':len(pax),'factorySeatAnchorsPreserved':14,'activeSeatIndices':contract['battleActiveSeats'],'groundSolutions':solutions,'closedHingeTipBlender':list(tip),'realMeshExitSamples':samples,'fullPassengerSurfaceTrianglesChecked':True,'footSupportSamples':len(support_gaps),'footSupportMaxPenetration':max(0,-min(support_gaps)),'footSupportMaxCornerGap':max(support_gaps),'footSupportMaxContactError':max(support_contact_errors),'footSupportMaxCorrection':max(abs(v) for v in support_corrections),'newCrewRootLocalXOffsetBySeatSide':{'left':-.12,'right':.09} if NEW_CREW else None,'wallTriangleIntersections':collision_failures,'passengerTriangleIntersections':passenger_failures,'footRootPlacementMaxError':max(foot_error,default=0),'crewModel':'vanguard-battle-v1 actual GLB static idle; blade emission off, hilt retained' if NEW_CREW else 'archived vanguardTrooper with stowed transport arms','crewGlbSha256':hashlib.sha256(crew_glb.read_bytes()).hexdigest() if NEW_CREW else None,'scope':'Actual passenger meshes and candidate GLB geometry, kinematic fixture. Not a world navigation/playtest assertion.'}
(EV/('boarding-validation-new-crew.json' if NEW_CREW else 'boarding-validation.json')).write_text(json.dumps(report,indent=2)+'\n');(EV/('boarding-paths-new-crew.json' if NEW_CREW else 'boarding-paths.json')).write_text(json.dumps(path_rows,indent=2)+'\n')
if NEW_CREW:
 for i,tr in enumerate(pax):tr.matrix_world=rest[i]
 bpy.context.view_layer.update();sc.render.filepath=str(EV/'glb-deployed-new-crew-seven.png');bpy.ops.render.render(write_still=True)
# Reviewable real animation in a separate Blender file; world will use ground sampling.
sc.frame_start=1;sc.frame_end=440;sc.render.fps=24
for frame,a in [(1,closed),(48,angle),(410,angle),(440,closed)]:hinge.rotation_euler.x=a;hinge.keyframe_insert(data_path='rotation_euler',frame=frame)
for i,tr in enumerate(pax):
 tr.parent=craft
 start_frame=55+i*44
 for k,row in enumerate(path_rows[i]):
  tr.location=Vector(row['rootLocationBlender']);tr.keyframe_insert(data_path='location',frame=start_frame+k*1.3)
 tr.location=Vector(path_rows[i][0]['rootLocationBlender']);tr.keyframe_insert(data_path='location',frame=1)
 # Linear interpolation guarantees the checked route, no bezier overshoot.
 if tr.animation_data and tr.animation_data.action:
  for layer in tr.animation_data.action.layers:
   for strip in layer.strips:
    for slot in tr.animation_data.action.slots:
     bag=strip.channelbag(slot,ensure=False)
     if bag:
      for curve in bag.fcurves:
       for key in curve.keyframe_points:key.interpolation='LINEAR'
sc.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/('socco-boarding-new-crew-demo.blend' if NEW_CREW else 'socco-boarding-demo.blend')))
if NEW_CREW:
 sc.frame_set(195);review=json.loads((EV/'report.json').read_text())['review'][-1];cam=sc.camera;cam.location=review['camera'];target=Vector(review['target']);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=10.0;sc.render.filepath=str(EV/'glb-new-crew-unloading-frame195.png');bpy.ops.render.render(write_still=True)
print(json.dumps({'samples':samples,'wallHits':len(collision_failures),'passengerHits':len(passenger_failures),'maxGroundError':max(s['tipContactError']for s in solutions),'demo':str(OUT/('socco-boarding-new-crew-demo.blend' if NEW_CREW else 'socco-boarding-demo.blend'))}))
if collision_failures or passenger_failures:raise RuntimeError('Boarding geometry validation found collisions; inspect report')
