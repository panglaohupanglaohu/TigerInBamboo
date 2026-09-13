import bpy,bmesh,json,math
from pathlib import Path
R=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
d=json.loads((R/'artifacts/pipeline/citadel-upper-rock-terraces/source.json').read_text())
scene=bpy.data.scenes.new('TigerMessenger_Upper_Rock_Terraces_R01');bpy.context.window.scene=scene
mesh=bpy.data.meshes.new('Measured_Rock_Shoulder');mesh.from_pydata([(x,-z,y) for x,y,z in d['points']],[],d['faces']);mesh.update()
color=mesh.color_attributes.new(name='RockSourceColor',type='FLOAT_COLOR',domain='CORNER')
for loop in mesh.loops:color.data[loop.index].color=(*d['colors'][loop.vertex_index],1)
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update()
obj=bpy.data.objects.new('new-city-upper-rock-terraces',mesh);scene.collection.objects.link(obj)
mat=bpy.data.materials.new('Citadel_Blue_Rock');mat.diffuse_color=(.16,.24,.34,1);obj.data.materials.append(mat)
positions=[];normals=[];colors=[]
for p in mesh.polygons:
 for li in p.loop_indices:
  vi=mesh.loops[li].vertex_index
  v=mesh.vertices[vi].co;n=p.normal;positions.extend([v.x,v.z,-v.y]);normals.extend([n.x,n.z,-n.y]);colors.extend(mesh.color_attributes["RockSourceColor"].data[li].color[:3])
out=R/'assets/models/optimized/citadel-upper-rock-terraces';out.mkdir(exist_ok=True)
bpy.data.libraries.write(str(out/'upper-rock-terraces-r01.blend'),{scene},fake_user=True)
(out/'upperRockTerracesR01.js').write_text('export default '+json.dumps({'source':'assets/models/optimized/citadel-upper-rock-terraces/upper-rock-terraces-r01.blend','positions':positions,'normals':normals,'colors':colors},separators=(',',':'))+';')
print(json.dumps({'triangles':len(positions)//9,'scene':scene.name}))
