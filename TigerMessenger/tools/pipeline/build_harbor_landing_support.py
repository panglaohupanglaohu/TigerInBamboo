import bpy,bmesh,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
source=json.loads((ROOT/'artifacts/pipeline/citadel-landing-support/source.json').read_text())
out=ROOT/'assets/models/optimized/citadel-landing-support';out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
points=source['grid'];top=source['top'];nx=source['nx'];nz=source['nz'];n=len(points)
verts=[(x,-z,y) for x,y,z in points]+[(x,-z,top) for x,y,z in points]
faces=[]
for j in range(nz-1):
 for i in range(nx-1):
  a=j*nx+i;b=a+1;c=b+nx;d=a+nx
  faces.extend([(a,d,c,b),(a+n,b+n,c+n,d+n)])
edge=list(range(nx))+[j*nx+nx-1 for j in range(1,nz)]+[(nz-1)*nx+i for i in range(nx-2,-1,-1)]+[j*nx for j in range(nz-2,0,-1)]
for i,a in enumerate(edge):
 b=edge[(i+1)%len(edge)];faces.append((a,b,b+n,a+n))
mesh=bpy.data.meshes.new('landing rock-contact support');mesh.from_pydata(verts,[],faces);mesh.update()
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
obj=bpy.data.objects.new('harbor-landing-support',mesh);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj;obj.select_set(True)
# Earlier Blender rounds remain archived.
# Small bevel only; preserve lower rock contact and upper walkable slab height.
mod=obj.modifiers.new('Stone edge bevel','BEVEL');mod.width=.045;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
mesh=obj.data;mesh.calc_loop_triangles();positions=[];normals=[]
for tri in mesh.loop_triangles:
 for idx in tri.vertices:
  v=mesh.vertices[idx].co;n=tri.normal;positions.extend([round(v.x,6),round(v.z,6),round(-v.y,6)]);normals.extend([round(n.x,6),round(n.z,6),round(-n.y,6)])
bpy.ops.wm.save_as_mainfile(filepath=str(out/'landing-support-r03.blend'))
data={'positions':positions,'normals':normals,'source':'assets/models/optimized/citadel-landing-support/landing-support-r03.blend','support':source,'triangles':len(mesh.loop_triangles)}
(out/'landingSupportR03.js').write_text('export default '+json.dumps(data,separators=(',',':'))+';\n')
print('LANDING_SUPPORT_DONE',len(mesh.loop_triangles))
