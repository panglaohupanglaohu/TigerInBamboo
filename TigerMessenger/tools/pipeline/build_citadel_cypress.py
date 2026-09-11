import bpy,math,random,json
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger');OUT=ROOT/'assets/models/optimized/citadel-cypress';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
materials=[]
for name,color in [('deep',(0.035,.075,.055,1)),('mid',(.07,.14,.09,1)),('sun',(.13,.21,.12,1)),('bark',(.20,.17,.12,1))]:
 m=bpy.data.materials.new('citadel-cypress-'+name);m.diffuse_color=color;m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color;m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.93;materials.append(m)
verts=[];faces=[];rng=random.Random(20260911);rings=[(.55,.22),(1.15,.60),(2.0,.82),(3.0,.73),(4.1,.60),(5.2,.42),(6.1,.20),(6.7,.015)];N=9
for k,(z,r) in enumerate(rings):
 for i in range(N):
  a=i*2*math.pi/N+(k%2)*.12;v=r*(.88+rng.random()*.22)
  verts.append((v*math.cos(a)+.13*math.sin(z*.7),v*math.sin(a)*.8,z+(rng.random()-.5)*.16))
for k in range(len(rings)-1):
 for i in range(N):
  a=k*N+i;b=k*N+(i+1)%N;c=(k+1)*N+i;d=(k+1)*N+(i+1)%N
  faces.extend([(a,b,c),(b,d,c)])
faces.append(tuple(reversed(range(N))));faces.append(tuple((len(rings)-1)*N+i for i in range(N)))
mesh=bpy.data.meshes.new('Cypress faceted crown');mesh.from_pydata(verts,[],faces);mesh.update();crown=bpy.data.objects.new('Citadel cypress',mesh);bpy.context.collection.objects.link(crown)
for m in materials[:3]:mesh.materials.append(m)
for p in mesh.polygons:p.material_index=2 if p.normal.x<-.35 and p.center.z>2 else (1 if rng.random()>.4 else 0)
bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=.14,radius2=.07,depth=1.4,location=(0,0,.7));trunk=bpy.context.object;trunk.data.materials.append(materials[3]);crown.select_set(True);bpy.context.view_layer.objects.active=crown;bpy.ops.object.join();bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'citadel-cypress-v1.glb'),export_format='GLB',use_selection=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=520;scene.render.resolution_y=760;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
sun=bpy.data.objects.new('Sun',bpy.data.lights.new('Sun','SUN'));scene.collection.objects.link(sun);sun.data.energy=2;sun.rotation_euler=(.4,-.5,-.3)
cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));scene.collection.objects.link(cam);cam.location=(9,-13,7);cam.rotation_euler=(Vector((0,0,3.4))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=8;scene.camera=cam
scene.render.filepath=str(OUT/'render.png');bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'citadel-cypress-v1.blend'));bpy.ops.render.render(write_still=True)
