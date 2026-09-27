"""Approved gate target: original geometry -> authored Blender copy -> shared engines.
Coordinates passed to helpers are Three.js (X right, Y up, Z rail forward).
Does not clear the user's scene. Owns only TM_Gate_Target_v1.
"""
import bpy, bmesh, json, math, random
ROUND = int(globals().get("GATE_ITERATION", 3))
LAND_ROUND=int(globals().get("LAND_ROUND",10))
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
OUT=ROOT/'assets/models/optimized/gate-of-sighs';OUT.mkdir(parents=True,exist_ok=True)
source=json.loads((ROOT/'artifacts/pipeline/gate-of-sighs-build/before-source.json').read_text())
scene=bpy.data.scenes.get('TM_Gate_Target_v1') or bpy.data.scenes.new('TM_Gate_Target_v1')
bpy.context.window.scene=scene
for obj in list(scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
rng=random.Random(210921)
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
palette={'brick':'a36b54','stone':'887679','edge':'bc9478','dark':'44383d','cloth':'752f38','gold':'b99550','rock':'785f60','leaf':'4e5940','wood':'614335'}
mats={}
for name,h in palette.items():
 m=bpy.data.materials.new('Gate_'+name);c=[linear(int(h[i:i+2],16)/255) for i in (0,2,4)]
 m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.96;p.inputs['Metallic'].default_value=0
 mats[name]=m
def cv(v):return (v[0],-v[2],v[1])
def mesh(name,verts,faces,mat,walk=False,bevel=0):
 me=bpy.data.meshes.new(name);me.from_pydata([cv(v) for v in verts],[],faces);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 if bevel:
  bmesh.ops.dissolve_limit(bm,angle_limit=.001,verts=list(bm.verts),edges=list(bm.edges),use_dissolve_boundaries=False)
  es=[e for e in bm.edges if len(e.link_faces)==2 and e.calc_face_angle()>.3]
  if es:bmesh.ops.bevel(bm,geom=es,offset=bevel,segments=1,affect='EDGES',clamp_overlap=True)
 bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();me.update()
 o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);o.data.materials.append(mats[mat]);o['gateWalkable']=walk;o['gateSolid']=not walk and mat not in ('leaf','cloth','gold')
 return o
def box(name,p,s,mat='stone',walk=False,bevel=.035):
 x,y,z=p;w,h,d=[v/2 for v in s]
 return mesh(name,[(x+a*w,y+b*h,z+c*d) for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],mat,walk,bevel)
def ring(name,c,r,w,zdepth,mat='edge',start=0,end=math.pi,n=18):
 x,y,z=c
 for i in range(n):
  a=start+(end-start)*i/n+.012;b=start+(end-start)*(i+1)/n-.012
  vs=[(x+rr*math.cos(t),y+rr*math.sin(t),zz) for zz in [z-zdepth/2,z+zdepth/2] for rr,t in [(r,a),(r,b),(r+w,b),(r+w,a)]]
  mesh(name+'-%02d'%i,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
def rod(name,a,b,r=.06,mat='gold'):
 aa=Vector(cv(a));bb=Vector(cv(b));d=bb-aa
 bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=d.length,location=(aa+bb)/2)
 o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(mats[mat]);o['gateSolid']=False;return o
def banner(name,x,y,z,w,h):
 vs=[(x-w/2,y,z),(x+w/2,y,z),(x+w/2,y-h+.6,z-.1),(x,y-h,z-.12),(x-w/2,y-h+.6,z-.1)]
 o=mesh(name,vs,[(0,1,2,3,4)],'cloth');o['gateSolid']=False
 mod=o.modifiers.new('Woven fabric thickness','SOLIDIFY');mod.thickness=.035
 rod(name+'-hanger',(x-w*.62,y+.15,z),(x+w*.62,y+.15,z),.075)
 for a,b in [(0,4),(4,3),(3,2),(2,1)]:rod(name+'-hem',vs[a],vs[b],.035)
 ring(name+'-sigil',(x,y-h*.42,z-.055),w*.19,.045,.03,'gold',0,2*math.pi,20)
 rod(name+'-sigil-stem',(x,y-h*.23,z-.07),(x,y-h*.65,z-.07),.035)

