import bpy,json,math
from pathlib import Path
from mathutils import Vector
p=Path(__file__).parent;bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for row in json.loads((p/'actual-bare-r3.json').read_text()):
 v=[(row['p'][j],-row['p'][j+2],row['p'][j+1]) for j in range(0,len(row['p']),3)];ix=row['ix'] or list(range(len(v)));f=[ix[j:j+3] for j in range(0,len(ix),3)];m=bpy.data.meshes.new(row['name']);m.from_pydata(v,[],f);m.update();o=bpy.data.objects.new(row['name'],m);bpy.context.collection.objects.link(o);mat=bpy.data.materials.new(row['name']);mat.diffuse_color=tuple(((row['mat']>>k)&255)/255 for k in[16,8,0])+(1,);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=mat.diffuse_color;bs.inputs['Roughness'].default_value=1
 if row['color']:
  ca=m.color_attributes.new(name='TerrainColor',type='FLOAT_COLOR',domain='POINT')
  for j,c in enumerate(ca.data):c.color=(*row['color'][j*3:j*3+3],1)
  a=mat.node_tree.nodes.new('ShaderNodeVertexColor');a.layer_name='TerrainColor';mat.node_tree.links.new(a.outputs['Color'],bs.inputs['Base Color'])
 o.data.materials.append(mat)
bpy.ops.object.camera_add(location=(0,-155,75));cam=bpy.context.object;cam.rotation_euler=(Vector((0,-10,10))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=40;bpy.context.scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(-65,-70,100));bpy.context.object.data.energy=350000;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=70
s=bpy.context.scene;s.world.color=(.25,.35,.40);s.render.engine='CYCLES';s.cycles.samples=16;s.render.resolution_x=1280;s.render.resolution_y=720;s.render.resolution_percentage=100;s.render.filepath=str(p/'actual-bare-r3.png');s.view_settings.view_transform='Standard';bpy.ops.render.render(write_still=True)
