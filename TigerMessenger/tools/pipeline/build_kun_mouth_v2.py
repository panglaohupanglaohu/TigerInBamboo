"""Local v1-derived mouth cavity iteration; original/v1 files remain read-only."""
import bpy,bmesh,math,json,hashlib,importlib.util
from pathlib import Path
from mathutils import Vector,Matrix
B=Path(__file__).resolve().parents[2];OUT=B/'assets/models/optimized/kun-battle-v2';EV=B/'artifacts/pipeline/kun-battle-v2';V1=B/'assets/models/optimized/kun-battle-v1';OUT.mkdir(exist_ok=True);EV.mkdir(exist_ok=True)
C=Matrix.Rotation(math.pi/2,4,'X');CI=C.inverted();H=Vector((24,-11.5,0))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
spec=importlib.util.spec_from_file_location('v1',B/'tools/pipeline/build_kun_battle_blender.py');v1=importlib.util.module_from_spec(spec);spec.loader.exec_module(v1)
hashes={p.name:sha(p) for p in V1.iterdir() if p.suffix in ('.blend','.glb','.json')}
bpy.ops.wm.open_mainfile(filepath=str(V1/'kun-battle-v1.blend'));sc=bpy.context.scene;sc.frame_set(1);bpy.context.view_layer.update();ns={o['three_node_id']:o for o in sc.objects if 'three_node_id'in o};added={o['kun_added_id']:o for o in sc.objects if 'kun_added_id'in o};root=ns['n0'];jaw=added['add:jaw-pivot'];floor=added['add:mouth-floor'];roof=added['add:mouth-roof'];lip=added['add:lower-lip'];baseline={k:(o.parent.name if o.parent else None,list(o.matrix_basis))for k,o in ns.items()}
# Recover exact original lip centerline, retaining all boundary coordinates.
rim=[]
for i in range(len(lip.data.vertices)//6):rim.append(CI.to_3x3()@(sum((lip.data.shape_keys.key_blocks['Basis'].data[i*6+j].co for j in range(6)),Vector())/6)+H+Vector((0,.11,0)))
# V1 closed the lip loop across the rear hinge, creating an artificial bar
# through the throat. Remove only its internal bridge faces; outer lips remain.
rear_segments=[i for i in range(len(rim)) if abs(rim[i].x-24)<1e-4 and abs(rim[(i+1)%len(rim)].x-24)<1e-4]
for tag,tubular in [('add:lower-lip',True),('add:upper-lip-line',True),('add:jaw-rim-thickness',False)]:
 o=added[tag];bm=bmesh.new();bm.from_mesh(o.data);bm.faces.ensure_lookup_table();indices=[i*6+j for i in rear_segments for j in range(6)] if tubular else rear_segments;bmesh.ops.delete(bm,geom=[bm.faces[i]for i in indices],context='FACES_ONLY');bm.to_mesh(o.data);bm.free();o.data.update();o['v2_internal_rear_bridge_removed']=True
center=sum(rim,Vector())/len(rim);xs=sorted(set(round(p.x,5)for p in rim));xmin=min(xs);xmax=max(xs)
def sides(x):
 zs=[]
 for a,b in zip(rim,rim[1:]+rim[:1]):
  if abs(a.x-x)<1e-4:zs.append(a.z)
  if min(a.x,b.x)-1e-5<=x<=max(a.x,b.x)+1e-5 and abs(b.x-a.x)>1e-5:zs.append(a.z+(b.z-a.z)*(x-a.x)/(b.x-a.x))
 return min(zs),max(zs)
def seam(x):return -11.5+(x-24)*4.1/19
N=10
# Regular longitudinal strips replace each single-centre triangle fan.
def row(x,kind):
 lo,hi=sides(x);s=(x-xmin)/(xmax-xmin);ps=[]
 for j in range(N+1):
  t=j/N;z=lo+(hi-lo)*t;arch=4*t*(1-t)
  if kind=='roof':rx=x-.03*s**8;p=Vector((rx,seam(rx)+.005+2.8*math.cos(s*math.pi/2)**2*arch,z*.998))
  else:
   p=center+(Vector((x,seam(x),z))-center)*.88+Vector((0,-.65,0));p.y-=(3.0*math.cos(s*math.pi/2)-(1-s)**2)*arch
  ps.append(p)
 return ps

def replace(o,vs,fs,materials):
 d=bpy.data.meshes.new(o.name+' layered cavity v2');d.from_pydata([C.to_3x3()@p for p in vs],[],fs);d.update();o.data=d
 for m in materials:d.materials.append(m)
 o['kun_v2_geometry']='Longitudinal multi-section cavity; v1 exterior boundary retained'
def strips(kind):
 vs=[p for x in xs for p in row(x,kind)];fs=[]
 for i in range(len(xs)-1):
  for j in range(N):
   a=i*(N+1)+j;b=a+N+1;quad=(a,a+1,b+1,b)
   if kind=='roof':quad=tuple(reversed(quad))
   # Skip collapsed nose faces rather than retaining zero-area triangles.
   for face in [(quad[0],quad[1],quad[2]),(quad[0],quad[2],quad[3])]:
    if (vs[face[1]]-vs[face[0]]).cross(vs[face[2]]-vs[face[0]]).length>1e-7:fs.append(face)
 return vs,fs
roofmat=roof.data.materials[0];floormat=floor.data.materials[0];rv,rf=strips('roof');fv,ff=strips('floor');replace(roof,rv,rf,[roofmat]);replace(floor,[p-H for p in fv],ff,[floormat]);floor.shape_key_add(name='Basis');infl=floor.shape_key_add(name='ThroatInflation')
for k,p in enumerate(fv):
 s=(p.x-(center.x+(xmin-center.x)*.88))/(.88*(xmax-xmin));t=(k%(N+1))/N;infl.data[k].co.z-=4.0*max(0,math.sin(math.pi*s))*4*t*(1-t)
# A real recessed, narrowing tube behind the hinge. The lower entrance follows
# the jaw analytically; intermediate rings interpolate towards fixed deep throat.
front_top=row(xmin,'roof');front_low=list(reversed(row(xmin,'floor')));front=front_top+front_low;count=len(front);vs=[];motion=[];ring_count=5
for level in range(ring_count):
 t=level/(ring_count-1);scale=1-.72*t;cx=24-11*t;cy=-11.5-.2*t
 for idx,p in enumerate(front):
  a=idx/count*math.tau;back=Vector((13,-11.7+2.2*math.sin(a),4.0*math.cos(a)))
  # Preserve near entrance exactly; back mapping follows the same upper/lower order.
  zratio=p.z/max(abs(q.z) for q in front);upper=idx<len(front_top);back=Vector((13,-11.7+(2.2 if upper else -2.2)*math.sqrt(max(0,1-zratio*zratio)),zratio*4.0))
  q=p.lerp(back,t);vs.append(q);motion.append((p,1-t if not upper else 0))
faces=[]
for level in range(ring_count-1):
 for j in range(count):faces.append((level*count+j,level*count+(j+1)%count,(level+1)*count+(j+1)%count,(level+1)*count+j))
# Small deep termination has physical depth and is never a full-opening patch.
vs.append(Vector((12.4,-11.7,0)));ci=len(vs)-1;motion.append((Vector((12.4,-11.7,0)),0))
for j in range(count):faces.append((ci,(ring_count-1)*count+j,(ring_count-1)*count+(j+1)%count))
deep=v1.mat('Kun v2 recessed throat warm charcoal',(.045,.041,.036));inside=v1.mesh('Kun v2 inward tapering throat',vs,faces,roof,deep,'add:inner-throat');inside.shape_key_add(name='Basis');sin_key=inside.shape_key_add(name='JawTurnSin');cos_key=inside.shape_key_add(name='JawTurnCos')
maximum=math.radians(38)
for i,(p,weight) in enumerate(motion):
 d=p-H;sin_key.data[i].co+=C.to_3x3()@(Vector((d.y,-d.x,0))*math.sin(maximum)*weight);cos_key.data[i].co+=C.to_3x3()@(Vector((-d.x,-d.y,0))*(1-math.cos(maximum))*weight)
# Original membrane stays under the outside throat; the new lining sits inside.
assembly=json.loads((V1/'kun-battle-v1.assembly.json').read_text());assembly['candidateVersion']='kun-battle-v2';assembly['derivedFromV1Hashes']=hashes
for sample in assembly['poseFrames']:
 f=sample['frame'];sc.frame_set(f);amount=sample['throatInflation'];infl.value=amount;infl.keyframe_insert('value',frame=f)
 weights=sample['morphs']['add:throat-membrane'];sin_key.value=weights['JawTurnSin'];cos_key.value=weights['JawTurnCos'];sin_key.keyframe_insert('value',frame=f);cos_key.keyframe_insert('value',frame=f)
 sample['morphs']['add:mouth-floor']={'ThroatInflation':amount};sample['morphs']['add:inner-throat']={'JawTurnSin':sin_key.value,'JawTurnCos':cos_key.value}
for owner in [floor.data.shape_keys,inside.data.shape_keys]:
 for layer in owner.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in bag.fcurves:
     for key in curve.keyframe_points:key.interpolation='LINEAR'
sc.frame_set(1);bpy.context.view_layer.update();root['candidateVersion']='kun-battle-v2';sc.render.resolution_x=1000;sc.render.resolution_y=900;sc.cycles.samples=16
assert len(ns)==295
assert all((o.parent.name if o.parent else None,list(o.matrix_basis))==baseline[k]for k,o in ns.items())
assembly['mouthV2Contract']={'replacementGeometry':['add:mouth-roof','add:mouth-floor'],'addedUnderExistingAdoptedNode':{'add:inner-throat':'add:mouth-roof'},'original295SourceGeometryUnchanged':True,'externalLipContourUnchanged':True,'internalLipBridgeFacesRemovedAtRearHinge':rear_segments,'longitudinalSections':len(xs),'crossSectionSegments':N,'throatRingCount':ring_count,'throatRearX':13,'throatFrontX':24,'roofTipInsetX':.03,'roofWidthFactor':.998,'rearFloorReliefY':1.0,'floorMorph':'add:mouth-floor ThroatInflation follows original inflation weight','innerThroatMorph':'add:inner-throat JawTurnSin/JawTurnCos follow original analytic membrane weights','runtimeChangeRequired':'Add the two listed nodes to runtime morph mapping; existing root adoption includes inner-throat automatically.','scope':'Candidate geometry; awaiting front/3q/side-below actual GLB visual review.'}
assembly['addedNodes'].append({'id':'add:inner-throat','parentId':'add:mouth-roof','name':inside.name,'localMatrix':v1.flat(CI@inside.matrix_basis@C)})
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'kun-battle-v2.blend'));v1.OUT=OUT;v1.export_glb(ns);(OUT/'kun-battle-v1.glb').rename(OUT/'kun-battle-v2.glb')
assembly['files']={p.name:{'path':str(p.relative_to(B)),'sha256':sha(p)}for p in [OUT/'kun-battle-v2.blend',OUT/'kun-battle-v2.glb']};(OUT/'kun-battle-v2.assembly.json').write_text(json.dumps(assembly,indent=2)+'\n')
assert all(sha(V1/name)==hash for name,hash in hashes.items())
print(json.dumps({'v1Unchanged':True,'sourceIDs':len(ns),'roofTriangles':len(rf),'floorTriangles':len(ff),'innerThroatTriangles':sum(len(f)-2 for f in faces),'files':assembly['files']}),flush=True)
