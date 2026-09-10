"""Read actual batch GLB bytes; audit material, source binding and wood/crown contact."""
import json,struct,hashlib,math
from pathlib import Path
from collections import Counter,defaultdict
from mathutils import Vector
from mathutils.bvhtree import BVHTree
B=Path(__file__).resolve().parents[2];OUT=B/'assets/models/optimized/saihoji-pines-v1';EV=B/'artifacts/pipeline/saihoji-pines-v1';manifest=json.loads((OUT/'manifest.json').read_text());results=[]

def load(p):
 raw=p.read_bytes();n=struct.unpack_from('<I',raw,12)[0];return json.loads(raw[20:20+n]),raw[28+n:],hashlib.sha256(raw).hexdigest()
def acc(j,data,index):
 a=j['accessors'][index];v=j['bufferViews'][a['bufferView']];fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']];nc={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];stride=v.get('byteStride',struct.calcsize(fmt)*nc);off=v.get('byteOffset',0)+a.get('byteOffset',0);return [struct.unpack_from('<'+fmt*nc,data,off+i*stride)for i in range(a['count'])]
def local_matrix(n):
 if 'matrix'in n:return n['matrix']
 x,y,z,w=n.get('rotation',[0,0,0,1]);sx,sy,sz=n.get('scale',[1,1,1]);tx,ty,tz=n.get('translation',[0,0,0]);return [(1-2*y*y-2*z*z)*sx,(2*x*y+2*z*w)*sx,(2*x*z-2*y*w)*sx,0,(2*x*y-2*z*w)*sy,(1-2*x*x-2*z*z)*sy,(2*y*z+2*x*w)*sy,0,(2*x*z+2*y*w)*sz,(2*y*z-2*x*w)*sz,(1-2*x*x-2*y*y)*sz,0,tx,ty,tz,1]
def surface(j,bin,ids):
 weld={};vs=[];fs=[]
 for node in j['nodes']:
  if node.get('extras',{}).get('three_node_id') not in ids or 'mesh'not in node:continue
  assert max(abs(x-y)for x,y in zip(local_matrix(node),[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]))<1e-5
  for prim in j['meshes'][node['mesh']]['primitives']:
   mapping=[]
   for pos in acc(j,bin,prim['attributes']['POSITION']):
    key=tuple(round(x,5)for x in pos)
    if key not in weld:weld[key]=len(vs);vs.append(Vector(key))
    mapping.append(weld[key])
   ix=[v[0]for v in acc(j,bin,prim['indices'])];fs.extend(tuple(mapping[k]for k in ix[i:i+3])for i in range(0,len(ix),3))
 return vs,fs
def topology(vs,fs):
 edges=Counter();adj=defaultdict(set);deg=0
 for face in fs:
  if len(set(face))<3:deg+=1;continue
  for a,b in zip(face,face[1:]+face[:1]):edges[tuple(sorted((a,b)))]+=1;adj[a].add(b);adj[b].add(a)
 todo=set(adj);cc=[]
 while todo:
  stack=[todo.pop()];part=set(stack)
  while stack:
   v=stack.pop()
   for n in adj[v]&todo:todo.remove(n);part.add(n);stack.append(n)
  cc.append(part)
 return {'components':len(cc),'componentVertices':sorted([len(c)for c in cc],reverse=True),'boundaryEdges':sum(n==1 for n in edges.values()),'nonManifoldEdges':sum(n>2 for n in edges.values()),'degenerateTriangles':deg},cc
for seedrow in manifest['seeds']:
 seed=seedrow['seed'];source=json.loads((B/f'assets/models/originals/saihoji-pines-r1/ancient-pine-{seed}.source.json').read_text());sn={n['id']:n for n in source['nodes']};contract=json.loads((OUT/str(seed)/'placement-contract.json').read_text());counts=Counter(tuple(round(x,5)for x in s[k])for s in contract['originalBranchCenterlines']for k in['a','b']);tips=[Vector((p[0],p[2],-p[1]))for p,n in counts.items()if n==1 and p[2]>.5];assert len(tips)==7
 for row in seedrow['lods']:
  j,bin,hash=load(B/row['glb']);ids={i:n.get('extras',{}).get('three_node_id')for i,n in enumerate(j['nodes'])};ns={ids[i]:n for i,n in enumerate(j['nodes'])if ids[i]};par={ids[c]:ids[i]for i,n in enumerate(j['nodes'])for c in n.get('children',[])};assert set(ns)==set(sn);assert all(par.get(k)==v['parent']for k,v in sn.items());matrixerror=max(abs(x-y)for k,n in ns.items()for x,y in zip(local_matrix(n),sn[k]['matrix']));assert matrixerror<1e-5
  materr=0
  for mat in j['materials']:
   mid=mat['extras']['three_uuid'];src=source['materials'][mid];actual=mat['pbrMetallicRoughness'].get('baseColorFactor',[1,1,1,1]);expected=src['color']+[src.get('opacity',1)];materr=max(materr,max(abs(x-y)for x,y in zip(actual,expected)));assert materr<1e-6 and mat.get('alphaMode','OPAQUE')=='OPAQUE'
  wv,wf=surface(j,bin,['n8','n9']);lv,lf=surface(j,bin,['n10','n11','n12']);wt,wcc=topology(wv,wf);lt,lcc=topology(lv,lf);wood=BVHTree.FromPolygons(wv,wf,all_triangles=True);leaf=BVHTree.FromPolygons(lv,lf,all_triangles=True);tipdist=[leaf.find_nearest(p)[3]for p in tips];contacts=[]
  for cc in lcc:
   faces=[f for f in lf if f[0]in cc];tree=BVHTree.FromPolygons(lv,faces,all_triangles=True);contacts.append(len(wood.overlap(tree)))
  originalground=min(source['geometries'][sn[sid]['geometry']]['attributes']['position']['values'][1::3][i]for sid in ['n8','n9']for i in range(len(source['geometries'][sn[sid]['geometry']]['attributes']['position']['values'])//3));grounddelta=min(v.y for v in wv)-originalground
  issues=[]
  if wt['components']!=1 or wt['boundaryEdges']or wt['nonManifoldEdges']or wt['degenerateTriangles']:issues.append('wood topology requires review')
  if any(n==0 for n in contacts):issues.append('crown component has no triangle contact with wood')
  if max(tipdist)>.22:issues.append('terminal branch to foliage gap requires review')
  if abs(grounddelta)>.035:issues.append('root ground envelope shifted beyond local tolerance')
  result={'seed':seed,'zone':seedrow['zone'],'lod':row['lod'],'glbSha256':hash,'sourceNodes':17,'parentIDsExact':True,'maxSourceMatrixError':matrixerror,'maxPaletteFactorError':materr,'triangles':len(wf)+len(lf),'wood':wt,'foliage':lt,'crownWoodTriangleContactPairs':contacts,'terminalTipToFoliageDistances':tipdist,'rootMinimumYDelta':grounddelta,'issues':issues};results.append(result)
(EV/'glb-contact-validation.json').write_text(json.dumps({'rows':results,'checkedGLBs':len(results),'issues':sum(bool(r['issues'])for r in results),'scope':'Actual GLB geometry and material batches. Crown triangle contact/branch endpoint proximity and source-local root envelope; not real-world terrain collision.'},indent=2)+'\n');print(json.dumps({'checked':len(results),'withIssues':sum(bool(r['issues'])for r in results),'seedsWithIssues':sorted(set(r['seed']for r in results if r['issues']))}),flush=True)
