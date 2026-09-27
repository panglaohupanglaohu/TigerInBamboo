"""Target-driven surface wear, dry scrub and mesa silhouettes; fixed gate-local frame.
Owns TM_Gate_Dressing only. Never modifies approved structural meshes or source rail."""
import bpy,bmesh,json,math,random
LAND_ROUND=int(globals().get("LAND_ROUND",10))
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/models/optimized/gate-of-sighs';rng=random.Random(210925)
old=bpy.data.scenes.get('TM_Gate_Dressing')
if old:
 if bpy.context.window.scene==old:bpy.context.window.scene=next(s for s in bpy.data.scenes if s!=old)
 for o in list(old.objects):bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.scenes.remove(old)
sc=bpy.data.scenes.new('TM_Gate_Dressing');bpy.context.window.scene=sc
source=json.loads((ROOT/'artifacts/pipeline/gate-of-sighs-build/before-source.json').read_text())
site=json.loads((OUT/'gateSiteData.js').read_text().removeprefix('export default ').rstrip(';\n'))
site_source=json.loads((ROOT/'artifacts/pipeline/gate-of-sighs-build/site-source.json').read_text())
verts=[];faces=[]
for p in site['parts']:
 if not p['name'].startswith('canyon-shoulder'):continue
 a=p['positions'];base=len(verts);verts.extend([tuple(a[i:i+3]) for i in range(0,len(a),3)]);faces.extend([tuple(range(base+i,base+i+3)) for i in range(0,len(a)//3,3)])
bvh=BVHTree.FromPolygons(verts,faces,all_triangles=True)
def ground(x,z):
 hit=bvh.ray_cast(Vector((x,100,z)),Vector((0,-1,0)),200)
 return hit[0].y if hit[0] is not None else None
mats={}
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
for key,h in {'plaster':'8c7d77','warmWear':'a58b78','ashWear':'827570','crack':'5e5556','mesa':'94705e','mesaShade':'786377','mesaCap':'b48a70','bark':'514735','leaf':'63674b','leafLit':'777a52','pot':'9c7054'}.items():
 c=[linear(int(h[i:i+2],16)/255) for i in (0,2,4)];m=bpy.data.materials.new('GateDress_'+key);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=1;mats[key]=m
parts=[];counts={'weatherPatches':0,'cracks':0,'trees':0,'shrubs':0,'mesas':0};placements=[]
def mesh(name,vs,fs,material,kind):
 d=bpy.data.meshes.new(name);d.from_pydata([(x,-z,y) for x,y,z in vs],[],fs);d.materials.append(mats[material]);d.update();bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free();o=bpy.data.objects.new(name,d);sc.collection.objects.link(o);o['kind']=kind;parts.append(o);return o
# Broad connected erosion follows the exposed tier edges. The stone bed is
# bordered by a shallow broken plaster lip; no isolated pale sticker shards.
wear_rng=random.Random(92144)
for p in source['parts']:
 if not p['name'].startswith('tower-tier-'):continue
 tier=int(p['name'].rsplit('-',1)[1]);a=p['positions'];ps=[a[i:i+3] for i in range(0,len(a),3)]
 side=-1 if min(v[0] for v in ps)+max(v[0] for v in ps)<0 else 1
 w=[19,17,15,13][tier];h=[25,8,5,4][tier];bottom=sum([25,8,5,4][:tier]);cx=side*15.5;z=min(v[2] for v in ps)-8-.045
 for edge in [-1,1]:
  # Each patch touches the masonry edge, tapering into the intact ochre skin.
  outer=cx+edge*(w/2-.48)
  n=21 if tier==0 else 11
  start=wear_rng.uniform(.02,.19);end=wear_rng.uniform(.80,.98)
  ys=[bottom+h*(start+(end-start)*i/(n-1)) for i in range(n)]
  depths=[wear_rng.uniform(.045,.25) for _ in ys]
  depths=[sum(depths[max(0,i-2):min(n,i+3)])/len(depths[max(0,i-2):min(n,i+3)]) for i in range(n)]
  inner=[outer-edge*w*d for d in depths]
  vs=[]
  for i,y in enumerate(ys):vs.extend([(outer,y,z),(inner[i],y,z-.018)])
  fs=[]
  for i in range(n-1):fs.extend([(2*i,2*i+1,2*i+3),(2*i,2*i+3,2*i+2)])
  o=mesh('exposed-old-stone',vs,fs,'plaster','wear')
  o.data.materials.append(mats['ashWear']);o.data.materials.append(mats['warmWear'])
  for f in o.data.polygons:
   f.material_index=wear_rng.choices([0,1,2],[12,2,1])[0]
   # Front faces must point toward local -Z (Blender +Y).
   if f.normal.y<0:f.flip()
  for i in range(n-1):
   lip=[(inner[i],ys[i],z-.018),(inner[i]+edge*.10,ys[i]+.025,z-.09),(inner[i+1]+edge*.10,ys[i+1]-.025,z-.09),(inner[i+1],ys[i+1],z-.018)]
   mesh('broken-plaster-lip',lip,[(0,1,2,3)],'warmWear','wear')
  # Meandering cracks split exposed stone, with occasional short branches.
  for j in range(1,n-1,2):
   x=(outer+inner[j])*.5;y=ys[j]
   path=[(x,y),(x+.22,y-.5),(x-.12,y-1.0),(x+.10,y-1.45)]
   for (ax,ay),(bx,by) in zip(path,path[1:]):
    mesh('aged-stone-fracture',[(ax-.035,ay,z-.03),(ax+.035,ay,z-.03),(bx+.022,by,z-.03),(bx-.022,by,z-.03)],[(0,3,2,1)],'crack','wear')
   counts['cracks']+=1
  counts['weatherPatches']+=1
# Keep landscape randomness unchanged by the architectural iteration.
rng=random.Random(210925)
# Layered far cliff shoulders stay in the existing gate site's outer strip.
for i,(x,z,h,rx,rz) in enumerate([(-53,18,23,7,8),(-57,39,34,6,8),(-48,47,20,7,6),(52,24,25,7,8),(57,45,35,6,7),(46,48,22,6,6)]):
 y=ground(x,z)
 if y is None:continue
 if LAND_ROUND>=6:h*=.55;rx*=1.3;rz*=1.35
 n=9;vs=[]
 for level,scale in [(0,1.15),(.32,1.02),(.38,.83),(.70,.75),(.76,.60),(1,.55)]:
  for j in range(n):
   angle=j*math.tau/n;vs.append((x+math.cos(angle)*rx*scale+rng.uniform(-.35,.35),y+level*h,z+math.sin(angle)*rz*scale+rng.uniform(-.3,.3)))
 fs=[tuple(range(n-1,-1,-1)),tuple(range(5*n,6*n))]
 fs += [(k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j) for k in range(5) for j in range(n)]
 o=mesh('distant-layered-mesa-'+str(i),vs,fs,'mesa','landscape');o.data.materials.append(mats['mesaShade']);o.data.materials.append(mats['mesaCap'])
 for face in o.data.polygons:face.material_index=2 if face.normal.z>.65 else (1 if face.normal.x>.4 else 0)
 counts['mesas']+=1
# Roots are raycast to the actual Blender rock surface, outside rail and walking reserves.
def allowed(x,z):
 if -32<x<-14 and -42<z<-13:return False
 if -45<x<12 and -43<z<-34:return False
 if LAND_ROUND>=9 and any(math.hypot(x-p[0],z-p[2])<3 for p in site.get('approachRoute',[])):return False
 return min(math.hypot(x-r['p'][0],z-r['p'][2]) for r in site_source['rail'])>8

def ico(name,p,scale,mat):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(p[0],-p[2],p[1]));o=bpy.context.object;o.name=name;o.scale=(scale[0],scale[2],scale[1]);o.data.materials.append(mats[mat]);o['kind']='vegetation';parts.append(o);return o

def branch(a,b,r0,r1):
 aa=Vector((a[0],-a[2],a[1]));bb=Vector((b[0],-b[2],b[1]));delta=bb-aa;bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=r0,radius2=r1,depth=delta.length,location=(aa+bb)/2);o=bpy.context.object;o.name='dry-twisted-branch';o.rotation_euler=delta.to_track_quat('Z','Y').to_euler();o.data.materials.append(mats['bark']);o['kind']='vegetation';parts.append(o)
tree_sites=[(-37,-18,5.1),(-43,8,4.2),(34,-19,4.6),(44,16,5.2)]
if LAND_ROUND>=7:tree_sites += [(-33,-55,4.4),(40,-62,5.8),(-38,50,5.2),(42,60,4.5),(-48,-34,6.3),(50,37,5.8),(31,30,4.4),(-32,27,4.9)]
for x,z,h in tree_sites:
 if not allowed(x,z):continue
 y=ground(x,z)
 if y is None:continue
 branch((x,y-.12,z),(x+.35,y+h*.62,z+.15),.32 if LAND_ROUND>=7 else .20,.12)
 for dx,dz in [(-1.4,-.6),(1.3,-.4),(.2,1.25)]:
  tip=(x+dx,y+h*.83,z+dz);branch((x+.3,y+h*.49,z),tip,.11,.04);ico('sparse-umbrella-crown',tip,(1.8,.7,1.35),'leafLit' if dx<0 else 'leaf')
  if LAND_ROUND>=7:
   for ex,ez in [(-.7,.3),(.65,-.35)]:ico('crown-lobe',(tip[0]+ex,tip[1]-.25,tip[2]+ez),(1.4,.7,1.1),'leaf')
 placements.append({'kind':'tree','point':[x,y,z]});counts['trees']+=1
for i in range(150 if LAND_ROUND>=8 else 45):
 x=rng.choice([-1,1])*rng.uniform(25,51);z=rng.uniform(-80,80) if LAND_ROUND>=8 else rng.uniform(-47,43)
 if not allowed(x,z):continue
 y=ground(x,z)
 if y is None or y< -12:continue
 for j in range(3):
  xx=x+j*.36;zz=z+math.sin(j)*.3;yy=ground(xx,zz) if LAND_ROUND>=9 else y
  if yy is not None and (LAND_ROUND<9 or allowed(xx,zz)):ico('dry-rock-pocket-shrub',(xx,yy+.25,zz),(.65,.46,.60),'leafLit' if j==0 else 'leaf')
 placements.append({'kind':'shrub','point':[x,y,z]});counts['shrubs']+=1
# Low planting pockets on front/rear rock sockets, never inside the tower or rail slot.
if LAND_ROUND>=8:
 for sign in [-1,1]:
  for z in [-24,-21,21,24]:
   for x0 in [13,18,23]:
    x=sign*x0
    if not allowed(x,z):continue
    y=ground(x,z)
    if y is None:continue
    ico('gate-foot-rock-pocket',(x,y+.22,z),(.72,.40,.62),'leaf')
    placements.append({'kind':'shrub','point':[x,y,z]});counts['shrubs']+=1
# Match structural batter exactly; weathering follows the wall, never floats.
for o in list(sc.objects):
 if o.get('kind')!='wear':continue
 for v in o.data.vertices:
  factor=1-.0105*max(0,min(42,v.co.z));cx=15.5 if v.co.x>0 else -15.5
  v.co.x=cx+(v.co.x-cx)*factor;v.co.y*=factor
 o.data.update()
# Rear elevations share attached erosion, with reversed face winding.
for o in list(sc.objects):
 if o.get('kind')!='wear':continue
 back=o.copy();back.data=o.data.copy();sc.collection.objects.link(back);back.name='rear-'+o.name
 for v in back.data.vertices:v.co.y=-v.co.y
 for face in back.data.polygons:face.flip()
 back.data.update()
# Bake all transforms and combine by purpose. Three draws total with per-face colour.
bpy.context.view_layer.update();result=[]
for kind in ['wear','landscape','vegetation']:
 objects=[o for o in list(sc.objects) if o.type=='MESH' and o.get('kind')==kind]
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=objects[0];o.name='gate-dressing-'+kind;o.data.calc_loop_triangles();normalmat=o.matrix_world.to_3x3().inverted().transposed();ps=[];ns=[];cs=[]
 for tri in o.data.loop_triangles:
  normal=(normalmat@tri.normal).normalized();c=o.data.materials[tri.material_index].diffuse_color[:3]
  for idx in tri.vertices:
   v=o.matrix_world@o.data.vertices[idx].co;ps.extend([v.x,v.z,-v.y]);ns.extend([normal.x,normal.z,-normal.y]);cs.extend(c)
 result.append({'name':o.name,'kind':kind,'positions':ps,'normals':ns,'colors':cs})
asset={'source':'Blender TM_Gate_Dressing','parts':result,'counts':counts,'placements':placements,'triangles':sum(len(p['positions'])//9 for p in result)}
(OUT/'gateDressingData.js').write_text('export default '+json.dumps(asset,separators=(',',':'))+';\n');(OUT/'dressing-manifest.json').write_text(json.dumps({k:v for k,v in asset.items() if k!='parts'},indent=2))
bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(ROOT/'godot/assets/art-pilots/gate-dressing-v1.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True)
bpy.data.libraries.write(str(OUT/'gate-dressing-v1.blend'),{sc},fake_user=True)
print(json.dumps({'counts':counts,'triangles':asset['triangles']}))
