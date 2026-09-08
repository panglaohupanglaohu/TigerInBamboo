"""Reproduce v3 from retained v2 .blend; run Blender --background --python this_file.
Only upper helmet rotates; skirt, belt and low belt studs remain byte-for-byte vertex-identical.
Source Three Y-up +Z front becomes +X with +90deg Y; Blender equivalent +90deg Z.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Matrix, Vector
base=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
ev=base/'artifacts/pipeline/roman-armor-v3-direction';ev.mkdir(parents=True,exist_ok=True)
source=base/'assets/models/optimized/roman-armor-v2.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
source_scene=bpy.data.scenes.get('Roman Armor V2 Refined');assert source_scene
scene=bpy.data.scenes.new('Roman Armor V3 Direction');bpy.context.window.scene=scene
root=bpy.data.objects.new('Roman_Armor_V3_Direction_BodyLocal',None);scene.collection.objects.link(root)
root['attachToOriginalNodeId']='n2';root['bodyLocalYUp']=True;root['frontAxis']='+X'
rotation=Matrix.Rotation(math.pi/2,3,'Z');report=[]
for original in source_scene.objects:
 if original.type!='MESH':continue
 assert original.name.startswith(('Helmet_Galea','Skirt_Ten_Separated_Lames','Waist_Belt')), original.name
 obj=original.copy();obj.data=original.data.copy();scene.collection.objects.link(obj);obj.parent=root;obj.matrix_basis=Matrix.Identity(4)
 before=[v.co.copy() for v in obj.data.vertices];upper=set()
 if original.name.startswith('Helmet_Galea'):
  upper={v.index for v in obj.data.vertices if v.co.z>.1}
  assert upper
  for face in obj.data.polygons:
   flags=[i in upper for i in face.vertices];assert all(flags) or not any(flags), 'cut would bisect a face'
  for v in obj.data.vertices:
   if v.index in upper:v.co=rotation@v.co
 obj.data.update()
 lower_unchanged=all(v.co==before[v.index] for v in obj.data.vertices if v.index not in upper)
 assert lower_unchanged
 report.append({'name':obj.name,'vertices':len(obj.data.vertices),'rotatedUpperHelmetVertices':len(upper),'otherVerticesExactlyUnchanged':lower_unchanged})
for o in scene.objects:o.select_set(True)
bpy.context.view_layer.objects.active=root
outglb=base/'godot/assets/art-pilots/roman-armor-v3-direction.glb'
bpy.ops.export_scene.gltf(filepath=str(outglb),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True)
assembly=json.loads((base/'artifacts/pipeline/roman-armor-v2/assembly.json').read_text())
assembly.update(schema='TigerMessenger.roman-armor-v3-direction',resource='res://assets/art-pilots/roman-armor-v3-direction.glb',frontAxis='+X',crestRotationY=math.pi/2,crestRotationDescription='Pre-multiply original local transform by +90 degrees about body-local Y, then apply crestOffset. Original three crest nodes remain children of n2.',scope='upper helmet vertices only rotate +90Y; original crest nodes rotate +90Y at assembly; skirt/belt/lower bronze studs unchanged',sourceBlendSha256=hashlib.sha256(source.read_bytes()).hexdigest())
(ev/'assembly.json').write_text(json.dumps(assembly,indent=2)+'\n')
# Separate context scene shows exact source body/head/crest, never exported as wearable.
context=bpy.data.scenes.new('Roman V3 Direction Original Context');bpy.context.window.scene=context
for o in scene.objects:context.collection.objects.link(o)
src=json.loads((base/'assets/models/originals/supplemental/romanSoldier_gladius_blue.source.json').read_text());nodes={n['id']:n for n in src['nodes']};worlds={}
for n in src['nodes']:
 m=Matrix([n['matrix'][i::4]for i in range(4)]);worlds[n['id']]=worlds[n['parent']]@m if n['parent']else m
inv=worlds['n2'].inverted();rot_y=Matrix.Rotation(math.pi/2,3,'Y')
for id in ['n3','n7','n11','n13','n15']:
 n=nodes[id];g=src['geometries'][n['geometry']];vals=g['attributes']['position']['values'];vv=[]
 for i in range(0,len(vals),3):
  v=inv@worlds[id]@Vector(vals[i:i+3])
  if id in ['n11','n13','n15']:v=rot_y@v;v.y-=.018
  vv.append((v.x,-v.z,v.y))
 ix=g.get('index');ix=ix.get('values')if isinstance(ix,dict)else ix;ix=ix or list(range(len(vv)))
 mesh=bpy.data.meshes.new('SourceContext_'+id);mesh.from_pydata(vv,[],[ix[i:i+3]for i in range(0,len(ix),3)]);mesh.update();o=bpy.data.objects.new('SourceContext_'+id,mesh);context.collection.objects.link(o)
 color=src['materials'][n['materials'][0]]['color'];material=bpy.data.materials.new('SourceContext_'+id);material.diffuse_color=tuple(color)+(1,);material.use_nodes=True;material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=material.diffuse_color;mesh.materials.append(material)
context.render.engine='CYCLES';context.cycles.samples=20;context.render.resolution_x=750;context.render.resolution_y=850;context.render.resolution_percentage=100
context.world=bpy.data.worlds.new('V3_Direction_World');context.world.use_nodes=True;context.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.38,.43,1);context.world.node_tree.nodes['Background'].inputs[1].default_value=.8
camdata=bpy.data.cameras.new('Direction_Camera');cam=bpy.data.objects.new('Direction_Camera',camdata);context.collection.objects.link(cam);context.camera=cam;camdata.type='ORTHO';camdata.ortho_scale=.6
target=Vector((0,0,.20));lampdata=bpy.data.lights.new('Direction_Key','AREA');lamp=bpy.data.objects.new('Direction_Key',lampdata);context.collection.objects.link(lamp);lamp.location=(1,-1,2);lamp.rotation_euler=(target-lamp.location).to_track_quat('-Z','Y').to_euler();lampdata.energy=80;lampdata.size=2
for label,loc in [('front',(1.7,0,.30)),('three-quarter',(1.7,-.9,.40)),('side',(0,-1.7,.30))]:
 cam.location=loc;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();context.render.filepath=str(ev/('direction-'+label+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(base/'assets/models/optimized/roman-armor-v3-direction.blend'))
(ev/'build-report.json').write_text(json.dumps({'meshes':report,'glbSha256':hashlib.sha256(outglb.read_bytes()).hexdigest(),'sourceBlendSha256':assembly['sourceBlendSha256'],'frontAxisBefore':'+Z','frontAxisAfter':'+X','blenderUpperHelmetRotationZDegrees':90,'crestAssemblyRotationYDegrees':90,'contextIncludesOriginalNodes':['n3','n7','n11','n13','n15']},indent=2)+'\n')
print('Direction v3 saved separately. Original v2 files unchanged.')
