"""Check actual saved cloak against equipment and moving limbs, not bounding boxes alone."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
P=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(P/'assets/models/optimized/human-courier-v1/human-courier.blend'))
nodes={o.name:o for o in bpy.context.scene.objects}
cloth=nodes['Cloak_folds']
adj={v.index:set() for v in cloth.data.vertices}
for edge in cloth.data.edges:
 a,b=edge.vertices;adj[a].add(b);adj[b].add(a)
remaining=set(adj);components=0
while remaining:
 components+=1;stack=[remaining.pop()]
 while stack:
  for vertex in adj[stack.pop()]:
   if vertex in remaining:remaining.remove(vertex);stack.append(vertex)
def xs(prefixes,minimum_y=-100):
 result=[]
 for o in nodes.values():
  if o.type=='MESH' and o.name.startswith(prefixes):
   for vertex in o.data.vertices:
    p=o.matrix_world@vertex.co
    if p.z>=minimum_y:result.append(p.x)
 return max(result)-min(result)
shoulder_width=xs(('Shirt_shoulder','Linen_sleeve'),1.30)
foot_width=xs(('Boot_sole',))
prefixes=('Map_roll','Map_tie','Linen_sleeve','Shirt_shoulder','Forearm','Trouser_thigh','Back_coat','Split_coat','Boot_')
obstacles=[o for o in nodes.values() if o.type=='MESH' and o.name.startswith(prefixes)]
def shape(o):
 vs=[o.matrix_world@v.co for v in o.data.vertices]
 return BVHTree.FromPolygons(vs,[list(p.vertices) for p in o.data.polygons]),[min(v[k] for v in vs) for k in range(3)],[max(v[k] for v in vs) for k in range(3)]
hits=[];samples=0
for mode in ['idle','walk','run','ride','airborne']:
 for i in range(32):
  phase=i*math.tau/32;walk=mode in ['walk','run'];swing=math.sin(phase)*(.5 if mode=='run' else .32) if walk else 0
  riding=mode=='ride';air=mode=='airborne'
  angles={'legL':-1.15 if riding else -.25 if air else swing,'legR':-1.15 if riding else .20 if air else -swing,'kneeL':1.3 if riding else max(0,-swing)*1.15,'kneeR':1.3 if riding else max(0,swing)*1.15,'armL':-.5 if riding else -swing*.65,'armR':-.5 if riding else swing*.65,'elbowL':-.7 if riding else -.12,'elbowR':-.7 if riding else -.12,'cape':.07+math.sin(phase)*.025 if walk else .015}
  for name,angle in angles.items():nodes[name].rotation_euler.x=angle
  bpy.context.view_layer.update();bv,lo,hi=shape(cloth)
  for o in obstacles:
   ov,ol,oh=shape(o)
   if any(hi[k]<ol[k] or lo[k]>oh[k] for k in range(3)):continue
   pairs=bv.overlap(ov)
   if pairs:hits.append({'mode':mode,'phase':i,'part':o.name,'trianglePairs':len(pairs)})
  samples+=1
report={'samples':samples,'hits':hits,'clothConnectedComponents':components,'shoulderWidth':shoulder_width,'footOuterWidth':foot_width,'passed':not hits and components==1 and abs(shoulder_width-foot_width)<.002,'scope':'Saved connected cloak vs map, sleeves, forearms, coat panels, trousers and boots at 160 sampled runtime poses; standing shoulder/foot width and cloth connectivity. Not full cloth simulation or all accessories.'}
(P/'artifacts/pipeline/human-courier-v1/cloak-collision.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
