"""Independent saved-file checks; no candidate/source file writes."""
import bpy,json,math,struct,hashlib
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'assets/models/optimized/kun-battle-v1';ART=Path(__file__).parent
C=Matrix.Rotation(math.pi/2,4,'X');CI=C.inverted()
def matrix(v):return Matrix([[v[c*4+r] for c in range(4)] for r in range(4)])
def err(a,b):return max(abs(a[r][c]-b[r][c]) for r in range(4) for c in range(4))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
a=json.loads((OUT/'kun-battle-v1.assembly.json').read_text());snap=json.loads((ROOT/'assets/models/originals/leviathan/leviathanIsland.source.json').read_text())
source=ROOT/a['sourceBlend'];source_hash=sha(source);blend=OUT/'kun-battle-v1.blend';blend_hash=sha(blend)
bpy.ops.wm.open_mainfile(filepath=str(blend));sc=bpy.context.scene
original={o['three_node_id']:o for o in sc.objects if 'three_node_id' in o};added={o['kun_added_id']:o for o in sc.objects if 'kun_added_id' in o}
fail=[];max_basis=0;max_original_geo=0
for n in snap['nodes']:
 o=original.get(n['id'])
 if not o:fail.append(['missing original',n['id']]);continue
 if (o.parent.get('three_node_id') if o.parent else None)!=n['parent']:fail.append(['parent',n['id']])
 e=err(o.matrix_basis,C@matrix(n['matrix'])@CI);max_basis=max(max_basis,e)
 if e>1e-5:fail.append(['original local transform',n['id'],e])
 if n['id']=='n1' or not n.get('geometry'):continue
 p=snap['geometries'][n['geometry']]['attributes']['position']['values']
 if len(o.data.vertices)*3!=len(p):fail.append(['original vertex count',n['id']]);continue
 for i,v in enumerate(o.data.vertices):max_original_geo=max(max_original_geo,(v.co-C.to_3x3()@Vector(p[i*3:i*3+3])).length)
max_timeline=0;max_membrane=0;max_morph=0;island=original['n102'];island_m=matrix(next(n['matrix'] for n in snap['nodes'] if n['id']=='n102'))
for sample in a['poseFrames']:
 sc.frame_set(sample['frame']);bpy.context.view_layer.update();jaw=added['add:jaw-pivot']
 max_timeline=max(max_timeline,err(CI@jaw.matrix_basis@C,matrix(sample['jawLocalMatrix'])))
 for tag,weights in sample['morphs'].items():
  for name,value in weights.items():max_morph=max(max_morph,abs(added[tag].data.shape_keys.key_blocks[name].value-value))
 throat=added['add:throat-membrane'];ev=throat.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh()
 for index,point in zip(a['morphEndpointIndices'],a['morphEndpointOriginalPoints']):
  expected=jaw.matrix_basis@(C.to_3x3()@(Vector(point)-Vector(a['jawPivotThree'])))
  actual=throat.matrix_basis@me.vertices[index].co
  max_membrane=max(max_membrane,(actual-expected).length)
 ev.to_mesh_clear()
 if err(CI@island.matrix_basis@C,island_m)>1e-5:fail.append(['island moved at frame',sample['frame']])
for label,value,tol in [('originalGeometry',max_original_geo,1e-5),('savedTimeline',max_timeline,1e-5),('savedMorphs',max_morph,1e-5),('throatEndpointCoupling',max_membrane,2e-5)]:
 if value>tol:fail.append([label,value,tol])
raw=(OUT/'kun-battle-v1.glb').read_bytes();length=struct.unpack_from('<I',raw,12)[0];glb=json.loads(raw[20:20+length]);nodes=glb['nodes'];parents={child:i for i,n in enumerate(nodes) for child in n.get('children',[])}
tags={n.get('extras',{}).get('three_node_id',n.get('extras',{}).get('kun_added_id')):i for i,n in enumerate(nodes)}
colors=[];archived=0
def glb_matrix(node):
 if 'matrix' in node:return matrix(node['matrix'])
 q=node.get('rotation',[0,0,0,1]);return Matrix.Translation(node.get('translation',[0,0,0]))@Quaternion((q[3],q[0],q[1],q[2])).to_matrix().to_4x4()@Matrix.Diagonal((*node.get('scale',[1,1,1]),1))
