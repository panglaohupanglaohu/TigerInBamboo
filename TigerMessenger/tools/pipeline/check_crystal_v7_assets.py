"""Structural validation of Blender-produced assets; not gameplay acceptance."""
import hashlib, json, math, struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'artifacts/pipeline/crystal-v7-three-rounds'
results=[]
for r in [1,2,3]:
 p=ROOT/f'assets/models/optimized/crystal-v7/crystal-v7-r{r:02d}.glb'
 raw=p.read_bytes()
 assert raw[:4]==b'glTF' and struct.unpack_from('<I',raw,8)[0]==len(raw)
 size=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+size])
 for node in g['nodes']:
  for field in ['matrix','translation','rotation','scale']:
   assert all(isinstance(v,(int,float)) and math.isfinite(v) for v in node.get(field,[])),(r,node.get('name'),field)
 for a in g['accessors']:
  assert a['count']>0
  for field in ['min','max']:assert all(math.isfinite(v) for v in a.get(field,[]))
 for v in g['bufferViews']:assert v.get('byteOffset',0)+v['byteLength']<=g['buffers'][v['buffer']]['byteLength']
 towers=[n for n in g['nodes'] if n.get('name','').startswith(('moebius-grand-community-tower','moebius-trackside-gold-'))]
 swamp=[n for n in g['nodes'] if n.get('name','')=='moebius-swamp-placement']
 assert len(towers)==3 and len(swamp)==1
 engine=ROOT/f'godot/assets/art-pilots/crystal-v7-r{r:02d}.glb'
 assert engine.read_bytes()==raw,'Godot asset differs from Blender output'
 results.append({'round':r,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'nodes':len(g['nodes']),'meshes':len(g['meshes']),'towers':len(towers),'swamp_roots':len(swamp),'finite_transforms':True,'valid_buffer_ranges':True,'godot_copy_matches':True})
native=[json.loads((ART/f'godot-r{r:02d}.json').read_text()) for r in [1,2,3]]
assert len({x['camera'] for x in native})==1
for row in native:assert row['nonfinite_vertices']==0 and row['towers']==3 and row['swamp_roots']==1
report={'results':results,'same_native_camera':True,'source_sha256':hashlib.sha256((ART/'round-1-source.glb').read_bytes()).hexdigest(),'target_sha256':hashlib.sha256((ROOT/'assets/concepts/moebius-crystal-city/target-v7-swamp-enclosure.png').read_bytes()).hexdigest(),'scope':'Asset integrity and actual native render only; not pathfinding, boarding, global transit or visual equivalence to target.'}
(ART/'asset-checks.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
