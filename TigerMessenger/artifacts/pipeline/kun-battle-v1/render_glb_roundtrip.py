"""Read-only fresh GLB import, applying the portable pose without builder logic."""
import bpy,importlib.util,json,math,hashlib
from pathlib import Path
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'assets/models/optimized/kun-battle-v1';ART=Path(__file__).parent
path=OUT/'kun-battle-v1.glb';before=hashlib.sha256(path.read_bytes()).hexdigest();assembly=json.loads((OUT/'kun-battle-v1.assembly.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path));sc=bpy.context.scene
original={o['three_node_id']:o for o in sc.objects if 'three_node_id' in o};added={o['kun_added_id']:o for o in sc.objects if 'kun_added_id' in o}
spec=importlib.util.spec_from_file_location('kun_studio',ROOT/'tools/pipeline/build_kun_battle_blender.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
bpy.context.view_layer.update();module.setup_review(sc,original,original['n0'])
C=Matrix.Rotation(math.pi/2,4,'X');CI=C.inverted()
for name,frame in [('closed',1),('open',31)]:
 sample=assembly['poseFrames'][frame-1];v=sample['jawLocalMatrix'];m=Matrix([[v[c*4+r] for c in range(4)] for r in range(4)]);added['add:jaw-pivot'].matrix_basis=C@m@CI
 for tag,weights in sample['morphs'].items():
  for key,value in weights.items():added[tag].data.shape_keys.key_blocks[key].value=value
 sc.render.filepath=str(ART/(name+'-glb-roundtrip.png'));bpy.ops.render.render(write_still=True)
assert hashlib.sha256(path.read_bytes()).hexdigest()==before
(ART/'glb-roundtrip-report.json').write_text(json.dumps({'sourceGLBUnchanged':True,'glbSha256':before,'originalNodesImported':len(original),'addedNodesImported':len(added),'posesAppliedFromContract':['closed','open'],'rendered':True,'scope':'Actual fresh GLB import rendered in background Blender; no game integration claim.'},indent=2))
