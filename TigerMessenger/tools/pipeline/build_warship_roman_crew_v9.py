"""Transplant approved Roman-family geometry into the retained v8 rowing rig."""
import bpy,bmesh,json,math,hashlib,importlib.util
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('ship',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
BASE=ROOT/'assets/models/optimized/warship-battle-v8';SOURCE=ROOT/'assets/models/optimized/roman-family-v1/romanSoldier_gladius_blue.blend';OUT=ROOT/'assets/models/optimized/warship-battle-v9';ART=ROOT/'artifacts/pipeline/warship-roman-crew';OUT.mkdir(exist_ok=True);ART.mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
hashes={str(p):sha(p) for p in [BASE/'warship-battle-v8.blend',BASE/'warship-battle-v8.glb',SOURCE]}
bpy.ops.wm.open_mainfile(filepath=str(BASE/'warship-battle-v8.blend'))
obs={s.ident(o):o for o in bpy.context.scene.objects if s.ident(o)};root=obs['n0']
with bpy.data.libraries.load(str(SOURCE),link=False) as (src,dst):dst.objects=list(src.objects)
imports=[o for o in dst.objects if o]
for o in imports:bpy.context.scene.collection.objects.link(o)
roman={o.get('three_node_id',o.get('roman_family_added_id')):o for o in imports if o.get('three_node_id',o.get('roman_family_added_id'))}
body=roman['n2'];bpy.context.view_layer.update()
R=Matrix.Rotation(-math.pi/2,4,'Y')
def source_mesh(keys,name,skirt=False):
 vv=[];ff=[];mi=[];materials=[]
 for key in keys:
  o=roman[key];m=R@s.CI@body.matrix_world.inverted()@o.matrix_world
  points=[m@v.co for v in o.data.vertices]
  # The accepted separate lames are retained; only their lower tips flare
  # around the seated hips, keeping their top seam and all ten gaps intact.
  if skirt and 'Skirt_' in o.name:
   for p in points:
    t=max(0,min(1,(.006-p.y)/.10));p.x*=1+.28*t;p.z*=1+.20*t
  off=len(vv);vv.extend(s.C.to_3x3()@p for p in points)
  remap=[]
  for mat in o.data.materials:
   if mat not in materials:materials.append(mat)
   remap.append(materials.index(mat))
  for poly in o.data.polygons:ff.append(tuple(off+i for i in poly.vertices));mi.append(remap[min(poly.material_index,len(remap)-1)])
 data=bpy.data.meshes.new(name);data.from_pydata(vv,[],ff)
 for mat in materials:data.materials.append(mat)
 for poly,index in zip(data.polygons,mi):poly.material_index=index;poly.use_smooth=False
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free();data.update();return data
armor=lambda prefix:next(k for k in roman if k and k.startswith('add:armor:'+prefix))
mapping={220:['n3'],221:[armor('Skirt_'),armor('Waist_')],222:['n7'],223:[armor('Helmet_')],224:['n11'],225:['n13'],226:['n15']}
report=[]
for n,keys in mapping.items():
 data=source_mesh(keys,'Approved_Roman_'+str(n),n==221)
 for i in range(26):
  o=obs['n'+str(n)+':i'+str(i)];o.data=data;o['romanCrewSource']='romanSoldier_gladius_blue';o['romanCrewComponents']=','.join(keys)
 report.append({'target':'n'+str(n)+':i0..25','sources':keys,'vertices':len(data.vertices),'polygons':len(data.polygons),'materials':len(data.materials),'sharedGeometryCopies':1})
# Borrow the approved short-sleeve cross section while preserving the rowing
# upper-arm segment axis and length; the original hand and forearm rigs remain.
for n in [227,228]:
 data=obs['n'+str(n)+':i0'].data.copy();blue=roman['n3'].data.materials[0];data.materials.append(blue)
 # Existing mesh is -Y shoulder-to-elbow; split sleeve is authored onto upper third.
 bm=bmesh.new();bm.from_mesh(data)
 for y in [0,-.043]:
  pass
 vv=[(r*math.cos(i*math.tau/8),y,r*math.sin(i*math.tau/8)) for y,r in [(.004,.030),(-.044,.028)] for i in range(8)]
 verts=[bm.verts.new(s.C.to_3x3()@Vector(v)) for v in vv]
 for i in range(8):
  f=bm.faces.new([verts[i],verts[(i+1)%8],verts[(i+1)%8+8],verts[i+8]]);f.material_index=len(data.materials)-1
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free();data.update()
 for i in range(26):obs['n'+str(n)+':i'+str(i)].data=data
for o in imports:bpy.data.objects.remove(o,do_unlink=True)
a=json.loads((BASE/'warship-battle-v8.assembly.json').read_text());a['stage']='v9 approved Roman appearance on original rowing rig';a['geometryRevision']['version']=9;a['runtimeIntegrated']=False
a['romanCrew']={'source':str(SOURCE.relative_to(ROOT)),'sha256':hashes[str(SOURCE)],'mapping':report,'forwardMapping':'approved +X transformed to retained rower local +Z','skirtFit':'ten original separated lames, lower tips flared 28% lateral / 20% fore-aft for seated hips; top seam unchanged','poseFramesUnchanged':True,'weaponsCarriedByRowers':False,'rowers':26}
bpy.context.scene.frame_set(1);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'warship-battle-v9.blend'));s.export_warship(list(obs.values()),OUT/'warship-battle-v9.glb');(OUT/'warship-battle-v9.assembly.json').write_text(json.dumps(a,separators=(',',':')))
assert all(sha(Path(p))==value for p,value in hashes.items())
(ART/'build-report.json').write_text(json.dumps({'version':9,'sourceHashes':hashes,'sourceUnchanged':True,'mapping':report,'glbSha256':sha(OUT/'warship-battle-v9.glb'),'status':'geometry produced; visual and contact audit follows'},indent=2))
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(OUT/'warship-battle-v9.glb'));sc=bpy.context.scene;s.v.studio(sc);sc.render.resolution_x=1400;sc.render.resolution_y=1000;sc.render.image_settings.file_format='PNG'
for name,center,direction,scale in [('three-quarter',(.25,0,1.75),(5,-7,4),7.9),('crew-close',(-.8,.20,1.09),(.4,3,1.2),1.25),('crew-front',(-.8,.20,1.10),(0,3,.25),1.20),('crew-top',(-.8,.1,1),(0,.01,4),1.8)]:
 target=Vector(center);sc.camera.location=target+Vector(direction);sc.camera.rotation_euler=(target-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.ortho_scale=scale;sc.render.filepath=str(ART/(name+'.png'));bpy.ops.render.render(write_still=True)
print('WARSHIP_V9_CREATED',flush=True)
