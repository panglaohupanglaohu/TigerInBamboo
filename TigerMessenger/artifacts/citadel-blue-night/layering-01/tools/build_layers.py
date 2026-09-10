import bpy,math,json,bmesh
from pathlib import Path
from mathutils import Vector
r=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(r.parent/'shoreline-fix/project/assets/candidate.glb'))
def ancestry(o):
 a=[]
 while o:a.append(o.name);o=o.parent
 return '/'.join(a)
def rise(z):return 0 if z>=12 else 4 if z>=0 else 9 if z>=-12 else 15
changes=[]
for o in list(bpy.data.objects):
 if o.type!='MESH':continue
 anc=ancestry(o)
 if 'citadel-layer-' not in anc and 'highland-central-sacred-tower' not in anc:continue
 o.data=o.data.copy();m=o.matrix_world;inv=m.inverted()
 if 'highland-central-sacred-tower' in anc:
  for v in o.data.vertices:
   w=m@v.co;w.z=4.95+(w.z-4.95)*0.72+9;v.co=inv@w
  continue
 # Rigidly lift each disconnected component, preserving local wall and roof shapes.
 parent=list(range(len(o.data.vertices)))
 def find(a):
  while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
  return a
 for e in o.data.edges:
  a,b=map(find,e.vertices);parent[b]=a
 groups={}
 for v in o.data.vertices:groups.setdefault(find(v.index),[]).append(v)
 moved=0
 for vs in groups.values():
  mid=sum((m@v.co for v in vs),Vector())/len(vs);dy=rise(-mid.y)
  if dy:
   for v in vs:w=m@v.co;w.z+=dy;v.co=inv@w
   moved+=1
 changes.append({'object':o.name,'components':len(groups),'lifted':moved})
bpy.ops.wm.save_as_mainfile(filepath=str(r/'city-tiered.blend'))
bpy.ops.export_scene.gltf(filepath=str(r/'project/assets/candidate.glb'),export_format='GLB')
(r/'layer-report.json').write_text(json.dumps({'method':'Original disconnected architectural components rigidly raised by four depth bands; central tower compressed vertically to 72 percent and raised 9m','bands':[0,4,9,15],'changes':changes,'navigation_validated':False},indent=2))
# Dedicated low roof sightseeing boat, modeled in Blender. X is length, Z is up.
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(n,c,emit=False):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=.65
 if emit:b.inputs['Emission Color'].default_value=(*c,1);b.inputs['Emission Strength'].default_value=3
 return m
wood=mat('boat-dark-walnut',(.07,.035,.025));trim=mat('boat-brass',(.5,.26,.07));roof=mat('boat-blue-tile',(.045,.14,.24));warm=mat('boat-lantern', (1,.42,.09),True)
def mesh(n,v,f,ma):
 me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);o.data.materials.append(ma);return o
def box(n,loc,scale,ma):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=n;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(ma);return o
rings=[(-5,0,.85),(-4,.65,.4),(-2.7,1.05,.2),(2.7,1.05,.2),(4,.65,.4),(5,0,.85)]
v=[]
for x,w,h in rings:v.extend([(x,-w,h),(x,w,h),(x,w*.6,-.45),(x,-w*.6,-.45)])
f=[]
for j in range(len(rings)-1):
 for k in range(4):f.append((4*j+k,4*j+(k+1)%4,4*(j+1)+(k+1)%4,4*(j+1)+k))
f.extend([(0,3,2,1),(20,21,22,23)]);mesh('castle-tour-boat-hull',v,f,wood)
box('deck',(0,0,.35),(7,1.7,.16),trim)
for x in [-2.1,2.1]:
 for y in [-.8,.8]:box('canopy-pillar',(x,y,1.3),(.12,.12,1.9),wood)
for y in [-.7,.7]:box('passenger-bench',(0,y,.72),(3.6,.35,.22),wood)
for i in range(14):
 x=-2.55+i*.39
 mesh('blue-roof-tile',[(x,-1.2,2.1),(x,0,2.65),(x,1.2,2.1),(x+.37,-1.2,2.1),(x+.37,0,2.65),(x+.37,1.2,2.1)],[(0,3,4,1),(1,4,5,2)],roof)
for x in [-2.15,2.15]:
 for y in [-.9,.9]:box('warm-lantern',(x,y,1.8),(.22,.22,.35),warm)
for x in [-4.7,4.7]:
 box('raised-prow',(x,0,1.15),(.18,.2,1.2),wood)
for y in [-1,1]:box('gunwale',(0,y,.58),(6,.1,.13),trim)
# Recalculate exterior normals before engine export.
for o in bpy.data.objects:
 if o.type=='MESH':
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
bpy.ops.wm.save_as_mainfile(filepath=str(r/'castle-tour-boat.blend'))
bpy.ops.export_scene.gltf(filepath=str(r/'project/assets/castle-tour-boat.glb'),export_format='GLB')
