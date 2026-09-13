import bpy,bmesh,json,math
from pathlib import Path
R=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
d=json.loads((R/'artifacts/pipeline/citadel-rock-shoulder/source.json').read_text())
scene=bpy.data.scenes.new('TigerMessenger_New_City_Rock_Shoulder_R01');bpy.context.window.scene=scene
mesh=bpy.data.meshes.new('Measured_Rock_Shoulder');mesh.from_pydata([(x,-z,y) for x,y,z in d['points']],[],d['faces']);mesh.update()
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update()
obj=bpy.data.objects.new('new-city-rock-shoulder',mesh);scene.collection.objects.link(obj)
mat=bpy.data.materials.new('Citadel_Blue_Rock');mat.diffuse_color=(.16,.24,.34,1);obj.data.materials.append(mat)
positions=[];normals=[]
for p in mesh.polygons:
 for vi in p.vertices:
  v=mesh.vertices[vi].co;n=p.normal;positions.extend([v.x,v.z,-v.y]);normals.extend([n.x,n.z,-n.y])
out=R/'assets/models/optimized/citadel-rock-shoulder';out.mkdir(exist_ok=True)
bpy.data.libraries.write(str(out/'rock-shoulder-r01.blend'),{scene},fake_user=True)
(out/'rockShoulderR01.js').write_text('export default '+json.dumps({'source':'assets/models/optimized/citadel-rock-shoulder/rock-shoulder-r01.blend','positions':positions,'normals':normals},separators=(',',':'))+';')
print(json.dumps({'triangles':len(positions)//9,'scene':scene.name}))
