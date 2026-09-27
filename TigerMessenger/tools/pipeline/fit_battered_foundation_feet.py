import bpy,json
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
folder=ROOT/'assets/models/optimized/citadel-compact-foundations'
data=json.loads((folder/'compactFoundationsR04.js').read_text().removeprefix('export default ').strip().removesuffix(';'))
audit=json.loads((ROOT/'artifacts/pipeline/citadel-master-terrain/battered-foundation-feet-r04.json').read_text())
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
report=[]
def key(p):return ','.join(format(v,'.5f') for v in p)
for part in data['parts']:
    name='citadel-upper-rock-'+part['name']+'-'+str(part['ordinal'])
    row=next(r for r in audit['parts'] if r['name']==name)
    M=Matrix([row['matrix'][i:i+4] for i in range(0,16,4)]).transposed();inv=M.inverted()
    samples={key(s['local']):s for s in row['samples']}
    assert all(s['surfaceY'] is not None for s in samples.values()),'Unmeasured foundation foot'
    original=part['rock']['positions'];vertices=[];indices=[];seen=set();changed=0;max_drop=0
    for i in range(0,len(original),3):
        v=Vector(original[i:i+3]);k=key(v)
        if k in samples:
            s=samples[k]
            if k not in seen:indices.append(i//3);seen.add(k)
            if s['gap']>.04:
                q=M@v;drop=s['gap']+.12;q.y-=drop;v=inv@q;changed+=1;max_drop=max(max_drop,drop)
        vertices.append(v)
    assert len(seen)==len(samples),'Foot correspondence changed'
    for kind,points in [('stone',[Vector(part['positions'][i:i+3]) for i in range(0,len(part['positions']),3)]),('rock',vertices)]:
        mesh=bpy.data.meshes.new(part['name']+'-'+kind);mesh.from_pydata([(v.x,-v.z,v.y) for v in points],[],[(i,i+1,i+2) for i in range(0,len(points),3)]);mesh.update()
        obj=bpy.data.objects.new(mesh.name,mesh);bpy.context.scene.collection.objects.link(obj);obj.matrix_world=C@M@C.inverted()
        mat=bpy.data.materials.new(kind);mat.diffuse_color=(.58,.60,.59,1) if kind=='stone' else (.14,.22,.32,1);mat.roughness=.98;mesh.materials.append(mat)
        if kind=='rock':
            positions=[];normals=[]
            for face in mesh.polygons:
                for idx in face.vertices:
                    v=mesh.vertices[idx].co;n=face.normal;positions.extend([v.x,v.z,-v.y]);normals.extend([n.x,n.z,-n.y])
            part['rock']={'positions':positions,'normals':normals,'footIndices':indices}
    report.append({'name':name,'footSamples':len(indices),'changedVertices':changed,'maxDownwardFit':max_drop,'stoneUnchanged':True})
data['source']='assets/models/optimized/citadel-compact-foundations/compact-foundations-r05.blend'
data['refinement']['footFit']='Current Web mountain and seabed; same lower face identities before and after'
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'compact-foundations-r05.blend'))
(folder/'compactFoundationsR05.js').write_text('export default '+json.dumps(data,separators=(',',':'))+';\n')
(ROOT/'godot/data/citadel-upper-foundations.json').write_text(json.dumps(data,separators=(',',':')))
(ROOT/'artifacts/pipeline/citadel-master-terrain/battered-foundations-blender.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