# Original structural bodies are imported, not substituted with a stock kit.
towers=[]
for p in source['parts']:
 n=p['name']
 if not (n.startswith('tower-tier-') or n.startswith('gate-arch-') or n.startswith('channel-pier-')):continue
 a=p['positions'];v=[a[i:i+3] for i in range(0,len(a),3)]
 if n.startswith('tower-tier-'):
  tier=int(n.rsplit('-',1)[1]);x0=min(q[0] for q in v);x1=max(q[0] for q in v);y0=min(q[1] for q in v);y1=max(q[1] for q in v)
  zmin=min(q[2] for q in v);zmax=max(q[2] for q in v)
  side=-1 if (x0+x1)<0 else 1;ws=[19,17,15,13];hs=[25,8,5,4];base=sum(hs[:tier])
  v=[[side*15.5+(q[0]-(x0+x1)/2)/(x1-x0)*ws[tier],base+(q[1]-y0)/(y1-y0)*hs[tier],q[2]+8*(2*(q[2]-zmin)/(zmax-zmin)-1)] for q in v]
 elif n.startswith('gate-arch-'):
  v=[[((1 if q[0]>0 else -1)*(15.5-9.5*(1-.0105*max(0,q[1]*1.7))+.3) if abs(q[0]*1.7)>6.2 else q[0]*1.7),q[1]*1.7,q[2]] for q in v]
 elif n.startswith('channel-pier-'):
  v=[[q[0]*1.7,q[1]*1.7,q[2]] for q in v]
 o=mesh(n,v,[(i,i+1,i+2) for i in range(0,len(v),3)],'brick' if n.startswith('tower') and tier==0 else 'stone',bevel=.075)
 if n.startswith('tower'):
  xs=[v[0] for v in v];ys=[v[1] for v in v];zs=[v[2] for v in v];towers.append((min(xs),max(xs),min(ys),max(ys),min(zs),max(zs)))
for idx,(x0,x1,y0,y1,z0,z1) in enumerate(towers):
 cx=(x0+x1)/2;w=x1-x0;h=y1-y0;d=z1-z0
 box('tier-cornice-'+str(idx),(cx,y1-.04,(z0+z1)/2),(w+.24,.38,d+.24),'edge')
 for x in [x0+.25,x1-.25]:box('facade-pilaster',(x,(y0+y1)/2,z0-.14),(.42,h,.3),'stone')
 for j in range(1,max(2,int(h/1.5))):
  yy=y0+j*h/max(2,int(h/1.5));box('masonry-bed',(cx,yy,z0-.025),(w-.5,.035,.035),'dark',bevel=0)
 for row in range(max(1,int(h/1.6))):
  for k in range(4):
   x=x0+.6+(k+(row%2)*.5)*(w-1.2)/4
   if x<x1-.3:box('masonry-joint',(x,y0+(row+.5)*1.6,z0-.025),(.032,1.5,.036),'dark',bevel=0)
 if y0<1:
  banner('tower-vow-banner',cx,y1-1.2,z0-.4,3.4,16)
  for x in [x0+1.1,x1-1.1]:box('recessed-vertical-channel',(x,12,z0-.22),(.36,19,.2),'dark')
 if y1>38:
  box('summit-altar',(cx,y1+.35,(z0+z1)/2),(3,.55,3),'dark')
  bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=1.1,radius2=1.65,depth=.55,location=cv((cx,y1+.8,(z0+z1)/2)))
  o=bpy.context.object;o.name='summit-beacon-bowl';o.data.materials.append(mats['gold'])
for i,z in enumerate([-13.2,0,13.2]):
 # Wider/taller ROUND openings follow the approved target; never narrow the old clearance.
 ring('arch-voussoir-'+str(i),(0,18.7,z-1.16),5.16,.84,.3)
 for side in [-1,1]:
  for j in range(17):box('arch-jamb-block',(side*5.52,(j+.5)*1.1,z-1.16),(.78,1.05,.3),'edge')
 box('arch-coping',(0,25.55,z),(12.8,.38,2.45),'edge')
 ring('arch-crown-seal',(0,24.85,z-1.36),.34,.065,.035,'gold',0,2*math.pi,16)

# Target-driven round 2: layered ashlar feet and shrine back wall.
if ROUND >= 2:
 for side in [-1,1]:
  for row in range(4):
   for col in range(7):
    box('tower-foot-ashlar',(side*15.5+(col-3)*2.35,(row+.5)*1.1,-16.06),(2.30,1.06,.28),'stone',False,.045)
  for x in [side*15.5-6.8,side*15.5+6.8]:
   box('tower-buttress',(x,10,-16.1),(1.0,20,.65),'stone')
 # Mirrored by existing terrace transform below; rear of dialogue space.
 for x in [24.0,26.0,28.0]:
  box('meeting-shrine-wall',(x,5.1,-15.7),(1.94,3.7,.42),'stone')
  box('meeting-shrine-cap',(x,7.0,-15.7),(2.02,.22,.60),'edge')
 for x in [24.0,28.0]: banner('meeting-shrine-vow',x,6.5,-16.02,.7,2.3)

