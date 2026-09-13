import bpy,json,math
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
s=json.loads((ROOT/'artifacts/pipeline/citadel-shore-arcades/blender-source.json').read_text())
scene=bpy.data.scenes.get('TigerMessenger_Shore_Arcades_Review') or bpy.data.scenes.new('TigerMessenger_Shore_Arcades_Review')
for o in list(scene.objects):bpy.data.objects.remove(o,do_unlink=True)
bpy.context.window.scene=scene
axis=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
parts=[]
for i,p in enumerate(s['parts']):
    v=p['positions'];vertices=[(v[j],-v[j+2],v[j+1]) for j in range(0,len(v),3)]
    faces=[(j,j+1,j+2) for j in range(0,len(vertices),3)]
    mesh=bpy.data.meshes.new(p['name']);mesh.from_pydata(vertices,[],faces);mesh.update()
    n=p['normals'];mesh.normals_split_custom_set_from_vertices([(n[j],-n[j+2],n[j+1]) for j in range(0,len(n),3)])
    for poly in mesh.polygons:poly.use_smooth=True
    if p['uv']:
        uv=mesh.uv_layers.new(name='UVMap')
        for loop in mesh.loops:uv.data[loop.index].uv=p['uv'][loop.vertex_index*2:loop.vertex_index*2+2]
    obj=bpy.data.objects.new(str(i)+'_'+p['name'],mesh);scene.collection.objects.link(obj)
    a=p['matrix'];obj.matrix_world=axis@Matrix([[a[c*4+r] for c in range(4)] for r in range(4)])@axis.inverted()
    spec=p['material'];mat=bpy.data.materials.new(str(i)+'_'+spec['name']);mat.diffuse_color=(*spec['color'],1);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=mat.diffuse_color;bs.inputs['Roughness'].default_value=spec['roughness'];bs.inputs['Emission Color'].default_value=(*spec['emissive'],1);bs.inputs['Emission Strength'].default_value=spec['emissiveIntensity'];mesh.materials.append(mat)
    if spec['map']:
        texture=mat.node_tree.nodes.new('ShaderNodeTexImage');texture.image=bpy.data.images.load(str(ROOT/'assets/textures/citadel/blue-woven-canvas-v1.png'),check_existing=True);mat.node_tree.links.new(texture.outputs['Color'],bs.inputs['Base Color'])
    mesh.calc_loop_triangles();pos=[];normals=[];uvs=[]
    for tri in mesh.loop_triangles:
        for li in tri.loops:
            loop=mesh.loops[li];v=mesh.vertices[loop.vertex_index].co;n=mesh.corner_normals[li].vector
            pos.extend([v.x,v.z,-v.y]);normals.extend([n.x,n.z,-n.y])
            if p['uv']:uvs.extend(mesh.uv_layers.active.data[li].uv)
    parts.append({'name':p['name'],'digest':p['digest'],'positions':pos,'normals':normals,'uv':uvs or None})
light=bpy.data.lights.new('Arcade sun','SUN');light.energy=2;lo=bpy.data.objects.new('Arcade sun',light);scene.collection.objects.link(lo);lo.rotation_euler=(.4,-.4,-.6)
cam=bpy.data.cameras.new('Arcade camera');co=bpy.data.objects.new('Arcade camera',cam);scene.collection.objects.link(co);co.location=(-30,-69,22);co.rotation_euler=(Vector((-59,-37,-3))-co.location).to_track_quat('-Z','Y').to_euler();cam.type='ORTHO';cam.ortho_scale=31;scene.camera=co
scene.world=bpy.data.worlds.new('Arcade world');scene.world.color=(.08,.12,.18);scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1200;scene.render.resolution_y=800;scene.render.resolution_percentage=100
out=ROOT/'assets/models/optimized/citadel-shore-arcades';out.mkdir(parents=True,exist_ok=True)
(out/'shoreArcadesR01.js').write_text('export default '+json.dumps({'parts':parts},separators=(',',':'))+';\n')
scene.render.filepath=str(ROOT/'artifacts/pipeline/citadel-shore-arcades/blender-r01.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'shore-arcades-r01.blend'),copy=True)
print(json.dumps({'parts':len(parts),'triangles':sum(len(p['positions'])//9 for p in parts)}))
