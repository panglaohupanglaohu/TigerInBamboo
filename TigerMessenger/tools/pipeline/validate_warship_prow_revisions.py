import bpy,json,sys,math,importlib.util
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sp=importlib.util.spec_from_file_location('ship',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(sp);sp.loader.exec_module(s)
results=[]
for version in [5,6]:
 name=f'warship-battle-v{version}';folder=ROOT/'assets/models/optimized'/name;a=json.loads((folder/(name+'.assembly.json')).read_text())
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(folder/(name+'.glb')));obs={s.ident(o):o for o in bpy.context.scene.objects if s.ident(o)};root=obs['n0'];checks=[]
 def points(o):return [s.rootmat(o,root)@(s.CI.to_3x3()@v.co) for v in o.data.vertices]
 def check(name,value):checks.append({'name':name,'passed':bool(value)})
 check('26 original rower torso nodes retained',sum(k.startswith('n220:i') for k in obs)==26)
 check('26 original oar pivots retained',all('n'+str(63+5*i) in obs for i in range(26)))
 check('bow eyes all ahead of midship',all(v.x>1.6 for k in ['n23','n25','n47','n49'] for v in points(obs[k])))
 check('all cargo remains at stern',all(v.x< -1.4 for k in ['n273','n275','n277','n279'] for v in points(obs[k])))
 hinge=obs['add:boarding-hinge'];board=[v for k,o in obs.items() if k.startswith('add:boarding-plank-') for v in points(o)]
 check('sailing boarding planks lie flat below deck',max(v.y for v in board)-min(v.y for v in board)<.05 and max(v.y for v in board)<.65)
 check('bronze prow points in positive X',max(v.x for v in points(obs['n51']))>3.4)
 check('candidate metadata does not claim runtime clearance',not a['runtimeIntegrated'] and not a['motionClearancePassed'])
 check('301 rowing pose frames preserved',len(a['poseFrames'])==301)
 check('no nonfinite mesh coordinates',all(math.isfinite(c) for o in obs.values() if o.type=='MESH' for v in points(o) for c in v))
 # Original dynamic transforms excluding intentionally revised boarding hinge.
 base=json.loads((ROOT/'assets/models/optimized/warship-battle-v4/warship-battle-v4.assembly.json').read_text())
 check('all original crew and oar poses unchanged',all(all(k=='add:boarding-hinge' or frame['transforms'].get(k)==values for k,values in old['transforms'].items()) for frame,old in zip(a['poseFrames'],base['poseFrames'])))
 results.append({'version':version,'passed':all(c['passed'] for c in checks),'checks':checks,'glbSHA256':s.sha(folder/(name+'.glb'))})
out=ROOT/'artifacts/pipeline/warship-prow-review';out.mkdir(parents=True,exist_ok=True);(out/'validation.json').write_text(json.dumps({'passed':all(r['passed'] for r in results),'versions':results},indent=2));print(json.dumps(results),flush=True)
if not all(r['passed'] for r in results):raise RuntimeError('validation failed')
