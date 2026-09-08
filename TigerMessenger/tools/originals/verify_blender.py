"""Reopen a saved archive and check actual mesh/instance/line data against source."""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Matrix,Vector
root=Path(__file__).resolve().parents[2]
asset=sys.argv[sys.argv.index('--')+1]
folder=root/'assets/models/originals'
bpy.ops.wm.open_mainfile(filepath=str(folder/'blender-r3'/f'{asset}.blend'))
source=json.loads((folder/f'{asset}.source.json').read_text())
objects={o['three_node_id']:o for o in bpy.data.objects if 'three_node_id' in o}
instances={(o['three_instance_owner'],o['three_instance_index']):o for o in bpy.data.objects if 'three_instance_owner' in o}
C=Matrix.Rotation(math.pi/2,4,'X')
max_error=0;line_edges=0;instance_count=0
for n in source['nodes']:
    assert n['id'] in objects,(asset,n['id'],'missing node')
    obj=objects[n['id']]
    assert (obj.parent['three_node_id'] if obj.parent else None)==n['parent']
    if n.get('geometry') is None:continue
    g=source['geometries'][n['geometry']];raw=g['attributes']['position']['values']
    checked=[]
    if 'instances' in n:
        assert obj.type=='EMPTY','unexpected prototype rendered at instance root'
        for i,arr in enumerate(n['instances']):
            child=instances[n['id'],i];instance_count+=1
            M=Matrix([[arr[c*4+r] for c in range(4)] for r in range(4)]);expected=C@M@C.inverted()
            assert max(abs(child.matrix_basis[r][c]-expected[r][c]) for r in range(4) for c in range(4))<1e-4
            if n.get('instanceColor'):
                stride=n['instanceColor']['itemSize'];col=n['instanceColor']['values'][i*stride:i*stride+3]
                assert max(abs(child.color[k]-col[k]) for k in range(3))<1e-6
            checked.append(child)
    else:checked.append(obj)
    for child in checked[:1]:
        assert child.type=='MESH';mesh=child.data
        assert len(mesh.vertices)==len(raw)//3
        for i,v in enumerate(mesh.vertices):max_error=max(max_error,(v.co-C.to_3x3()@Vector(raw[i*3:i*3+3])).length)
        ids=g['index'] if g['index'] is not None else list(range(len(raw)//3))
        start=g['drawRange']['start'];count=g['drawRange']['count'];ids=ids[start:start+count] if count is not None else ids[start:]
        if n['type'] in ['Line','LineSegments','LineLoop']:
            expected=len(ids)//2 if n['type']=='LineSegments' else max(0,len(ids)-1)+(1 if n['type']=='LineLoop' and len(ids)>2 else 0)
            assert len(mesh.edges)==expected,(n['id'],len(mesh.edges),expected)
            assert not mesh.polygons;line_edges+=len(mesh.edges)
assert max_error<1e-6
print('SAVED_BLEND_VERIFIED',json.dumps({'asset':asset,'nodes':len(objects),'instances':instance_count,'lineEdges':line_edges,'maxVertexError':max_error}))
