import bpy,bmesh,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'artifacts/pipeline/citadel-tall-portal';OUT.mkdir(parents=True,exist_ok=True)
target=ROOT/'src/assets/citadelPortalBlenderData.js';source=OUT/'before.js'
if not source.exists():source.write_text(target.read_text())
data=json.loads(source.read_text().split('export default ',1)[1].strip().removesuffix(';'))
def height(y):
 if y<=3.832759:return y*5.3/3.832759
 if y<=6.172727:return 5.3+(y-3.832759)*3.2/(6.172727-3.832759)
 return 8.5+(y-6.172727)*4.5/(13-6.172727)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
result={}
for name,row in data.items():
 p=row['positions'];verts=[(p[i],-p[i+2],height(p[i+1]))for i in range(0,len(p),3)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],[tuple(range(i,i+3))for i in range(0,len(verts),3)]);mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
 ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
 mat=bpy.data.materials.new(name);mat.diffuse_color=(.8,.69,.48,1)if 'surround'in name else(.86,.83,.75,1);mesh.materials.append(mat)
 if 'surround'in name:ob.location.y=-1.3
 mesh.calc_loop_triangles();positions=[];normals=[]
 for tri in mesh.loop_triangles:
  for vi in tri.vertices:
   v=mesh.vertices[vi].co;n=tri.normal;positions.extend([round(v.x,6),round(v.z,6),round(-v.y,6)]);normals.extend([round(n.x,6),round(n.z,6),round(-n.y,6)])
 result[name]={'positions':positions,'normals':normals,'triangles':len(mesh.loop_triangles)}
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'portal-tall-arch.blend'))
target.write_text('// Existing portal reshaped in Blender; preserved wall perimeter and entry width.\nexport default '+json.dumps(result,separators=(',',':'))+';\n')
(OUT/'design.json').write_text(json.dumps({'source':str(source),'springHeight':5.3,'apexHeight':8.5,'wallHeight':13,'width':4.984615,'scope':'Original portal geometry vertically reshaped; no change to ground route or outer wall boundaries.'},indent=2))
print('TALL_PORTAL_COMPLETE')