max_glb_matrix=0
for n in snap['nodes']:
 i=tags.get(n['id'])
 if i is None:fail.append(['GLB missing original',n['id']]);continue
 actual_parent=nodes[parents[i]].get('extras',{}).get('three_node_id') if i in parents else None
 if actual_parent!=n['parent']:fail.append(['GLB parent',n['id'],actual_parent,n['parent']])
 node=nodes[i];extras=node.get('extras',{})
 max_glb_matrix=max(max_glb_matrix,err(glb_matrix(node),matrix(n['matrix'])))
 if extras.get('candidateHidden') and 'mesh' in node:fail.append(['hidden mesh visible',n['id']])
 if 'archivedHiddenMeshIndex' in extras:
  archived+=1
  if extras['archivedHiddenMeshIndex']>=len(glb['meshes']):fail.append(['invalid archived mesh',n['id']])
 if n.get('geometry') and not extras.get('candidateHidden') and 'color' in snap['geometries'][n['geometry']]['attributes']:
  okay=all('COLOR_0' in p['attributes'] for p in glb['meshes'][node['mesh']]['primitives']);colors.append((n['id'],okay))
  if not okay:fail.append(['GLB missing vertex colors',n['id']])
for tag,expected in [('add:jaw-shell',['ThroatInflation']),('add:throat-membrane',['JawTurnSin','JawTurnCos']),('add:lower-lip',['LipFullness'])]:
 node=nodes[tags[tag]];m=glb['meshes'][node['mesh']];names=m.get('extras',{}).get('targetNames',[])
 if names!=expected:fail.append(['morph names',tag,names,expected])
 if any(len(p.get('targets',[]))!=len(expected) for p in m['primitives']):fail.append(['missing morph targets',tag])
for n in a['addedNodes']:max_glb_matrix=max(max_glb_matrix,err(glb_matrix(nodes[tags[n['id']]]),matrix(n['localMatrix'])))
if max_glb_matrix>1e-5:fail.append(['GLB local matrix differs from saved closed pose',max_glb_matrix])
material_count=0;max_material_error=0
for material in glb['materials']:
 key=material.get('extras',{}).get('three_uuid')
 if not key:continue
 src=snap['materials'][key];expected=[*src.get('color',[1,1,1]),src.get('opacity',1)];actual=material.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1])
 e=max(abs(x-y) for x,y in zip(actual,expected));max_material_error=max(max_material_error,e);material_count+=1
 if e>1e-6:fail.append(['GLB original color factor',key,e])
sc.frame_set(1);bpy.context.view_layer.update()
g=snap['geometries']['g0'];rawpos=g['attributes']['position']['values'];idx=g['index']['values'] if isinstance(g['index'],dict) else g['index']
source_body=[Vector((rawpos[i]*4.5,rawpos[i+1]*1.3-4.4,rawpos[i+2]*2.2)) for i in range(0,len(rawpos),3)]
triangles=[idx[i:i+3] for i in range(0,len(idx),3)];bvh=BVHTree.FromPolygons(source_body,triangles,all_triangles=True)
def root_matrix(o):
 m=o.matrix_basis.copy();p=o.parent
 while p and p!=original['n0']:m=p.matrix_basis@m;p=p.parent
 return CI@m
def surface(o):
 ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();m=root_matrix(o);vs=[m@v.co for v in me.vertices];me.calc_loop_triangles();fs=[tuple(t.vertices) for t in me.loop_triangles];ev.to_mesh_clear();return vs,fs
def area(vs,fs):return sum((vs[f[1]]-vs[f[0]]).cross(vs[f[2]]-vs[f[0]]).length*.5 for f in fs)
candidate_hull=[surface(o) for o in [original['n1'],added['add:jaw-shell']]]
closed_shell_error=max(bvh.find_nearest(p)[3] for vs,fs in candidate_hull for p in vs)
original_area=area(source_body,triangles);candidate_area=sum(area(vs,fs) for vs,fs in candidate_hull)
ray=Vector((.817,.319,.481)).normalized()
def outside(p):
 pos=p+ray*1e-5;count=0
 for _ in range(80):
  hit=bvh.ray_cast(pos,ray,500)[0]
  if hit is None:return count%2==0
  count+=1;pos=hit+ray*1e-4
 return False
