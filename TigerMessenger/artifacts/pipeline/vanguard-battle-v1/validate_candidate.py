"""Independent saved Blender/GLB checks, including actual triangle contact."""
import bpy,json,math,struct,hashlib
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_ray_tri
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'assets/models/optimized/vanguard-battle-v1';ART=Path(__file__).parent
C=Matrix.Rotation(math.pi/2,4,'X');CI=C.inverted()
def ident(o):return o.get('three_node_id',o.get('vanguard_added_id'))
def matrix(v):return Matrix([[v[c*4+r] for c in range(4)] for r in range(4)])
def err(a,b):return max(abs(a[r][c]-b[r][c]) for r in range(4) for c in range(4))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def geometry(o):
 me=o.data;me.calc_loop_triangles();vs=[o.matrix_world@v.co for v in me.vertices];fs=[tuple(t.vertices) for t in me.loop_triangles];return vs,fs,BVHTree.FromPolygons(vs,fs,all_triangles=True)
def actual_crossings(a,b):
 av,af,ab=a;bv,bf,bb=b;hits=0
 for ai,bi in ab.overlap(bb):
  A=[av[i] for i in af[ai]];B=[bv[i] for i in bf[bi]];intersects=False
  for poly,target in [(A,B),(B,A)]:
   for p,q in zip(poly,poly[1:]+poly[:1]):
    v=q-p
    if v.length<1e-8:continue
    hit=intersect_ray_tri(*target,v.normalized(),p,True)
    if hit is not None and 1e-6<(hit-p).dot(v.normalized())<v.length-1e-6:intersects=True;break
   if intersects:break
  hits+=int(intersects)
 return hits
a=json.loads((OUT/'vanguard-battle-v1.assembly.json').read_text());s=json.loads((ROOT/a['source']['snapshot']).read_text());source=ROOT/a['source']['blend'];hashes={'source':sha(source),'blend':sha(OUT/'vanguard-battle-v1.blend'),'glb':sha(OUT/'vanguard-battle-v1.glb'),'assembly':sha(OUT/'vanguard-battle-v1.assembly.json')}
bpy.ops.wm.open_mainfile(filepath=str(OUT/'vanguard-battle-v1.blend'));sc=bpy.context.scene;objects={ident(o):o for o in sc.objects if ident(o)};fail=[]
for n in s['nodes']:
 if n['id'] not in objects:fail.append(['missing original',n['id']]);continue
 if (ident(objects[n['id']].parent) if objects[n['id']].parent else None)!=n['parent']:fail.append(['parent',n['id']])
max_matrix=0;max_grip={'R':0,'L':0};min_surface={'R':100,'L':100};crossings=[];forearm_crossings=[]
for p in a['poseFrames']:
 sc.frame_set(p['frame']);bpy.context.view_layer.update()
 for tag,v in p['transforms'].items():max_matrix=max(max_matrix,err(CI@objects[tag].matrix_basis@C,matrix(v)))
 for side,hand,weapon,point in [('R','n54','n59',(0,0,0)),('L','n34','n39',(0,-.11,-.12))]:
  if side=='L' and p['leftHandRole']!='gun grip':continue
  hw=objects[hand].matrix_world.translation;ww=objects[weapon].matrix_world@(C.to_3x3()@Vector(point));max_grip[side]=max(max_grip[side],(hw-ww).length)
 cache={k:geometry(objects[k]) for k in ['n40','n42','n44','n28','n30','n18','n20','n22','n23','n24','n4']}
 for gun in ['n40','n42','n44']:
  for body in ['n28','n30','n18','n20','n22','n23','n24','n4']:
   count=actual_crossings(cache[gun],cache[body])
   if count:crossings.append({'frame':p['frame'],'gun':gun,'body':body,'trianglePairs':count})
 for fore,other in [('n52','n54'),('n52','n60'),('n32','n34'),('n32','n44')]:
  count=actual_crossings(geometry(objects[fore]),geometry(objects[other]))
  if count:forearm_crossings.append({'frame':p['frame'],'forearm':fore,'other':other,'trianglePairs':count})
 if p['frame'] in [1,31,61,101,131]:
  for side,hand,grip in [('R','n54','n60'),('L','n34','n44')]:
   if side=='L' and p['leftHandRole']!='gun grip':continue
   hand_geo=geometry(objects[hand]);grip_geo=geometry(objects[grip]);distance=min(grip_geo[2].find_nearest(v)[3] for v in hand_geo[0]);min_surface[side]=min(min_surface[side],distance)
