import bpy,json,math
from pathlib import Path
from mathutils import Vector
root=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/base-four-hour/models')
report=[]
for robot in ['locust','ant','beetle']:
 bpy.ops.wm.open_mainfile(filepath=str(root/(robot+'-actions.blend')))
 clips=[]
 for clip in ['idle','move','attack','transport','disabled']:
  for o in bpy.data.objects:
   if o.animation_data:
    o.animation_data.action=None
    for track in o.animation_data.nla_tracks:track.mute=track.name!=clip
  samples=[]
  for frame in [0,7,17]:
   bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
   points=[o.matrix_world@v.co for o in bpy.data.objects if o.type=='MESH' for v in o.data.vertices]
   assert all(math.isfinite(c) for p in points for c in p)
   lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
   samples.append({'frame':frame,'min':lo,'max':hi,'joints':{o.name:[round(n,6) for row in o.matrix_world for n in row] for o in bpy.data.objects if o.name.startswith('joint-')}})
  clips.append({'clip':clip,'samples':samples})
 move=next(c for c in clips if c['clip']=='move')['samples'];assert move[0]['joints']!=move[1]['joints'],robot+' move was static'
 idle=clips[0]['samples'][0];transport=clips[3]['samples'][0]
 assert idle['joints']!=transport['joints'],robot+' transport did not switch'
 report.append({'robot':robot,'finite':True,'moveChanges':True,'transportChanges':True,'clips':clips})
(root/'blender-action-validation.json').write_text(json.dumps(report,indent=2))
print('ACTION_VALIDATION',json.dumps([{k:r[k] for k in ['robot','finite','moveChanges','transportChanges']} for r in report]))
