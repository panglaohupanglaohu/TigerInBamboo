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

from mathutils.bvhtree import BVHTree

def geometry(o):
 e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();vs=[e.matrix_world@v.co for v in m.vertices];fs=[tuple(p.vertices)for p in m.polygons];e.to_mesh_clear();return vs,fs

def tree(o):
 v,f=geometry(o);return BVHTree.FromPolygons(v,f,all_triangles=False,epsilon=1e-7)
rows=[]
for frame in range(1,122):
 sample=assembly['poseFrames'][frame-1];v=sample['jawLocalMatrix'];m=Matrix([[v[c*4+r] for c in range(4)] for r in range(4)]);added['add:jaw-pivot'].matrix_basis=C@m@CI
 for tag,weights in sample['morphs'].items():
  for key,value in weights.items():added[tag].data.shape_keys.key_blocks[key].value=value
 bpy.context.view_layer.update();pairs=[]
 for inside,outside in [('add:mouth-roof','n1'),('add:mouth-floor','add:jaw-shell'),('add:inner-throat','n1'),('add:inner-throat','add:jaw-shell')]:
  a=added[inside];b=original[outside] if outside.startswith('n') else added[outside];hits=tree(a).overlap(tree(b));pairs.append({'inside':inside,'outside':outside,'triangleIntersectionPairs':len(hits),'insideFaceCentersThree':[list(CI.to_3x3()@(original['n0'].matrix_world.inverted()@(sum((geometry(a)[0][v]for v in geometry(a)[1][face]),Vector())/len(geometry(a)[1][face]))))for face in sorted(set(x[0]for x in hits))]})
 rows.append({'frame':frame,'gape':sample['jawOpen01'],'inflation':sample['throatInflation'],'pairs':pairs})
(ART/'v2-pose-surface-audit.json').write_text(json.dumps({'sourceGLBSha256':before,'poses':rows,'note':'Surface triangle intersections; shared intended boundary contacts require separate interpretation. Not all world collision pairs.'},indent=2)+'\n');print(json.dumps(rows),flush=True)
