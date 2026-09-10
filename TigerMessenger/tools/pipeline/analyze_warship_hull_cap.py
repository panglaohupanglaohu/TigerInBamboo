import bpy,json,importlib.util
from pathlib import Path
ROOT=Path("/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger")
source=ROOT/'artifacts/pipeline/warship-battle-v1/check_oar_neighbors.py'
ns={'__file__':str(source)};exec(compile(source.read_text().split("bpy.ops.wm.open_mainfile")[0],str(source),'exec'),ns)
s=ns['s'];geo=ns['geo'];cross=ns['crossings']
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/models/optimized/warship-battle-v2/warship-battle-v2.blend'))
sc=bpy.context.scene;obs={s.ident(o):o for o in sc.objects if s.ident(o)};hull=geo([obs['n1']]);records=[]
for frame in [1,51,121,181,212,301]:
 sc.frame_set(frame);bpy.context.view_layer.update();body=[obs['n'+str(n)+':i'+str(i)] for i in range(26) for n in [220,221,222,223,224,225,226,229,230]];body=[o for o in body if o.type=='MESH' and not o.hide_render]
 moving=[obs['n'+str(64+5*i)] for i in range(26)]+[obs['add:oar-handle-'+str(i)] for i in range(26)]
 records.append({'frame':frame,'bodyHull':cross(geo(body),hull),'oarsHull':cross(geo(moving),hull)})
out=ROOT/'artifacts/pipeline/warship-battle-v4/v2-hull-contact-baseline.json';out.write_text(json.dumps({'source':'warship-battle-v2.blend','readOnly':True,'sampledFrames':records},indent=2));print(json.dumps(records),flush=True)
