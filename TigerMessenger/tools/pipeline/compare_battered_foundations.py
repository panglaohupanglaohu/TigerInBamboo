"""Compare actual Godot triangles after importer reordering and compression."""
import json,math,itertools
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'artifacts/pipeline/citadel-master-terrain'
data=json.loads((ROOT/'godot/data/citadel-upper-foundations.json').read_text())
rows=[]
tolerance=.002
for part in data['parts']:
    name='citadel-upper-rock-'+part['name']+'-'+str(part['ordinal'])
    native=json.loads((OUT/(name+'-native-vertices.json')).read_text())
    flat=part['rock']['positions'];v=[flat[i:i+3] for i in range(0,len(flat),3)]
    expected=[v[i:i+3] for i in range(0,len(v),3)]
    verts=native['vertices'];idx=native['indices'] or list(range(len(verts)))
    actual=[[verts[j] for j in idx[i:i+3]] for i in range(0,len(idx),3)]
    def cell(tri):return tuple(math.floor(sum(v[k] for v in tri)/3/.01) for k in range(3))
    buckets={}
    for i,tri in enumerate(expected):buckets.setdefault(cell(tri),set()).add(i)
    maximum=0;unmatched=0
    for tri in actual:
        c=cell(tri);best=(math.inf,None,None)
        for delta in itertools.product((-1,0,1),repeat=3):
            key=tuple(c[k]+delta[k] for k in range(3))
            for i in buckets.get(key,()):
                error=min(max(math.dist(tri[k],perm[k]) for k in range(3)) for perm in itertools.permutations(expected[i]))
                if error<best[0]:best=(error,i,key)
        if best[0]<=tolerance:
            maximum=max(maximum,best[0]);buckets[best[2]].remove(best[1])
        else:unmatched+=1
    missing=sum(map(len,buckets.values()))
    rows.append(dict(name=name,triangles=len(actual),max_vertex_distance_m=maximum,unmatched=unmatched,missing=missing,passed=not unmatched and not missing))
report=dict(passed=all(r['passed'] for r in rows),tolerance_m=tolerance,parts=rows,scope='One-to-one complete triangle correspondence despite Godot index reorder/compression; local geometry only. Separate runtime route and foot tests required.')
(OUT/'battered-foundations-triangle-parity.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report));assert report['passed']
