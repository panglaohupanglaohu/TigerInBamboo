"""Save the tested port pose as an isolated original-ship Blender candidate."""
import bpy,json,hashlib,importlib.util
from pathlib import Path
from mathutils import Matrix,Quaternion,Vector
root=Path(__file__).resolve().parents[2]
source=root/'assets/models/optimized/warship-battle-v11/warship-battle-v11.blend'
digest=hashlib.sha256(source.read_bytes()).hexdigest()
survey=json.loads((root/'artifacts/pipeline/citadel-master-terrain/surroundings-r04-boarding-survey.json').read_text())
c=survey['landingCandidate']
assert c['clearance']['clear']
spec=importlib.util.spec_from_file_location('ship_helpers',root/'tools/pipeline/build_warship_battle_blender.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.scene.frame_set(211)
objects={s.ident(o):o for o in bpy.context.scene.objects if s.ident(o)}
assembly=json.loads(source.with_suffix('.assembly.json').read_text())
for key,values in assembly['poseFrames'][210]['transforms'].items():
 if key in objects:s.setm(objects[key],s.mat(values))
hinge=objects['add:boarding-hinge'];hinge.animation_data_clear()
q=c['hingeQuaternion'];rotation=Quaternion((q[3],q[0],q[1],q[2])).to_matrix().to_4x4()
s.setm(hinge,Matrix.Translation(s.local(hinge).translation)@rotation)
faces=[tuple(c['indices'][i:i+3]) for i in range(0,len(c['indices']),3)]
shoe=s.mesh('Citadel quay timber bearing candidate',c['boatLocalVertices'],faces,objects['n0'],objects['n231'].data.materials[0],'add:citadel-quay-bearing-candidate')
shoe['candidate_only']=True
step_report=root/'artifacts/pipeline/citadel-master-terrain/surroundings-r04-step-review.json'
if step_report.exists():
 step_data=json.loads(step_report.read_text())
 assert step_data['clearance']['clear']
 pose=step_data['native'];q=pose['quaternion']
 city_to_boat=Matrix.LocRotScale(Vector(pose['position']),Quaternion((q[3],q[0],q[1],q[2])),Vector(pose['scale'])).inverted()
 verts,faces=s.v.box_geometry(step_data['step']['size'])
 center=Vector(step_data['step']['center'])
 s.mesh('Citadel landing transition board candidate',[city_to_boat@(Vector(v)+center) for v in verts],faces,objects['n0'],objects['n231'].data.materials[0],'add:citadel-landing-step-candidate')
bpy.context.scene['candidate_scope']='Static port bearing only; self-deployment and human boarding not certified. Quay bearing shown in ship-relative coordinates for review; runtime must attach it to quay.'
bpy.context.view_layer.update()
out=root/'assets/models/optimized/citadel-boarding-r04';out.mkdir(exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'citadel-boarding-r04-candidate.blend'))
assert hashlib.sha256(source.read_bytes()).hexdigest()==digest
(out/'candidate.json').write_text(json.dumps({'source':str(source.relative_to(root)),'sourceSHA256':digest,'sourcePreserved':True,'pose':c,'scope':'Isolated Blender review. Not installed as production ship or certified for deployment, actor traversal or Godot.'},indent=2))
print('Saved original-ship boarding candidate; source unchanged')
