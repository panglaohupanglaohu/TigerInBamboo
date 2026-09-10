"""Age the actual seed-811 v2 GLB with coherent face colors, then reimport.
No Web/scene edits. Bark COLOR_0 is linear; seven sRGB swatches are converted
once. Source v1 and the v2 geometry-pass GLB are immutable inputs.
"""
import bpy,json,math,hashlib,struct
from pathlib import Path
from mathutils import Vector
from collections import Counter
B=Path(__file__).resolve().parents[2];OUT=B/'assets/models/optimized/saihoji-pines-v2/811';EV=B/'artifacts/pipeline/saihoji-pine-v2-811'
INPUT=OUT/'ancient-pine-811-v2-lod0.glb';FINAL=OUT/'ancient-pine-811-v2-aged.glb'
CONTRACT=B/'assets/models/optimized/saihoji-pines-v1/811/placement-contract.json'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source_hash=sha(INPUT);contract=json.loads(CONTRACT.read_text());segments=contract['originalBranchCenterlines']
for s in segments:s['a']=Vector(s['a']);s['b']=Vector(s['b'])
COLORS=['514737','5c503e','685b48','766650','85735b','938169','a18f76']
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
PALETTE=[tuple(linear(int(c[i:i+2],16)/255) for i in (0,2,4))+(1,) for c in COLORS]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(INPUT))
scene=bpy.context.scene;nodes={o.get('three_node_id'):o for o in scene.objects if o.get('three_node_id')};root=nodes['n0']
bpy.context.view_layer.update();counts=Counter()
def closest_segment(p):
 best=None;distance=1e9
 for s in segments:
  d=s['b']-s['a'];t=max(0,min(1,(p-s['a']).dot(d)/max(d.length_squared,1e-10)));center=s['a']+d*t;dist=(p-center).length
  if dist<distance:distance=dist;best=(s,center)
 return best
for sid in ['n8','n9']:
 o=nodes[sid];mesh=o.data;transform=root.matrix_world.inverted()@o.matrix_world
 # Each polygon receives one flat color; longitudinal sectors follow its
 # authored branch axis, preserving coherent grooves across adjacent facets.
 attr=mesh.color_attributes.new(name='BarkAgeColor',type='FLOAT_COLOR',domain='CORNER');mesh.color_attributes.active_color=attr
 mesh.update()
 for poly in mesh.polygons:
  p=transform@poly.center;s,center=closest_segment(p);axis=(s['b']-s['a']).normalized()
  dominant=max(range(3),key=lambda i:abs(axis[i]))
  if axis[dominant]<0:axis=-axis
  ref=Vector((1,0,0)) if abs(axis.x)<.8 else Vector((0,1,0));u=axis.cross(ref).normalized();v=axis.cross(u).normalized()
  radial=p-center;theta=math.atan2(radial.dot(v),radial.dot(u))
  groove=math.cos(theta*6+.32*math.sin(p.z*1.8))
  # Radial sector (not each polygon's noisy normal) keeps the painted band
  # continuous along the limb. Narrow dark groove, broad grey-brown planes.
  ridge=radial.normalized().dot(Vector((-.48,-.70,.34)).normalized())
  if groove>.92:index=0 if groove>.994 else 1
  elif groove>.65:index=2
  elif groove<-.80:index=6 if ridge>.93 else 5 if ridge>.70 else 4
  else:index=3
  counts[COLORS[index]]+=1
  for loop in poly.loop_indices:attr.data[loop].color=PALETTE[index]
 mesh.update()
 mat=bpy.data.materials.new('PineV2_AgedBark_'+sid);mat.use_nodes=True
 mat['three_uuid']='m0' if sid=='n8' else 'm1';mat['bark_palette_srgb']=json.dumps(COLORS);mat['bark_color_space']='linear vertex COLOR_0 × white base';mat.diffuse_color=(1,1,1,1)
 bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(1,1,1,1);bsdf.inputs['Roughness'].default_value=.95
 color=mat.node_tree.nodes.new('ShaderNodeVertexColor');color.layer_name='BarkAgeColor';mat.node_tree.links.new(color.outputs['Color'],bsdf.inputs['Base Color'])
 mesh.materials.clear();mesh.materials.append(mat)
 for poly in mesh.polygons:poly.material_index=0
 o['bark_revision']='seven coherent face colors, not random noise or lighting-only preview'
root['candidate_id']='saihoji-pines-v2-aged';root['source_seed']=811
for o in scene.objects:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(FINAL),export_format='GLB',use_selection=True,export_yup=True,export_extras=True)

# Read the actual portable buffer, not only Blender's color attribute.
raw=FINAL.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);binary=raw[28+length:]
def values(i):
 a=doc['accessors'][i];view=doc['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']];size=struct.calcsize(fmt)*n;offset=view.get('byteOffset',0)+a.get('byteOffset',0);out=[]
 for j in range(a['count']):
  val=struct.unpack_from('<'+fmt*n,binary,offset+j*view.get('byteStride',size))
  if a.get('normalized'):val=tuple(x/(65535 if a['componentType']==5123 else 255) for x in val)
  out.append(val)
 return out
