"""Widen the original hull, translating intact rowing rigs to open two lanes."""
import bpy,bmesh,json,math,re,hashlib,importlib.util
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2];sp=importlib.util.spec_from_file_location('s',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(sp);sp.loader.exec_module(s)
BASE=ROOT/'assets/models/optimized/warship-battle-v9';OUT=ROOT/'assets/models/optimized/warship-battle-v10';ART=ROOT/'artifacts/pipeline/warship-roman-crew';OUT.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(BASE/'warship-battle-v9.blend'));sc=bpy.context.scene;obs={s.ident(o):o for o in sc.objects if s.ident(o)};root=obs['n0'];a=json.loads((BASE/'warship-battle-v9.assembly.json').read_text());originalsha=hashlib.sha256((BASE/'warship-battle-v9.blend').read_bytes()).hexdigest();W=1.75;OFFSET=.35
def row(key):
 m=re.match(r'n22[0-9]:i(\d+)$|n230:i(\d+)$',key)
 if m:return int(next(v for v in m.groups() if v is not None))
 m=re.match(r'add:(?:hand|forearm)-(\d+)[LR]$|add:seat-leaf-(\d+)$|add:bench-(\d+)$|add:oarlock-(?:shoe|pin)-(\d+)',key)
 if m:return int(next(v for v in m.groups() if v is not None))
 if key.startswith('n') and key[1:].isdigit():
  n=int(key[1:])
  if 193<=n<=218:return n-193
  if 63<=n<=188 and (n-63)%5==0:return (n-63)//5
 return None
def shifted(key,m):
 i=row(key)
 if i is not None:m.translation.z+=(-1 if i<13 else 1)*OFFSET
 elif key=='add:boarding-hinge':m.translation.z*=W
 return m
def oar_descendant(o):
 p=o
 while p is not None:
  k=s.ident(p)
  if k and k.startswith('n') and k[1:].isdigit() and 63<=int(k[1:])<=188 and (int(k[1:])-63)%5==0:return True
  p=p.parent
 return False
def cargo_descendant(o):
 p=o
 while p is not None:
  if s.ident(p) in ['n273','n275','n277','n279']:return True
  p=p.parent
 return False
def board_descendant(o):
 p=o
 while p is not None:
  if s.ident(p)=='add:boarding-hinge':return True
  p=p.parent
 return False
sc.frame_set(1);bpy.context.view_layer.update();staticWidened=[]
for key,o in obs.items():
 if o.type!='MESH' or row(key) is not None or oar_descendant(o) or board_descendant(o) or cargo_descendant(o) or key.startswith('add:stored-') or key.startswith('add:oar-') or key=='n325':continue
 # Ship construction widens across Z. Faces, limbs, equipment, sails'
 # rope articulation and the actual boarding plank are excluded.
 o.data=o.data.copy();m=s.rootmat(o,root);inv=m.inverted();post=key.startswith('n') and key[1:].isdigit() and (235<=int(key[1:])<=252 or 255<=int(key[1:])<=272);zs=[(m@(s.CI.to_3x3()@v.co)).z for v in o.data.vertices];centerZ=(min(zs)+max(zs))/2
 for v in o.data.vertices:
  p=m@(s.CI.to_3x3()@v.co);p.z=(p.z-centerZ)+centerZ*W if post else p.z*W;v.co=s.C.to_3x3()@(inv@p)
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.update();staticWidened.append(key)
# Cargo sits aft of the last rowing station, on an actual small stern deck.
for j,key in enumerate(['n273','n275','n277','n279']):
 o=obs[key];m=s.rootmat(o,root);vs=[m@(s.CI.to_3x3()@v.co) for v in o.data.vertices];center=Vector(tuple((min(v[k] for v in vs)+max(v[k] for v in vs))/2 for k in range(3)));target=Vector((-2.42 if j<2 else -2.10,.855+(max(v.y for v in vs)-min(v.y for v in vs))/2,-.14 if j%2==0 else .14));m.translation+=target-center;s.setroot(o,m,root)
