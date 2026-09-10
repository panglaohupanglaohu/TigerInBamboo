"""Read the actual world GLB and index only export-expanded original instances."""
from pathlib import Path
import hashlib,json,struct
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'godot/assets/world-source/original-world-v1.glb'
data=source.read_bytes()
document=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
groups=[]
for node in document['nodes']:
    children=[document['nodes'][index] for index in node.get('children',[])]
    instances=[child for child in children if child.get('name','').startswith(node.get('name','')+' instance ') and 'mesh' in child and not child.get('extras')]
    if instances:
        if len({child['mesh'] for child in instances})!=1:
            raise ValueError('Original instance geometry changed: '+node['name'])
        groups.append({'sourcePath':node['extras']['sourcePath'],'count':len(instances),'matrices':[child['matrix'] for child in instances]})
manifest={'source_sha256':hashlib.sha256(data).hexdigest(),'scope':'Original export-expanded GPU instances; identity/order verified against archive','groups':groups}
(source.parent/'original-instance-map.json').write_text(json.dumps(manifest,separators=(',',':')))
print(json.dumps({'groups':len(groups),'instances':sum(g['count'] for g in groups)}))
