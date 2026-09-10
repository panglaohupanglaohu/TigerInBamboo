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

sample=assembly['poseFrames'][30];v=sample['jawLocalMatrix'];m=Matrix([[v[c*4+r] for c in range(4)] for r in range(4)]);added['add:jaw-pivot'].matrix_basis=C@m@CI
for tag,weights in sample['morphs'].items():
 for key,value in weights.items():added[tag].data.shape_keys.key_blocks[key].value=value
bpy.context.view_layer.update();root=original['n0'];inv=root.matrix_world.inverted();direction=(root.matrix_world.to_3x3()@(C.to_3x3()@Vector((-1,0,0)))).normalized();dg=bpy.context.evaluated_depsgraph_get()
rows=[]
for y in [-9+i*-.5 for i in range(23)]:
 origin=root.matrix_world@(C.to_3x3()@Vector((70,y,0)));hit,loc,norm,face,obj,mat=sc.ray_cast(dg,origin,direction,distance=100)
 rows.append({'y':y,'object':obj.name if hit else None,'point':list(CI.to_3x3()@(inv@loc)) if hit else None})
(ART/'probe-rays.json').write_text(json.dumps(rows,indent=2)+'\n')
