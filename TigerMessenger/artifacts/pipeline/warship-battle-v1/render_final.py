import bpy,importlib.util,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];spec=importlib.util.spec_from_file_location('warship',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
bpy.ops.wm.open_mainfile(filepath=str(s.OUT/'warship-battle-v1.blend'));sc=bpy.context.scene;files={}
for name,frame,direction in [('final-rowing-three-quarter',61,(4,-5,3)),('final-boarding-deck',241,(0,-.01,5))]:
 sc.frame_set(frame);s.g.render(name+'.png',direction=direction);files[name+'.png']={'frame':frame,'blendSHA256':s.sha(s.OUT/'warship-battle-v1.blend')}
sc.frame_set(61);i=15;focus=['n'+str(n)+':i'+str(i) for n in range(220,231)]+['add:hand-'+str(i)+h for h in ['L','R']]+['add:forearm-'+str(i)+h for h in ['L','R']]+['add:oar-handle-'+str(i),'add:oar-collar-'+str(i)];s.g.render('final-rower-grip.png',direction=(2,-4,2.5),focus=focus);files['final-rower-grip.png']={'frame':61,'blendSHA256':s.sha(s.OUT/'warship-battle-v1.blend')}
bpy.ops.wm.open_mainfile(filepath=str(s.ART/'boarding-review.blend'));sc=bpy.context.scene
for name,frame in [('boarding-pass-mast',78),('boarding-on-board',197)]:
 sc.frame_set(frame);s.g.render(name+'.png',direction=(4,-5,3));files[name+'.png']={'frame':frame,'reviewBlendSHA256':s.sha(s.ART/'boarding-review.blend'),'shipGLBSHA256':s.sha(s.OUT/'warship-battle-v1.glb')}
(s.ART/'final-render-sources.json').write_text(json.dumps(files,indent=2))