# Round 3: broad restrained face tones, not dense black mortar lines.
if ROUND >= 3:
 for o in list(scene.objects):
  if o.name.startswith('masonry-'):
   o.data.materials.clear();o.data.materials.append(mats['stone'])
# Rock shoulders support the original feet; none cross the rail channel |X|<3.
for side in [-1,1]:
 for i in range(15):
  x=side*(9+rng.random()*13);y=-2+rng.random()*3;z=-15+rng.random()*29
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=cv((x,y,z)))
  o=bpy.context.object;o.name='faceted-rock-shoulder';o.scale=(2+rng.random()*2,3+rng.random()*2,4+rng.random()*3);o.data.materials.append(mats['rock']);o['gateSolid']=True

# Independent right-hand meeting terrace: stairs end at the FRONT, not the rail.
mesh('meeting-terrace-foundation',[(16.5,2.8,-25),(29.5,2.8,-25),(29.5,2.8,-15),(16.5,2.8,-15),(14,-9,-27),(32,-9,-28),(33,-9,-12),(13,-9,-13),(15,-2,-25.8),(30.8,-1,-26.1),(31,-3,-13.4),(14.7,-1,-14)],[(0,1,2,3),(4,7,6,5),(0,8,9,1),(1,9,10,2),(2,10,11,3),(3,11,8,0),(8,4,5,9),(9,5,6,10),(10,6,7,11),(11,7,4,8)],'rock')
box('meeting-terrace-floor',(23,3,-20),(13,.4,10),'stone',True)
for x in range(17,30,2):
 for z in range(-24,-15,2):box('terrace-paving',(x,3.22,z),(1.96,.04,1.96),'edge',True,0)
for i in range(30):
 z=-37+(i+.5)*.4;top=-4.0+(i+1)*.24
 box('approach-stair-%02d'%i,(23,(top-7)/2,z),(3.6,top+7,.405),'stone',True,.015)
 for x in [20.95,25.05]:box('stair-sidewall',(x,top+.4,z),(.5,.8,.405),'edge',False,.02)
# Low parapets leave stairs' 3.6m arrival clear.
for x in [16.6,29.4]:box('terrace-side-parapet',(x,3.65,-20),(.5,.9,9.8),'stone')
box('terrace-back-parapet',(23,3.65,-15.4),(12.8,.9,.5),'stone')
for x,w in [(18.8,4),(27.2,4)]:box('terrace-front-parapet',(x,3.65,-24.7),(w,.9,.5),'stone')
# Canopy to the back/right leaves public approach and dialogue floor open.
for x in [23.5,28]:
 for z in [-20.5,-16]:rod('canopy-post',(x,3.25,z),(x,7.2,z),.095,'wood')
mesh('oxblood-canopy',[(23.2,7.25,-20.8),(28.3,7.25,-20.8),(23.2,7.25,-15.7),(28.3,7.25,-15.7),(25.75,6.7,-20.8),(25.75,6.7,-15.7)],[(0,4,5,2),(4,1,3,5)],'cloth')
banner('meeting-banner',28.0,6.7,-15.85,1.0,2.4)
for x,z in [(17.8,-16.5),(28,-22.5),(18,-22.5)]:
 for j in range(3):
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.65,location=cv((x+j*.4,3.3 if z<-15 and x>16 else -.2,z)))
  o=bpy.context.object;o.name='rock-pocket-shrub';o.scale=(1,.8,.7);o.data.materials.append(mats['leaf'])

# Front review looks from -Z: screen-right is local -X. Keep the meeting
# terrace on that side, matching the approved composition rather than mirroring it.
for o in list(scene.objects):
 if o.type!='MESH':continue
 if o.name.startswith(('meeting-','terrace-','approach-','stair-','canopy-','oxblood-canopy','rock-pocket-shrub')):
  transform=o.matrix_world.copy()
  for v in o.data.vertices:
   q=transform@v.co;q.x=-q.x;v.co=q
  o.matrix_world.identity()
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()

