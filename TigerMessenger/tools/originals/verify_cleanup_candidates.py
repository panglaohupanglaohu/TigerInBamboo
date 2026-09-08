"""Independently reopen original/candidate files and compare saved surfaces."""
import bpy, json, hashlib, struct
from pathlib import Path
root=Path(__file__).resolve().parents[2]
source=root/'assets/models/originals/blender-r3'
folder=root/'assets/models/optimized/batch-candidates-v2'

def digest(values):
    h=hashlib.sha256()
    for value in values:h.update(struct.pack('<d',value))
    return h.hexdigest()

def snapshot(path):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    meshes={}
    result={}
    for o in bpy.data.objects:
        key=o.data.as_pointer() if o.type=='MESH' else None
        if key is not None and key not in meshes:
            m=o.data
            # Triangle corner order, UV seams and material slots must survive.
            meshes[key]={
                'corners':digest(c for l in m.loops for c in m.vertices[l.vertex_index].co),
                'uv':{u.name:digest(c for v in u.data for c in v.uv) for u in m.uv_layers},
                'faces':[(p.loop_total,p.material_index,p.use_smooth) for p in m.polygons],
                'materials':[a.name if a else None for a in m.materials],
                'looseEdges':digest(c for e in m.edges if e.is_loose for i in e.vertices for c in m.vertices[i].co),
                'colors':{a.name:digest(c for v in a.data for c in v.color) for a in m.color_attributes},
            }
            if not m.polygons:meshes[key]['points']=digest(c for v in m.vertices for c in v.co)
        result[o.name]={
            'parent':o.parent.name if o.parent else None,
            'type':o.type,'matrix':tuple(c for r in o.matrix_basis for c in r),
            'visible':not o.hide_render,'color':tuple(o.color),
            'mesh':meshes.get(key),
        }
    return result

reports=[]
for item in json.loads((folder/'batch-report.json').read_text()):
    ident=item['id']
    try:
        a=snapshot(source/f'{ident}.blend')
        b=snapshot(folder/f'{ident}.blend')
        assert a==b, 'saved surface, hierarchy, material, color or transform mismatch'
        row={'id':ident,'verified':True,'objects':len(a)}
    except Exception as e:
        row={'id':ident,'verified':False,'error':str(e)}
    reports.append(row)
    (folder/'saved-verification.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
    print('SAVED_CANDIDATE_CHECK',ident,row['verified'],flush=True)
print('SAVED_CHECKS_FINISHED',len(reports),sum(r['verified'] for r in reports),flush=True)
