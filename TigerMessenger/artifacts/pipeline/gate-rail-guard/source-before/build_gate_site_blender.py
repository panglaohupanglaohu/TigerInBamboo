"""Authored canyon shoulders and continuous stone viaduct fitted to sampled live tram.
Only replaces TM_Gate_Site; leaves all unrelated Blender scenes untouched."""
import bpy,bmesh,json,math
LAND_ROUND=int(globals().get("LAND_ROUND",10))
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/models/optimized/gate-of-sighs';D=json.loads((ROOT/'artifacts/pipeline/gate-of-sighs-build/site-source.json').read_text())
old=bpy.data.scenes.get('TM_Gate_Site')
if old:
 if bpy.context.window.scene==old:bpy.context.window.scene=next(s for s in bpy.data.scenes if s!=old)
 for o in list(old.objects):bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.scenes.remove(old)
sc=bpy.data.scenes.new('TM_Gate_Site');bpy.context.window.scene=sc
materials={}
for n,c in {'rock':(.27,.13,.10),'rockLight':(.38,.20,.14),'rockStrata':(.24,.20,.22),'rockCap':(.40,.26,.17),'stone':(.25,.22,.20),'trim':(.38,.32,.26),'shrub':(.13,.16,.085),'lamp':(.7,.29,.045)}.items():
 m=bpy.data.materials.new('GateSite_'+n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.96;materials[n]=m
parts=[]
def mesh(n,vs,fs,mat,walk=False,solid=True):
 d=bpy.data.meshes.new(n);d.from_pydata([(x,-z,y) for x,y,z in vs],[],fs);d.materials.append(materials[mat]);d.update();bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free();o=bpy.data.objects.new(n,d);sc.collection.objects.link(o);o['gateWalkable']=walk;o['gateSolid']=solid;parts.append(o);return o
boxfaces=[(0,2,6,4),(1,5,7,3),(0,4,5,1),(2,3,7,6),(0,1,3,2),(4,6,7,5)]
def box(n,c,dim,mat='stone',walk=False):return mesh(n,[tuple(c[k]+dim[k]*v[k]/2 for k in range(3)) for v in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]],boxfaces,mat,walk)
grid={(x,z):y for x,y,z in D['grid']}
def ground(x,z):
 x=max(-65,min(65,x));z=max(-140,min(140,z));x0=math.floor(x/5)*5;z0=math.floor(z/5)*5;x1=min(65,x0+5);z1=min(140,z0+5);a=(x-x0)/5;b=(z-z0)/5
 return (1-a)*(1-b)*grid[x0,z0]+a*(1-b)*grid[x1,z0]+(1-a)*b*grid[x0,z1]+a*b*grid[x1,z1]
# Faceted shoulders: a clear canyon slot stays beneath the actual rails.
for sign in [-1,1]:
 xs=[6.3,9,12,15,18,22,26,30,35,40,46,52,58,63];zs=list(range(-96,97 if LAND_ROUND>=2 else 55,4));vs=[]
 for j,z in enumerate(zs):
  for i,x in enumerate(xs):
   xx=sign*x;base=ground(xx,z)
   # Distance-based taper avoids a half-height wall in the first grid strip.
   edge=max(0,min((x-xs[0])/8,(xs[-1]-x)/24,(z-zs[0])/28,(zs[-1]-z)/28,1))
   edge=edge*edge*(3-2*edge)
   # Front/rear slopes frame a continuous canyon, with broad rock shelves
   # carrying the gate rather than independent conical peaks.
   crest=-7+17*math.exp(-((x-34)/19)**2-((z+32)/43)**2)
   if LAND_ROUND>=2:crest=max(crest,-8+19*math.exp(-((x-37)/18)**2-((z-36)/42)**2))
   if LAND_ROUND>=3 and x<28 and abs(z)<23:
    crest=max(crest,.65+1.3*math.sin(z*.16)**2)
   if LAND_ROUND>=6:
    crest=math.floor(crest/2.4)*2.4+.45*math.sin(z*.32+x*.21)
   if sign<0 and -42<z<-14 and x<32:crest=-4.6 if z<-26 else -.7
   y=base+(max(base,crest)-base)*edge
   closest=min(D['rail'],key=lambda s:(s['p'][0]-xx)**2+(s['p'][2]-z)**2);distance=math.hypot(closest['p'][0]-xx,closest['p'][2]-z)
   if distance<40:
    # Preserve the original inner clearance cap; smoothly release it outside 15m.
    cap=closest['p'][1]-8+max(0,min(distance,15)-7)*1.5
    release=max(0,min(1,(distance-15)/25));release=release*release*(3-2*release)
    y=min(y,cap+max(0,y-cap)*release)
   vs.append((xx,y,z))
 fs=[];nx=len(xs)
 for j in range(len(zs)-1):
  for i in range(nx-1):
   a=j*nx+i;fs.extend([(a,a+1,a+nx),(a+1,a+nx+1,a+nx)])
 # Close skirt to original terrain, no vertical sheet extending into the sky.
 boundary=list(range(nx))+[j*nx+nx-1 for j in range(1,len(zs))]+list(range((len(zs)-1)*nx+nx-2,(len(zs)-1)*nx-1,-1))+[j*nx for j in range(len(zs)-2,0,-1)]
 # Close using a matching ground-following grid, never a single nonplanar ngon.
 # The old open underside exposed a paper-thin silhouette from the neighboring city.
 top_count=len(vs)
 for x,y,z in list(vs):vs.append((x,min(y-1,ground(x,z)-1),z))
 for j in range(len(zs)-1):
  for i in range(nx-1):
   a=j*nx+i+top_count;fs.extend([(a+nx,a+1,a),(a+nx,a+nx+1,a+1)])
 for i,a in enumerate(boundary):
  b=boundary[(i+1)%len(boundary)];fs.append((a,b,b+top_count,a+top_count))
 o=mesh('canyon-shoulder-'+str(sign),vs,fs,'rock');o.data.materials.append(materials['rockLight'])
 if LAND_ROUND>=10:o.data.materials.append(materials['rockStrata']);o.data.materials.append(materials['rockCap'])
 for face in o.data.polygons:
  if LAND_ROUND>=6:
   mean=sum(o.data.vertices[v].co.z for v in face.vertices)/len(face.vertices)
   face.material_index=1 if int(math.floor(mean/2.4))%4==0 or face.normal.z>.75 else 0
  else:face.material_index=1 if face.index%7 in [0,2] else 0
  if LAND_ROUND>=10:
   if face.normal.z>.7:face.material_index=3
   elif int(math.floor(mean/2.4))%3==1:face.material_index=2
