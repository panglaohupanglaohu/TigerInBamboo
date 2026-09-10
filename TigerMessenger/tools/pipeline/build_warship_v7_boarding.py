"""Bounded real Blender v7 candidate; source v6 is immutable."""
import bpy,json,hashlib,shutil
from pathlib import Path
P=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
S=P/'assets/models/optimized/warship-battle-v6';O=P/'assets/models/optimized/warship-battle-v7';O.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(S/'warship-battle-v6.glb'))
removed=[]
for ob in list(bpy.data.objects):
    key=ob.get('warship_added_id','')
    if key.startswith('add:boarding-post-') or key.startswith('add:boarding-rope-'):
        removed.append(key);bpy.data.objects.remove(ob,do_unlink=True)
d=json.loads((S/'warship-battle-v6.assembly.json').read_text())
d['addedNodes']=[n for n in d['addedNodes'] if n['id'] not in removed]
for transforms in [d['restTransforms']]+[f['transforms'] for f in d['poseFrames']]:
    for k in removed:transforms.pop(k,None)
d['geometryRevision']='v7: six unsupported high rail components removed; original plank-and-beam boarding board retained'
d['boarding']['removedHighRails']=removed
d['boarding']['requiredStopped']=True
d['boarding']['geometryRevalidationRequired']=True
d['readyForBattle']=False
d['runtimeIntegrated']=False
d['limitations'].append('V7 removes confirmed high rail/rope collisions with rower 25; old board rotation sweep still requires geometry correction. Do not deploy in production.')
assert len(removed)==6
assert all(float(f['sourceSpeed'])==0 for f in d['poseFrames'][180:212])
bpy.ops.wm.save_as_mainfile(filepath=str(O/'warship-battle-v7.blend'))
bpy.ops.export_scene.gltf(filepath=str(O/'warship-battle-v7.glb'),export_format='GLB',export_extras=True,export_animations=False,export_yup=True)
(O/'warship-battle-v7.assembly.json').write_text(json.dumps(d,separators=(',',':')))
(O/'provenance.json').write_text(json.dumps({'source_sha256':hashlib.sha256((S/'warship-battle-v6.glb').read_bytes()).hexdigest(),'candidate_sha256':hashlib.sha256((O/'warship-battle-v7.glb').read_bytes()).hexdigest(),'removed':removed,'unchanged':'26 rowers,52 grips,all retained pose transforms, original hull/bow/cargo','runtime_integrated':False},indent=2))
shutil.copy2(__file__,O/'build.py')
print('V7_EXPORTED',removed)
