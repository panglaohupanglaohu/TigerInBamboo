import bpy,importlib.util,json,hashlib
from pathlib import Path
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('vanguard',ROOT/'tools/pipeline/build_vanguard_battle_blender.py');v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
a=json.loads((v.OUT/'vanguard-battle-v1.assembly.json').read_text());src=json.loads((ROOT/a['source']['snapshot']).read_text())
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(v.OUT/'vanguard-battle-v1.glb'));sc=bpy.context.scene;objects={v.ident(o):o for o in sc.objects if v.ident(o)};fail=[];maxerr=0;uv=0
for n in src['nodes']:
 o=objects.get(n['id'])
 if not o:fail.append(['missing original',n['id']]);continue
 if (v.ident(o.parent) if o.parent else None)!=n['parent']:fail.append(['parent',n['id']])
for tag,vals in a['poseFrames'][0]['transforms'].items():
 o=objects[tag];m=Matrix([[vals[c*4+r] for c in range(4)] for r in range(4)]);maxerr=max(maxerr,max(abs(v.local(o)[r][c]-m[r][c]) for r in range(4) for c in range(4)))
 if o.type=='MESH':
  if not o.data.uv_layers:fail.append(['UV missing',tag])
  else:uv+=1
if maxerr>1e-5:fail.append(['static matrix',maxerr])
# Reimported original material factors, independent of source Blender shaders.
material_checks=[]
for m in bpy.data.materials:
 key=m.get('three_uuid')
 if not key or key not in src['materials']:continue
 bs=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
 actual=[*list(bs.inputs['Base Color'].default_value)[:3],bs.inputs['Alpha'].default_value] if bs else None;expected=[*src['materials'][key].get('color',[1,1,1]),src['materials'][key].get('opacity',1)]
 material_checks.append({'id':key,'actual':actual,'expected':expected})
 if actual is None or max(abs(x-y) for x,y in zip(actual,expected))>1e-5:fail.append(['material',key])
v.studio(sc);v.render('idle-glb-roundtrip.png')
for phase,frame in [('aim',31),('slash',61)]:
 for tag,vals in a['poseFrames'][frame-1]['transforms'].items():v.setm(objects[tag],Matrix([[vals[c*4+r] for c in range(4)] for r in range(4)]))
 v.render(phase+'-glb-roundtrip.png')
 if phase=='aim':v.render('aim-front-glb-roundtrip.png',direction=(0,-5,0))
r={'passed':not fail,'originalNodes':len(src['nodes']),'taggedNodes':len(objects),'maxStaticLocalMatrixError':maxerr,'visibleMeshesWithUV':uv,'originalMaterialChecks':material_checks,'failures':fail,'glbSha256':v.sha(v.OUT/'vanguard-battle-v1.glb'),'scope':'Fresh glTF importer: original parents, static matrices, UV layers and original color factors; real idle render, portable aim/slash matrices applied without builder pose code. GLB itself has no animation clips.'}
(v.ART/'glb-roundtrip-report.json').write_text(json.dumps(r,indent=2));print(json.dumps({k:val for k,val in r.items() if k!='originalMaterialChecks'},indent=2))
