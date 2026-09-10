"""Read-only saved-Blender and fresh GLB validation; does not call authoring fit/pose."""
import bpy,json,struct,importlib.util,math
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('warship',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
def mat(v):return Matrix([[v[c*4+r] for c in range(4)] for r in range(4)])
def err(a,b):return max(abs(a[r][c]-b[r][c]) for r in range(4) for c in range(4))
blend=s.OUT/'warship-battle-v1.blend';glb=s.OUT/'warship-battle-v1.glb';a=json.loads((s.OUT/'warship-battle-v1.assembly.json').read_text());source=json.loads(s.SNAP.read_text());hashes={p.name:s.sha(p) for p in [blend,glb]};fail=[]
bpy.ops.wm.open_mainfile(filepath=str(blend));sc=bpy.context.scene;obs={s.ident(o):o for o in sc.objects if s.ident(o)}
for n in source['nodes']:
 if n['id'] not in obs:fail.append(['missing original',n['id']]);continue
 if s.ident(obs[n['id']].parent)!=n['parent']:fail.append(['original parent',n['id']])
instances=[o for o in obs.values() if ':i' in s.ident(o)]
if len(instances)!=286:fail.append(['instance count',len(instances)])
for o in instances:
 if s.ident(o.parent)!=o['three_instance_owner']:fail.append(['instance parent',s.ident(o)])
max_saved=0;max_grip=0;grip_count=0;bad_frames=[]
for f in a['poseFrames']:
 sc.frame_set(f['frame']);bpy.context.view_layer.update();frame_err=0
 for tag,values in f['transforms'].items():frame_err=max(frame_err,err(s.local(obs[tag]),mat(values)))
 max_saved=max(max_saved,frame_err)
 if frame_err>1e-5:bad_frames.append([f['frame'],frame_err])
 inv=obs['n0'].matrix_world.inverted()
 for grip in a['grips']:
  hand=inv@obs[grip['hand']].matrix_world.translation
  target=inv@obs[grip['oar']].matrix_world@(s.C.to_3x3()@Vector(grip['point']))
  max_grip=max(max_grip,(hand-target).length);grip_count+=1
if bad_frames:fail.append(['saved timeline',bad_frames[:10]])
if max_grip>1e-5:fail.append(['grip anchor',max_grip])
sc.frame_set(1);bpy.context.view_layer.update();triangles={};uv=0
for tag,o in obs.items():
 if o.type=='MESH' and not o.hide_render:o.data.calc_loop_triangles();triangles[tag]=len(o.data.loop_triangles)
# Shape landmarks remain the same source geometry; source root and bow eyes remain fixed.
originals={n['id']:n for n in source['nodes']};fixed=['n0','n51']+[n['id'] for n in source['nodes'] if 1.77<n['matrix'][12]<1.82 and abs(n['matrix'][14])>.45]
for tag in fixed:
 if err(s.local(obs[tag]),mat(originals[tag]['matrix']))>1e-6:fail.append(['fixed root/ram/eye transform',tag])
geometry_preserved=[]
for tag in ['n1','n51','n23','n25','n47','n49']:
 o=obs[tag];entry=originals[tag];values=source['geometries'][entry['geometry']]['attributes']['position']['values'];actual=[c for vertex in o.data.vertices for c in s.CI.to_3x3()@vertex.co]
 delta=max((abs(x-y) for x,y in zip(values,actual)),default=0) if len(values)==len(actual) else 999
 geometry_preserved.append({'id':tag,'vertices':len(actual)//3,'maxCoordinateError':delta})
 if delta>1e-6:fail.append(['original hull/ram/eye geometry',tag,delta])
raw=glb.read_bytes();size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);glbkeys={};archive=[]
for node in doc['nodes']:
 ex=node.get('extras',{});key=ex.get('three_node_id',ex.get('three_instance_key',ex.get('warship_added_id')))
 if key:glbkeys[key]=node
 if ex.get('candidateHidden'):
  idx=ex.get('archivedHiddenMeshIndex')
  if idx is not None and not (0<=idx<len(doc['meshes'])):fail.append(['invalid hidden archive',key])
  if idx is not None:archive.append(key)
 if 'mesh' in node and ex.get('candidateHidden'):fail.append(['hidden mesh still visible',key])
factor_count=0
for material in doc.get('materials',[]):
 key=material.get('extras',{}).get('three_uuid');src=source['materials'].get(key)
 if src is None:continue
 factor_count+=1;expected=[*src.get('color',[1,1,1]),src.get('opacity',1)];actual=material['pbrMetallicRoughness']['baseColorFactor']
 if max(abs(x-y) for x,y in zip(actual,expected))>1e-6:fail.append(['original factor',key])
 expected=[x*src.get('emissiveIntensity',1) for x in src.get('emissive',[0,0,0])]
 if max(abs(x-y) for x,y in zip(material.get('emissiveFactor',[0,0,0]),expected))>1e-6:fail.append(['original effective emissive',key])
# Entirely fresh importer validates final stored geometry, local matrices and materials.
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(glb));sc=bpy.context.scene;imp={s.ident(o):o for o in sc.objects if s.ident(o)};max_import=0
for tag,values in a['restTransforms'].items():
 o=imp.get(tag)
 if o is None:fail.append(['GLB missing',tag]);continue
 max_import=max(max_import,err(s.local(o),mat(values)))
 if o.type=='MESH':
  o.data.calc_loop_triangles()
  if len(o.data.loop_triangles)!=triangles.get(tag):fail.append(['GLB triangles',tag,len(o.data.loop_triangles),triangles.get(tag)])
  if not o.data.uv_layers:fail.append(['GLB UV',tag])
  else:uv+=1
for n in source['nodes']:
 if n['id'] in imp and s.ident(imp[n['id']].parent)!=n['parent']:fail.append(['GLB parent',n['id']])
for tag,o in imp.items():
 if ':i' in tag and s.ident(o.parent)!=o['three_instance_owner']:fail.append(['GLB instance parent',tag])
if max_import>1e-5:fail.append(['GLB matrix',max_import])
materials=[]
for material in bpy.data.materials:
 key=material.get('three_uuid');src=source['materials'].get(key)
 if src is None:continue
 bs=next((n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None);actual=[*list(bs.inputs['Base Color'].default_value)[:3],bs.inputs['Alpha'].default_value] if bs else None;expected=[*src.get('color',[1,1,1]),src.get('opacity',1)];materials.append({'id':key,'source':expected,'actual':actual})
 if actual is None or max(abs(x-y) for x,y in zip(actual,expected))>1e-5:fail.append(['GLB material reimport',key])
if s.sha(s.SOURCE)!=a['source']['sha256']:fail.append(['source changed'])
if any(s.sha(s.OUT/name)!=value for name,value in hashes.items()):fail.append(['candidate changed during validation'])
s.v.studio(sc);sc.render.resolution_x=1500;sc.render.resolution_y=1100;s.g.render('glb-roundtrip-three-quarter.png',direction=(4,-5,3));s.g.render('glb-roundtrip-deck.png',direction=(0,-.01,5))
r={'passed':not fail,'sourceUnchanged':True,'originalNodes':340,'originalInstances':len(instances),'visibleUVMeshes':uv,'archivedHiddenMeshes':len(archive),'savedFrames':len(a['poseFrames']),'maxSavedMatrixError':max_saved,'gripChecks':grip_count,'maxGripAnchorError':max_grip,'maxGLBReimportMatrixError':max_import,'sourceMaterialFactors':factor_count,'visibleSourceMaterials':len(materials),'materialReimport':materials,'fixedRootRamEyes':fixed,'originalHullRamEyeGeometry':geometry_preserved,'files':hashes,'failures':fail,'scope':'All original parents, 286 source crew instance parents, every saved local animation matrix, 52 hand/oar anchors per frame, fresh static GLB matrices/triangles/UV/material colors and effective emission. Does not certify arbitrary world landing ground or all body intersections.'}
(s.ART/'validation.json').write_text(json.dumps(r,indent=2));print(json.dumps({k:v for k,v in r.items() if k!='materialReimport'},indent=2))
