import bpy, json, math, bmesh
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
source=json.loads((ROOT/'artifacts/pipeline/citadel-old-harbor-grade/rock-source.json').read_text())
scene=bpy.data.scenes.get('TigerMessenger_Old_Shore_Rock_Review') or bpy.data.scenes.new('TigerMessenger_Old_Shore_Rock_Review')
for obj in list(scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
bpy.context.window.scene=scene
vertices=[];faces=[]
for strip_index,raw in enumerate(source['rows']):
    strip=[]
    for row_index,row in enumerate(raw):
        expanded=[]
        for j in range(5):
            p=list(row[j])
            if j in (0,4):
                factor=1.15+0.12*math.sin(row_index*1.8+strip_index)
                p[0]=row[2][0]+(p[0]-row[2][0])*factor;p[2]=row[2][2]+(p[2]-row[2][2])*factor
            expanded.append(p)
            if j in (0,3):
                q=row[j+1];mid=[(p[c]+q[c])*.5 for c in range(3)];mid[1]-=.2+.35*(1+math.sin(row_index*1.4+j+strip_index));expanded.append(mid)
        strip.append(expanded)
    offset=len(vertices);n=len(strip);m=7
    for row in strip:
        vertices.extend((p[0],-p[2],p[1]) for p in row)
    for row in strip:
        floor=min(p[1] for p in row)-2
        vertices.extend((p[0],-p[2],floor) for p in row)
    count=n*m
    for i in range(n-1):
        for j in range(m-1):
            a=offset+i*m+j;b=a+1;c=a+m+1;d=a+m
            faces.extend([(a,b,c),(a,c,d),(a+count,c+count,b+count),(a+count,d+count,c+count)])
    boundary=list(range(m))+[i*m+m-1 for i in range(1,n)]+[(n-1)*m+j for j in range(m-2,-1,-1)]+[i*m for i in range(n-2,0,-1)]
    for i,a in enumerate(boundary):
        b=boundary[(i+1)%len(boundary)];a+=offset;b+=offset
        faces.extend([(a,a+count,b+count),(a,b+count,b)])
mesh=bpy.data.meshes.new('Old shore hillside supports');mesh.from_pydata(vertices,[],faces);mesh.update()
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));nonmanifold=sum(not e.is_manifold for e in bm.edges);bm.to_mesh(mesh);bm.free()
obj=bpy.data.objects.new('old-shore-blender-rock-support',mesh);scene.collection.objects.link(obj)
for i,factor in enumerate([.85,1,1.12]):
    mat=bpy.data.materials.new('Old shore slate '+str(i));mat.diffuse_color=(.09*factor,.145*factor,.215*factor,1);mat.use_nodes=True;mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=mat.diffuse_color;mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.95;obj.data.materials.append(mat)
for p in mesh.polygons:p.material_index=(p.index*7)%3;p.use_smooth=False
light=bpy.data.lights.new('Shore rock sun','SUN');light.energy=2;lo=bpy.data.objects.new('Shore rock sun',light);scene.collection.objects.link(lo);lo.rotation_euler=(.4,-.4,-.6)
cam=bpy.data.cameras.new('Shore rock camera');co=bpy.data.objects.new('Shore rock camera',cam);scene.collection.objects.link(co);co.location=(-19,-83,32);co.rotation_euler=(Vector((-49,-34,-2))-co.location).to_track_quat('-Z','Y').to_euler();cam.type='ORTHO';cam.ortho_scale=55;scene.camera=co
scene.world=bpy.data.worlds.new('Shore rock blue world');scene.world.color=(.08,.12,.18);scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1200;scene.render.resolution_y=800;scene.render.resolution_percentage=100
out=ROOT/'assets/models/optimized/citadel-old-shore';out.mkdir(parents=True,exist_ok=True)
positions=[];normals=[];colors=[]
mesh.calc_loop_triangles()
for tri in mesh.loop_triangles:
    color=obj.data.materials[mesh.polygons[tri.polygon_index].material_index].diffuse_color
    for vi in tri.vertices:
        v=mesh.vertices[vi].co;n=mesh.polygons[tri.polygon_index].normal
        positions.extend([round(v.x,6),round(v.z,6),round(-v.y,6)]);normals.extend([round(n.x,6),round(n.z,6),round(-n.y,6)]);colors.extend([round(c,6) for c in color[:3]])
data={'control':source['control'],'positions':positions,'normals':normals,'colors':colors,'triangles':len(mesh.loop_triangles),'nonmanifoldEdges':nonmanifold,'coordinateSpace':'castle-local; common frame old harbor candidate'}
(out/'oldShoreRockR03.js').write_text('export default '+json.dumps(data,separators=(',',':'))+';\n')
scene.render.filepath=str(ROOT/'artifacts/pipeline/citadel-old-harbor-grade/blender-rock-r03.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'old-shore-rock-r03.blend'),copy=True)
print(json.dumps({'triangles':data['triangles'],'nonmanifoldEdges':nonmanifold,'asset':str(out)}))
