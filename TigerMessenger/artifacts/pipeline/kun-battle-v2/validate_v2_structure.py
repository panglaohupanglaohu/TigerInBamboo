import json,struct,hashlib,math
from pathlib import Path
B=Path(__file__).resolve().parents[3];EV=Path(__file__).parent

def load(version):
 p=B/f'assets/models/optimized/kun-battle-{version}/kun-battle-{version}.glb';raw=p.read_bytes();n=struct.unpack_from('<I',raw,12)[0];return json.loads(raw[20:20+n]),raw[28+n:],hashlib.sha256(raw).hexdigest()
a,ab,ah=load('v1');b,bb,bh=load('v2')
def nodes(j):return {n.get('extras',{}).get('three_node_id'):n for n in j['nodes']if n.get('extras',{}).get('three_node_id')}
def parents(j):
 ids={i:n.get('extras',{}).get('three_node_id',n.get('extras',{}).get('kun_added_id'))for i,n in enumerate(j['nodes'])};return {ids[c]:ids[i]for i,n in enumerate(j['nodes'])for c in n.get('children',[])}
def acc(j,data,ix):
 a=j['accessors'][ix];v=j['bufferViews'][a['bufferView']];nc={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']];stride=v.get('byteStride',nc*struct.calcsize(fmt));off=v.get('byteOffset',0)+a.get('byteOffset',0);return [struct.unpack_from('<'+fmt*nc,data,off+i*stride)for i in range(a['count'])]
na,nb=nodes(a),nodes(b);assert set(na)==set(nb) and len(na)==295;pa,pb=parents(a),parents(b);assert all(pa.get(k)==pb.get(k)and na[k].get('matrix')==nb[k].get('matrix')for k in na)
geometry_checks=[]
for sid,n in na.items():
 if 'mesh'not in n:continue
 assert 'mesh'in nb[sid];ma=a['meshes'][n['mesh']];mb=b['meshes'][nb[sid]['mesh']];assert len(ma['primitives'])==len(mb['primitives'])
 for ap,bp in zip(ma['primitives'],mb['primitives']):
  av=sorted(acc(a,ab,ap['attributes']['POSITION']));bv=sorted(acc(b,bb,bp['attributes']['POSITION']));assert len(av)==len(bv);err=max(abs(x-y)for p,q in zip(av,bv)for x,y in zip(p,q));assert err<1e-5,(sid,err);geometry_checks.append({'id':sid,'maxVertexPositionError':err})
def triangles(j):return sum(j['accessors'][pr['indices']]['count']//3 for n in j['nodes']if 'mesh'in n for pr in j['meshes'][n['mesh']]['primitives'])
added=[]
for n in b['nodes']:
 tag=n.get('extras',{}).get('kun_added_id')
 if tag in ['add:mouth-roof','add:mouth-floor','add:inner-throat']:
  m=b['meshes'][n['mesh']];added.append({'id':tag,'triangles':sum(b['accessors'][p['indices']]['count']//3 for p in m['primitives']),'morphs':m.get('extras',{}).get('targetNames',[]),'materials':[b['materials'][p['material']].get('pbrMetallicRoughness')for p in m['primitives']]})
r={'v1GlbSha256':ah,'v2GlbSha256':bh,'sourceIDs':295,'originalParentsAndRestMatricesExact':True,'originalVisibleGeometryChecks':geometry_checks,'v1Triangles':triangles(a),'v2Triangles':triangles(b),'mouthMeshes':added,'runtimeIntegrated':False};(EV/'v2-structure-validation.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'sourceIDs':295,'originalMeshesChecked':len(geometry_checks),'triangles':r['v2Triangles'],'v2Hash':bh}))
