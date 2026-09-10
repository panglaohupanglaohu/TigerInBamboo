import bpy,bmesh,json,sys,importlib.util,hashlib,shutil
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sp=importlib.util.spec_from_file_location('ship',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(sp);sp.loader.exec_module(s)
BASE=ROOT/'assets/models/optimized/warship-battle-v6';OUT=ROOT/'assets/models/optimized/warship-battle-v8';ART=ROOT/'artifacts/pipeline/warship-bow-ornament';OUT.mkdir(exist_ok=True);ART.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(BASE/'warship-battle-v6.blend'))
root=next(o for o in bpy.context.scene.objects if s.ident(o)=='n0');obs={s.ident(o):o for o in bpy.context.scene.objects if s.ident(o)}
changed=[]
for key in ['n59','n60','n61','n62']:
 o=obs[key];o.data=o.data.copy();m=s.rootmat(o,root);inv=m.inverted()
 for v in o.data.vertices:
  p=m@(s.CI.to_3x3()@v.co);p.x=-p.x+.35;p.y-=.43;v.co=s.C.to_3x3()@(inv@p)
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.update();changed.append(key)
a=json.loads((BASE/'warship-battle-v6.assembly.json').read_text());a['stage']='v8 user-requested curved ornament and red finial relocated to bow';a['geometryRevision']['version']=8;a['geometryRevision']['bowOrnament']='original n59/n61 and outline children reflected along X then translated +0.35; cargo unchanged';a['runtimeIntegrated']=False
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'warship-battle-v8.blend'));s.export_warship(list(obs.values()),OUT/'warship-battle-v8.glb');(OUT/'warship-battle-v8.assembly.json').write_text(json.dumps(a,separators=(',',':')))
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(OUT/'warship-battle-v8.glb'));sc=bpy.context.scene;s.v.studio(sc);sc.render.resolution_x=1200;sc.render.resolution_y=900;sc.render.image_settings.file_format='PNG';center=Vector((.25,0,1.75))
for name,direction in [('three-quarter',(5,-7,4)),('side',(0,-9,1))]:
 sc.camera.location=center+Vector(direction);sc.camera.rotation_euler=(center-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.ortho_scale=7.9;sc.render.filepath=str(ART/(name+'.png'));bpy.ops.render.render(write_still=True)
(ART/'report.json').write_text(json.dumps({'source':'v6','result':'v8','changedNodes':changed,'sha256':hashlib.sha256((OUT/'warship-battle-v8.glb').read_bytes()).hexdigest(),'boardingChanged':False},indent=2))
