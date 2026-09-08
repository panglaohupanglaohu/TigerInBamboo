import bpy,json,hashlib
from pathlib import Path
base=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger');e=base/'artifacts/pipeline/moebius-tiger-anatomy-v3'
before={'filepath':bpy.data.filepath,'dirty':bpy.data.is_dirty,'sceneNames':[s.name for s in bpy.data.scenes]}
paths=['assets/models/originals/blender-r3/moebiusTiger.blend','assets/models/optimized/moebiusTiger.blend'];records=[]
for path in paths:
 with bpy.data.libraries.load(str(base/path),link=False)as(src,dst):dst.scenes=src.scenes
 found=[s for s in dst.scenes if any(o.get('three_node_id')=='n0' and 'tiger' in o.name.lower() for o in s.objects)]
 assert len(found)==1
 s=found[0];s.name='Tiger Anatomy Original Reference' if 'originals' in path else 'Tiger Anatomy V3'
 records.append({'path':path,'sha256':hashlib.sha256((base/path).read_bytes()).hexdigest(),'scene':s.name,'objects':len(s.objects),'nodes':[{'id':o.get('three_node_id'),'name':o.name,'type':o.type,'parent':o.parent.get('three_node_id')if o.parent else None,'localMatrix':[list(row)for row in o.matrix_local],'customKeys':list(o.keys())}for o in s.objects if o.get('three_node_id')in ['n0','n1','n2','n8','n9','n27','n52','n53']]})
bpy.context.window.scene=bpy.data.scenes['Tiger Anatomy V3']
(e/'source-read.json').write_text(json.dumps({'before':before,'sources':records},indent=2));print(json.dumps(records))
