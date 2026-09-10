import bpy,json,math,struct,sys,importlib.util
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[3];spec=importlib.util.spec_from_file_location('gate',ROOT/'tools/pipeline/build_gatepod_escort_blender.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
C=g.C;CI=g.CI;OUT=g.OUT;ART=g.ART
ident=g.ident

def matrix(v):return Matrix([[v[c*4+r] for c in range(4)] for r in range(4)])
def err(a,b):return max(abs(a[r][c]-b[r][c]) for r in range(4) for c in range(4))
def geom(o):
 o.data.calc_loop_triangles();vs=[o.matrix_world@v.co for v in o.data.vertices];fs=[tuple(t.vertices) for t in o.data.loop_triangles];return BVHTree.FromPolygons(vs,fs,all_triangles=True)
def check(variant):
 a=json.loads((OUT/(variant+'.assembly.json')).read_text());s=json.loads((ROOT/a['source']['snapshot']).read_text());blend=OUT/(variant+'.blend');glb=OUT/(variant+'.glb');hashes={p.name:g.sha(p) for p in [blend,glb]};fail=[]
 bpy.ops.wm.open_mainfile(filepath=str(blend));sc=bpy.context.scene;obs={ident(o):o for o in sc.objects if ident(o)};max_saved=0
 for n in s['nodes']:
  if n['id'] not in obs:fail.append(['missing source',n['id']]);continue
  if (ident(obs[n['id']].parent) if obs[n['id']].parent else None)!=n['parent']:fail.append(['parent',n['id']])
 for pose in a['poseFrames']:
  sc.frame_set(pose['frame']);bpy.context.view_layer.update()
  for tag,v in pose['transforms'].items():max_saved=max(max_saved,err(CI@obs[tag].matrix_basis@C,matrix(v)))
 if max_saved>1e-5:fail.append(['saved matrix',max_saved])
 sc.frame_set(1);bpy.context.view_layer.update();root=obs['n0'];root_inv=root.matrix_world.inverted();muzzle=s['nodes'][0]['userData']['tranqMuzzle']['nodeRef'];source_index={n['id']:n for n in s['nodes']}
 for tag in ['n0',muzzle]:
  if err(CI@obs[tag].matrix_basis@C,matrix(source_index[tag]['matrix']))>1e-6:fail.append(['source root/muzzle modified',tag])
 anchors=[];ray_hits=[];down=(root.matrix_world.to_3x3()@(C.to_3x3()@Vector((0,-1,0)))).normalized()
 for anchor in a['ropeAnchors']:
  o=obs[anchor['node']];p=CI.to_3x3()@(root_inv@o.matrix_world.translation);e=(p-Vector(anchor['actorLocalPoint'])).length;anchors.append({'seat':anchor['seat'],'actorPoint':list(p),'error':e})
  if e>1e-5:fail.append(['anchor',anchor['node'],e])
  start=o.matrix_world.translation+down*.001
  for tag,mesh in obs.items():
   if mesh.type!='MESH' or mesh.hide_render:continue
   hit=geom(mesh).ray_cast(start,down,3*max(root.scale))
   if hit[0] is not None:ray_hits.append({'anchor':anchor['node'],'mesh':tag,'distance':hit[3]})
 if ray_hits:fail.append(['rope path hits actor',ray_hits])
 wing_contacts=[]
 for n in s['nodes']:
  if n.get('userData',{}).get('podPart')!='wing':continue
  wing=obs[n['id']];idx=int(n['id'][1:]);bvh=geom(wing)
  for j in [0,1]:
   rod=obs['n'+str(idx+6+j)];ends=[rod.matrix_world@(C.to_3x3()@Vector((0,y,0))) for y in [-.875,.875]];dist=min(bvh.find_nearest(p)[3] for p in ends);wing_contacts.append({'strut':ident(rod),'wing':n['id'],'closestEndToWing':dist})
   if dist>.015:fail.append(['strut disconnected',ident(rod),dist])
 triangles={tag:len(o.data.loop_triangles) for tag,o in obs.items() if o.type=='MESH' and not o.hide_render}
 # Fresh importer, without invoking the model authoring functions.
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(glb));sc=bpy.context.scene;imported={ident(o):o for o in sc.objects if ident(o)};max_import=0;uv=0
 for n in s['nodes']:
  o=imported.get(n['id'])
  if o is None:fail.append(['GLB missing node',n['id']]);continue
  if (ident(o.parent) if o.parent else None)!=n['parent']:fail.append(['GLB parent',n['id']])
 for tag,v in a['poseFrames'][0]['transforms'].items():
  o=imported[tag];max_import=max(max_import,err(CI@o.matrix_basis@C,matrix(v)))
  if o.type=='MESH':
   o.data.calc_loop_triangles()
   if not o.data.uv_layers:fail.append(['GLB UV',tag])
   else:uv+=1
   if len(o.data.loop_triangles)!=triangles[tag]:fail.append(['triangle count',tag])
 if max_import>1e-5:fail.append(['GLB matrix',max_import])
 raw=glb.read_bytes();size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);factor_count=0
 for m in doc['materials']:
  key=m.get('extras',{}).get('three_uuid')
  if key not in s['materials']:continue
  src=s['materials'][key];expect=[*src.get('color',[1,1,1]),src.get('opacity',1)];actual=m['pbrMetallicRoughness']['baseColorFactor'];factor_count+=1
  if max(abs(x-y) for x,y in zip(actual,expect))>1e-6:fail.append(['GLB original factor',key])
 materials=[]
 for m in bpy.data.materials:
  key=m.get('three_uuid')
  if key not in s['materials']:continue
  bs=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None);actual=[*list(bs.inputs['Base Color'].default_value)[:3],bs.inputs['Alpha'].default_value] if bs else None;src=s['materials'][key];expected=[*src.get('color',[1,1,1]),src.get('opacity',1)];materials.append({'id':key,'actual':actual,'source':expected})
  if actual is None or max(abs(x-y) for x,y in zip(actual,expected))>1e-5:fail.append(['GLB material',key])
 if any(o.get('reviewOnly') for o in sc.objects):fail.append(['Review rope leaked into GLB'])
 g.v.studio(sc);sc.render.resolution_x=1400;sc.render.resolution_y=1000;g.render(variant+'-glb-roundtrip.png');g.render(variant+'-belly-glb-roundtrip.png',direction=(3,-4,-2.5))
 assert all(g.sha(OUT/k)==v for k,v in hashes.items()) and g.sha(ROOT/a['source']['blend'])==a['source']['sha256']
 r={'variant':variant,'passed':not fail,'sourceUnchanged':True,'originalNodes':len(s['nodes']),'addedNodes':len(imported)-len(s['nodes']),'framesChecked':len(a['poseFrames']),'maxSavedMatrixError':max_saved,'maxGLBReimportMatrixError':max_import,'visibleUVMeshes':uv,'originalMaterialFactorsChecked':factor_count,'visibleOriginalMaterialsReimported':len(materials),'originalMaterials':materials,'ropeAnchors':anchors,'ropePathHits':ray_hits,'wingStrutContacts':wing_contacts,'tranqMuzzle':muzzle,'files':hashes,'failures':fail,'scope':'All original parents, saved local poses, imported static matrices/colors/UV/triangles; fixed root/muzzle, wing strut ends and vertical rope ray clearance. Does not certify troop spacing or arbitrary angled runtime rope paths.'};(ART/(variant+'-validation.json')).write_text(json.dumps(r,indent=2));print(json.dumps({k:v for k,v in r.items() if k!='originalMaterials'},indent=2));return r
variants=[sys.argv[sys.argv.index('--variant')+1]] if '--variant' in sys.argv else g.VARIANTS
results=[check(variant) for variant in variants]
(ART/'validation-summary.json').write_text(json.dumps({'passed':all(r['passed'] for r in results),'variants':[{'variant':r['variant'],'passed':r['passed'],'failures':r['failures']} for r in results]},indent=2))
