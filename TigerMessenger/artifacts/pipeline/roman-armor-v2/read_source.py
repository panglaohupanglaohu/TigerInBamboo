import bpy,json
from pathlib import Path
source='/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/assets/models/originals/supplemental/blender-r3/romanSoldier_gladius_blue.blend'
with bpy.data.libraries.load(source,link=False) as (src,dst): dst.scenes=src.scenes
s=dst.scenes[0];s.name='Roman Armor Original Reference'
bounds=[]
for o in s.objects:
 if o.get('three_node_id') in ['n2','n5','n7','n9','n11','n13','n15']:
  bounds.append({'id':o.get('three_node_id'),'name':o.name,'parent':o.parent.get('three_node_id') if o.parent else None,'localMatrix':[list(row) for row in o.matrix_local],'meshBounds':[[min(v.co[k] for v in o.data.vertices),max(v.co[k] for v in o.data.vertices)]for k in range(3)]if o.type=='MESH' else None})
r={'source':source,'scene':s.name,'boundsBlenderZUp':bounds,'currentFile':bpy.data.filepath,'dirty':bpy.data.is_dirty}
Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/roman-armor-v2/source-blender-read.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
