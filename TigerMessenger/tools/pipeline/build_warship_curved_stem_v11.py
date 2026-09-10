"""Continue the user's rising curled bow in the saved widened v10 ship; no crew pose edits."""
import bpy,bmesh,json,importlib.util,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sp=importlib.util.spec_from_file_location('ship',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(sp);sp.loader.exec_module(s)
BASE=ROOT/'assets/models/optimized/warship-battle-v10';OUT=ROOT/'assets/models/optimized/warship-battle-v11';ART=ROOT/'artifacts/pipeline/warship-top-side';OUT.mkdir(exist_ok=True);ART.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(BASE/'warship-battle-v10.blend'));sc=bpy.context.scene;sc.frame_set(1)
obs={s.ident(o):o for o in sc.objects if s.ident(o)};root=obs['n0']
for key in ['n59','n60','n61','n62']:
 o=obs[key];o.data=o.data.copy();m=s.rootmat(o,root);inv=m.inverted()
 for v in o.data.vertices:
  p=m@(s.CI.to_3x3()@v.co);p.y+=.60;v.co=s.C.to_3x3()@(inv@p)
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=0.000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
 bm.to_mesh(o.data);bm.free();o.data.update()
def extrude(name,key,profile,depth,material):
 vs=[(x,y,z) for z in [-depth/2,depth/2] for x,y in profile];n=len(profile);fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 o=s.mesh(name,vs,fs,root,material,key);bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=0.000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();s.v.ensure_uv(o);return o
# A flared hull-coloured stem rises into the original wooden curl, rather than a loose arch on deck.
extrude('Continuous raised bow stem','add:curved-bow-stem',[(2.47,.70),(2.82,.71),(2.78,.99),(2.56,1.24),(2.47,1.42),(2.32,1.37),(2.32,1.19),(2.44,.98)],.16,obs['n1'].data.materials[0])
extrude('Curved bow stem timber edge','add:curved-bow-timber',[(2.68,.70),(2.82,.71),(2.78,.99),(2.56,1.24),(2.47,1.42),(2.36,1.40),(2.46,1.20),(2.65,.94)],.19,obs['n59'].data.materials[0])
extrude('Aft pennant and lantern support','add:aft-lantern-support',[(-2.31,.72),(-2.25,.72),(-2.25,1.67),(-2.31,1.67)],.06,obs['n59'].data.materials[0])
obs={s.ident(o):o for o in sc.objects if s.ident(o)};a=json.loads((BASE/'warship-battle-v10.assembly.json').read_text());a['stage']='v11 widened crew aisle with continuous raised curled bow';a['geometryRevision']['version']=11;a['geometryRevision']['bowReference']='assets/concepts/warship-target-v2-eye-consistent.png';a['restTransforms']={k:s.flat(s.local(o)) for k,o in obs.items()}
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'warship-battle-v11.blend'));s.export_warship(list(obs.values()),OUT/'warship-battle-v11.glb');(OUT/'warship-battle-v11.assembly.json').write_text(json.dumps(a,separators=(',',':')))
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(OUT/'warship-battle-v11.glb'));sc=bpy.context.scene;s.v.studio(sc);sc.render.resolution_x=1400;sc.render.resolution_y=1000;sc.render.image_settings.file_format='PNG';center=Vector((.25,0,1.75))
for name,direction,scale in [('three-quarter',(5,-7,4),8.4),('side',(0,-9,.3),8.4),('top',(0,-.001,9),8.4)]:
 sc.camera.location=center+Vector(direction);sc.camera.rotation_euler=(center-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.ortho_scale=scale;sc.render.filepath=str(ART/(name+'.png'));bpy.ops.render.render(write_still=True)
(ART/'report.json').write_text(json.dumps({'source':'v10','revision':11,'sha256':hashlib.sha256((OUT/'warship-battle-v11.glb').read_bytes()).hexdigest(),'poseFramesUnchanged':a['poseFrames']==json.loads((BASE/'warship-battle-v10.assembly.json').read_text())['poseFrames'],'boardingValidated':False},indent=2))