sc.frame_set(31);bpy.context.view_layer.update()
root_inv=objects['n0'].matrix_world.inverted()
def actor_points(ids):return [CI.to_3x3()@(root_inv@o.matrix_world@v.co) for tag in ids for o in [objects[tag]] for v in o.data.vertices]
gun_pts=actor_points(['n40','n42','n44','add:muzzle-collar']);head_pts=actor_points(['n18','n20','n22','n23','n24'])
aim_axis=(CI@root_inv@objects['n39'].matrix_world@C).to_3x3()@Vector((0,0,1))
aim_report={'gunDirectionActor':list(aim_axis),'leftPositiveXClearance':min(p.x for p in gun_pts)-max(p.x for p in head_pts),'gunXBounds':[min(p.x for p in gun_pts),max(p.x for p in gun_pts)],'headXBounds':[min(p.x for p in head_pts),max(p.x for p in head_pts)],'definition':'Guaranteed separation of disjoint X intervals, all visible barrel/receiver/grip/collar vertices versus helmet/crown/visor/frame/face; actor-local units.'}
if (aim_axis-Vector((0,0,1))).length>1e-5 or aim_report['leftPositiveXClearance']<=0:fail.append(['aim axis or head clearance',aim_report])
if max_matrix>1e-5:fail.append(['saved matrix',max_matrix])
if max(max_grip.values())>1e-5:fail.append(['grip detached',max_grip])
if forearm_crossings:fail.append(['forearm versus hand/grip crossings',len(forearm_crossings)])
if crossings:fail.append(['cannon armor crossings',len(crossings)])
raw=(OUT/'vanguard-battle-v1.glb').read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);tags={o.get('extras',{}).get('three_node_id',o.get('extras',{}).get('vanguard_added_id')):i for i,o in enumerate(g['nodes'])};parents={c:i for i,o in enumerate(g['nodes']) for c in o.get('children',[])};max_glb=0;uv_count=0;materials=0
for tag,v in a['poseFrames'][0]['transforms'].items():
 node=g['nodes'][tags[tag]];max_glb=max(max_glb,err(matrix(node['matrix']),matrix(v)))
 if 'mesh' in node:
  for p in g['meshes'][node['mesh']]['primitives']:
   if 'TEXCOORD_0' not in p['attributes']:fail.append(['GLB missing UV',tag])
   else:uv_count+=1
for n in s['nodes']:
 i=tags[n['id']];parent=g['nodes'][parents[i]].get('extras',{}).get('three_node_id') if i in parents else None
 if parent!=n['parent']:fail.append(['GLB original parent',n['id'],parent])
for m in g['materials']:
 key=m.get('extras',{}).get('three_uuid')
 if not key:continue
 src=s['materials'][key];expected=[*src.get('color',[1,1,1]),src.get('opacity',1)];actual=m.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1]);materials+=1
 if max(abs(x-y) for x,y in zip(actual,expected))>1e-6:fail.append(['material factor',key])
if max_glb>1e-5:fail.append(['GLB static matrix',max_glb])
stripe={}
for key in ['n67','n77']:
 node=g['nodes'][tags[key]];m=g['materials'][g['meshes'][node['mesh']]['primitives'][0]['material']];stripe[key]={'sourceMaterial':m['extras']['three_uuid'],'baseColor':m['pbrMetallicRoughness']['baseColorFactor'],'emissive':m.get('emissiveFactor',[0,0,0])}
 if any(stripe[key]['emissive']):fail.append(['red stripe emission',key])
assert sha(source)==hashes['source'] and sha(OUT/'vanguard-battle-v1.blend')==hashes['blend']
r={'checksPassed':not fail,'originalNodes':len(s['nodes']),'addedNodes':len(objects)-len(s['nodes']),'framesChecked':len(a['poseFrames']),'maxSavedMatrixError':max_matrix,'maxGLBMatrixError':max_glb,'maxGripAnchorError':max_grip,'keyPoseMinGripSurfaceDistance':min_surface,'cannonArmorTriangleCrossings':crossings,'aimHeadClearance':aim_report,'forearmHandGripCrossings':forearm_crossings,'GLBUVPrimitivesChecked':uv_count,'GLBOriginalMaterialsChecked':materials,'redStripeChecks':stripe,'sourceUnchanged':True,'files':hashes,'failures':fail,'scope':'All saved 30Hz pose matrices/grip anchors and cannon versus shoulder, upper arm, helmet, chest actual triangle crossings; not all body-surface intersections or gameplay validation.'};(ART/'validation-report.json').write_text(json.dumps(r,indent=2));print(json.dumps({k:v for k,v in r.items() if k!='cannonArmorTriangleCrossings'},indent=2));print('cannon crossing samples',crossings[:8])
