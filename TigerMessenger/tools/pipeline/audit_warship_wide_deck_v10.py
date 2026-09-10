import bpy,json,math,hashlib,importlib.util,re
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];sp=importlib.util.spec_from_file_location('s',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(sp);sp.loader.exec_module(s)
OUT=ROOT/'assets/models/optimized/warship-battle-v10';ART=ROOT/'artifacts/pipeline/warship-roman-crew';a=json.loads((OUT/'warship-battle-v10.assembly.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(OUT/'warship-battle-v10.blend'));sc=bpy.context.scene;obs={s.ident(o):o for o in sc.objects if s.ident(o)};root=obs['n0'];mx=0;count=0;lanes=[999,999];worst=[]
crew=[]
for k,o in obs.items():
 if o.type=='MESH' and (':i' in k or re.match(r'add:(?:hand|forearm)-[0-9]+[LR]$',k)):
  i=int(k.split(':i')[1]) if ':i' in k else int(re.search(r'-(\d+)[LR]$',k).group(1));crew.append((k,o,i,[s.CI.to_3x3()@v.co for v in o.data.vertices]))
weaponExtent=0
for k,o in obs.items():
 if k.startswith('add:stored-') and o.type=='MESH':
  m=s.rootmat(o,root);weaponExtent=max(weaponExtent,max(abs((m@(s.CI.to_3x3()@v.co)).z) for v in o.data.vertices))
for frame in a['poseFrames']:
 sc.frame_set(frame['frame']);bpy.context.view_layer.update();inv=root.matrix_world.inverted()
 for grip in a['grips']:
  hand=inv@obs[grip['hand']].matrix_world.translation;target=inv@obs[grip['oar']].matrix_world@(s.C.to_3x3()@Vector(grip['point']));mx=max(mx,(hand-target).length);count+=1
 for key,o,i,points in crew:
  m=s.rootmat(o,root);side=0 if i<13 else 1;distance=min(((-1 if side==0 else 1)*(m@p).z) for p in points);lane=distance-weaponExtent
  if lane<lanes[side]:lanes[side]=lane;worst.append({'frame':frame['frame'],'part':key,'side':side,'lane':lane})
r={'passed':mx<1e-5 and min(lanes)>=.28,'maxHandOarError':mx,'gripChecks':count,'frames':301,'centralStoredWeaponWidth':weaponExtent*2,'leftLaneMinimum':lanes[0],'rightLaneMinimum':lanes[1],'worstCases':worst,'glbSha256':hashlib.sha256((OUT/'warship-battle-v10.glb').read_bytes()).hexdigest(),'scope':'All original 301 animation samples; conservative X-independent crew-to-centre-weapon clear width, including helmets/skirts/legs; not a swept-volume walking route around mast or boarding ramp.'};(ART/'v10-layout-audit.json').write_text(json.dumps(r,indent=2));print(json.dumps(r),flush=True)
