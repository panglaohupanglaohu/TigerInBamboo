"""User-directed v5/v6 bow revisions, retained v4 input, actual GLB reimport renders."""
import bpy,bmesh,json,math,sys,importlib.util
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2]
sp=importlib.util.spec_from_file_location('ship',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(sp);sp.loader.exec_module(s)
V=int(sys.argv[sys.argv.index('--version')+1]);NAME=f'warship-battle-v{V}'
BASE=ROOT/'assets/models/optimized/warship-battle-v4';OUT=ROOT/'assets/models/optimized'/NAME;ART=ROOT/'artifacts/pipeline'/NAME
OUT.mkdir(parents=True,exist_ok=True);ART.mkdir(parents=True,exist_ok=True);s.OUT=OUT;s.ART=ART;s.g.ART=ART
original={str(p.relative_to(ROOT)):s.sha(p) for p in BASE.glob('*') if p.is_file()}
a=json.loads((BASE/'warship-battle-v4.assembly.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(BASE/'warship-battle-v4.blend'))
sc=bpy.context.scene;sc.frame_set(1);obs={s.ident(o):o for o in sc.objects if s.ident(o)};root=obs['n0']
def coords(o):
 m=s.rootmat(o,root);return [m@(s.CI.to_3x3()@v.co) for v in o.data.vertices]
def deform(o,fn):
 o.data=o.data.copy();m=s.rootmat(o,root);inv=m.inverted()
 for v in o.data.vertices:v.co=s.C.to_3x3()@(inv@fn(m@(s.CI.to_3x3()@v.co)))
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.update()
# Prolong the actual wooden bow instead of making only the metal ram longer.
length=1.55 if V==5 else 1.88
shellkeys=['n1','n3','n7','n27','n31','n231','n233','n253']+[k for k in obs if k.startswith('add:deck-plank-')]+['add:bow-landing','add:bow-hinge-lip']
def bow(p):
 q=p.copy()
 if q.x>1.60:
  u=min(1,(q.x-1.60)/.70);q.x=1.60+(q.x-1.60)*length
  q.y+=u*u*(.12 if V==5 else .22)
 return q
for k in shellkeys:deform(obs[k],bow)
if V==6:
 # After v5 review: remove the broad landing lip from the bow silhouette.
 # The original aft side of the transfer deck remains for a later route audit.
 for k in ['add:bow-landing','add:bow-hinge-lip','n231']+[k for k in obs if k.startswith('add:deck-plank-')]:
  def sharpen(p):
   q=p.copy()
   if q.x>1.72:
    cap=max(.028,.46*(1-(q.x-1.72)/1.20));q.z=max(-cap,min(cap,q.z))
   return q
  deform(obs[k],sharpen)
# Eyes belong beside the projecting +X bow; mirror former wrongly placed -X decals.
for k in ['n23','n25','n47','n49']:
 def eye(p):
  q=p.copy();q.x=-q.x;q=bow(q);q.z*=1.05;return q
 deform(obs[k],eye)
if V==6:
 from mathutils.bvhtree import BVHTree
 surface=[];faces=[]
 for k in ['n1','n3','n7','n27','n31']:
  o=obs[k];offset=len(surface);surface.extend(coords(o));faces.extend(tuple(offset+i for i in p.vertices) for p in o.data.polygons)
 tree=BVHTree.FromPolygons(surface,faces)
 for key in ['n23','n25','n47','n49']:
  def conform(p):
   q=p.copy();q.y-=.12;side=1 if q.z>=0 else -1
   hit=tree.ray_cast(Vector((q.x,q.y,side*3)),Vector((0,0,-side)),6)[0]
   if hit is not None:q.z=hit.z+side*(.018 if key in ['n25','n49'] else .010)
   return q
  deform(obs[key],conform)
# Replace the four prongs with one continuous wedge and bronze cheek plates.
bronze=obs['n51'].data.materials[0]
def replace(k,vs,fs):
 o=obs[k];m=s.rootmat(o,root).inverted();me=bpy.data.meshes.new(NAME+' '+k);me.from_pydata([s.C.to_3x3()@(m@Vector(p)) for p in vs],[],fs);me.materials.append(bronze);o.data=me
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();s.v.ensure_uv(o)
x0=2.30;tip=3.42 if V==5 else 3.64
replace('n51',[(x0,-.02,-.14),(x0,.28,-.14),(x0,.28,.14),(x0,-.02,.14),(tip,.20,0),(tip-.12,.31,0)],[(0,3,4),(0,4,5,1),(1,5,2),(2,5,4,3),(0,1,2,3)])
for k in ['n53','n55','n57']:
 # Superseded ornamental prongs are removed from this candidate export.
 o=obs.pop(k);bpy.data.objects.remove(o,do_unlink=True)
# Retain cargo at stern, but lower it to a readable, compact aft stowage group.
for j,k in enumerate(['n273','n275','n277','n279']):
 o=obs[k];pts=coords(o);lo=Vector(tuple(min(v[i] for v in pts) for i in range(3)));hi=Vector(tuple(max(v[i] for v in pts) for i in range(3)));center=(lo+hi)/2
 target=Vector((-2.02+(j//2)*.30,1.108+(hi.y-lo.y)*.42,(-1 if j%2==0 else 1)*.145))
 deform(o,lambda p,c=center,t=target:t+(p-c)*.84)
# Sailing board lies flat under the deck; it is no longer a standing door.
pivot=obs['add:boarding-hinge'];pivot.animation_data_clear();stowY=.37 if V==6 else .52;stowed=Matrix.Translation((1.83,stowY,.23))@Matrix.Rotation(-math.pi/2,4,'Y')
for f in a['poseFrames']:
 t=f['boarding01'];m=stowed if t==0 else Matrix.Translation((1.83,stowY,.23)).lerp(Matrix.Translation((1.94,.664,.48)),t) @ Matrix.Rotation(-math.pi/2*(1-t),4,'Y') @ Matrix.Rotation(.12*t,4,'X')
 s.setm(pivot,m);f['transforms']['add:boarding-hinge']=s.flat(s.local(pivot));f['boardingStowage']='flat below forward deck'
 pivot.keyframe_insert('location',frame=f['frame']);pivot.keyframe_insert('rotation_euler',frame=f['frame']);pivot.keyframe_insert('scale',frame=f['frame'])
for o in obs.values():
 if o.type=='MESH':s.v.ensure_uv(o)
sc.frame_set(1);bpy.context.view_layer.update()
a.update(stage=f'v{V} forward prow and flat boarding stowage candidate',readyForBattle=False,runtimeIntegrated=False,motionClearancePassed=False)
a['axes']='Three +X bow/ram/eyes/forward, -X stern/cargo, +Y up, Z beam'
a['geometryRevision']={'version':V,'bowWoodExtensionFactor':length,'bronzeTipX':tip,'eyesAtBow':True,'cargoAtStern':True,'boardingStowed':'flat below deck; no vertical door','input':'warship-battle-v4','reference':'assets/concepts/warship-target-v1.png'}
a['limitations']=['Candidate not runtime integrated.','Board deployment path changed: collision and 25-person boarding clearance require revalidation.','Original 26 rowers and oar animation retained; hull/eye appearance requires user review.']
a['restTransforms']={k:s.flat(s.local(o)) for k,o in obs.items()};a['boarding']['stowedMatrix']=s.flat(stowed);a['boarding']['geometryRevalidationRequired']=True
for f in a['poseFrames']:
 for k in ['n53','n55','n57']:f['transforms'].pop(k,None)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(NAME+'.blend')));s.export_warship(list(obs.values()),OUT/(NAME+'.glb'));(OUT/(NAME+'.assembly.json')).write_text(json.dumps(a,separators=(',',':')))
assert all(s.sha(ROOT/k)==h for k,h in original.items())
# Render saved GLB, never a substituted mesh; same camera and lighting in both rounds.
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(OUT/(NAME+'.glb')));sc=bpy.context.scene;obs={s.ident(o):o for o in sc.objects if s.ident(o)}
s.v.studio(sc);sc.render.resolution_x=1200;sc.render.resolution_y=900;sc.render.image_settings.file_format='PNG'
center=Vector((.25,0,1.75))
for name,direction,scale in [('three-quarter',(5,-7,4),7.9),('side',(0,-9,1),7.9),('top',(0,-.01,9),7.9)]:
 sc.camera.location=center+Vector(direction);sc.camera.rotation_euler=(center-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.ortho_scale=scale;sc.render.filepath=str(ART/(name+'.png'));bpy.ops.render.render(write_still=True)
(ART/'provenance.json').write_text(json.dumps({'version':V,'inputHashes':original,'glbSHA256':s.sha(OUT/(NAME+'.glb')),'freshGLBImport':True,'axes':a['axes'],'candidateOnly':True},indent=2))
print(NAME+' COMPLETE',flush=True)
