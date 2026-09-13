"""Widen original planks and handrails, keeping inner beams on their bearing."""
import bpy,json,hashlib,importlib.util
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=root/'assets/models/optimized/citadel-boarding-r04'
source=out/'citadel-boarding-r04-candidate.blend';before=hashlib.sha256(source.read_bytes()).hexdigest()
spec=importlib.util.spec_from_file_location('ship_helpers',root/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
bpy.ops.wm.open_mainfile(filepath=str(source));changes=[]
for obj in bpy.context.scene.objects:
 key=s.ident(obj)
 if not key:continue
 matrix=s.local(obj);old=s.flat(matrix);replacement=None
 if key.startswith('add:boarding-plank-'):
  for row in range(3):matrix[row][0]*=1.35
 elif key.startswith(('add:boarding-post-','add:boarding-rope-')):
  matrix.translation.x=.25 if matrix.translation.x>0 else -.25
 elif key in ['add:boarding-left-lash','add:boarding-right-lash']:
  matrix.translation.x=.27 if matrix.translation.x>0 else -.27
 elif key.startswith('add:boarding-beam-'):
  # Keep the shore end fixed; relieve the first 11 cm at the hinge so the
  # below-deck reinforcement does not sweep through the original gunwale.
  for row in range(3):matrix[row][2]*=(1.35-.11)/1.35
  matrix.translation.z+=.055
 elif key=='n271':
  matrix.translation.x-=.075
 elif key=='n253':
  # Keep the original stern endpoint, open the existing bow-side gate to
  # the widened board's inner edge, with a small timber end clearance.
  xs=[(matrix@(s.CI.to_3x3()@v.co)).x for v in obj.data.vertices]
  left,right=min(xs),max(xs);end=1.61
  assert left<end<right
  factor=(end-left)/(right-left)
  for col in range(4):matrix[0][col]*=factor
  matrix.translation.x+=left*(1-factor)
 elif key=='add:bow-hinge-lip':
  # A solid flat transfer timber, retaining the original node and material.
  size=[.60,.04,.20];vertices,faces=s.v.box_geometry(size)
  mesh=bpy.data.meshes.new('Boarding_transfer_solid_candidate')
  mesh.from_pydata([s.C.to_3x3()@s.Vector(p) for p in vertices],[],faces)
  for material in obj.data.materials:mesh.materials.append(material)
  mesh.update();obj.data=mesh
  matrix=s.Matrix.Translation((1.94,.664,.70));replacement={'boxSize':size}
 else:continue
 obj.animation_data_clear();s.setm(obj,matrix)
 entry={'id':key,'before':old,'matrix':s.flat(matrix)}
 if replacement:entry['geometry']=replacement
 changes.append(entry)
assert sum(c['id'].startswith('add:boarding-plank-') for c in changes)==9
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'citadel-boarding-r04-wide.blend'))
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
report={'source':str(source.relative_to(root)),'sourceSHA256':before,'sourcePreserved':True,'plankWidthLocal':.54,'railInnerWidthWorld':(.5-.028)*1.84,'beamSupport':'Original inner beam positions retained on measured shore shoe','changes':changes,'scope':'Blender-derived candidate transforms; dynamic sweep and full actor boarding not yet certified'}
(out/'wide-transforms.json').write_text(json.dumps(report,indent=2));print('Saved wide boarding candidate',len(changes),report['railInnerWidthWorld'])
