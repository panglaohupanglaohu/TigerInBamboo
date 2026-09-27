"""V7 native art candidate. Copies live source assets; never overwrites originals.
The local composition is a review scene, not a validated spherical transit release.
"""
import bpy, json, math, sys, random
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'artifacts/pipeline/crystal-v7-three-rounds'
OUT=ROOT/'assets/models/optimized/crystal-v7'
OUT.mkdir(parents=True,exist_ok=True)
ROUND=int(sys.argv[sys.argv.index('--')+1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ART/'round-1-source.glb'))
scene=bpy.context.scene
scene.name='CrystalV7_Round_%d'%ROUND
all_source=list(scene.objects)
names=['moebius-grand-community-tower','moebius-trackside-gold-right','moebius-trackside-gold-left','moebius-swamp-placement']
roots=[next(o for o in scene.objects if o.name==n) for n in names]
keep=set()
for o in roots:keep.add(o);keep.update(o.children_recursive)
for o in roots:
 o.parent=None
 # Blender's glTF importer converts both node bases and mesh coordinates to Z-up.
 # Reset only the original spherical placement; an extra X rotation would tip towers.
 o.matrix_world=Matrix.Identity(4)
for o in all_source:
 if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
sites=[(3,28,9,3),(-38,-8,5,1.35),(40,-12,5,1.35),(0,-3,8.2,.5)]
if ROUND>=3:
 sites=[(3,40,9,3),(-42,-29,5,1.35),(43,-29,5,1.35),(0,-3,8.2,.5)]
for o,(x,y,z,s) in zip(roots,sites):
 o.location=(x,y,z);o.scale=(s,s,s)
 if ROUND>=2 and o!=roots[-1]:
  # Broader faceted bodies/flower halls retain every original component.
  o.scale.x*=1.8;o.scale.y*=1.8;o.scale.z*=.82
if ROUND>=2:
 for o in roots[-1].children_recursive:
  if o.name.startswith('swamp-towering-tree'):
   o.scale.z*=.55

def srgb(h):
 vals=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 return [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in vals]
palette={'rock':'b9a68b','rock2':'d3bda0','stone':'eee0c3','cap':'f7e8cb','grass':'809566','leaf':'365c46','lightleaf':'728b4d','trunk':'685544','gold':'bd9143','water':'25899f','dark':'40586a','flower':'e2a0a1'}
mats={}
for name,c in palette.items():
 m=bpy.data.materials.new('V7_'+name);m.diffuse_color=(*srgb(c),1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Roughness'].default_value=.78
 mats[name]=m
created=[]
def mesh(name,vs,faces,mat):
 d=bpy.data.meshes.new(name);d.from_pydata(vs,[],faces);d.update();o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);d.materials.append(mats[mat]);created.append(o);return o
def ring(name,x,y,levels,n,mat,seed=1):
 rng=random.Random(seed);j=[1+rng.uniform(-.06,.06) for _ in range(n)];vs=[]
 for z,r in levels:
  vs.extend([(x+math.cos(i*math.tau/n)*r*j[i],y+math.sin(i*math.tau/n)*r*j[i],z) for i in range(n)])
 fs=[tuple(reversed(range(n)))];fs += [(k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i) for k in range(len(levels)-1) for i in range(n)];fs.append(tuple(range((len(levels)-1)*n,len(levels)*n)))
 return mesh(name,vs,fs,mat)
