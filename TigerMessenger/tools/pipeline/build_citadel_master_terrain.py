"""Create an isolated Blender terrain work scene from actual runtime geometry."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
root=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
folder=root/'artifacts/pipeline/citadel-master-terrain'
data=json.loads((folder/'source.json').read_text())
scene=bpy.data.scenes.new('TigerMessenger_Master_Terrain_Baseline')
if bpy.context.window: bpy.context.window.scene=scene
def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);return m
rock=material('Master terrain · measured rock',(.22,.32,.43))
site=material('Master terrain · existing built support',(.68,.44,.19))
water=material('Master terrain · measured sea',(.06,.24,.34))
for part in data['parts']:
 mesh=bpy.data.meshes.new(part['name']);idx=part['indices']
 mesh.from_pydata([(x,-z,y) for x,y,z in part['vertices']],[],[idx[i:i+3] for i in range(0,len(idx),3)])
 mesh.update();o=bpy.data.objects.new(part['name'],mesh);scene.collection.objects.link(o)
 mesh.materials.append({'rock':rock,'site':site,'water':water}[part['kind']])
 o['source']='default 8931 measured geometry';o['role']=part['kind']
camera_data=bpy.data.cameras.new('Master terrain overview');camera=bpy.data.objects.new('Master terrain overview',camera_data);scene.collection.objects.link(camera);scene.camera=camera
def point(v):return Vector((v[0],-v[2],v[1]))
eye=point(data['camera']['eye']);look=point(data['camera']['look']);camera.location=look+(eye-look)*1.65
camera.rotation_euler=(look-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=225
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True
scene.display.shading.background_type='WORLD';scene.world=bpy.data.worlds.new('Master terrain background');scene.world.color=(.07,.085,.11)
scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene['status']='Measured terrain baseline; not approved final landform. Brown objects are existing construction supports.'
scene['coordinates']='castle local X,Y,Z -> Blender X,-Z,Y; metres'
out=root/'assets/models/optimized/citadel-master-terrain';out.mkdir(parents=True,exist_ok=True)
bpy.context.view_layer.update()
if bpy.app.background:
 bpy.ops.wm.save_as_mainfile(filepath=str(out/'master-terrain-baseline.blend'))
else:
 bpy.data.libraries.write(str(out/'master-terrain-baseline.blend'),{scene},fake_user=True)
scene.render.filepath=str(folder/'blender-baseline.png');bpy.ops.render.render(write_still=True,scene=scene.name)
print(json.dumps({'scene':scene.name,'parts':len(data['parts']),'blend':str(out/'master-terrain-baseline.blend')}))
