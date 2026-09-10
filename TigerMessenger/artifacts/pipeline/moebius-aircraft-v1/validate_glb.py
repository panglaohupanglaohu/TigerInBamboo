import json,struct,math,hashlib
from pathlib import Path
BASE=Path(__file__).resolve().parents[3];EV=Path(__file__).parent
source=json.loads((BASE/'assets/models/originals/moebiusAircraft.source.json').read_text());sn={n['id']:n for n in source['nodes']}
p=BASE/'assets/models/optimized/moebius-aircraft-v1/moebius-aircraft-v1.glb';raw=p.read_bytes();size=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+size]);binary=raw[28+size:]
ns={n.get('extras',{}).get('three_node_id'):n for n in g['nodes']if n.get('extras',{}).get('three_node_id')};index_ids={i:n.get('extras',{}).get('three_node_id')for i,n in enumerate(g['nodes'])};parents={index_ids[c]:index_ids[i]for i,n in enumerate(g['nodes'])for c in n.get('children',[])if index_ids[c]}
assert set(ns)==set(sn)
assert all(parents.get(sid)==n['parent']for sid,n in sn.items())
def matrix(n):
 if 'matrix'in n:return n['matrix']
 x,y,z,w=n.get('rotation',[0,0,0,1]);sx,sy,sz=n.get('scale',[1,1,1]);tx,ty,tz=n.get('translation',[0,0,0])
 return [(1-2*y*y-2*z*z)*sx,(2*x*y+2*z*w)*sx,(2*x*z-2*y*w)*sx,0,(2*x*y-2*z*w)*sy,(1-2*x*x-2*z*z)*sy,(2*y*z+2*x*w)*sy,0,(2*x*z+2*y*w)*sz,(2*y*z-2*x*w)*sz,(1-2*x*x-2*y*y)*sz,0,tx,ty,tz,1]
errs={sid:max(abs(a-b)for a,b in zip(matrix(n),sn[sid]['matrix']))for sid,n in ns.items()};assert max(errs.values())<1e-5,errs
def acc(ix):
 a=g['accessors'][ix];view=g['bufferViews'][a['bufferView']];fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];stride=view.get('byteStride',struct.calcsize(fmt)*n);off=view.get('byteOffset',0)+a.get('byteOffset',0);data=[struct.unpack_from('<'+fmt*n,binary,off+i*stride)for i in range(a['count'])]
 if a.get('normalized'):data=[tuple(v/({5123:65535,5121:255}[a['componentType']])for v in row)for row in data]
 return data
refnodes=[]
def refs(v):
 if isinstance(v,dict):
  if 'nodeRef'in v:refnodes.append(v['nodeRef'])
  for value in v.values():refs(value)
 elif isinstance(v,list):
  for value in v:refs(value)
refs(sn['n0']['userData']);assert all(s in ns for s in refnodes)
checks=[]
for sid in ['n1','n11','n14','n53','n54','n56','n57','n58','n59','n60','n61','n62','n63','n64','n65']:
 n=ns[sid];pos=[v for pr in g['meshes'][n['mesh']]['primitives']for v in acc(pr['attributes']['POSITION'])];a=source['geometries'][sn[sid]['geometry']]['attributes']['position']['values'];sp=list(zip(a[::3],a[1::3],a[2::3]));error=max(abs(fn(v[k]for v in pos)-fn(v[k]for v in sp))for fn in [min,max]for k in range(3));assert error<1e-5,(sid,error)
 checks.append({'id':sid,'localPositionBoundsMaxError':error,'meshPresent':True})
energy=g['meshes'][ns['n14']['mesh']]['primitives'][0];assert 'COLOR_0'in energy['attributes'];colors=acc(energy['attributes']['COLOR_0']);sc=source['geometries']['g6']['attributes']['color']['values'];cs=list(zip(sc[::3],sc[1::3],sc[2::3]));ce=max(abs(fn(c[k]for c in colors)-fn(c[k]for c in cs))for fn in [min,max]for k in range(3));assert ce<1e-4,ce
hidden=[sid for sid in ['n62','n63','n64']if ns[sid]['extras']['source_visible']==False and 'mesh'in ns[sid]];assert len(hidden)==3
report={'glbSha256':hashlib.sha256(raw).hexdigest(),'sourceNodeCount':len(ns),'sourceParentsExact':True,'maxLocalMatrixError':max(errs.values()),'allOriginalNodeReferencesResolve':True,'referencedNodeIDs':refnodes,'originalHullAndDynamicMeshBounds':checks,'energyVertexColorsPresent':True,'energyColorBoundsMaxError':ce,'hiddenScanGeometryAndVisibilityMetadataPreserved':hidden,'addedStaticNodes':sum('candidate_node_id'in n.get('extras',{})for n in g['nodes']),'note':'Animation contracts and original geometry preservation checks are not a runtime animation test. Importer must honor source_visible=false.'}
(EV/'validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