# Continuous batter across all structural courses, including facade details.
# Keep the base and the original traffic clearance; do not stack vertical boxes.
for o in list(scene.objects):
 if o.type!='MESH':continue
 if not o.name.startswith(('tower-','facade-','masonry-','recessed-','tier-cornice','summit-')):continue
 mat=o.matrix_world.copy()
 for v in o.data.vertices:
  q=mat@v.co;h=max(0,min(42,q.z));factor=1-.0105*h;cx=15.5 if q.x>0 else -15.5
  q.x=cx+(q.x-cx)*factor;q.y*=factor;v.co=q
 o.matrix_world.identity()
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()

# Mountain sockets carry the three gate walls down into the canyon banks.
if LAND_ROUND>=4:
 for zz in [-13.2,0,13.2]:
  for side in [-1,1]:
   cx=side*10.4
   vs=[(cx+sx*w,y,zz+sz*d) for y,w,d in [(-12,2.3,2.8),(16,1.6,2.05)] for sx,sz in [(-1,-1),(1,-1),(1,1),(-1,1)]]
   mesh('arch-mountain-socket',vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'stone',bevel=.06)
if LAND_ROUND>=5:
 for zz in [-13.2,0,13.2]:
  for x in [-7.4,-5.55,-3.7,-1.85,0,1.85,3.7,5.55,7.4]:
   box('embedded-arch-merlon',(x,26.12,zz),(1.05,1.15,2.2),'stone',bevel=.05)
  box('embedded-arch-wall-cap',(0,25.60,zz),(17,.36,2.48),'edge')

# Rear face inherits the same architectural language, no additional tower.
for o in list(scene.objects):
 if o.type=='MESH' and o.name.startswith(('facade-pilaster','masonry-','recessed-vertical-channel','tower-vow-banner','tower-foot-ashlar','tower-buttress','arch-voussoir','arch-jamb-block','arch-crown-seal')):
  duplicate=o.copy();duplicate.data=o.data.copy();scene.collection.objects.link(duplicate);duplicate.name='rear-'+o.name
  transform=duplicate.matrix_world.copy()
  for v in duplicate.data.vertices:
   q=transform@v.co;q.y=-q.y;v.co=q
  duplicate.matrix_world.identity()
  bm=bmesh.new();bm.from_mesh(duplicate.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(duplicate.data);bm.free()

# Freeze generated modifiers; merge by material and walkability for both engines.
for o in list(scene.objects):
 if o.type!='MESH':continue
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.select_set(False)
groups={}
for o in list(scene.objects):
 if o.type=='MESH':groups.setdefault((o.data.materials[0].name,bool(o.get('gateWalkable')),bool(o.get('gateSolid'))),[]).append(o)
parts=[]
for (mat,walk,solid),objects in groups.items():
 positions=[];normals=[]
 for o in objects:
  o.data.calc_loop_triangles();normalmat=o.matrix_world.to_3x3().inverted().transposed()
  for tri in o.data.loop_triangles:
   n=(normalmat@tri.normal).normalized()
   for vi in tri.vertices:
    v=o.matrix_world@o.data.vertices[vi].co;positions.extend([round(v.x,5),round(v.z,5),round(-v.y,5)]);normals.extend([round(n.x,6),round(n.z,6),round(-n.y,6)])
 parts.append({'name':mat+('_walk' if walk else '_solid' if solid else '_detail'),'positions':positions,'normals':normals,'color':list(objects[0].data.materials[0].diffuse_color[:3]),'walkable':walk,'solid':solid})
 # Join keeps Blender and GLB draw-call budget comparable to Web.
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=parts[-1]['name']
data={'source':'assets/models/optimized/gate-of-sighs/gate-of-sighs-v1.blend','parts':parts,'meetingAnchor':[-25,3.26,-18.5],'approach':[-23,-3.76,-36.8],'originalRailOpening':{'width':6,'apex':14},'targetRailOpening':{'width':10.2,'apex':23.8},'triangles':sum(len(p['positions'])//9 for p in parts)}
(OUT/'gateTargetData.js').write_text('export default '+json.dumps(data,separators=(',',':'))+';\n')
(OUT/'manifest.json').write_text(json.dumps({k:v for k,v in data.items() if k!='parts'},indent=2))
bpy.data.libraries.write(str(OUT/'gate-of-sighs-v1.blend'),{scene},fake_user=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'godot/assets/art-pilots/gate-of-sighs-v1.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True,export_yup=True)
print(json.dumps({'parts':len(parts),'triangles':data['triangles'],'blend':str(OUT/'gate-of-sighs-v1.blend')}))
