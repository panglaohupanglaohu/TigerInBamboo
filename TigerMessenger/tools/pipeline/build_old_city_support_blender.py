import bpy, bmesh, json, math
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
s=json.loads((ROOT/'artifacts/pipeline/citadel-foundation-support/survey.json').read_text())
scene=bpy.data.scenes.get('TigerMessenger_Old_City_Support_Review') or bpy.data.scenes.new('TigerMessenger_Old_City_Support_Review')
for obj in list(scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
bpy.context.window.scene=scene
rows=s['rows'];route=s['route'];center=[sum(r['top'][k] for r in rows)/len(rows) for k in (0,2)]
def corridor(x,z):
    ys=[]
    for a,b in zip(route,route[1:]):
        dx,dz=b[0]-a[0],b[2]-a[2];den=dx*dx+dz*dz
        if den<1e-8:continue
        t=max(0,min(1,((x-a[0])*dx+(z-a[2])*dz)/den))
        if math.hypot(x-a[0]-dx*t,z-a[2]-dz*t)<4.5:ys.append(a[1]+(b[1]-a[1])*t-.8)
    return min(ys) if ys else 1000
vertices=[];faces=[]
# A closed coastal spur connects the unsupported run to rock already beneath
# the rear of the old-city shelf. Keep a full corridor below actual stair treads.
for i in list(range(87,113,2))+[112]:
    r=rows[i];x,y,z=r['top'];previous=rows[i-1]['top'];nxt=rows[(i+1)%len(rows)]['top']
    dx,dz=nxt[0]-previous[0],nxt[2]-previous[2];length=math.hypot(dx,dz);nx,nz=dz/length,-dx/length
    if nx*(center[0]-x)+nz*(center[1]-z)>0:nx,nz=-nx,-nz
    floor=min(r['sea']-2,(r['skyGround'][1]-.6) if r['skyGround'] else r['sea']-2)
    # Cross-section: top inner/outer, irregular two-layer exposed face, buried base.
    shape=[(-7,4.15),(.15,4.15),(1.4+.8*math.sin(i*1.7),4.15+(floor-4.15)*(.24+.07*math.sin(i))), (2.7+.9*math.sin(i*1.2),4.15+(floor-4.15)*(.53+.08*math.sin(i*1.5))), (3.2+.7*math.sin(i*2.1),4.15+(floor-4.15)*(.79+.05*math.sin(i*.7))), (3.8+.6*math.sin(i*1.1),floor),(-7,floor)]
    for offset,yy in shape:
        xx,zz=x+nx*offset,z+nz*offset;yy=min(yy,corridor(xx,zz))
        vertices.append((xx,-zz,yy))
m=7;n=len(vertices)//m
for i in range(n-1):
    for j in range(m):
        a=i*m+j;b=i*m+(j+1)%m;c=(i+1)*m+(j+1)%m;d=(i+1)*m+j
        faces.extend([(a,b,c),(a,c,d)])
faces.extend([tuple(range(m-1,-1,-1)),tuple((n-1)*m+j for j in range(m))])
mesh=bpy.data.meshes.new('Old city coastal rock spur');mesh.from_pydata(vertices,[],faces);mesh.update()
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));nonmanifold=sum(not e.is_manifold for e in bm.edges);bm.to_mesh(mesh);bm.free()
obj=bpy.data.objects.new('citadel-old-city-support-spur',mesh);scene.collection.objects.link(obj)
for i,factor in enumerate([.84,1,1.13]):
    mat=bpy.data.materials.new('Old city slate '+str(i));mat.diffuse_color=(.09*factor,.145*factor,.215*factor,1);mat.use_nodes=True;mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=mat.diffuse_color;mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.96;mesh.materials.append(mat)
for p in mesh.polygons:p.material_index=(p.index*7)%3;p.use_smooth=False
light=bpy.data.lights.new('Spur sunlight','SUN');light.energy=2;lo=bpy.data.objects.new('Spur sunlight',light);scene.collection.objects.link(lo);lo.rotation_euler=(.4,-.4,-.6)
cam=bpy.data.cameras.new('Spur camera');co=bpy.data.objects.new('Spur camera',cam);scene.collection.objects.link(co);co.location=(-24,-74,26);co.rotation_euler=(Vector((-53,-22,-2))-co.location).to_track_quat('-Z','Y').to_euler();cam.type='ORTHO';cam.ortho_scale=48;scene.camera=co
scene.world=bpy.data.worlds.new('Spur blue world');scene.world.color=(.08,.12,.18);scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1200;scene.render.resolution_y=800;scene.render.resolution_percentage=100
out=ROOT/'assets/models/optimized/citadel-old-city-support';out.mkdir(parents=True,exist_ok=True)
positions=[];normals=[];colors=[];mesh.calc_loop_triangles()
for tri in mesh.loop_triangles:
    poly=mesh.polygons[tri.polygon_index];color=mesh.materials[poly.material_index].diffuse_color
    for vi in tri.vertices:
        v=mesh.vertices[vi].co;normal=poly.normal
        positions.extend([round(v.x,6),round(v.z,6),round(-v.y,6)]);normals.extend([round(normal.x,6),round(normal.z,6),round(-normal.y,6)]);colors.extend([round(c,6) for c in color[:3]])
data={'positions':positions,'normals':normals,'colors':colors,'triangles':len(mesh.loop_triangles),'nonmanifoldEdges':nonmanifold,'foundationMatrix':s['foundationMatrix'],'castleMatrix':s['castleMatrix'],'route':route,'coordinateSpace':'castle-local; common frame old harbor candidate'}
(out/'oldCitySupportR02.js').write_text('export default '+json.dumps(data,separators=(',',':'))+';\n')
scene.render.filepath=str(ROOT/'artifacts/pipeline/citadel-foundation-support/blender-r02.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'old-city-support-r02.blend'),copy=True)
print(json.dumps({'triangles':data['triangles'],'nonmanifoldEdges':nonmanifold}))
