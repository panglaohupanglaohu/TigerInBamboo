import bpy,math,json,random
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'project/assets/lowPolyTree.glb'))
original=list(bpy.data.objects)
archive=bpy.data.collections.new('Original pine archive — unchanged');bpy.context.scene.collection.children.link(archive)
for o in original:
 for c in list(o.users_collection):c.objects.unlink(o)
 archive.objects.link(o)
archive.hide_render=True;archive.hide_viewport=True

def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.86;return m
bark=material('Warm umber bark',(.09,.052,.028));greens=[material('Broadleaf jade '+str(i),c) for i,c in enumerate([(.025,.085,.055),(.035,.13,.083),(.055,.18,.11),(.07,.22,.14)])]
def branch(parent,a,b,r1,r2):
 a,b=Vector(a),Vector(b);d=b-a;bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=r1,radius2=r2,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.name='Branch';o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.parent=parent;o.data.materials.append(bark);return o
def crown(parent,pos,scale,idx,sub=2):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=pos);o=bpy.context.object;o.name='Rounded broadleaf crown' if parent.name=='Broadleaf' else 'Cypress foliage';o.scale=scale;o.parent=parent;o.data.materials.append(greens[idx%len(greens)]);return o
broad=bpy.data.objects.new('Broadleaf',None);bpy.context.collection.objects.link(broad)
# Reuse the archived original trunk mesh as the starting trunk, with an explicitly changed taller proportion.
source=next(o for o in original if o.type=='MESH' and o.name=='n1')
trunk=source.copy();trunk.data=source.data.copy();bpy.context.collection.objects.link(trunk);trunk.name='Original trunk reshaped';trunk.parent=broad;trunk.matrix_parent_inverse.identity();trunk.location=(0,0,.95);trunk.rotation_euler=(0,0,0);trunk.scale=(1.7,1.7,2.25);trunk.data.materials.clear();trunk.data.materials.append(bark)
branch(broad,(0,0,.5),(.08,0,2.8),.19,.10)
for i,(x,y,z,sx,sy,sz) in enumerate([(-.9,-.3,2.7,1,.85,.8),(.85,-.25,2.85,1,.9,.9),(-.6,.6,3.05,.95,.95,.85),(.6,.65,3.2,1,.85,.9),(0,0,3.7,1.2,1,.95),(-1.15,.15,3.45,.85,.75,.7),(1.2,.12,3.5,.8,.8,.75),(.0,-.8,3.4,1,.8,.9),(-.35,.2,4.15,.85,.8,.7)]):
 branch(broad,(.02,0,1.8),(x*.8,y*.8,z-.25),.07,.025);crown(broad,(x,y,z),(sx,sy,sz),i)
cypress=bpy.data.objects.new('Cypress',None);bpy.context.collection.objects.link(cypress)
branch(cypress,(0,0,0),(0,0,4.8),.14,.025)
for i in range(9):
 t=i/8;w=.56*(1-t*.70);crown(cypress,(.035*math.sin(i),.025*math.cos(i),1.05+i*.48),(w,w*.90,.74*(1-t*.40)),i,2)
models=[broad,cypress];report=[]
for model in models:
 bpy.ops.object.select_all(action='DESELECT');model.select_set(True)
 for o in model.children_recursive:o.select_set(True)
 bpy.context.view_layer.objects.active=model
 filename=model.name.lower()+'-reference-v1.glb'
 bpy.ops.export_scene.gltf(filepath=str(root/'project/assets'/filename),export_format='GLB',use_selection=True,export_extras=True)
 meshes=[o for o in model.children_recursive if o.type=='MESH'];report.append({'name':model.name,'file':filename,'meshes':len(meshes),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)})
# Review composition only; export pivots above remain at origin.
broad.location.x=-2.7;cypress.location.x=2.7
floor=material('Warm paper',(.65,.60,.49));bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(floor)
bpy.ops.object.camera_add(location=(10,-17,9));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,2.3))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=11;scene=bpy.context.scene;scene.camera=cam
for loc,power,color,size in [((0,-6,10),1600,(1,.81,.59),8),((-5,2,7),1100,(.50,.72,1),6)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new("Review world");scene.world.color=(.2,.2,.2);scene.render.filepath=str(root/'plants-blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'reference-plants-v1.blend'));bpy.ops.render.render(write_still=True)
(root/'plant-model-report.json').write_text(json.dumps({'source':'Original lowPolyTree imported and archived; trunk reused in broadleaf, canopy and branching redesigned against user reference','variants':report},indent=2))
