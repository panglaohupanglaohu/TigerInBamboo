"""One actual Blender iteration: seed 811, not a batch or runtime replacement.
Run Blender --background --python this script. Original generators and sources
remain unchanged; their verified source extraction is reused in memory.
"""
import bpy, json, hashlib, math
from pathlib import Path
from mathutils import Vector
B=Path(__file__).resolve().parents[2]
OUT=B/'assets/models/optimized/saihoji-pines-v2/811'
EV=B/'artifacts/pipeline/saihoji-pine-v2-811'
OUT.mkdir(parents=True,exist_ok=True);EV.mkdir(parents=True,exist_ok=True)
GEN=B/'tools/pipeline/build_ancient_pine_candidate.py'
SOURCE=B/'assets/models/originals/saihoji-pines-r1/blender-r3/ancient-pine-811.blend'
SNAP=B/'assets/models/originals/saihoji-pines-r1/ancient-pine-811.source.json'
OLD=B/'assets/models/optimized/saihoji-pines-v1/811/ancient-pine-811-lod0.glb'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
original_hashes={str(p.relative_to(B)):sha(p) for p in [GEN,SOURCE,SNAP,OLD]}
code=GEN.read_text().split('# Two-sided same-camera review:')[0]
code=code.replace("OUT=BASE/'assets/models/optimized/ancient-pine-v1';EV=BASE/'artifacts/pipeline/ancient-pine-v1'",f'OUT=Path({str(OUT)!r});EV=Path({str(EV)!r})')
code=code.replace("SOURCE=BASE/'assets/models/originals/blender-r3/pine.blend';SNAPSHOT=BASE/'assets/models/originals/pine.source.json'",f'SOURCE=Path({str(SOURCE)!r});SNAPSHOT=Path({str(SNAP)!r})')
code=code.replace('print(json.dumps(rows))','')
code=code.replace("root['candidate_id']='ancient-pine-v1'","root['candidate_id']='saihoji-pines-v2';root['source_seed']=811")
code=code.replace("'ancient-pine-v1-lod%d.glb'","'ancient-pine-811-v2-lod%d.glb'")
code=code.replace('for index,ratio in [(1,.62),(2,.34)]:','for index,ratio in []:')
# Keep authored clump centers, but recover substantial crown volume instead of
# v1's 0.57 vertical flatten. Union gives layered scalloped cloud silhouettes.
code=code.replace('d.x*1.035,d.y*1.035,d.z*.57','d.x*1.20,d.y*1.20,d.z*1.00')
code=code.replace('remesh_and_reduce(foliage,.025,2050,1)','remesh_and_reduce(foliage,.025,5600,1)')
code=code.replace('remesh_and_reduce(wood,.012,1550,4)','remesh_and_reduce(wood,.012,3400,4)')
# No physical bark noise: aging is carried by the separate face-color pass.
code=code.replace('remove_tiny_islands(wood);wood_master=wood.data.copy()', '''remove_tiny_islands(wood)
# Split only large longitudinal facets: no displacement/noise. The color pass
# can now form narrow connected wood planes instead of a few giant triangles.
bm=bmesh.new();bm.from_mesh(wood.data)
long_edges=[e for e in bm.edges if e.calc_length()>.19]
bmesh.ops.subdivide_edges(bm,edges=long_edges,cuts=3,use_grid_fill=True)
bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(wood.data);bm.free();wood.data.update()
wood_master=wood.data.copy()''')
code=code.replace("wood=temp_mesh('TemporaryJoinedOriginalWood',verts,faces)","""# Flared buttress blends existing root spokes into the trunk; no new root
# direction or moved endpoint. The scalloped base shares the source ground.
base_rings=[]
for z,radius in [(ground,.46),(.07,.38),(.24,.29),(.46,.235)]:
 ring=[]
 for k in range(18):
  angle=k*math.tau/18
  radius_k=radius*(1+.16*math.cos(6*angle)+.035*math.sin(5*angle))
  ring.append(len(verts));verts.append(Vector((math.cos(angle)*radius_k,math.sin(angle)*radius_k,z)))
 base_rings.append(ring)
for a,b in zip(base_rings,base_rings[1:]):
 for k in range(18):faces.append((a[k],a[(k+1)%18],b[(k+1)%18],b[k]))
faces.extend([tuple(reversed(base_rings[0])),tuple(base_rings[-1])])
# Tapered root webs follow the six existing authored root directions. They
# broaden the thin source spokes into low buttresses without new radial roots.
root_ends=[]
for segment in segments:
 for point in [segment['a'],segment['b']]:
  if point.z<.10 and math.hypot(point.x,point.y)>.55 and all((point-q).length>.12 for q in root_ends):root_ends.append(point)
for endpoint in root_ends:
 axis=Vector((endpoint.x,endpoint.y,0)).normalized();side=Vector((-axis.y,axis.x,0));rings=[]
 for t,width,height in [(0,.15,.30),(.45,.11,.14),(.88,.045,.060),(1,.018,.028)]:
  center=endpoint*t
  underside=ground*(1-t)**2
  points=[center-side*width+Vector((0,0,underside)),center+side*width+Vector((0,0,underside)),center+side*width*.50+Vector((0,0,height)),center-side*width*.50+Vector((0,0,height))]
  ring=[]
  for point in points:ring.append(len(verts));verts.append(point)
  rings.append(ring)
 for a,b in zip(rings,rings[1:]):
  for k in range(4):faces.append((a[k],a[(k+1)%4],b[(k+1)%4],b[k]))
 faces.extend([tuple(reversed(rings[0])),tuple(rings[-1])])
wood=temp_mesh('TemporaryJoinedOriginalWood',verts,faces)""")
# Material changes are explicit, separate from geometric changes. Export
# actual Principled factors, never a Blender-only ObjectInfo preview link.
code=code.replace("palette=json.loads(SNAPSHOT.read_text())['materials']", """palette=json.loads(SNAPSHOT.read_text())['materials']
target_colors=['766958','504a3e','253e2b','446439','72934d']
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
for i,color in enumerate(target_colors):palette['m'+str(i)]['color']=[linear(int(color[j:j+2],16)/255) for j in (0,2,4)]""")
scope={'__file__':str(__file__),'__name__':'__pine_v2_build__'}
exec(compile(code,str(GEN)+' [v2 hero 811]','exec'),scope)
actual=scope['roundtrip'];actual_nodes=scope['roundtrip_nodes'];visible=scope['VISIBLE']
before=bpy.data.scenes.new('V1 actual GLB comparison');bpy.context.window.scene=before
bpy.ops.import_scene.gltf(filepath=str(OLD))
before_nodes={o.get('three_node_id'):o for o in before.objects if o.get('three_node_id')}
# Comparison-only copies: both actual GLBs use the current Web target palette
# under the same renderer so hue does not masquerade as geometry improvement.
for sid in visible:
 for mat in before_nodes[sid].data.materials:
  mid=mat.get('three_uuid')
  if mid in scope['palette']:
   bsdf=mat.node_tree.nodes.get('Principled BSDF')
   if bsdf:bsdf.inputs['Base Color'].default_value=(*scope['palette'][mid]['color'],1)