rail=D['rail']
def clearance(s):
 k=max(0,min(len(rail)-2,int((s+140)/2)));a=rail[k];b=rail[k+1];t=(s-a['s'])/2
 return (a['trackRadius']-a['groundRadius'])*(1-t)+(b['trackRadius']-b['groundRadius'])*t
def sample(s):
 k=max(0,min(len(rail)-2,int((s+140)/2)));a=rail[k];b=rail[k+1];t=(s-a['s'])/(b['s']-a['s']);p=Vector(a['p']).lerp(Vector(b['p']),t);v=Vector(b['p'])-Vector(a['p']);right=Vector(a['right']).lerp(Vector(b['right']),t).normalized();return p,right,(a['ground']*(1-t)+b['ground']*t)
def rp(s,x,y):
 p,r,_=sample(s);k=max(0,min(len(rail)-2,int((s+140)/2)));t=(s-rail[k]['s'])/2;up=Vector(rail[k]['up']).lerp(Vector(rail[k+1]['up']),t).normalized();return tuple(p+r*x+up*y)
# Curved deck surfaces track every two metres. No change to the running rails.
for k in range(140):
 a=-140+k*2;b=a+2
 if clearance((a+b)/2)<-.4:continue
 vs=[rp(s,x,y) for s in [a,b] for x,y in [(-2.2,-.65),(2.2,-.65),(2.2,-.20),(-2.2,-.20)]]
 mesh('viaduct-deck-'+str(k),vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'stone',True)
# Continuous parapet coping outside the swept train envelope.
for k in range(140):
 a=-140+k*2;b=a+2
 if clearance((a+b)/2)<-.4:continue
 for side in [-1,1]:
  vs=[rp(ss,x,y) for ss in [a,b] for x,y in [(side*2.25,-.2),(side*2.48,-.2),(side*2.48,.28),(side*2.25,.28)]]
  mesh('bridge-edge-coping',vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'trim')
# Low stone posts and dark handrails outside the train's lateral envelope.
for ss in range(-140,141,5):
 for side in [-1,1]:
  vs=[rp(t,x,y) for t in [max(-140,ss-.13),min(140,ss+.13)] for x,y in [(side*2.26,.28),(side*2.48,.28),(side*2.48,1.20),(side*2.26,1.20)]]
  mesh('bridge-parapet-post',vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'trim')
for k in range(140):
 a=-140+k*2;b=a+2
 for side in [-1,1]:
  vs=[rp(ss,x,y) for ss in [a,b] for x,y in [(side*2.30,1.08),(side*2.43,1.08),(side*2.43,1.20),(side*2.30,1.20)]]
  mesh('bridge-handrail',vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'rock')
