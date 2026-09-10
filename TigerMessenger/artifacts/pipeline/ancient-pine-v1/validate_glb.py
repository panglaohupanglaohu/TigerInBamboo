import json,struct,hashlib
from pathlib import Path
from collections import Counter,defaultdict
BASE=Path(__file__).resolve().parents[3]
EV=Path(__file__).parent
source=json.loads((EV/'source-audit.json').read_text());expected={n['id']:n['parent']for n in source['nodes']}
results=[]
for lod in range(3):
 p=BASE/f'assets/models/optimized/ancient-pine-v1/ancient-pine-v1-lod{lod}.glb';raw=p.read_bytes();sz=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+sz]);binary=raw[28+sz:]
 def acc(index):
  a=j['accessors'][index];b=j['bufferViews'][a['bufferView']];fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']];n={'SCALAR':1,'VEC3':3,'VEC2':2,'VEC4':4}[a['type']];stride=b.get('byteStride',struct.calcsize(fmt)*n);off=b.get('byteOffset',0)+a.get('byteOffset',0)
  return [struct.unpack_from('<'+fmt*n,binary,off+i*stride)for i in range(a['count'])]
 ids={i:n.get('extras',{}).get('three_node_id')for i,n in enumerate(j['nodes'])};parents={ids[c]:ids[i]for i,n in enumerate(j['nodes'])for c in n.get('children',[])}
 actual={sid:parents.get(sid)for sid in ids.values()if sid};assert actual==expected,(actual,expected)
 weld={};verts=[];faces=[];triangles=0
 for n in j['nodes']:
  if 'mesh'not in n:continue
  for pr in j['meshes'][n['mesh']]['primitives']:
   ix=[v[0]for v in acc(pr['indices'])];triangles+=len(ix)//3
   if n['extras']['three_node_id']not in ['n8','n9']:continue
   assert 'matrix'not in n and n.get('translation',[0,0,0])==[0,0,0]
   mapping=[]
   for pnt in acc(pr['attributes']['POSITION']):
    key=tuple(round(v,5)for v in pnt)
    if key not in weld:weld[key]=len(verts);verts.append(key)
    mapping.append(weld[key])
   faces.extend(tuple(mapping[k]for k in ix[i:i+3])for i in range(0,len(ix),3))
 edges=Counter();adj=defaultdict(set);degenerate=0
 for f in faces:
  if len(set(f))<3:degenerate+=1;continue
  for a,b in zip(f,f[1:]+f[:1]):edges[tuple(sorted((a,b)))]+=1;adj[a].add(b);adj[b].add(a)
 remaining=set(adj);components=[]
 while remaining:
  stack=[remaining.pop()];count=0
  while stack:
   v=stack.pop();count+=1
   for n in adj[v]&remaining:remaining.remove(n);stack.append(n)
  components.append(count)
 root=next(n for n in j['nodes']if n.get('extras',{}).get('three_node_id')=='n0')
 results.append({'lod':lod,'sha256':hashlib.sha256(raw).hexdigest(),'sourceNodeIDs':len(actual),'sourceParentIDsExact':True,'triangles':triangles,'visibleMeshNodes':sum('mesh'in n for n in j['nodes']),'hiddenOutlineMetadataOnly':all('mesh'not in n for n in j['nodes']if n.get('extras',{}).get('three_node_id')in ['n13','n14','n15','n16']),'woodSurface':{'weldTolerance':1e-5,'components':len(components),'componentVertexCounts':sorted(components,reverse=True),'boundaryEdges':sum(v==1 for v in edges.values()),'nonManifoldEdges':sum(v>2 for v in edges.values()),'degenerateTriangles':degenerate},'gltfRootTRS':{k:root[k]for k in ['translation','rotation','scale']if k in root}})
report={'glbs':results,'note':'Wood topology weld is evaluated across the two original bark material batches; no rendering-based collision claim.'}
(EV/'validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