def box(name,x,y,z,w,d,h,mat):
 return mesh(name,[(x+a*w/2,y+b*d/2,z+c*h/2) for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
def arch(name,x,y,z,r,depth,thick,angle=0):
 for i in range(12):
  a=i*math.pi/12;b=(i+1)*math.pi/12
  vs=[(rr*math.cos(t),yy,z+rr*math.sin(t)) for yy in [-depth/2,depth/2] for rr,t in [(r,a),(r+thick,a),(r+thick,b),(r,b)]]
  vs=[(x+u*math.cos(angle)-v*math.sin(angle),y+u*math.sin(angle)+v*math.cos(angle),w) for u,v,w in vs]
  mesh(name+str(i),vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'stone')

# Three asymmetric island foundations; the central bowl stays open.
for i,(x,y,z,s) in enumerate(sites[:3]):
 r=13 if i==0 else 11
 ring('bank-rock-%d'%i,x,y,[(-5,r*1.38),(-1,r*1.3),(z-2,r),(z-.25,r*.87)],14,'rock',i+3)
 ring('bank-grass-%d'%i,x,y,[(z-.35,r*.87),(z-.12,r*.86)],14,'grass',i+3)
 ring('tower-plinth-%d'%i,x,y,[(z-.65,r*.68),(z-.04,r*.68)],16,'stone',30+i)
# Outer sloping retaining embankment around the original swamp, no disk across water.
n=64;vs=[]
for radius,z in [(18,7.0),(21,7.0),(24,2),(25,-4)]:
 for j in range(n):
  a=j*math.tau/n;vs.append((math.cos(a)*radius,-3+math.sin(a)*radius,z))
mesh('swamp-outer-embankment',vs,[(k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j) for k in range(3) for j in range(n)],'rock')

if ROUND>=2:
 # Terraced waterfront masonry and stairs. Front landing remains a separate route.
 for i,(x,y,z,s) in enumerate(sites[:3]):
  r=13 if i==0 else 11
  for level in range(2):
   zz=1.5+level*2.0;rr=r*(1.15-level*.08)
   ring('quay-course-%d-%d'%(i,level),x,y,[(zz-.7,rr),(zz,rr)],16,'stone',i+3)
   ring('quay-coping-%d-%d'%(i,level),x,y,[(zz,rr+.12),(zz+.15,rr+.12)],16,'cap',i+3)
  for step in range(int((z-1.1)/.2)):
   zz=1.1+(step+1)*.2; yy=y-r-7+step*.28
   box('island-stair-%d-%02d'%(i,step),x,yy,(zz-1)/2+1,3.8,.29,zz-1,'stone')
  for side in [-1,1]:
   bx=x+side*5;by=y-r*.74
   box('arcade-pier',bx-1.6,by,2.05,.6,1.4,3.1,'stone');box('arcade-pier',bx+1.6,by,2.05,.6,1.4,3.1,'stone')
   arch('quay-arch',bx,by,3.5,1.3,1.4,.35)
 # Rear/side garden causeways join shore parcels; no rail or navigation claim.
 connections=[((-28,-4,5),(-18,-3,7)),((18,-3,7),(30,-8,5)),((-4,16,7),(1,21,9))]
 if ROUND>=3:
  connections=[]
  for i,(x,y,z,s) in enumerate(sites[:3]):
   direction=Vector((x,y+3,0)).normalized();r=13 if i==0 else 11
   a=Vector((0,-3,7))+direction*20
   b=Vector((x,y,z-.12))-direction*r*.83
   connections.append((tuple(a),tuple(b)))
 for a,b in connections:
  d=Vector(b)-Vector(a);mid=(Vector(a)+Vector(b))/2
  o=box('garden-connector',0,0,-.22,3.8,d.length,.44,'stone');o.location=mid;o.rotation_euler=d.to_track_quat('Y','Z').to_euler()
  for t in [.15,.85]:
   p=Vector(a).lerp(Vector(b),t)
   box('connector-support',p.x,p.y,(p.z-3)/2,1.0,1.0,p.z+3,'stone')

if ROUND>=3:
 for root in roots[:3]:
  layers=[o for o in root.children_recursive if o.name.startswith('bio-dome-layer')]
  for i,o in enumerate(layers):
   # Counteract the wider/shorter tower root so hemispheres keep real volume.
   o.scale.x*=1.6;o.scale.y*=1.6;o.scale.z*=3.0
   o.rotation_euler.z=[0,-1.3,1.1][i%3]
 # Sparse, supported cypress/shrub groups keep tower silhouettes and steps clear.
 rng=random.Random(7711)
 for i,(x,y,z,s) in enumerate(sites[:3]):
  rr=10 if i==0 else 8
  for j in range(9):
   a=.25+j*math.tau/9
   if math.sin(a)<-.7:continue
   xx=x+rr*math.cos(a);yy=y+rr*math.sin(a)
   h=rng.uniform(3.2,5.7)
   ring('cypress-trunk',xx,yy,[(z-.2,.13),(z+h*.5,.1)],6,'trunk')
   ring('cypress-crown',xx,yy,[(z+.5,.25),(z+h*.35,.65),(z+h*.7,.47),(z+h,0.02)],7,'leaf')
  for j in range(16):
   a=j*math.tau/16;xx=x+(rr-1.1)*math.cos(a);yy=y+(rr-1.1)*math.sin(a)
   if abs(xx-x)<3 and yy<y:continue
   ring('garden-shrub',xx,yy,[(z-.15,.7),(z+.6,.8),(z+1.1,.1)],7,'lightleaf',j)
 # Facet colour belongs to the original tower geometry, not a replacement asset.
 gem=[]
 for h in ['2c7199','54a9cc','a4deea','d3f0ef','577da7','8eb9d9']:
  m=bpy.data.materials.new('V7_crystal_'+h);m.use_nodes=True
  p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*srgb(h),1)
  p.inputs['Metallic'].default_value=.18;p.inputs['Roughness'].default_value=.28
  gem.append(m)
 mats['crystal']=gem[0]
 for i,(x,y,z,s) in enumerate(sites[:3]):
  size=1 if i==0 else .55
  for k,(dx,dy,h) in enumerate([(-5,1,22),(4,2,16),(2,-4,12)]):
   o=ring('tower-crystal-buttress',x+dx*size,y+dy*size,[(z,1.4*size),(z+h*size*.75,1.0*size),(z+h*size,.02)],5,'crystal',k)
   o.data.materials.clear()
   for g in gem:o.data.materials.append(g)
   for p in o.data.polygons:p.material_index=p.index%6
 for root in roots[:3]:
  for o in root.children_recursive:
   if o.type!='MESH':continue
   if o.name.startswith('neon-dome-shell'):
    m=bpy.data.materials.new('V7_warm_flower_glass');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*srgb('f1ca85'),1);p.inputs['Metallic'].default_value=.25;p.inputs['Roughness'].default_value=.22
    p.inputs['Emission Color'].default_value=(*srgb('a25b29'),1);p.inputs['Emission Strength'].default_value=.2
    o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(m)
    continue
   for slot in o.material_slots:
    m=slot.material
    if not m or not m.use_nodes:continue
    p=m.node_tree.nodes.get('Principled BSDF')
    if not p:continue
    c=p.inputs['Base Color'].default_value
    if p.inputs['Alpha'].default_value<.95:
     m=m.copy();slot.material=m;p=m.node_tree.nodes.get('Principled BSDF')
     p.inputs['Base Color'].default_value=(*srgb('80c7e2'),1)
     p.inputs['Alpha'].default_value=1
     p.inputs['Metallic'].default_value=.22;p.inputs['Roughness'].default_value=.26
     if 'Emission Color' in p.inputs:p.inputs['Emission Color'].default_value=(.01,.035,.06,1);p.inputs['Emission Strength'].default_value=.25
     if o.dimensions.z>3 and o.dimensions.z>o.dimensions.x*1.1:
      o.data=o.data.copy();o.data.materials.clear()
      for g in gem:o.data.materials.append(g)
      for face in o.data.polygons:
       a=math.atan2(face.normal.y,face.normal.x)
       face.material_index=int((a+math.pi)/math.tau*6)%6
     break

 # Harbour details are confined to front side bays; keep the central mouth open.
 for i,(x,y,z,s) in enumerate(sites[:3]):
  r=13 if i==0 else 11
  if i==0:continue
  for offset in [-4,4]:
   yy=y-r-9
   box('side-berth-deck',x+offset,yy,1.05,2.4,9,.4,'rock2')
   for yy2 in [yy-3.6,yy+3.6]:
    for xx in [x+offset-.9,x+offset+.9]:
     ring('berth-pile',xx,yy2,[(-4,.14),(1.5,.14)],8,'trunk')
  for a in [j*math.tau/14 for j in range(14) if j not in [9,10,11]]:
   xx=x+(r*.88)*math.cos(a);yy=y+(r*.88)*math.sin(a)
   ring('quay-bollard',xx,yy,[(3.65,.12),(4.55,.12)],8,'gold')

# Save an engine asset without staging ocean, lights or camera.
scene.world=bpy.data.worlds.new('V7_day_world');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.40,.57,.72,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'crystal-v7-r{ROUND:02d}.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/f'crystal-v7-r{ROUND:02d}.glb'),export_format='GLB',use_active_scene=True,export_cameras=False,export_lights=False)
for o in created:o.data.calc_loop_triangles()
counts={'round':ROUND,'source':'round-1-source.glb: live game towers and complete swamp','tower_count':3,'source_objects_retained':len(keep),'new_meshes':len(created),'triangles':sum(len(o.data.loop_triangles) for o in created),'scope':'local art candidate; spherical-world navigation and story migration not released','sites':sites}
(ART/f'blender-r{ROUND:02d}.json').write_text(json.dumps(counts,indent=2))
print(json.dumps(counts))
