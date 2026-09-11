"""Convert the reviewed static Blender GLB to the synchronous Web geometry format."""
import json, struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'assets/models/optimized/citadel-statue/citadel-soldier-statue-r03.glb'
b=source.read_bytes()
assert b[:4]==b'glTF'
n=struct.unpack_from('<I',b,12)[0]
j=json.loads(b[20:20+n]); binary=b[28+n:]
def accessor(index):
 a=j['accessors'][index]; assert 'sparse' not in a
 v=j['bufferViews'][a['bufferView']]
 width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
 code={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]
 size=struct.calcsize('<'+code)*width
 stride=v.get('byteStride',size)
 start=v.get('byteOffset',0)+a.get('byteOffset',0)
 result=[]
 for i in range(a['count']): result.extend(struct.unpack_from('<'+code*width,binary,start+i*stride))
 return [round(x,6) if isinstance(x,float) else x for x in result]
parts=[]
for node in j['nodes']:
 assert not node.get('children') and 'matrix' not in node, 'This converter handles only flat static TRS assets'
 if 'mesh' not in node: continue
 for primitive in j['meshes'][node['mesh']]['primitives']:
  assert primitive.get('mode',4)==4
  parts.append(dict(name=node['name'],position=accessor(primitive['attributes']['POSITION']),normal=accessor(primitive['attributes']['NORMAL']),index=accessor(primitive['indices']),material=primitive['material'],translation=node.get('translation',[0,0,0]),rotation=node.get('rotation',[0,0,0,1]),scale=node.get('scale',[1,1,1])))
data=dict(source=str(source.relative_to(ROOT)),parts=parts,materials=j['materials'])
out=source.with_name('citadelStatueData.js')
out.write_text('export default '+json.dumps(data,separators=(',',':'))+';\n')
print(json.dumps(dict(path=str(out),parts=len(parts),triangles=sum(len(p['index'])//3 for p in parts))))
