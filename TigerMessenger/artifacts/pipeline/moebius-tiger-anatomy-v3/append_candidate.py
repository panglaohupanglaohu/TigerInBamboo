import bpy,json,hashlib
from pathlib import Path
base=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger');e=base/'artifacts/pipeline/moebius-tiger-anatomy-v3'
with bpy.data.libraries.load(str(e/'optimized-source-snapshot.blend'),link=False) as(src,dst):dst.scenes=src.scenes
s=dst.scenes[0];s.name='Tiger Anatomy V3';bpy.context.window.scene=s
r={'scene':s.name,'currentUserFile':bpy.data.filepath,'userFileDirty':bpy.data.is_dirty,'sources':{p:hashlib.sha256((base/p).read_bytes()).hexdigest()for p in ['assets/models/originals/blender-r3/moebiusTiger.blend','assets/models/optimized/moebiusTiger.blend']},'nodes':[{'id':o.get('three_node_id'),'name':o.name,'parent':o.parent.get('three_node_id')if o.parent else None,'matrix':[list(row)for row in o.matrix_local],'parentInverse':[list(row)for row in o.matrix_parent_inverse]}for o in s.objects if o.get('three_node_id')in ['n0','n1','n2','n8','n9','n52','n53']]}
(e/'source-read.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