# Lower and move the inherited stern cabin and roof behind the final seat.
for key in ['n281','n282','n283','n284']:
 o=obs[key];m=s.rootmat(o,root);inv=m.inverted();points=[m@(s.CI.to_3x3()@v.co) for v in o.data.vertices];lo=Vector(tuple(min(v[k] for v in points) for k in range(3)));hi=Vector(tuple(max(v[k] for v in points) for k in range(3)));roof=int(key[1:])>=283;targetLo=Vector((-2.60,.815,-.34)) if roof else Vector((-2.59,.67,-.32));targetHi=Vector((-1.86,.855,.34)) if roof else Vector((-1.87,.815,.32))
 for vertex,point in zip(o.data.vertices,points):
  p=Vector(tuple(targetLo[k]+(point[k]-lo[k])/(hi[k]-lo[k])*(targetHi[k]-targetLo[k]) for k in range(3)));vertex.co=s.C.to_3x3()@(inv@p)
 o.data.update()
a['aftCargoLayout']={'rearStationX':-1.8,'boxCentersX':[-2.42,-2.10],'boxCentersZ':[-.14,.14],'bottomY':.855,'support':'original n281/n283 lowered stern cargo platform','oldOverlapRemoved':True}
# Shift static supports once. Animated nodes below use portable frame matrices.
dynamic=set(a['poseFrames'][0]['transforms'])
for key,o in obs.items():
 if key not in dynamic and row(key) is not None:s.setm(o,shifted(key,s.local(o)))
for record in a['poseFrames']:
 sc.frame_set(record['frame'])
 for key,value in record['transforms'].items():
  o=obs[key];m=shifted(key,s.mat(value));s.setm(o,m);record['transforms'][key]=s.flat(m)
  for field in ['location','rotation_euler','scale']:o.keyframe_insert(field,frame=record['frame'])
 record['seatedLateralPosition']=record.get('seatedLateralPosition',.16)+OFFSET
for grip in a['grips']:
 for field in ['target','shoulder','elbow']:
  if field in grip:grip[field][2]+=(-1 if grip['rower']<13 else 1)*OFFSET
a['boarding']['rootPoint'][2]*=W;a['boarding']['stowedMatrix'][14]*=W;a['boarding']['rowerSeatZDuringRowing']+=OFFSET;a['boarding']['rowerSeatZWhileBoarding']+=OFFSET
a['geometryRevision']['version']=10;a['stage']='v10 widened original hull and intact Roman rowing rigs';a['wideDeck']={'sourceVersion':9,'hullWidthFactor':W,'intactCrewAndOarsOutwardOffset':OFFSET,'bodyScaleChanged':False,'staticGeometryNodes':staticWidened,'centralWeaponWidth':.228,'laneClearanceStatus':'pending all-frame measured audit','same25LandingOwners':True}
sc.frame_set(1);bpy.context.view_layer.update();a['restTransforms']={key:s.flat(s.local(o)) for key,o in obs.items()}
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'warship-battle-v10.blend'));s.export_warship(list(obs.values()),OUT/'warship-battle-v10.glb');(OUT/'warship-battle-v10.assembly.json').write_text(json.dumps(a,separators=(',',':')));assert hashlib.sha256((BASE/'warship-battle-v9.blend').read_bytes()).hexdigest()==originalsha
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(OUT/'warship-battle-v10.glb'));sc=bpy.context.scene;s.v.studio(sc);sc.render.resolution_x=1500;sc.render.resolution_y=1100
for name,center,direction,scale in [('v10-three-quarter',(.25,0,1.75),(5,-7,4),7.9),('v10-crew-close',(-.8,.45,1.09),(.4,3,1.2),1.6),('v10-deck-top',(-.10,0,.80),(0,-.01,4),4.8)]:
 target=Vector(center);sc.camera.location=target+Vector(direction);sc.camera.rotation_euler=(target-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.ortho_scale=scale;sc.render.filepath=str(ART/(name+'.png'));bpy.ops.render.render(write_still=True)
print('WARSHIP_V10_READY',hashlib.sha256((OUT/'warship-battle-v10.glb').read_bytes()).hexdigest(),flush=True)
