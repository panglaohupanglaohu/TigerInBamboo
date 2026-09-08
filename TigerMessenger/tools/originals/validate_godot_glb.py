"""Validate exported containers and compare visible source triangle counts."""
import json, struct
from pathlib import Path
root = Path(__file__).resolve().parents[2]
results = []
for path in sorted((root/'godot/assets/originals').glob('*.glb')):
    raw = path.read_bytes()
    magic, version, total = struct.unpack_from('<III', raw)
    size, kind = struct.unpack_from('<II', raw, 12)
    assert magic == 0x46546c67 and version == 2 and total == len(raw), path
    doc = json.loads(raw[20:20+size])
    source = json.loads((root/'assets/models/originals'/f'{path.stem}.source.json').read_text())
    expected = 0; visible = {}
    for n in source['nodes']:
        visible[n['id']] = n['visible'] and visible.get(n['parent'], True)
        if not visible[n['id']] or n.get('userData', {}).get('isOutline'): continue
        geo = source['geometries'].get(n.get('geometry'))
        if not geo or n['type'] in ['Line', 'LineLoop', 'LineSegments', 'Points']: continue
        length = len(geo['index']) if geo['index'] is not None else len(geo['attributes']['position']['values'])//3
        draw = geo.get('drawRange', {}); start = draw.get('start',0); count = draw.get('count')
        count = max(0,length-start) if count is None else min(count,max(0,length-start))
        expected += count//3 * len(n.get('instances', [None]))
    triangles = 0; modes = {}
    for n in doc.get('nodes', []):
        if 'mesh' not in n: continue
        for prim in doc['meshes'][n['mesh']]['primitives']:
            mode = prim.get('mode',4)
            acc = doc['accessors'][prim.get('indices', prim['attributes']['POSITION'])]
            modes[str(mode)] = modes.get(str(mode),0)+1
            if mode == 4: triangles += acc['count']//3
    results.append(dict(id=path.stem, expectedTriangles=expected, exportedTriangles=triangles,
        triangleMatch=expected==triangles, primitiveModes=modes, images=len(doc.get('images',[]))))
report = dict(tested=len(results), mismatches=[r['id'] for r in results if not r['triangleMatch']], results=results)
(root/'artifacts/godot-export/glb-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='results'}))
raise SystemExit(bool(report['mismatches']))
