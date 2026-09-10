import bpy,json,math,hashlib,importlib.util,struct
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('ship',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
OUT=ROOT/'assets/models/optimized/warship-battle-v9';ART=ROOT/'artifacts/pipeline/warship-roman-crew'
a=json.loads((OUT/'warship-battle-v9.assembly.json').read_text());b=json.loads((ROOT/'assets/models/optimized/warship-battle-v8/warship-battle-v8.assembly.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(OUT/'warship-battle-v9.blend'));sc=bpy.context.scene;obs={s.ident(o):o for o in sc.objects if s.ident(o)};root=obs['n0'];mx=0;count=0;directions=[];checks=[]
def check(n,v):checks.append({'name':n,'passed':bool(v)})
for frame in a['poseFrames']:
 sc.frame_set(frame['frame']);bpy.context.view_layer.update();inv=root.matrix_world.inverted()
 for grip in a['grips']:
  hand=inv@obs[grip['hand']].matrix_world.translation;target=inv@obs[grip['oar']].matrix_world@(s.C.to_3x3()@Vector(grip['point']));mx=max(mx,(hand-target).length);count+=1
check('All 301 original v8 pose frames and 52 grasp anchors retained',a['poseFrames']==b['poseFrames'] and a['grips']==b['grips'])
check('15,652 evaluated saved Blender hand/oar contacts within 0.01 mm',count==301*52 and mx<1e-5)
check('26 actual transplanted faces torsos helmets and separated skirts',all(obs['n'+str(n)+':i'+str(i)].get('romanCrewSource')=='romanSoldier_gladius_blue' for n in range(220,227) for i in range(26)))
check('One shared mesh datablock per new body component',all(len({obs['n'+str(n)+':i'+str(i)].data.as_pointer() for i in range(26)})==1 for n in range(220,229)))
check('Face retains sculpted profile geometry',len(obs['n222:i0'].data.vertices)!=len(obs['n220:i0'].data.vertices))
raw=(OUT/'warship-battle-v9.glb').read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);nodes={n.get('extras',{}).get('three_instance_key'):n for n in doc['nodes']}
check('Skirt and waist belt preserve donor shared material',len(doc['meshes'][nodes['n221:i0']['mesh']]['primitives'])==a['romanCrew']['mapping'][1]['materials'])
check('All 26 torso GLB instances share one mesh index',len({nodes['n220:i'+str(i)]['mesh'] for i in range(26)})==1)
check('Crest recolor node prefixes retained',all('n'+str(n)+':i'+str(i) in nodes for n in [224,225,226] for i in range(26)))
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(OUT/'warship-battle-v9.glb'));imp={s.ident(o):o for o in bpy.context.scene.objects if s.ident(o)}
check('Fresh GLB import contains all original 26 rower bodies',all('n220:i'+str(i) in imp for i in range(26)))
report={'passed':all(c['passed'] for c in checks),'checks':checks,'savedBlenderContactCount':count,'maxHandOarError':mx,'glbSha256':hashlib.sha256(raw).hexdigest(),'limitations':['Hands and rowing forearm/leg rig remain the validated v8 rowing rig, not combat weapon pose.','Seated skirt tips flare from accepted separate-lame mesh; complete body collision certification is not claimed.','This asset audit does not certify sailing terrain, docking or 25 landing soldier spawning.']}
(ART/'audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
if not report['passed']:raise RuntimeError('v9 crew audit failed')
