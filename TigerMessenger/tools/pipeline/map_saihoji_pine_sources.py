"""Match every original world pine to its seed by geometry, never by list order."""
from pathlib import Path
import struct,json,hashlib
ROOT=Path(__file__).resolve().parents[2]
raw=(ROOT/'godot/assets/world-source/original-world-v1.glb').read_bytes()
length=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+length]);binary=28+length
sources=[]
for path in (ROOT/'assets/models/originals/saihoji-pines-r1').glob('*.source.json'):
    source=json.loads(path.read_text())
    sources.append(source)
def positions(node):
    primitive=doc['meshes'][node['mesh']]['primitives'][0]
    accessor=doc['accessors'][primitive['attributes']['POSITION']]
    view=doc['bufferViews'][accessor['bufferView']]
    assert accessor['componentType']==5126 and accessor['type']=='VEC3' and view.get('byteStride',12)==12
    offset=binary+view.get('byteOffset',0)+accessor.get('byteOffset',0)
    return struct.unpack_from('<%sf'%(accessor['count']*3),raw,offset)
def error(a,b):
    return max(abs(x-y) for x,y in zip(a,b)) if len(a)==len(b) else float('inf')
rows=[]
for node in doc['nodes']:
    path=node.get('extras',{}).get('sourcePath','')
    if 'SaihojiSixScenes' not in path or node.get('name')!='giantTreeGroup':continue
    meshes=[doc['nodes'][i] for i in node['children'] if 'mesh' in doc['nodes'][i]]
    world_positions=[positions(mesh) for mesh in meshes]
    assert len(meshes)==5
    matches=[]
    for source in sources:
        wood=source['geometries']['g0']['attributes']['position']['values']
        if error(world_positions[0],wood)>1e-6:continue
        errors=[error(world_positions[i],source['geometries'][f'g{i}']['attributes']['position']['values']) for i in range(5)]
        if max(errors)<=1e-6:matches.append((source,errors))
    assert len(matches)==1,(path,len(matches))
    source,errors=matches[0]
    rows.append({'sourcePath':path,'seed':source['provenance']['seed'],'zone':source['provenance']['placement']['zone'],'originalRootMatrix':node['matrix'],'mesh_position_errors':errors,'matching_meshes':5})
assert len(rows)==25 and len({row['seed'] for row in rows})==25
report={'world_sha256':hashlib.sha256(raw).hexdigest(),'scope':'Each of all five visible meshes matched to one unique seed; tolerance 1e-6, no assumed ordering','max_position_error':max(max(row['mesh_position_errors']) for row in rows),'rows':rows}
out=ROOT/'artifacts/pipeline/saihoji-pine-source-mapping.json'
out.write_text(json.dumps(report,indent=2))
print(json.dumps({'matched':len(rows),'max_position_error':report['max_position_error'],'output':str(out)}))
