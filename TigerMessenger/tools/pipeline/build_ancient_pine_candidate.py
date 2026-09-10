"""Original ancient pine candidate; Blender --background --python this_file [-- --audit]."""
import bpy,bmesh,math,json,hashlib,sys
from pathlib import Path
from mathutils import Vector,Matrix
BASE=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
OUT=BASE/'assets/models/optimized/ancient-pine-v1';EV=BASE/'artifacts/pipeline/ancient-pine-v1'
OUT.mkdir(parents=True,exist_ok=True);EV.mkdir(parents=True,exist_ok=True)
SOURCE=BASE/'assets/models/originals/blender-r3/pine.blend';SNAPSHOT=BASE/'assets/models/originals/pine.source.json'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before_hashes={'blend':sha(SOURCE),'snapshot':sha(SNAPSHOT)}
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
source_nodes={o.get('three_node_id'):o for o in bpy.data.objects if o.get('three_node_id')}
source_scene=bpy.context.scene
rows=[]
for sid,o in source_nodes.items():
 rows.append({'id':sid,'name':o.name,'parent':o.parent.get('three_node_id')if o.parent else None,'type':o.type,'vertices':len(o.data.vertices)if o.type=='MESH'else 0,'triangles':sum(len(p.vertices)-2 for p in o.data.polygons)if o.type=='MESH'else 0,'hidden':o.hide_render,'materials':[m.name for m in o.data.materials]if o.type=='MESH'else []})
(EV/'source-audit.json').write_text(json.dumps({'hashes':before_hashes,'nodes':rows},indent=2)+'\n')
print(json.dumps(rows))
if '--audit' in sys.argv:sys.exit(0)
from collections import Counter,defaultdict
VISIBLE=['n8','n9','n10','n11','n12']
def triangles(o):return sum(len(p.vertices)-2 for p in o.data.polygons)if o.type=='MESH'else 0
original_count=sum(triangles(source_nodes[s])for s in VISIBLE)

def clone_scene(name,originals):
 scene=bpy.data.scenes.new(name);nodes={}
 for sid,o in originals.items():
  c=o.copy()
  if o.type=='MESH':c.data=o.data.copy()
  scene.collection.objects.link(c);nodes[sid]=c
 for sid,o in originals.items():
  nodes[sid].parent=nodes.get(o.parent.get('three_node_id'))if o.parent else None
  nodes[sid].matrix_parent_inverse=o.matrix_parent_inverse.copy()
 return scene,nodes
scene,nodes=clone_scene('Ancient Pine V1 Candidate LOD0',source_nodes);bpy.context.window.scene=scene
# Exportable materials copied from the source JSON, never the archive shader.
# ObjectInfo color links from the old Blender preview are not glTF portable.
palette=json.loads(SNAPSHOT.read_text())['materials']
for sid in VISIBLE:
 target=nodes[sid]
 for mi,old in enumerate(list(target.data.materials)):
  mid=old.get('three_uuid');src=palette[mid];material=bpy.data.materials.new('PineV1_Source_'+mid);material.use_nodes=True
  material['three_uuid']=mid;material['three_source']=json.dumps(src);material['candidate_palette_source']='pine.source.json'
  bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*src['color'],src.get('opacity',1));bsdf.inputs['Metallic'].default_value=0;bsdf.inputs['Roughness'].default_value=.85
  target.data.materials[mi]=material
root=nodes['n0'];root['candidate_id']='ancient-pine-v1';root['source_asset_id']='pine';root['source_factory']='createAncientPineTree';root['optimization_scope']='original segment junctions and layered needle crowns; static candidate, no runtime integration';root['source_blend_sha256']=before_hashes['blend']

def local_vertices(o):
 transform=source_nodes['n0'].matrix_world.inverted()@o.matrix_world
 return [transform@v.co for v in o.data.vertices]