def points(ns):
 return [o.matrix_world@v.co for sid,o in ns.items() if sid in visible for v in o.data.vertices]
for sc in [before,actual]:bpy.context.window.scene=sc;bpy.context.view_layer.update()
pp=points(before_nodes)+points(actual_nodes)
lo=Vector(tuple(min(p[i] for p in pp) for i in range(3)));hi=Vector(tuple(max(p[i] for p in pp) for i in range(3)))
center=(lo+hi)/2;span=max(hi-lo);direction=Vector((3,-5,1.7)).normalized()
views=[('full',center,span*1.10),('crown',actual_nodes['n0'].matrix_world@Vector((1.55,-.1,2.75)),3.4),('root',actual_nodes['n0'].matrix_world@Vector((0,0,.40)),1.7)]
renders=[]
for label,sc,ns in [('v1',before,before_nodes),('v2',actual,actual_nodes)]:
 bpy.context.window.scene=sc;sc.render.engine='CYCLES';sc.cycles.samples=20
 sc.render.resolution_x=900;sc.render.resolution_y=900;sc.render.resolution_percentage=100
 sc.view_settings.view_transform='AgX'
 world=bpy.data.worlds.new('Pine V2 Review World '+label);world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.33,.37,.39,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65;sc.world=world
 for name,offset,energy,size in [('Key',(-4,-5,6),1100,4),('Fill',(4,-1,3),500,4),('Rim',(1,4,5),850,3)]:
  ld=bpy.data.lights.new(name,'AREA');lamp=bpy.data.objects.new(name,ld);sc.collection.objects.link(lamp);lamp.location=center+Vector(offset);lamp.rotation_euler=(center-lamp.location).to_track_quat('-Z','Y').to_euler();ld.energy=energy;ld.size=size
 cd=bpy.data.cameras.new('Same camera');cam=bpy.data.objects.new('Same camera',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.type='ORTHO'
 for view,target,ortho in views:
  cam.location=target+direction*span*3;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=ortho;sc.render.filepath=str(EV/f'{label}-{view}.png');bpy.ops.render.render(write_still=True)
  renders.append({'state':label,'view':view,'camera':list(cam.location),'target':list(target),'ortho':ortho,'path':str(Path(sc.render.filepath).relative_to(B))})

# Measure actual round-tripped topology after welding the two material batches.
import bmesh
def topology(ns,ids):
 bm=bmesh.new()
 for sid in ids:
  ob=ns[sid];temp=bmesh.new();temp.from_mesh(ob.data);bmesh.ops.transform(temp,matrix=ns['n0'].matrix_world.inverted()@ob.matrix_world,verts=list(temp.verts));tmp=bpy.data.meshes.new('audit');temp.to_mesh(tmp);temp.free();bm.from_mesh(tmp);bpy.data.meshes.remove(tmp)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5)
 todo=set(bm.verts);components=0
 while todo:
  components+=1;stack=[todo.pop()]
  while stack:
   v=stack.pop()
   for edge in v.link_edges:
    other=edge.other_vert(v)
    if other in todo:todo.remove(other);stack.append(other)
 result={'components':components,'boundaryEdges':sum(e.is_boundary for e in bm.edges),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'vertices':len(bm.verts)};bm.free();return result
