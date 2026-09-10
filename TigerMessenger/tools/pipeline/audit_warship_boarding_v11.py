"""Read-only geometry dimensions in original game units, not navigation certification."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Matrix,Vector
P=Path(__file__).resolve().parents[2];O=P/'artifacts/pipeline/warship-boarding-v11';O.mkdir(exist_ok=True)
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
def key(o):return o.get('three_node_id',o.get('three_instance_key',o.get('warship_added_id',o.get('roman_family_added_id',o.name))))
def hidden(o):
 while o:
  if o.get('candidateHidden') or o.get('candidate_hidden_source_geometry') or o.get('three_visible') is False:return True
  o=o.parent
 return False
def bounds(objects,root):
 points=[C.inverted()@root.matrix_world.inverted()@o.matrix_world@v.co for o in objects for v in o.data.vertices]
 if not points:return None
 lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
 return {'min':lo,'max':hi,'size':[hi[i]-lo[i] for i in range(3)]}
report={'units':'Original unscaled model coordinates. +X bow/actor forward; +Y up; +Z transverse. No world scaling assumed.','soldiers':{}}
for role in ['gladius','spear','longbow']:
 path=P/f'assets/models/optimized/roman-family-v1/romanSoldier_{role}_blue.blend';bpy.ops.wm.open_mainfile(filepath=str(path));bpy.context.view_layer.update();obs={key(o):o for o in bpy.context.scene.objects};root=obs['n0'];body=obs['n2'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and not hidden(o) and (o==root or o in root.children_recursive)]
 bodymeshes=[o for o in meshes if o==body or o in body.children_recursive];report['soldiers'][role]={'wholeEquippedPose':bounds(meshes,root),'bodyHelmetSkirt':bounds(bodymeshes,root),'parts':{key(o):bounds([o],root) for o in meshes},'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest()}
path=P/'assets/models/optimized/warship-battle-v11/warship-battle-v11.glb';bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path));bpy.context.view_layer.update();obs={key(o):o for o in bpy.context.scene.objects};root=obs['n0'];report['shipSha256']=hashlib.sha256(path.read_bytes()).hexdigest();report['shipParts']={key(o):bounds([o],root) for o in bpy.context.scene.objects if o.type=='MESH' and not hidden(o)}
report['seats']={k:bounds([o],root) for k,o in obs.items() if k.startswith('n220:i')}
(O/'dimensions.json').write_text(json.dumps(report,indent=2));print('DIMENSIONS',json.dumps({k:{n:v for n,v in d.items() if n!='parts'} for k,d in report['soldiers'].items()}))
