import bpy, math, json
from pathlib import Path
from mathutils import Vector
base=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
ev=base/'artifacts/pipeline/roman-shield-handle'
before={"filepath":bpy.data.filepath,"dirty":bpy.data.is_dirty,"scenes":[s.name for s in bpy.data.scenes]}
assert 'Roman Shield Handle V1' not in bpy.data.scenes
scene=bpy.data.scenes.new('Roman Shield Handle V1')
bpy.context.window.scene=scene
root=bpy.data.objects.new('Roman_Shield_Handle_V1',None);scene.collection.objects.link(root)
root['coordinateContract']='Godot shield local +X front, -X rear; wooden grip center (-0.055,0,0)'
def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.72
 return m
wood=material('Roman_Handle_Dark_Wood',(.18,.075,.025));gold=material('Roman_Handle_Gold_Brackets',(.75,.54,.16))
def make(name,verts,faces,mat):
 # Author in shield's Godot XYZ, store Blender Z-up; glTF export converts back.
 mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,-z,y) for x,y,z in verts],[],faces);mesh.update()
 obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);obj.parent=root;mesh.materials.append(mat);return obj
verts=[]
for y in [-.035,.035]:
 for i in range(8):
  a=2*math.pi*i/8;verts.append((-.055+.008*math.cos(a),y,.008*math.sin(a)))
faces=[tuple(range(7,-1,-1)),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
# Reverse cylinder winding because Y-axis construction is opposite standard Z cylinder.
faces=[tuple(reversed(f)) for f in faces]
make('Wooden_Grip',verts,faces,wood)
for y,label in [(-.045,'Lower'),(.045,'Upper')]:
 x0,x1=-.058,-.012;y0,y1=y-.012,y+.012;z0,z1=-.010,.010
 v=[(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)]
 f=[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
 make('Gold_'+label+'_Bracket',v,f,gold)
blend=str(base/'assets/models/optimized/roman-shield-handle-v1.blend')
bpy.data.libraries.write(blend,{scene},fake_user=True,compress=True)
for o in scene.objects:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(base/'godot/assets/art-pilots/roman-shield-handle-v1.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True)
report={'before':before,'currentFilepath':bpy.data.filepath,'sourceSavedOver':False,'scene':scene.name,'meshCount':3,'gripCenterGodot':[-.055,0,0],'gripLength':.07,'gripRadius':.008,'bracketY':[-.045,.045],'bracketXBounds':[-.058,-.012],'shieldRearX':-.014,'shieldContactOverlap':.002,'gripBracketYOverlap':.002,'blend':blend,'rootTransformIdentity':list(root.matrix_local)==list(root.matrix_local.Identity(4))}
(ev/'model-report.json').write_text(json.dumps(report,indent=2))
# Render the actual added geometry, without adding original shield or changing it.
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=700;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Roman_Handle_Review_World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.26,.30,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
camdata=bpy.data.cameras.new('Handle_Review_Camera');cam=bpy.data.objects.new('Handle_Review_Camera',camdata);scene.collection.objects.link(cam);scene.camera=cam
cam.location=(-.32,-.22,.14);target=Vector((-.035,0,0));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=.16
lampdata=bpy.data.lights.new('Handle_Review_Key','AREA');lamp=bpy.data.objects.new('Handle_Review_Key',lampdata);scene.collection.objects.link(lamp);lamp.location=(-.3,-.2,.4);lamp.rotation_euler=(target-lamp.location).to_track_quat('-Z','Y').to_euler();lampdata.energy=25;lampdata.shape='DISK';lampdata.size=.4
scene.render.filepath=str(ev/'handle-render.png');bpy.ops.render.render(write_still=True)
print(json.dumps(report))
