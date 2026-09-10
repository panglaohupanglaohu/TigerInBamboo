"""Lossless portable vertex arrays from approved GLBs; no Blender/source mutations."""
from pathlib import Path
import json,struct,hashlib
ROOT=Path(__file__).resolve().parents[2]
def load(kind,name,snapshot):
 p=ROOT/'assets/models/optimized'/name/(name+'.glb');raw=p.read_bytes();length=struct.unpack_from('<I',raw,12)[0];d=json.loads(raw[20:20+length]);binary=raw[28+length:];src=json.loads((ROOT/snapshot).read_text())
 def attr(i):
  a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];fmt={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}[a['componentType']];size=struct.calcsize(fmt)*count;stride=v.get('byteStride',size);offset=v.get('byteOffset',0)+a.get('byteOffset',0);values=[]
  for k in range(a['count']):values.extend(struct.unpack_from('<'+fmt*count,binary,offset+k*stride))
  if a.get('normalized') and a['componentType']!=5126:
   divisor={5120:127,5121:255,5122:32767,5123:65535}[a['componentType']];values=[max(-1,v/divisor) for v in values]
  return values
 meshes=[]
 for m in d['meshes']:
  primitives=[]
  for prim in m['primitives']:
   if prim.get('mode',4)!=4:raise ValueError('Nontriangle')
   attrs={key:attr(value) for key,value in prim['attributes'].items()}
   primitives.append({'attributes':attrs,'indices':attr(prim['indices']) if 'indices' in prim else list(range(len(attrs['POSITION'])//3)),'material':prim.get('material',0)})
  meshes.append({'name':m.get('name',''),'primitives':primitives})
 ids={i:n.get('extras',{}).get('three_node_id') or n.get('extras',{}).get('vanguard_added_id') or n.get('extras',{}).get('candidate_node_id') or 'add:glb-'+str(i) for i,n in enumerate(d['nodes'])}
 parents={c:i for i,n in enumerate(d['nodes']) for c in n.get('children',[])}
 nodes=[{'id':ids[i],'parent':ids.get(parents.get(i)),'name':n.get('name',''),'matrix':n.get('matrix'),'translation':n.get('translation',[0,0,0]),'rotation':n.get('rotation',[0,0,0,1]),'scale':n.get('scale',[1,1,1]),'mesh':n.get('mesh'),'hidden':bool(n.get('extras',{}).get('candidateHidden') or n.get('extras',{}).get('candidate_hidden_outline'))} for i,n in enumerate(d['nodes'])]
 # Original archive-hidden outlines can also have retained GLB meshes: always
 # retain their original objects but give them empty geometry in the active adapter.
 srcnodes=[{'id':n['id'],'parent':n.get('parent'),'name':n.get('name',''),'type':n.get('type'),'matrix':n['matrix']} for n in src['nodes']]
 result={'asset':name,'sha256':hashlib.sha256(raw).hexdigest(),'geometrySha256':hashlib.sha256(json.dumps(meshes,separators=(',',':')).encode()).hexdigest(),'originalNodes':srcnodes,'nodes':nodes,'meshes':meshes,'materials':d['materials']}
 out=ROOT/'src/assets'/('battle'+kind.title()+'Data.js');out.write_text('// Generated from approved GLB; regenerate via tools/pipeline/export_battle_web_data.py.\nexport default '+json.dumps(result,separators=(',',':'))+';\n')
 print(kind,len(nodes),len(meshes),out.stat().st_size)
load('vanguard','vanguard-color-v2','assets/models/originals/supplemental/vanguardTrooper.source.json')
load('socco','socco-color-v2','assets/models/originals/supplemental/soccoCraft.source.json')
