import bpy,math,json,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
P=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger');A=P/'assets/models/optimized/citadel-horse-terrace';O=P/'artifacts/pipeline/citadel-horse-terrace-blender'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(A/'source-v1.glb'))
city=bpy.data.objects['highland-west-city'];terrain=bpy.data.objects['citadel-oskar-grid-mountain-surface']
bpy.context.view_layer.update()
verts=[terrain.matrix_world@v.co for v in terrain.data.vertices];polys=[list(f.vertices) for f in terrain.data.polygons];bvh=BVHTree.FromPolygons(verts,polys)
inv=city.matrix_world.inverted();up=(city.matrix_world.to_3x3()@Vector((0,0,1))).normalized()
perimeter=[(69,65.5),(75,65.5),(81,65.5),(81,69),(81,75),(81,79.5),(75,79.5),(69,79.5),(69,75),(69,69)]
bases=[]
for x,z in perimeter:
 hit,normal,index,distance=bvh.ray_cast(city.matrix_world@Vector((x,-z,300)),-up,700)
 if hit is None:raise RuntimeError(f'No actual terrain below terrace {x,z}')
 y=(inv@hit).z;bases.append(min(-.25,y-.65))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.render.resolution_x=1100;scene.render.resolution_y=780;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Terrace review');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.12,.19,.28,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
sun=bpy.data.objects.new('Terrace review sun',bpy.data.lights.new('Terrace review sun','SUN'));scene.collection.objects.link(sun);sun.data.energy=2;sun.rotation_euler=(.4,-.35,-.4)
cam=bpy.data.objects.new('Terrace camera',bpy.data.cameras.new('Terrace camera'));scene.collection.objects.link(cam);cam.location=city.matrix_world@Vector((110,-111,28));target=city.matrix_world@Vector((75,-72.5,2));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(45);scene.camera=cam
mats=[]
for i,color in enumerate([(0.18,.28,.39,1),(.23,.34,.45,1),(.15,.24,.34,1),(.28,.38,.48,1)]):
 mat=bpy.data.materials.new('Terrace exposed rock '+str(i));mat.diffuse_color=color;mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color;mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.97;mats.append(mat)
reports=[]
for iteration in [3,4]:
 old=bpy.data.objects.get('horse-terrace-blender-masonry')
 if old:bpy.data.objects.remove(old,do_unlink=True)
 pieces=[]
 def stone(x,y,z,w,h,d,tone):
  bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,0));obj=bpy.context.object;obj.name='Terrace cut stone';obj.parent=city;obj.location=(x,-z,y);obj.scale=(w,d,h)
  bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  obj.data.materials.append(mats[tone])
  bevel=obj.modifiers.new('Subtle chipped arris','BEVEL');bevel.width=.012 if iteration==3 else .028;bevel.segments=1
  bpy.ops.object.modifier_apply(modifier=bevel.name);pieces.append(obj)
 # Warm limestone, slightly varied faces; keep geometric joints visible.
 for i,mat in enumerate(mats):
  color=[(.58,.56,.50,1),(.65,.62,.55,1),(.53,.52,.47,1),(.68,.66,.59,1)][i]
  mat.diffuse_color=color;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color
 rows=7
 for row in range(rows):
  y=.4+row*.76
  for face in range(4):
   length=12 if face<2 else 14
   n=6 if face<2 else 7
   # Alternating half blocks make continuous staggered courses.
   boundaries=[0]+[v for v in [k*2+(1 if row%2 else 0) for k in range(1 if row%2==0 else 0,n+1)] if 0<v<length]+[length]
   for j in range(len(boundaries)-1):
    a,b=boundaries[j:j+2];center=(a+b)/2;size=b-a-.035;tone=(row*3+j+face)%4
    if face==0:stone(69+center,y,79.53,size,.72,.12,tone)
    elif face==1:stone(69+center,y,65.47,size,.72,.12,tone)
    elif face==2:stone(81.03,y,65.5+center,.12,.72,size,tone)
    else:stone(68.97,y,65.5+center,.12,.72,size,tone)
 bpy.ops.object.select_all(action='DESELECT')
 for obj in pieces:obj.select_set(True)
 bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join();obj=bpy.context.object;obj.name='horse-terrace-blender-masonry'
 # Bake cladding to new-city author coordinates for the Web geometry adapter.
 to_city=city.matrix_world.inverted()@obj.matrix_world;mesh=obj.data;mesh.calc_loop_triangles();positions=[];colors=[]
 for tri in mesh.loop_triangles:
  color=obj.data.materials[mesh.polygons[tri.polygon_index].material_index].diffuse_color[:3]
  for index in tri.vertices:
   v=to_city@mesh.vertices[index].co;positions.extend([v.x,v.z,-v.y]);colors.extend(color)
 bpy.ops.wm.save_as_mainfile(filepath=str(A/f'horse-terrace-r{iteration:02d}.blend'))
 scene.render.filepath=str(O/f'blender-r{iteration:02d}.png');bpy.ops.render.render(write_still=True)
 if iteration==4:(A/'masonryData.js').write_text('export default '+json.dumps({'source':'assets/models/optimized/citadel-horse-terrace/horse-terrace-r04.blend','positions':positions,'colors':colors},separators=(',',':'))+';\n')
 reports.append({'round':iteration,'triangles':len(mesh.loop_triangles),'sourceSha256':hashlib.sha256((A/'source-v1.glb').read_bytes()).hexdigest(),'scope':'Blender masonry cladding; previous rock support candidate not integrated'})
(O/'masonry-report.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports))
