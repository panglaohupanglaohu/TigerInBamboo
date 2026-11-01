import bpy,json,math
from mathutils import Vector
from pathlib import Path
base=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
out=base/'artifacts/pipeline/courier-head-profile-20261028'
bpy.ops.wm.open_mainfile(filepath=str(base/'artifacts/pipeline/courier-blender-threeview-20261008/v2/courier-v2.blend'))
removed=[o.name for o in bpy.data.objects if o.name.startswith('goggle_')]
assert len(removed)==6,removed
for name in removed:bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
# Rebuild the continuous head in the original head joint coordinates.
h=bpy.data.objects['head_skin']; inverse=h.matrix_world.inverted()
rings=[(1.572,.018,.012,-.067),(1.58,.034,.030,-.050),(1.60,.050,.052,-.037),(1.63,.066,.076,-.018),(1.67,.079,.089,-.004),(1.71,.079,.087,-.002),(1.75,.064,.069,.002),(1.78,.006,.009,.005)]
verts=[];faces=[];n=64
for z,rx,ry,cy in rings:
 for i in range(n):
  a=2*math.pi*i/n;x=rx*math.sin(a);y=cy-ry*math.cos(a)
  # underside rises towards the ear, leaving a distinct chin/throat break.
  rear=max(0,min(1,(y+.015)/.085));lift=.023*rear*max(0,1-(z-1.572)/.058)
  verts.append(inverse@Vector((x,y,z+lift)))
for j in range(len(rings)-1):
 for i in range(n):
  a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
faces.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+i for i in range(n))])
mesh=bpy.data.meshes.new('courier-reference-jaw');mesh.from_pydata(verts,[],faces);mesh.update()
for mat in h.data.materials:mesh.materials.append(mat)
h.data=mesh
for poly in mesh.polygons:poly.use_smooth=True
# Preserve the original face feature objects; pull the mouth to the new lip surface.
m=bpy.data.objects.get('mouth')
if m:m.location.y-=.005
bpy.ops.wm.save_as_mainfile(filepath=str(out/'courier-head-profile.blend'))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'courier-head-profile.blend'))
for name in ['body','head','legL','legR','kneeL','kneeR','armL','armR','elbowL','elbowR','handL','handR','letter']:
 e=bpy.data.objects.get(name);assert e is not None,name
 kids=[o for o in e.children if o.type=='MESH']
 if len(kids)>1:
  bpy.ops.object.select_all(action='DESELECT')
  for o in kids:o.select_set(True)
  bpy.context.view_layer.objects.active=kids[0];bpy.ops.object.join();bpy.context.object.name=name+'_mesh'
bpy.ops.export_scene.gltf(filepath=str(base/'assets/models/courier-blender-v2/courier-head-profile.glb'),export_format='GLB',export_extras=True,export_apply=True)
(out/'build.json').write_text(json.dumps({'removed':removed,'source':'original pre-merge v2 blend','chinChanged':True,'otherGeometryChanged':'head surface and mouth seating only; original joints/body retained'},indent=2))

scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=720;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Review world');scene.world.color=(.35,.35,.35)
bpy.ops.object.light_add(type='AREA',location=(2,-3,4));bpy.context.object.data.energy=450;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=.35
for name,loc in [('side',(3,0,1.67)),('front',(0,-3,1.67)),('quarter',(2,-3,1.67))]:
 cam.location=loc;cam.rotation_euler=(Vector((0,0,1.67))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/('head-'+name+'.png'));bpy.ops.render.render(write_still=True)
