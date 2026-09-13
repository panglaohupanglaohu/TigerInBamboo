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
for iteration in [1,2]:
 old=bpy.data.objects.get('horse-terrace-blender-rock-support')
 if old:bpy.data.objects.remove(old,do_unlink=True)
 vertices=[];N=len(perimeter)
 for ring in range(3):
  for i,(x,z) in enumerate(perimeter):
   if ring==0:y=.15;dx=dz=0
   elif ring==1:y=bases[i]*.42;dx=(x-75)*(.13 if iteration==1 else .06);dz=(z-72.5)*(.10 if iteration==1 else .04)
   else:y=bases[i];dx=(x-75)*.06;dz=(z-72.5)*.06
   if iteration==2 and ring==1:dx+=.18*math.sin(i*2.1);dz+=.12*math.cos(i*1.7)
   vertices.append((x+dx,-z-dz,y))
 faces=[]
 for ring in range(2):
  for i in range(N):
   a=ring*N+i;b=ring*N+(i+1)%N;c=(ring+1)*N+i;d=(ring+1)*N+(i+1)%N;faces.extend([(a,c,b),(b,c,d)])
 faces.extend([tuple(range(N-1,-1,-1)),tuple(range(2*N,3*N))])
 mesh=bpy.data.meshes.new('Actual terrain fitted rock');mesh.from_pydata(vertices,[],faces);mesh.update();obj=bpy.data.objects.new('horse-terrace-blender-rock-support',mesh);scene.collection.objects.link(obj);obj.parent=city
 for mat in mats:mesh.materials.append(mat)
 for face in mesh.polygons:face.material_index=face.index%len(mats)
 # Recalculate outward faces for the closed support mesh before export.
 bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');obj.select_set(False)
 bpy.ops.wm.save_as_mainfile(filepath=str(A/f'horse-terrace-r{iteration:02d}.blend'))
 scene.render.filepath=str(O/f'blender-r{iteration:02d}.png');bpy.ops.render.render(write_still=True)
 mesh.calc_loop_triangles();positions=[];colors=[]
 for tri in mesh.loop_triangles:
  col=mats[mesh.polygons[tri.polygon_index].material_index].diffuse_color[:3]
  for v in tri.vertices:
   p=mesh.vertices[v].co;positions.extend([p.x,p.z,-p.y]);colors.extend(col)
 data={'source':f'assets/models/optimized/citadel-horse-terrace/horse-terrace-r{iteration:02d}.blend','positions':positions,'colors':colors}
 if iteration==2:(A/'rockSupportData.js').write_text('export default '+json.dumps(data,separators=(',',':'))+';\n')
 reports.append({'round':iteration,'triangles':len(mesh.loop_triangles),'terrainBottoms':bases,'sourceSha256':hashlib.sha256((A/'source-v1.glb').read_bytes()).hexdigest()})
(O/'report.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports))
