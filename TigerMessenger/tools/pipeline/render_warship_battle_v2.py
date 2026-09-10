"""Two actual fresh-GLB views at a formerly intersecting source frame."""
import bpy,json,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('ship',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
s.OUT=ROOT/'assets/models/optimized/warship-battle-v2';s.ART=ROOT/'artifacts/pipeline/warship-battle-v2';s.g.ART=s.ART
a=json.loads((s.OUT/'warship-battle-v2.assembly.json').read_text());bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(s.OUT/'warship-battle-v2.glb'));sc=bpy.context.scene;obs={s.ident(o):o for o in sc.objects if s.ident(o)}
pose=a['poseFrames'][50]
for key,values in pose['transforms'].items():s.setm(obs[key],s.mat(values))
bpy.context.view_layer.update();s.v.studio(sc);sc.render.resolution_x=1400;sc.render.resolution_y=1000
for name,direction in [('glb-synchronized-frame51-3q.png',(4,-5,3)),('glb-synchronized-frame51-top.png',(0,-.01,5))]:s.g.render(name,direction=direction)
(s.ART/'render-provenance.json').write_text(json.dumps({'inputGLB':s.sha(s.OUT/'warship-battle-v2.glb'),'appliedPortablePoseFrame':51,'staticGLBStoredFrame':1,'geometry':'fresh GLB import; applied exact V2 local matrices, no source mesh substituted','images':['glb-synchronized-frame51-3q.png','glb-synchronized-frame51-top.png']},indent=2))