segments=[]
for sid in ['n8','n9']:
 verts=local_vertices(source_nodes[sid]);assert len(verts)%84==0
 for start in range(0,len(verts),84):
  vv=verts[start:start+84];counts=Counter(tuple(round(x,6)for x in v)for v in vv)
  centers=[Vector(v)for v,count in counts.items()if count==7];assert len(centers)==2,(sid,start,counts)
  a,b=centers;axis=(b-a).normalized();ra=max((v-a-axis*(v-a).dot(axis)).length for v in vv if abs((v-a).dot(axis))<1e-4);rb=max((v-b-axis*(v-b).dot(axis)).length for v in vv if abs((v-b).dot(axis))<1e-4)
  segments.append({'a':a,'b':b,'ra':ra,'rb':rb,'sourceID':sid,'sourceSegment':start//84})

def temp_mesh(name,verts,faces):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);return o

def combined(ids):
 verts=[];faces=[]
 for sid in ids:
  o=source_nodes[sid];vv=local_vertices(o);off=len(verts);verts.extend(vv);faces.extend(tuple(i+off for i in p.vertices)for p in o.data.polygons)
 return verts,faces

def remesh_and_reduce(obj,voxel,budget,smooth_iterations=2):
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 mod=obj.modifiers.new('Fuse authored intersections','REMESH');mod.mode='VOXEL';mod.voxel_size=voxel;mod.use_smooth_shade=False;bpy.ops.object.modifier_apply(modifier=mod.name)
 if smooth_iterations:
  mod=obj.modifiers.new('Small junction fairing','SMOOTH');mod.factor=.55;mod.iterations=smooth_iterations;bpy.ops.object.modifier_apply(modifier=mod.name)
 count=triangles(obj)
 mod=obj.modifiers.new('Bounded silhouette budget','DECIMATE');mod.ratio=min(1,budget/max(count,1));mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 for p in obj.data.polygons:p.use_smooth=False
 obj.data.update()
 return count

# Re-loft the exact archived cylinder centerlines with shared joint radii and
# angle-bisector rings. The original factory restarts its taper at every segment,
# leaving abrupt caps; a common ring removes that discontinuity without moving
# any authored centerline endpoint or attaching a new branch.
source_wood,_=combined(['n8','n9']);ground=min(v.z for v in source_wood)
joints={}
for seg in segments:
 for key,radius in [('a',seg['ra']),('b',seg['rb'])]:
  p=seg[key];k=tuple(round(v,5)for v in p)
  if k not in joints:joints[k]={'point':p,'radius':radius,'degree':0,'radii':[],'axes':[]}
  joints[k]['radius']=max(joints[k]['radius'],radius);joints[k]['degree']+=1;joints[k]['radii'].append(radius)
  joints[k]['axes'].append((seg['b']-seg['a']).normalized())
verts=[];faces=[]
for seg in segments:
 axis=(seg['b']-seg['a']).normalized();rings=[]
 for key,radius in [('a',seg['ra']),('b',seg['rb'])]:
  p=seg[key];joint=joints[tuple(round(v,5)for v in p)];normal=axis
  if joint['degree']>=2 and radius>=joint['radius']*.6:
   ranked=sorted(zip(joint['radii'],joint['axes']),key=lambda x:x[0],reverse=True)[:2];axes=[a for r,a in ranked];normal=(axes[0]+axes[1]*(1 if axes[0].dot(axes[1])>=0 else -1)).normalized();radius=sum(r for r,a in ranked)/2
  # Canonical ring frame is identical on both sides of each shared joint.
  component=max(range(3),key=lambda i:abs(normal[i]))
  if normal[component]<0:normal=-normal
  ref=Vector((1,0,0))if abs(normal.x)<.8 else Vector((0,1,0));u=normal.cross(ref).normalized();v=normal.cross(u).normalized()
  ring=[]
  for i in range(7):
   q=p+radius*(u*math.cos(2*math.pi*i/7)+v*math.sin(2*math.pi*i/7));q.z=max(q.z,ground);ring.append(len(verts));verts.append(q)
  if normal.dot(axis)<0:ring.reverse()
  rings.append(ring)
 for i in range(7):faces.append((rings[0][i],rings[0][(i+1)%7],rings[1][(i+1)%7],rings[1][i]))
 faces.extend([tuple(reversed(rings[0])),tuple(rings[1])])
wood=temp_mesh('TemporaryJoinedOriginalWood',verts,faces)
bm=bmesh.new();bm.from_mesh(wood.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(wood.data);bm.free()
wood_intermediate=remesh_and_reduce(wood,.012,1550,4)
# Remove detached remesh/decimation specks of fewer than four faces only.
def remove_tiny_islands(o):
 bm=bmesh.new();bm.from_mesh(o.data);todo=set(bm.verts)
 while todo:
  stack=[todo.pop()];island=set(stack)
  while stack:
   v=stack.pop()
   for edge in v.link_edges:
    n=edge.other_vert(v)
    if n in todo:todo.remove(n);island.add(n);stack.append(n)
  ff={f for v in island for f in v.link_faces}
  if len(ff)<4:bmesh.ops.delete(bm,geom=list(island),context='VERTS')
 bm.to_mesh(o.data);bm.free();o.data.validate();o.data.update()
remove_tiny_islands(wood);wood_master=wood.data.copy()

def point_segment_distance(p,s):
 d=s['b']-s['a'];t=max(0,min(1,(p-s['a']).dot(d)/d.length_squared));return (p-s['a']-d*t).length-(s['ra']+(s['rb']-s['ra'])*t)

def split_to_source(obj,ids,classifier,target_nodes=None):
 target_nodes=target_nodes or nodes
 selections={sid:[]for sid in ids}
 for face in obj.data.polygons:selections[classifier(face)].append(face)
 for sid,ff in selections.items():
  mapping={};vv=[];polys=[];target=target_nodes[sid];to_local=target.matrix_basis.inverted()
  for face in ff:
   ix=[]
   for old in face.vertices:
    if old not in mapping:mapping[old]=len(vv);vv.append(to_local@obj.data.vertices[old].co)
    ix.append(mapping[old])
   polys.append(ix)
  mesh=bpy.data.meshes.new('PineV1_'+sid);mesh.from_pydata(vv,[],polys);mesh.update()
  for material in target.data.materials:mesh.materials.append(material)
  target.data=mesh;target['candidate_geometry']='ancient-pine-v1';target['source_node_id']=sid
 bpy.data.objects.remove(obj,do_unlink=True)
split_to_source(wood,['n8','n9'],lambda face:min(segments,key=lambda s:abs(point_segment_distance(face.center,s)))['sourceID'])

# Recover each original leaf clump from its 80-triangle primitive, preserve its
# center/branch assignment, then flatten and fuse overlaps into seven crown pads.
verts=[];faces=[];clumps=[]
for sid in ['n10','n11','n12']:
 o=source_nodes[sid];vv=local_vertices(o);assert len(vv)%240==0
 for start in range(0,len(vv),240):
  chunk=vv[start:start+240];center=sum(chunk,Vector())/len(chunk);clumps.append(center)
  for v in chunk:
   d=v-center;verts.append(center+Vector((d.x*1.035,d.y*1.035,d.z*.57)))
 off=len(verts)-len(vv);faces.extend(tuple(i+off for i in p.vertices)for p in o.data.polygons)
foliage=temp_mesh('TemporaryFusedOriginalCrowns',verts,faces)
leaf_intermediate=remesh_and_reduce(foliage,.025,2050,1);leaf_master=foliage.data.copy()
# Reuse exactly the original dark/mid/light greens: dark underside, mid edge,
# lit upper planes. These source IDs are material batches, not animated joints.
split_to_source(foliage,['n10','n11','n12'],lambda f:'n10'if f.normal.z<-.13 else'n12'if f.normal.z>.62 else'n11')

# Shared local placement, hierarchy and original source IDs stay intact.
matrix_error=0.0
for sid,o in nodes.items():
 delta=max(abs(o.matrix_basis[i][j]-source_nodes[sid].matrix_basis[i][j])for i in range(4)for j in range(4));matrix_error=max(matrix_error,delta);assert delta<1e-6,(sid,delta)
 assert (o.parent.get('three_node_id')if o.parent else None)==(source_nodes[sid].parent.get('three_node_id')if source_nodes[sid].parent else None)
 o['source_visibility_preserved']=o.hide_render==source_nodes[sid].hide_render
 root['collideRadius']=.58

lods=[(scene,nodes)]
for index,ratio in [(1,.62),(2,.34)]:
 ls,ln=clone_scene('Ancient Pine V1 Candidate LOD'+str(index),nodes);bpy.context.window.scene=ls
 # Decimate each unified surface before restoring its original material batches;
 # independent per-material decimation would open cracks on shared boundaries.
 for master,ids,classifier in [(wood_master,['n8','n9'],lambda f:min(segments,key=lambda t:abs(point_segment_distance(f.center,t)))['sourceID']),(leaf_master,['n10','n11','n12'],lambda f:'n10'if f.normal.z<-.13 else'n12'if f.normal.z>.62 else'n11')]:
  o=bpy.data.objects.new('TemporaryUnifiedLOD',master.copy());ls.collection.objects.link(o);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  mod=o.modifiers.new('LOD silhouette reduction','DECIMATE');mod.ratio=ratio;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name);remove_tiny_islands(o)
  split_to_source(o,ids,classifier,ln)
 ln['n0']['candidate_lod']=index;lods.append((ls,ln))

def export_lod(scene,nodes,index):
 # Keep all 17 source IDs, but hidden stale outline geometry becomes metadata-
 # only empties in this export scene so it cannot leak into a runtime render.
 export=bpy.data.scenes.new('Ancient Pine V1 GLB LOD'+str(index));copies={}
 for sid,o in nodes.items():
  if o.hide_render and o.type=='MESH':
   c=bpy.data.objects.new(o.name,None)
   for k,v in o.items():c[k]=v
   c['candidate_hidden_source_geometry']=True;c['original_source_type']='Mesh'
  else:c=o.copy()
  export.collection.objects.link(c);copies[sid]=c
 for sid,o in nodes.items():
  c=copies[sid];c.parent=copies.get(o.parent.get('three_node_id'))if o.parent else None;c.matrix_parent_inverse=o.matrix_parent_inverse.copy();c.matrix_basis=o.matrix_basis.copy();c.hide_render=False;c.hide_viewport=False
 bpy.context.window.scene=export
 for o in export.objects:o.select_set(True)
 bpy.context.view_layer.objects.active=copies['n0']
 path=OUT/('ancient-pine-v1-lod%d.glb'%index)
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True)
 return {'lod':index,'triangles':sum(triangles(nodes[s])for s in VISIBLE),'visibleMeshes':5,'glb':str(path.relative_to(BASE)),'sha256':sha(path),'bytes':path.stat().st_size}
