import bpy,json
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
data=json.loads((ROOT/'godot/data/old-harbor-ocean-grade.json').read_text())
scene=bpy.data.scenes.get('TigerMessenger_Mountain_Forest_Review') or bpy.data.scenes.new('TigerMessenger_Mountain_Forest_Review')
for obj in list(scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
bpy.context.window.scene=scene
before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'godot/assets/art-pilots/old-harbor-ocean-grade.glb'));objects=set(scene.objects)-before
axis=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
def mat(a):return Matrix([[a[c*4+r] for c in range(4)] for r in range(4)])
wrapper=bpy.data.objects.new('Current mountain and original harbor',None);scene.collection.objects.link(wrapper)
wrapper.matrix_world=axis@mat(data['castleMatrix']).inverted()@mat(data['harborMatrix'])@axis.inverted()
for obj in objects:
    if obj.parent not in objects:obj.parent=wrapper
# Include the separately synchronized western massif, otherwise some correct
# tree roots would look unsupported in this Blender-only context view.
west=json.loads((ROOT/'godot/data/common-frame-west-massif.json').read_text())
v=west['positions'];mesh=bpy.data.meshes.new('Western massif context');mesh.from_pydata([(v[i],-v[i+2],v[i+1]) for i in range(0,len(v),3)],[],[(i,i+1,i+2) for i in range(0,len(v)//3,3)]);mesh.update()
obj=bpy.data.objects.new('highland-ravine-wall-west-context',mesh);scene.collection.objects.link(obj);obj.matrix_world=axis@mat(data['castleMatrix']).inverted()@mat(west['matrix'])@axis.inverted()
colors=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
for i in range(len(mesh.vertices)):colors.data[i].color=(*west['colors'][i*3:i*3+3],1)
material=bpy.data.materials.new('Western slate context');material.use_nodes=True;bs=material.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.98;attr=material.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Col';material.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color']);mesh.materials.append(material)
for obj in objects:
    if obj.type=='MESH' and ('citadel-oskar-grid-mountain-surface' in obj.name or 'citadel-coastal-cliff-seal' in obj.name):
        obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
        for polygon in obj.data.polygons:polygon.use_smooth=False
light=bpy.data.lights.new('Mountain sun','SUN');light.energy=2;lo=bpy.data.objects.new('Mountain sun',light);scene.collection.objects.link(lo);lo.rotation_euler=(.4,-.4,-.6)
cam=bpy.data.cameras.new('Mountain camera');co=bpy.data.objects.new('Mountain camera',cam);scene.collection.objects.link(co);co.location=(-35,-115,50);co.rotation_euler=(Vector((-45,-10,15))-co.location).to_track_quat('-Z','Y').to_euler();cam.type='ORTHO';cam.ortho_scale=165;scene.camera=co
scene.world=bpy.data.worlds.new('Mountain forest world');scene.world.color=(.08,.12,.18);scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1400;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.filepath=str(ROOT/'artifacts/pipeline/citadel-mountain-forest/blender-layout-r03.png');bpy.ops.render.render(write_still=True)
out=ROOT/'assets/models/optimized/citadel-mountain-forest';out.mkdir(parents=True,exist_ok=True)
bpy.data.libraries.write(str(out/'mountain-forest-layout-r03.blend'),{scene},fake_user=True)
print(json.dumps({'cypress':len(data['mountainForest']['cypress']),'round':len(data['mountainForest']['retainedRound']),'importedObjects':len(objects),'file':str(out/'mountain-forest-layout-r03.blend')}))