def triangle_fingerprints(path):
 global doc,binary
 saved_doc,saved_binary=doc,binary
 data=path.read_bytes();size=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+size]);binary=data[28+size:];result={}
 for node in doc['nodes']:
  if 'mesh' not in node:continue
  sid=node.get('extras',{}).get('three_node_id');p=doc['meshes'][node['mesh']]['primitives'][0];positions=values(p['attributes']['POSITION']);indices=[v[0] for v in values(p['indices'])]
  triangles=[]
  for j in range(0,len(indices),3):triangles.append(tuple(sorted(tuple(round(c,5) for c in positions[k]) for k in indices[j:j+3])))
  result[sid]=hashlib.sha256(repr(sorted(triangles)).encode()).hexdigest()
 doc,binary=saved_doc,saved_binary;return result
geometry_before=triangle_fingerprints(INPUT);geometry_after=triangle_fingerprints(FINAL)
assert geometry_before==geometry_after,(geometry_before,geometry_after)
checks=[]
for node in doc['nodes']:
 if node.get('extras',{}).get('three_node_id') not in ['n8','n9']:continue
 primitive=doc['meshes'][node['mesh']]['primitives'][0];assert 'COLOR_0' in primitive['attributes']
 colors=values(primitive['attributes']['COLOR_0']);unique={tuple(round(v,5) for v in c[:3]) for c in colors}
 error=max(min(max(abs(a-b) for a,b in zip(c[:3],p[:3])) for p in PALETTE) for c in colors)
 factor=doc['materials'][primitive['material']]['pbrMetallicRoughness'].get('baseColorFactor',[1,1,1,1])
 assert max(abs(v-1) for v in factor)<1e-6 and error<2e-5 and len(unique)>=5,(factor,error,len(unique))
 checks.append({'node':node['extras']['three_node_id'],'uniqueColors':len(unique),'maxLinearPaletteError':error,'baseColorFactor':factor,'colorAccessorCount':len(colors)})

# Render only a fresh reimport of the delivered GLB with unchanged review lights.
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(FINAL));sc=bpy.context.scene
actual={o.get('three_node_id'):o for o in sc.objects if o.get('three_node_id')};bpy.context.view_layer.update()
camera_report=EV/'user-round-1/report.json'
if not camera_report.exists():camera_report=EV/'report.json'
base_report=json.loads(camera_report.read_text());full=next(r for r in base_report['renders'] if r['state']=='v2' and r['view']=='full');center=Vector(full['target']);span=full['ortho']/1.10;direction=Vector((3,-5,1.7)).normalized()
sc.render.engine='CYCLES';sc.cycles.samples=24;sc.render.resolution_x=900;sc.render.resolution_y=900;sc.render.resolution_percentage=100;sc.view_settings.view_transform='AgX'
world=bpy.data.worlds.new('Same actual GLB review world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.33,.37,.39,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65;sc.world=world
for name,offset,energy,size in [('Key',(-4,-5,6),1100,4),('Fill',(4,-1,3),500,4),('Rim',(1,4,5),850,3)]:
 ld=bpy.data.lights.new(name,'AREA');lamp=bpy.data.objects.new(name,ld);sc.collection.objects.link(lamp);lamp.location=center+Vector(offset);lamp.rotation_euler=(center-lamp.location).to_track_quat('-Z','Y').to_euler();ld.energy=energy;ld.size=size
cd=bpy.data.cameras.new('Same review camera');cam=bpy.data.objects.new('Same review camera',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.type='ORTHO'
views=[('full',center,full['ortho']),('trunk',actual['n0'].matrix_world@Vector((.35,0,1.60)),2.9),('root',actual['n0'].matrix_world@Vector((0,0,.40)),1.7)]
renders=[]
for name,target,ortho in views:
 cam.location=target+direction*span*3;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=ortho;sc.render.filepath=str(EV/f'v2-aged-{name}.png');bpy.ops.render.render(write_still=True)
 renders.append({'view':name,'path':str(Path(sc.render.filepath).relative_to(B)),'camera':list(cam.location),'target':list(target),'ortho':ortho})
blend=OUT/'ancient-pine-811-v2-aged.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend))
assert sha(INPUT)==source_hash
report={'seed':811,'scope':'Single seed 811 actual Blender v2 geometry plus exported face-color aging. No Web/Godot or batch integration.',
 'inputGeometryGlb':str(INPUT.relative_to(B)),'inputGeometrySHA256':source_hash,'sourceGeometryUnchangedByColorPass':True,'actualTriangleFingerprintsBefore':geometry_before,'actualTriangleFingerprintsAfter':geometry_after,
 'iteration':'user-round-2','physicalBarkNoiseRemoved':True,
 'paletteSRGB':['#'+c for c in COLORS],'paletteLinear':PALETTE,'method':'Seven face-flat related colors: gray-brown ground, coherent longitudinal dark grooves and pale facet ridges; no random per-face noise.',
 'faceCounts':dict(counts),'actualGlbColorChecks':checks,'glb':str(FINAL.relative_to(B)),'glbSHA256':sha(FINAL),'blend':str(blend.relative_to(B)),'blendSHA256':sha(blend),'generatorSHA256':sha(Path(__file__)),
 'renders':renders,'runtimeContract':'Bark baseColorFactor WHITE and vertexColors true; preserve COLOR_0. Leaves keep current Web target factors. Do not overwrite bark with solid palette.',
 'limitations':['Only one hero seed','Portable colors verified; actual visual review still required','Crown geometry pass is separate and retains its original anchor contracts','No runtime replacement in this task']}
(EV/'bark-color-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('AGED_PINE_GLB_DONE '+json.dumps({'actualGlbChecks':checks,'inputUnchanged':True}),flush=True)
