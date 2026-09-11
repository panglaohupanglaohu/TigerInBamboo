"""Reuse the approved Roman gladius soldier, frozen in a two-handed sword-rest pose."""
import bpy, math, json, importlib.util, hashlib
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2]
assert bpy.app.background
source=ROOT/'assets/models/optimized/roman-family-v1/romanSoldier_gladius_blue.blend'
out=ROOT/'assets/models/optimized/citadel-statue'
name='citadel-soldier-statue-r03'
review=ROOT/'artifacts/pipeline/citadel-statue'/name
assert not (out/(name+'.blend')).exists()
review.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('family',ROOT/'tools/pipeline/build_roman_family_blender.py');family=importlib.util.module_from_spec(spec);spec.loader.exec_module(family)
bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.scene.frame_set(1)
for o in bpy.context.scene.objects:o.animation_data_clear()
nodes={o['three_node_id']:o for o in bpy.context.scene.objects if 'three_node_id' in o}
family.hidden(nodes['n32'])
skin=nodes['n18'].data.materials[0]
axis=Vector((0,-1,0));right=Vector((.13,.245,0));left=Vector((.13,.29,0))
family.arm(nodes,'R',(0,.305,-.067),right,axis,skin,hint=(0,-1,-1),hole=.014)
family.arm(nodes,'L',(0,.305,.067),left,axis,skin,hint=(0,-1,1),hole=.014)
family.setm(nodes['n50'],Matrix.Translation(right-axis*.04)@Vector((0,1,0)).rotation_difference(axis).to_matrix().to_4x4())
# Preserve the source weapon node; ceremonial longer blade points down to the feet.
for ch in list(nodes['n50'].children):family.hidden(ch)
v=[(-.020,.082,0),(0,.082,.006),(.020,.082,0),(0,.082,-.006),(-.016,.41,0),(0,.41,.004),(.016,.41,0),(0,.41,-.004),(0,.46,0)]
f=[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,8),(5,6,8),(6,7,8),(7,4,8),(3,2,1,0)]
family.mesh('Statue_ceremonial_blade',v,f,skin,nodes['n50'],'statue:blade')
family.box('Statue_sword_crossguard',(0,.077,0),(.105,.014,.024),skin,nodes['n50'],'statue:crossguard')
family.box('Statue_sword_grip',(0,.01,0),(.022,.12,.022),skin,nodes['n50'],'statue:grip')
family.box('Statue_sword_pommel',(0,-.061,0),(.032,.022,.032),skin,nodes['n50'],'statue:pommel')
bpy.context.view_layer.update()
def in_actor(o):
 p=o
 while p:
  if p==nodes['n0']:return True
  p=p.parent
 return False
def visible(o):
 p=o
 while p:
  if p.hide_render or p.get('candidateHidden'):return False
  p=p.parent
 return True
# Freeze visible approved surfaces into a standalone sculpture, keeping source data untouched.
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and in_actor(o) and visible(o)]
assert meshes
R=Matrix.Rotation(-math.pi/2,4,'Z')
frozen=[]
for o in meshes:
 data=o.data.copy();data.transform(R@o.matrix_world)
 new=bpy.data.objects.new('soldier-statue-'+o.name,data);frozen.append(new)
for o in list(bpy.data.objects):
 if o not in frozen:bpy.data.objects.remove(o,do_unlink=True)
scene=bpy.context.scene
for o in frozen:scene.collection.objects.link(o)
verts=[v.co for o in frozen for v in o.data.vertices];bottom=min(v.co.z for o in frozen if o.name in ('soldier-statue-n24','soldier-statue-n27') for v in o.data.vertices);top=max(v.z for v in verts);scale=4.0/(top-bottom)
blade=next(o for o in frozen if 'Statue_ceremonial_blade' in o.name)
lo=min(v.co.z for v in blade.data.vertices);hi=max(v.co.z for v in blade.data.vertices)
for v in blade.data.vertices:v.co.z=bottom+(v.co.z-lo)/(hi-lo)*(hi-bottom)
stone=family.material('soldier-statue-white-limestone',(.81,.79,.72))
for o in frozen:
 for v in o.data.vertices:v.co=(v.co-Vector((0,0,bottom)))*scale+Vector((0,0,2.88))
 o.data.materials.clear();o.data.materials.append(stone)
 for poly in o.data.polygons:poly.material_index=0
# Retain the already placed, layered pedestal; no old human figure is reused.
with bpy.data.libraries.load(str(out/'citadel-hero-statue-r01.blend'),link=False) as (a,b):
 b.objects=[n for n in a.objects if n.startswith('pedestal-') or n=='figure-carved-plinth']
for o in b.objects:
 if o:scene.collection.objects.link(o)
bpy.context.view_layer.update()
asset=list(scene.objects)
# Flatten static transforms, matching the synchronous runtime export contract.
for o in asset:
 if o.type=='MESH':
  o.data=o.data.copy();o.data.transform(o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
  o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/(name+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
bpy.ops.object.select_all(action='DESELECT')
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=720;scene.render.resolution_y=960;scene.render.resolution_percentage=100
scene.world.color=(.17,.20,.25);scene.view_settings.view_transform='AgX'
groundmat=family.material('review-floor',(.13,.16,.20))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));bpy.context.object.data.materials.append(groundmat)
for label,loc,power,size in [('key',(-5,-7,10),1500,7),('fill',(5,-1,7),900,6),('rim',(0,5,9),1800,5)]:
 d=bpy.data.lights.new(label,'AREA');d.energy=power;d.size=size;o=bpy.data.objects.new(label,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,3.8))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('review-camera');cam=bpy.data.objects.new('review-camera',d);scene.collection.objects.link(cam);d.type='ORTHO';d.ortho_scale=8.4;scene.camera=cam
for view,loc in {'front':(0,-15,6),'side':(15,0,6),'three-quarter':(9,-14,7)}.items():
 cam.location=loc;cam.rotation_euler=(Vector((0,0,3.4))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(review/(view+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/(name+'.blend')))
(review/'report.json').write_text(json.dumps({'source':str(source.relative_to(ROOT)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'status':'candidate-needs-visual-review','figureHeight':4.0,'totalHeight':6.88,'sourceFigureMeshes':len(frozen),'pose':'both hands rest on vertical sword grip, blade down','sourceUntouched':True},indent=2))