wood=topology(actual_nodes,['n8','n9']);foliage=topology(actual_nodes,['n10','n11','n12'])
assert wood['components']==1 and wood['boundaryEdges']==0,wood
assert foliage['boundaryEdges']==0,foliage
assert original_hashes=={str(p.relative_to(B)):sha(p) for p in [GEN,SOURCE,SNAP,OLD]}
bpy.context.window.scene=actual
blend=OUT/'ancient-pine-811-v2.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend))
report={'seed':811,'stage':'single Blender v2 hero candidate, actual GLB reimport rendered; NOT Web/Godot integrated or batch complete',
 'reference':'assets/concepts/ancient-pine-target-v1.png','sources':original_hashes,'sourceHashesUnchanged':True,'generatorSHA256':sha(Path(__file__)),
 'geometryChanges':{'clumpCenterInputsRetained':len(scope['clumps']),'originalBranchSegmentsRetained':len(scope['segments']),'verticalClumpFactorFromOriginal':1.00,'v1VerticalFactor':.57,'horizontalClumpFactor':1.20,'woodBudgetBeforeLargeFacetSubdivision':3400,'foliageBudget':5600,'flaredRootUnion':True,'originalRootDirectionWebs':len(scope['root_ends']),'largeFacetSubdivisionEdgeThreshold':.19,'barkReliefMaxLocal':0,'userRequestedRound':2},
 'materialTargetSRGB':['#766958','#504a3e','#253e2b','#446439','#72934d'],'sourcePaletteUnchanged':False,
 'comparisonPalette':'Both v1 and v2 actual GLBs rendered with current Web target palette; v1 material adjustment is preview-only, original v1 GLB untouched',
 'lods':scope['metrics'],'actualGlbWoodTopology':wood,'actualGlbFoliageTopology':foliage,'sourceNodeIdsPreserved':len(actual_nodes),'sourceLocalMatrixMaxError':scope['matrix_error'],
 'blend':str(blend.relative_to(B)),'blendSHA256':sha(blend),'renders':renders,
 'limitations':['One seed only, no world integration','Not a pixel match to reference; low-poly cloud detail and root texture still require visual review','Root/branch/clump input anchors preserved; remeshed surface centroids and vertices intentionally change','No external asset packs or paid generation used']}
(EV/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print('PINE_V2_HERO_DONE '+json.dumps({'triangles':scope['metrics'][0]['triangles'],'wood':wood,'foliage':foliage,'sourcesUnchanged':True}),flush=True)