# True open arches, continuous below the deck. Build only where terrain leaves clearance.
pier_stations=set()
for k in range(28):
 a=-140+k*10;b=a+10;mid=(a+b)/2;p,r,g=sample(mid)
 if clearance(mid)<6:continue
 vs=[];N=16
 for i in range(N+1):
  t=i/N;s=a+t*10;under=-5.7+4.8*math.sqrt(max(0,1-(2*t-1)**2))
  vs.extend([rp(s,-2.15,under),rp(s,2.15,under),rp(s,2.15,-.65),rp(s,-2.15,-.65)])
 fs=[(0,1,2,3),(N*4+3,N*4+2,N*4+1,N*4)]
 for i in range(N):
  for j in range(4):fs.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
 mesh('viaduct-arch-'+str(k),vs,fs,'trim')
 # Radial voussoir joints on both visible bridge faces; below train clearance.
 for i in range(1,N):
  t=i/N;ss=a+t*10;low=-5.7+4.8*math.sqrt(max(0,1-(2*t-1)**2))
  for side in [-1,1]:
   vsj=[rp(ss-.025,side*2.159,low+.03),rp(ss+.025,side*2.159,low+.03),rp(ss+.025,side*2.159,-.67),rp(ss-.025,side*2.159,-.67)]
   vsj += [rp(ss-.025,side*2.169,low+.03),rp(ss+.025,side*2.169,low+.03),rp(ss+.025,side*2.169,-.67),rp(ss-.025,side*2.169,-.67)]
   mesh('bridge-voussoir-joint',vsj,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'rock')

 for s in [a,b]:
  if s in pier_stations:continue
  pier_stations.add(s)
  p,r,g=sample(s);up=Vector(rail[max(0,min(len(rail)-1,int((s+140)/2)))]['up'])
  bottom=min(-clearance(s)-.6,-6);top=-5.2
  vs=[rp(ss,x,y) for ss in [max(-140,s-.65),min(140,s+.65)] for x,y in [(-2.48,bottom),(2.48,bottom),(2.15,top),(-2.15,top)]]
  mesh('viaduct-pier-'+str(s),vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'stone')
  vs=[rp(ss,x,y) for ss in [max(-140,s-.82),min(140,s+.82)] for x,y in [(-2.58,bottom),(2.58,bottom),(2.58,bottom+.55),(-2.58,bottom+.55)]]
  mesh('bridge-pier-footing',vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'trim')
# Pedestrian spur joins the retained stairs to the real viaduct edge, above canyon water.
a=Vector((-23,-3.78,-39));landing=min(rail,key=lambda row:abs(row['p'][2]+39));b=Vector(landing['p']);b.x-=1.8;b.y-=.20;steps=max(1,math.ceil(abs(a.y-b.y)/.23));route=[]
for i in range(steps):
 t=(i+.5)/steps;p=a.lerp(b,t);top=a.y+(b.y-a.y)*(i/steps);length=math.hypot(a.x-b.x,a.z-b.z)/steps+.08
 o=box('bank-approach-step-'+str(i),(0,-.3,0),(3.4,.6,length),'stone',True);angle=math.atan2(b.x-a.x,b.z-a.z);o.rotation_euler.z=angle;o.location=(p.x,-p.z,top);route.append([p.x,top,p.z])
box('approach-turning-landing',(-23,-4.08,-38),(4,.6,2.3),'stone',True)
# Join static geometry by material and collision role, retaining flat normals.
merged=[]
for mat in materials.values():
 for walk in [False,True]:
  batch=[o for o in list(sc.objects) if o.type=='MESH' and o.get('gateWalkable')==walk and len(o.data.materials)==1 and o.data.materials[0]==mat]
  if not batch:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in batch:o.select_set(True)
  bpy.context.view_layer.objects.active=batch[0];bpy.ops.object.join();o=batch[0];o.name='gate-site-'+mat.name.split('.')[0]+('-walk' if walk else '-solid');merged.append(o)
merged += [o for o in sc.objects if o.type=='MESH' and len(o.data.materials)>1]
bpy.context.view_layer.update()
result=[];triangles=0
for o in merged:
 bpy.context.view_layer.objects.active=o;o.select_set(True);o.data.calc_loop_triangles();ps=[];ns=[];cols=[];normalmatrix=o.matrix_world.to_3x3().inverted().transposed()
 for tri in o.data.loop_triangles:
  n=normalmatrix@tri.normal;n.normalize();color=o.data.materials[tri.material_index].diffuse_color[:3]
  for idx in tri.vertices:
   v=o.matrix_world@o.data.vertices[idx].co;ps.extend([v.x,v.z,-v.y]);ns.extend([n.x,n.z,-n.y]);cols.extend(color)
 triangles+=len(o.data.loop_triangles);result.append({'name':o.name,'positions':ps,'normals':ns,'colors':cols,'walkable':bool(o.get('gateWalkable')),'solid':bool(o.get('gateSolid'))})
asset={'source':'Blender TM_Gate_Site fitted to actual 8931 tram samples','anchorU':D['u'],'matrix':D['matrix'],'origin':D['origin'],'quaternion':D['quaternion'],'parts':result,'triangles':triangles,'approachRoute':route}
(OUT/'gateSiteData.js').write_text('export default '+json.dumps(asset,separators=(',',':'))+';\n')
bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(ROOT/'godot/assets/art-pilots/gate-site-v1.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True)
bpy.data.libraries.write(str(OUT/'gate-site-v1.blend'),{sc},fake_user=True)
(OUT/'site-manifest.json').write_text(json.dumps({k:v for k,v in asset.items() if k!='parts'},indent=2))
print('GATE_SITE '+str(len(result))+' meshes '+str(triangles)+' triangles')
