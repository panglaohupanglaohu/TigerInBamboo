import struct,json,collections
from pathlib import Path
root=Path(__file__).resolve().parents[4]
def read(path):
 b=path.read_bytes();length=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+length]);data=b[28+length:]
 def accessor(index):
  a=j['accessors'][index];v=j['bufferViews'][a['bufferView']];count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];code={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']];fmt='<'+code*count;stride=v.get('byteStride',struct.calcsize(fmt));offset=v.get('byteOffset',0)+a.get('byteOffset',0)
  return [struct.unpack_from(fmt,data,offset+i*stride) for i in range(a['count'])]
 meshes={}
 for mesh in j['meshes']:
  tris=[]
  for p in mesh['primitives']:
   pos=accessor(p['attributes']['POSITION']);normal=accessor(p['attributes']['NORMAL']);idx=[x[0] for x in accessor(p['indices'])];mat={k:v for k,v in j['materials'][p['material']].items() if k not in ['name','extras']};material=json.dumps(mat,sort_keys=True)
   for i in range(0,len(idx),3):
    vertices=[tuple(round(v,6) for v in pos[index]+normal[index]) for index in idx[i:i+3]]
    cyclic=min(tuple(vertices[k:]+vertices[:k]) for k in range(3));tris.append((cyclic,material))
  meshes[mesh['name']]=collections.Counter(tris)
 nodes={n.get('extras',{}).get('three_node_id',n['name']):{k:v for k,v in n.items() if k not in ['mesh','children']} | {'childNames':[j['nodes'][i]['name'] for i in n.get('children',[])]} for n in j['nodes']}
 return j,meshes,nodes
folder=Path(__file__).parent
before,bm,bn=read(folder/'materials-before.glb');after,am,an=read(root/'godot/assets/art-pilots/scoutAircraft-art-v1.glb')
report={'beforePrimitives':sum(len(m['primitives']) for m in before['meshes']),'afterPrimitives':sum(len(m['primitives']) for m in after['meshes']),'meshNamesEqual':bm.keys()==am.keys(),'nodePropertiesEqual':bn==an,'differentMeshes':[k for k in bm if bm[k]!=am.get(k)],'comparison':'Triangle positions, normals, winding and effective PBR material parameters; rounded at 1e-6'}
report['passed']=report['meshNamesEqual'] and report['nodePropertiesEqual'] and not report['differentMeshes'];(folder/'surface-equivalence.json').write_text(json.dumps(report,indent=2));print(json.dumps(report));assert report['passed']