metrics=[export_lod(ls,ln,i)for i,(ls,ln)in enumerate(lods)]
import struct
material_checks=[]
for row in metrics:
 raw=(BASE/row['glb']).read_bytes();doc=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
 checks=[]
 for mat in doc['materials']:
  mid=mat['extras']['three_uuid'];expected=palette[mid]['color']+[palette[mid].get('opacity',1)];actual=mat['pbrMetallicRoughness'].get('baseColorFactor',[1,1,1,1]);err=max(abs(a-b)for a,b in zip(expected,actual));assert err<1e-6,(mid,actual,expected)
  assert mat.get('alphaMode','OPAQUE')=='OPAQUE';checks.append({'sourceMaterial':mid,'baseColorFactor':actual,'maxError':err,'alphaMode':mat.get('alphaMode','OPAQUE')})
 material_checks.append({'lod':row['lod'],'materials':checks})
roundtrip=bpy.data.scenes.new('Ancient Pine V1 Actual GLB Reimport');bpy.context.window.scene=roundtrip
bpy.ops.import_scene.gltf(filepath=str(BASE/metrics[0]['glb']))
roundtrip_nodes={o.get('three_node_id'):o for o in roundtrip.objects if o.get('three_node_id')}
assert set(roundtrip_nodes)==set(source_nodes)


