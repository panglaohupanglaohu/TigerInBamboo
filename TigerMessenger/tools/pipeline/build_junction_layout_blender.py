"""Target v1 spatial study, not final assets or a replacement of the user's saved town."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/models/optimized/canal-junction'
ART=ROOT/'artifacts/pipeline/canal-junction-target'
name='TM_Junction_Layout_Study'
old=bpy.data.scenes.get(name)
if old:
 if bpy.context.window.scene==old:bpy.context.window.scene=next(s for s in bpy.data.scenes if s!=old)
 for o in list(old.objects):bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.scenes.remove(old)
scene=bpy.data.scenes.new(name);bpy.context.window.scene=scene
palette={'stone':'c8b99b','coral':'c78269','teal':'6f9c9b','yellow':'d1ac66','cream':'d7ccb1','roof':'384d63','route':'cdba87','water':'347e8e','person':'35496a'}
materials={}
for k,h in palette.items():
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
 m=bpy.data.materials.new('JunctionStudy_'+k);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=1;materials[k]=m
# Use Blender Z-up; front is negative Y, study confined to original 44x36 water allocation.
objects=[]
def mesh(n,vs,faces,mat):
 d=bpy.data.meshes.new(n);d.from_pydata(vs,[],faces);d.update();o=bpy.data.objects.new(n,d);scene.collection.objects.link(o);d.materials.append(materials[mat]);objects.append(o);return o
def box(n,x,y,z,w,d,h,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z+h/2));o=bpy.context.object;o.name=n;o.scale=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(materials[mat]);objects.append(o);return o
# Chamfered island platform: seawater below 0, quay 0.65, court 3.35.
poly=[(-17,-12),(-12,-15),(12,-15),(18,-10),(18,9),(12,14),(-12,14),(-18,8)]
vs=[(x,y,z) for z in (-1,.65) for x,y in poly];N=len(poly)
mesh('irregular-quay',vs,[tuple(reversed(range(N))),tuple(range(N,N*2))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)],'stone')
# Retaining wall leaves a 4m clear front arch. Walkable court starts beyond the arch.
box('court-left-support',-9,-.5,.65,10,17,2.7,'stone');box('court-right-support',9,-.5,.65,10,17,2.7,'stone')
box('court-rear-support',0,4,.65,8,8,2.7,'stone')
# True radial masonry ring, no filled opening.
for j in range(12):
 a=j*math.pi/12;b=(j+1)*math.pi/12;r=2;R=2.6;z0=2.8
 v=[(rr*math.cos(t),y,z0+rr*math.sin(t)) for y in (-10,-8.8) for rr,t in [(r,a),(R,a),(R,b),(r,b)]]
 mesh('front-arch-voussoir-%02d'%j,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'stone')
for x in (-2.3,2.3):box('arch-jamb',x,-9.4,.65,.6,1.2,2.15,'stone')
# Stair under arch rises behind its back face, then opens onto court.
for i in range(15):box('quay-court-step-%02d'%i,0,-8.6+i*.38,.65,3.8,.38,(i+1)*.18,'route')
box('central-open-court',0,1.7,3.32,13,7.6,.03,'route')
box('keep-bearing-foundation',0,12,.65,14,4,5.94,'stone')
# Main keep approach stays separate from central court.
for i in range(18):box('court-keep-step-%02d'%i,0,5.6+i*.30,3.35,4.2,.30,(i+1)*.18,'stone')
regions=[
 ('left-front-coral',-11,-6,3.35,4.8,4.8,5.1,'coral'),('left-mid-yellow',-12,.3,3.35,4.8,5,6.8,'yellow'),
 ('left-rear-teal',-9,6.8,3.35,5,4.8,8.5,'teal'),('left-watchtower',-14,8.5,3.35,3.5,3.5,17,'cream'),
 ('right-front-teal',11,-6,3.35,4.8,4.8,5.1,'teal'),('right-mid-coral',12,.3,3.35,4.8,5,6.8,'coral'),
 ('right-rear-yellow',10,6.8,3.35,4.8,4.8,8.5,'yellow'),('right-watchtower',15,8.5,3.35,3.5,3.5,13,'cream'),
 ('rear-keep',0,12,6.59,7,4,11,'cream'),('keep-tower-left',-4.6,11.8,6.59,2.5,3,13,'cream'),('keep-tower-right',4.6,11.8,6.59,2.5,3,15,'cream')]
for n,x,y,z,w,d,h,mat in regions:
 if n=='rear-keep':
  box(n+'-left',x-2.5,y,z,2,d,h,mat);box(n+'-right',x+2.5,y,z,2,d,h,mat);box(n+'-lintel',x,y,z+3.2,3,d,h-3.2,mat)
 else:box(n,x,y,z,w,d,h,mat)
 if 'tower' in n:
  bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=w*.78,depth=3,location=(x,y,z+h+1.5));o=bpy.context.object;o.name=n+'-roof';o.data.materials.append(materials['roof']);objects.append(o)
 else:
  v=[(x-w*.55,y-d*.55,z+h),(x+w*.55,y-d*.55,z+h),(x+w*.55,y+d*.55,z+h),(x-w*.55,y+d*.55,z+h),(x,y-d*.55,z+h+1.7),(x,y+d*.55,z+h+1.7)]
  mesh(n+'-roof',v,[(0,1,4),(3,5,2),(0,4,5,3),(1,2,5,4)],'roof')
# Quay and side berths; cargo will be confined to side strips after circulation passes.
for x in (-11,11):box('berth-deck',x,-16.1,.4,3,4.4,.25,'stone')
for x,y,z in [(0,-12,.65),(0,-4,2.99),(4,1.5,3.35),(-4,2,3.35),(0,11,6.59)]:
 bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=.22,radius2=.28,depth=1.25,location=(x,y,z+.8));o=bpy.context.object;o.name='scale-person-1.8m';o.data.materials.append(materials['person']);objects.append(o)
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.22,location=(x,y,z+1.58));o=bpy.context.object;o.data.materials.append(materials['person']);objects.append(o)
# Shared circulation geometry exported for original module assembly.
baseparts=[]
for o in objects:
 if not (o.name.startswith(('irregular-quay','court-left-support','court-right-support','court-rear-support','front-arch','arch-jamb','quay-court-step','central-open-court','keep-bearing','court-keep-step','berth-deck'))):continue
 o.data.calc_loop_triangles();ps=[];ns=[]
 for tri in o.data.loop_triangles:
  n=o.matrix_world.to_3x3()@tri.normal
  for v in tri.vertices:
   q=o.matrix_world@o.data.vertices[v].co;ps.extend([q.x,q.z,-q.y]);ns.extend([n.x,n.z,-n.y])
 baseparts.append({'name':o.name,'positions':ps,'normals':ns,'color':list(o.data.materials[0].diffuse_color[:3])})
(OUT/'foundation.json').write_text(json.dumps({'parts':baseparts,'regions':regions}))
# Model only; render water excluded from export.
bpy.data.libraries.write(str(OUT/'junction-layout-v1.blend'),{scene},fake_user=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'junction-layout-v1.glb'),export_format='GLB',use_active_scene=True,export_cameras=False,export_lights=False)
box('render-water',0,0,-1.5,180,180,.1,'water')
scene.world=bpy.data.worlds.new('JunctionStudyWorld');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.4,.5,.65,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
bpy.ops.object.light_add(type='AREA',location=(-20,-25,45));bpy.context.object.data.energy=3500;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=35
bpy.ops.object.light_add(type='SUN',location=(-20,-20,40));bpy.context.object.rotation_euler=(.45,-.4,-.45);bpy.context.object.data.energy=2
bpy.ops.object.camera_add(location=(45,-58,43));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,8))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=60;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1440;scene.render.resolution_y=1080;scene.render.resolution_percentage=100;scene.render.filepath=str(ART/'layout-v1.png');bpy.ops.render.render(write_still=True)
(ART/'layout-v1.json').write_text(json.dumps({'status':'spatial study, not final geometry; no WFC solve in this blockout','quayHeight':.65,'courtHeight':3.35,'keepLanding':6.59,'frontArchClearWidth':4,'courtSize':[13,7.6],'mainStairWidth':4.2,'sourceWaterAllocation':[44,36],'regions':regions,'caveats':['Harbor approach requires original-world bathymetry test','Front ring height exceeds court, parapet massing pending','No changes to saved user layout or production game']},ensure_ascii=False,indent=2))
print('Junction spatial study exported and rendered')
