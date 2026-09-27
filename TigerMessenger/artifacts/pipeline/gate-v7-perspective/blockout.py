import bpy, math
from mathutils import Vector
from pathlib import Path
out=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/gate-v7-perspective')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);return m
stone=mat('Blue stone',(.32,.48,.65));deck=mat('Deck',(.55,.6,.65));gold=mat('Brass',(.65,.5,.23));green=mat('Terrace',(.3,.5,.42));rail=mat('Rails',(.12,.16,.2))
def box(n,p,s,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name=n;o.dimensions=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);return o
def beam(a,b,r,m):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
box('Straight bridge',(0,18,-.6),(14,105,1.2),deck)
for x in [-3.3,-1.7,1.7,3.3]:box('Rail',(x,18,.08),(.12,105,.15),rail)
for y in range(-34,71,2):
 for x in [-2.5,2.5]:box('Sleeper',(x,y,.03),(2.3,.22,.1),rail)
for y in [0,21,42]:
 for x in [-6,6]:box('Portal foot',(x,y,5.5),(.8,1.1,11),stone)
 for j in range(48):
  a=j/48*math.pi;b=(j+1)/48*math.pi
  beam((6*math.cos(a),y,11+6*math.sin(a)),(6*math.cos(b),y,11+6*math.sin(b)),.42,stone)
 for x in [-6,6]:beam((x,y,1),(x,y,8),.6,gold)
# Stop and meeting balcony always on left, before first portal.
box('Stop platform',(-9,-12,0),(4,16,.8),deck)
box('Meeting terrace',(-17,-12,3),(10,10,.6),green)
for i in range(15):box('Stair',(-12.4-i*.28,-15,.1+i*.2),(.5,2,.2),deck)
for x,y in [(-18,-11),(-16,-11),(-17,-13)]:
 beam((x,y,3.3),(x,y,4.7),.25,gold)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.2,location=(x,y,5));bpy.context.object.data.materials.append(gold)
box('Tram',(-2.5,-21,1.5),(2.5,8,3),stone)
for x in [-6.7,6.7]:
 for y in range(-32,71,4):beam((x,y,0),(x,y,1.2),.06,gold)
 beam((x,-34,1.2),(x,70,1.2),.07,gold)
sc=bpy.context.scene;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=True;sc.display.shading.show_cavity=True;sc.world.color=(.15,.2,.28)
sc.render.resolution_x=1536;sc.render.resolution_y=1024;sc.render.resolution_percentage=100
bpy.ops.object.camera_add();camera=bpy.context.object;sc.camera=camera;camera.data.lens=43
for name,pos,look in [('overview',(27,-53,31),(-3,15,5)),('front',(0,-57,8),(0,20,8)),('meeting',(-29,-31,16),(-10,-5,5))]:
 camera.location=pos;camera.rotation_euler=(Vector(look)-camera.location).to_track_quat('-Z','Y').to_euler();sc.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'gate-perspective.blend'))
