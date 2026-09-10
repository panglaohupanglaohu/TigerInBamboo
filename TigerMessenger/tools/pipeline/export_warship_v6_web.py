from pathlib import Path
import json,struct,base64,hashlib,os
r=Path(__file__).resolve().parents[2];manifest=r/'assets/models/optimized/warship-runtime.json';version=os.environ.get('WARSHIP_ASSET_VERSION',str(json.loads(manifest.read_text())['revision']) if manifest.exists() else '8');p=r/f'assets/models/optimized/warship-battle-v{version}/warship-battle-v{version}.glb';raw=p.read_bytes();n=struct.unpack_from('<I',raw,12)[0];d=json.loads(raw[20:20+n]);bn=struct.unpack_from('<I',raw,20+n)[0];binary=raw[28+n:28+n+bn]
a=json.loads(p.with_suffix('.assembly.json').read_text());keys=sorted(a['poseFrames'][0]['transforms']);data=[];frames=list(range(60,120))+list(range(180,211))
for frame in frames:
 for k in keys:data.extend(a['poseFrames'][frame]['transforms'][k])
poses=struct.pack('<'+'f'*len(data),*data)
for node in d['nodes']:
 e=node.get('extras',{});node['sourceId']=str(e['three_instance_owner'])+':i'+str(e['three_instance_index']) if 'three_instance_owner' in e else e.get('three_node_id',e.get('warship_added_id'))
 node['hidden']=bool(e.get('candidateHidden') or e.get('three_visible') is False)
d['boarding']=a.get('boarding',{});d['frameIndex']={str(f):i for i,f in enumerate(frames)};d['binary']=base64.b64encode(binary).decode();d['poseBinary']=base64.b64encode(poses).decode();d['poseKeys']=keys;d['sourceSHA256']=hashlib.sha256(raw).hexdigest();d['source']=str(p.relative_to(r))
(r/'src/assets/warshipV6Data.js').write_text('// Generated from saved Blender GLB and assembly; do not edit by hand.\nexport default '+json.dumps(d,separators=(',',':'))+';\n');print('packed 91 runtime pose frames; original full 301 remain in asset assembly')
