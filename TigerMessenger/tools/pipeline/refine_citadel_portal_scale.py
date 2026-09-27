"""Remodel the existing beveled portal in Blender, preserving its outer wall joins."""
import bpy,bmesh,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'artifacts/pipeline/citadel-portal-scale'
OUT.mkdir(parents=True,exist_ok=True)
target=ROOT/'src/assets/citadelPortalBlenderData.js'
source=OUT/'portal-before.js'
if not source.exists():source.write_text(target.read_text())
data=json.loads(source.read_text().split('export default ',1)[1].strip().removesuffix(';'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def map_x(x):
    sign=-1 if x<0 else 1;a=abs(x)
    return sign*(a*2.7/3.9 if a<=3.9 else 2.7+(a-3.9)*(5.3-2.7)/(5.3-3.9))
def map_y(y):
    if y<=5.8:return y*3.9/5.8
    if y<=9.1:return 3.9+(y-5.8)*2.5/3.3
    return 6.4+(y-9.1)*6.6/3.9
result={}
for name,row in data.items():
    p=row['positions'];vertices=[(map_x(p[i]),-p[i+2],map_y(p[i+1])) for i in range(0,len(p),3)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],[tuple(range(i,i+3)) for i in range(0,len(vertices),3)]);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
    if 'surround' in name:ob.location.y=-1.3
    mat=bpy.data.materials.new(name+' stone');mat.diffuse_color=(.72,.65,.5,1) if 'surround' in name else (.85,.82,.73,1);mesh.materials.append(mat)
    mesh.calc_loop_triangles();positions=[];normals=[]
    for tri in mesh.loop_triangles:
        for vi in tri.vertices:
            v=mesh.vertices[vi].co;n=tri.normal
            positions.extend([round(v.x,6),round(v.z,6),round(-v.y,6)])
            normals.extend([round(n.x,6),round(n.z,6),round(-n.y,6)])
    result[name]={'positions':positions,'normals':normals,'triangles':len(mesh.loop_triangles)}
bpy.context.scene['source']='Existing Blender-beveled portal; outer wall endpoints and top retained'
bpy.context.scene['opening_width']=map_x(3.6)*2
bpy.context.scene['opening_apex']=map_y(8.8)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'portal-human-scale.blend'))
target.write_text('// Existing portal remodeled in Blender; see refine_citadel_portal_scale.py.\nexport default '+json.dumps(result,separators=(',',':'))+';\n')
(OUT/'report.json').write_text(json.dumps({'opening':{'width':map_x(3.6)*2,'springHeight':map_y(5.7),'apexHeight':map_y(8.8)},'outerWall':{'width':10.6,'height':13},'source':str(source),'blend':str(OUT/'portal-human-scale.blend')},indent=2))
print('PORTAL_SCALE_COMPLETE')