protrusion=0;protrusion_node=None
for tag,o in added.items():
 if o.type!='MESH':continue
 vs,fs=surface(o)
 for p in vs:
  distance=bvh.find_nearest(p)[3]
  if distance>protrusion and distance>1e-5 and outside(p):protrusion=distance;protrusion_node=tag
roof=surface(added['add:mouth-roof'])[0];floor=surface(added['add:mouth-floor'])[0]
mouth_depth=max(p.x for p in roof)-min(p.x for p in roof)
floor_recess=abs(floor[0].y-sum(p.y for p in floor[1:])/len(floor[1:]))
sc.frame_set(31);bpy.context.view_layer.update();lip=surface(added['add:lower-lip'])[0];opening_drop=min(p.y for p in roof)-min(p.y for p in lip)
def island_signature(objects):
 rows=[]
 for k in [f'n{i}' for i in range(102,175)]:
  o=objects[k];rows.append({'id':k,'parent':o.parent.get('three_node_id'),'matrix':[list(row) for row in o.matrix_basis],'vertices':[list(v.co) for v in o.data.vertices] if o.type=='MESH' else [],'faces':[list(p.vertices) for p in o.data.polygons] if o.type=='MESH' else []})
 return hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()
island_candidate_hash=island_signature(original)
bpy.ops.wm.open_mainfile(filepath=str(source));source_nodes={o['three_node_id']:o for o in bpy.context.scene.objects if 'three_node_id' in o};island_source_hash=island_signature(source_nodes)
if island_source_hash!=island_candidate_hash:fail.append(['island hash mismatch'])
if closed_shell_error>1e-4:fail.append(['closed shell surface distance',closed_shell_error])
assert sha(source)==source_hash and sha(blend)==blend_hash
report={'checksPassed':not fail,'sourceFileUnchanged':True,'candidateFileUnchanged':True,'originalNodeCount':len(original),'addedNodeCount':len(added),'savedFramesChecked':len(a['poseFrames']),'maxOriginalBasisError':max_basis,'maxUnmodifiedMeshVertexError':max_original_geo,'maxSavedJawMatrixError':max_timeline,'maxSavedMorphWeightError':max_morph,'maxThroatEndpointErrorActorUnits':max_membrane,'maxGLBLocalMatrixError':max_glb_matrix,'GLBColorMeshesChecked':len(colors),'GLBArchivedHiddenMeshes':archived,'failures':fail,'scope':'Structural and saved 30Hz jaw/morph coupling checks; not full visual acceptance, all-surface contact certification, or gameplay integration.','files':{'blend':blend_hash,'glb':sha(OUT/'kun-battle-v1.glb'),'assembly':sha(OUT/'kun-battle-v1.assembly.json')}}
report['geometryMetrics']={'units':'source actor local units, before original root scale .5','closedSplitHullVertexToOriginalSurfaceMax':closed_shell_error,'closedOriginalHullArea':original_area,'closedSplitHullArea':candidate_area,'closedSplitHullAreaRelativeError':abs(candidate_area-original_area)/original_area,'closedAddedMouthMaxOutwardVertexDistance':protrusion,'closedAddedMouthMaxOutwardNode':protrusion_node,'mouthPalateLongitudinalDepth':mouth_depth,'lowerFloorCenterRecessBelowInnerRim':floor_recess,'openLowerLipDropBelowRearPalate':opening_drop,'measurementScope':'Surface distance on closed split hull vertices and combined triangle area; outward parity/nearest-surface checks on added mouth vertices. Not a continuous Hausdorff proof or silhouette pixel comparison.'}
report['islandSignature']={'source':island_source_hash,'candidate':island_candidate_hash,'identical':island_source_hash==island_candidate_hash,'scope':'73 original n102–n174 nodes: IDs, parents, local Blender matrix_basis, exact mesh vertices and face indices; direct independent read of both saved Blend files.'}
report['GLBMaterialCheck']={'originalMaterialsChecked':material_count,'maxLinearBaseColorOpacityError':max_material_error,'scope':'Against original source snapshot, including non-vertex-colored eyes, tubercles and moss; engine toon shading parity is not asserted.'}
(ART/'validation-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