# Two-sided same-camera review: source and candidate get the same area lights,
# background, exposure and cameras. Framing is computed on their union once.
def all_points(ns):
 return [o.matrix_world@v.co for sid,o in ns.items()if sid in VISIBLE for v in o.data.vertices]
for sc,ns in [(source_scene,source_nodes),(scene,nodes)]:
 bpy.context.window.scene=sc;bpy.context.view_layer.update()
points=all_points(source_nodes)+all_points(nodes);lo=Vector(tuple(min(p[i]for p in points)for i in range(3)));hi=Vector(tuple(max(p[i]for p in points)for i in range(3)));center=(lo+hi)/2;span=max(hi-lo)
direction=Vector((3,-4,2.2)).normalized()
view_specs=[('full-three-quarter',center,span*1.16),('branch-junction',source_nodes['n0'].matrix_world@segments[3]['a'],1.65),('root-detail',source_nodes['n0'].matrix_world@Vector((0,0,.23)),1.9)]
review=[]
for sc,ns,label in [(source_scene,source_nodes,'before'),(scene,nodes,'after'),(roundtrip,roundtrip_nodes,'glb-roundtrip')]:
 bpy.context.window.scene=sc;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.render.resolution_x=1200;sc.render.resolution_y=1200;sc.render.resolution_percentage=100;sc.view_settings.view_transform='AgX'
 world=bpy.data.worlds.new('PineReviewWorld_'+label);world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.34,.38,.41,1);world.node_tree.nodes['Background'].inputs[1].default_value=.7;sc.world=world
 for n,offset,energy,size in [('Key',(-3,-4,6),1100,4),('Fill',(4,-1,3),700,4),('Rim',(1,4,5),1000,3)]:
  ld=bpy.data.lights.new('PineReview'+n,'AREA');lamp=bpy.data.objects.new('PineReview'+n,ld);sc.collection.objects.link(lamp);lamp.location=center+Vector(offset);lamp.rotation_euler=(center-lamp.location).to_track_quat('-Z','Y').to_euler();ld.energy=energy;ld.size=size
 cd=bpy.data.cameras.new('PineReviewCamera');cam=bpy.data.objects.new('PineReviewCamera',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.type='ORTHO'
 for view,target,ortho in view_specs:
  cam.location=target+direction*span*3;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=ortho;sc.render.filepath=str(EV/(label+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
  review.append({'state':label,'view':view,'path':str(Path(sc.render.filepath).relative_to(BASE)),'cameraPosition':list(cam.location),'target':list(target),'orthoScale':ortho})

# Save the candidate project with original reference and explicit LOD scenes.
bpy.context.window.scene=scene
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ancient-pine-v1.blend'))
assert before_hashes=={'blend':sha(SOURCE),'snapshot':sha(SNAPSHOT)}
report={'candidateBlend':'assets/models/optimized/ancient-pine-v1/ancient-pine-v1.blend','candidateBlendSha256':sha(OUT/'ancient-pine-v1.blend'),'generatorSha256':sha(Path(__file__)),'status':'Blender candidate optimized; Web/Godot not integrated; awaiting visual review','sourceAsset':'pine','factory':'src/assets/ancient.js:createAncientPineTree','sourceHashesBefore':before_hashes,'sourceHashesAfter':{'blend':sha(SOURCE),'snapshot':sha(SNAPSHOT)},'originalVisibleTriangles':original_count,'lods':metrics,'nodesPreserved':len(nodes),'sourceParentsExact':True,'sourceLocalMatrixMaxError':matrix_error,'extraRuntimeNodes':[],'metadataOnlyExportNodes':['n13','n14','n15','n16'],'originalAuthoredWoodSegments':len(segments),'sharedJunctionsFilled':sum(v['degree']>=2 for v in joints.values()),'woodContinuityMethod':'exact original 37 segment endpoints; shared angle-bisector rings and averaged incident radii, voxel union and local fairing','originalLeafClumpCentersRetained':len(clumps),'sourcePaletteUnchanged':True,'actualGlbMaterialChecks':material_checks,'glbRoundtripRendered':True,'materialAssignmentChange':'same two bark colors nearest source segment; original 3 leaf greens redistributed dark underside/mid edge/light top','placement':{'rootSourceID':'n0','rootLocalMatrix':list(sum((list(row)for row in source_nodes['n0'].matrix_basis),[])),'blenderUp':'+Z','gltfUp':'+Y','sourceScaleAndYawRetained':True,'collideRadius':.58,'animation':'original static merged tree; no animation added'},'review':review,'skills':['threejs-game-director','threejs-aaa-graphics-builder (authoring-recipes, technical-art)'],'limitations':['LOD variants exported, distance switching not wired','Source outline archive nodes retained; hidden obsolete outline geometry intentionally not rendered in candidate GLBs','No separate moss/rock entourage added; original root positions retained','Not a new generic pine or a replacement game factory']}
(EV/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'originalTriangles':original_count,'lods':metrics,'originalHashesUnchanged':True}))
