"""Export verified Blender topology using the original Three corner attributes.
Position and UV must match the original exactly (within coordinate conversion
roundoff); retain original floats to keep the brush shader's hash unchanged.
"""
import bpy,json,math,hashlib,struct
from pathlib import Path
from mathutils import Matrix,Vector
root=Path(__file__).resolve().parents[2]
folder=root/'assets/models';source=folder/'originals/moebiusTiger.source.json';data=json.loads(source.read_text())
bpy.ops.wm.open_mainfile(filepath=str(folder/'optimized/moebiusTiger.blend'))
objects={o['three_node_id']:o for o in bpy.data.objects if 'three_node_id' in o}
C=Matrix.Rotation(math.pi/2,4,'X').inverted()
result={'version':1,'source':'original-moebiusTiger-blender-cleanup','geometries':{},'nodes':[]}
def fingerprint(values):
    h=2166136261
    for v in values:
        for b in struct.pack("<f",v):h=((h^b)*16777619)&0xffffffff
    return h
before=after=before_bytes=after_bytes=0
for n in data['nodes']:
    result['nodes'].append({'name':n['name'],'type':n['type'],'geometry':n.get('geometry')})
    key=n.get('geometry')
    if key is None or key in result['geometries']:continue
    original=data['geometries'][key];mesh=objects[n['id']].data
    indices=original['index'] if original['index'] is not None else list(range(len(original['attributes']['position']['values'])//3))
    assert len(mesh.loops)==len(indices)
    attrs=original['attributes'];unique={};new_indices=[];values={name:[] for name in attrs};vertex_sources=[]
    for corner,loop in enumerate(mesh.loops):
        old_index=indices[corner]
        expected=Vector(attrs['position']['values'][old_index*3:old_index*3+3]);actual=C.to_3x3()@mesh.vertices[loop.vertex_index].co
        assert (actual-expected).length<1e-6,'Blender shape changed; requires separate visual review'
        if 'uv' in attrs:
            uv=attrs['uv']['values'][old_index*2:old_index*2+2]
            assert max(abs(mesh.uv_layers[0].data[corner].uv[k]-uv[k]) for k in range(2))<1e-7
        components=[]
        for name,a in attrs.items():
            size=a['itemSize'];components.extend(a['values'][old_index*size:(old_index+1)*size])
        # A welded Blender vertex may still need several GPU vertices at UV or
        # normal seams. Use the Blender vertex and all original corner data.
        signature=(loop.vertex_index,*components)
        if signature not in unique:
            unique[signature]=len(unique)
            vertex_sources.append(old_index)
            for name,a in attrs.items():
                size=a['itemSize'];values[name].extend(a['values'][old_index*size:(old_index+1)*size])
        new_indices.append(unique[signature])
    old_count=len(attrs['position']['values'])//3;new_count=len(unique)
    record={"vertexSources":vertex_sources,"index":new_indices,"groups":original["groups"],"expected":{"attributes":{k:{"itemSize":a["itemSize"],"normalized":a["normalized"],"length":len(a["values"]),"fingerprint":fingerprint(a["values"])} for k,a in attrs.items()},"index":original["index"]}}
    result['geometries'][key]=record
    before+=old_count;after+=new_count
    before_bytes+=sum(len(a['values'])*4 for a in attrs.values())+(len(indices)*2 if original['index'] is not None else 0)
    after_bytes+=sum(len(v)*4 for v in values.values())+len(new_indices)*2
result['stats']={'sourceVertices':before,'gpuVertices':after,'sourceBufferBytes':before_bytes,'optimizedBufferBytes':after_bytes,'materialsAndNodesReplaced':False}
output=folder/'optimized/moebiusTigerGeometryData.js'
output.write_text('// Generated from the verified original moebiusTiger Blender working copy.\nexport default '+json.dumps(result,separators=(',',':'))+';\n')
(folder/'optimized/moebiusTiger.runtime-report.json').write_text(json.dumps(result['stats'],indent=2))
print('TIGER_RUNTIME_EXPORT_OK',json.dumps(result['stats']))
