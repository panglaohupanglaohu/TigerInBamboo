"""Read-only fresh GLB import, applying the portable pose without builder logic."""
import bpy,importlib.util,json,math,hashlib
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'assets/models/optimized/kun-battle-v2';ART=Path(__file__).parent
path=OUT/'kun-battle-v2.glb';before=hashlib.sha256(path.read_bytes()).hexdigest();assembly=json.loads((OUT/'kun-battle-v2.assembly.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path));sc=bpy.context.scene
original={o['three_node_id']:o for o in sc.objects if 'three_node_id' in o};added={o['kun_added_id']:o for o in sc.objects if 'kun_added_id' in o}
spec=importlib.util.spec_from_file_location('kun_studio',ROOT/'tools/pipeline/build_kun_battle_blender.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
bpy.context.view_layer.update();module.setup_review(sc,original,original['n0'])
C=Matrix.Rotation(math.pi/2,4,'X');CI=C.inverted()
sc.render.resolution_x=1000;sc.render.resolution_y=900;sc.cycles.samples=16
for name,frame,offset in [('v2-open-front',31,(4,-.02,.45)),('v2-open-front-high',31,(4,-.02,1.6)),('v2-open-three-quarter',31,(3,-4,1.2)),('v2-open-side-below',31,(1.1,-4,-1)),('v2-closed-front',1,(4,-.02,.45)),('v2-half-front',16,(4,-.02,.45)),('v2-engulf-front',61,(4,-.02,.45)),('v2-engulf-side-below',61,(1.1,-4,-1)),('v2-diagnostic-front-fill',31,(4,-.02,.45)),('v2-diagnostic-three-quarter-fill',31,(3,-4,1.2))]:
 if name=='v2-diagnostic-front-fill':
  light=bpy.data.objects.new('Diagnostic mouth fill only',bpy.data.lights.new('Diagnostic mouth fill only','AREA'));sc.collection.objects.link(light);light.location=original['n0'].matrix_world@(C.to_3x3()@Vector((50,-12,3)));aim=original['n0'].matrix_world@(C.to_3x3()@Vector((22,-12,0)));light.rotation_euler=(aim-light.location).to_track_quat('-Z','Y').to_euler();light.data.energy=600;light.data.size=9
 sample=assembly['poseFrames'][frame-1];v=sample['jawLocalMatrix'];m=Matrix([[v[c*4+r] for c in range(4)] for r in range(4)]);added['add:jaw-pivot'].matrix_basis=C@m@CI
 for tag,weights in sample['morphs'].items():
  for key,value in weights.items():added[tag].data.shape_keys.key_blocks[key].value=value
 center=original['n0'].matrix_world@(C.to_3x3()@Vector((33,-12,0)));sc.camera.location=center+Vector(offset).normalized()*100;sc.camera.rotation_euler=(center-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.ortho_scale=18;sc.render.filepath=str(ART/(name+'-glb-roundtrip.png'));bpy.ops.render.render(write_still=True)
assert hashlib.sha256(path.read_bytes()).hexdigest()==before
(ART/'v2-glb-roundtrip-report.json').write_text(json.dumps({'sourceGLBUnchanged':True,'glbSha256':before,'originalNodesImported':len(original),'addedNodesImported':len(added),'posesAppliedFromContract':['open frame31 from v1 assembly'],'rendered':True,'scope':'Actual v2 fresh GLB import; open/closed/half/engulf front, 3q and side below. No world integration claim.'},indent=2))
