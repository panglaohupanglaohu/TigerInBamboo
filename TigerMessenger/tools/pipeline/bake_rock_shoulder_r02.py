import bpy,bmesh,json,math
from pathlib import Path
R=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
d=json.loads((R/'artifacts/pipeline/citadel-rock-shoulder/source.json').read_text())
scene=bpy.data.scenes.new('TigerMessenger_New_City_Rock_Shoulder_R02');bpy.context.window.scene=scene
mesh=bpy.data.meshes.new('Measured_Rock_Shoulder');mesh.from_pydata([(x,-z,y) for x,y,z in d['points']],[],d['faces']);mesh.update()
color=mesh.color_attributes.new(name='RockSourceColor',type='FLOAT_COLOR',domain='CORNER')
for loop in mesh.loops:color.data[loop.index].color=(*d['colors'][loop.vertex_index],1)
for v in mesh.vertices:
 x,z=v.co.x,-v.co.y;distance=max(x-86.4,z-88.2);fade=max(0,min(1,(7.5-distance)/2.5,(x-45.5)/2,(z-60)/2));weight=max(0,min(1,(distance-.8)/2))*fade
 if x-86.4>z-88.2:v.co.x+=.65*math.sin(z*.63)*weight
 else:v.co.y-=.65*math.sin(x*.57)*weight
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update()
obj=bpy.data.objects.new('new-city-rock-shoulder',mesh);scene.collection.objects.link(obj)
mat=bpy.data.materials.new('Citadel_Blue_Rock');mat.diffuse_color=(.16,.24,.34,1);obj.data.materials.append(mat)
positions=[];normals=[];colors=[]
for p in mesh.polygons:
 for li in p.loop_indices:
  vi=mesh.loops[li].vertex_index
  v=mesh.vertices[vi].co;n=p.normal;positions.extend([v.x,v.z,-v.y]);normals.extend([n.x,n.z,-n.y]);colors.extend(mesh.color_attributes["RockSourceColor"].data[li].color[:3])
out=R/'assets/models/optimized/citadel-rock-shoulder';out.mkdir(exist_ok=True)
bpy.data.libraries.write(str(out/'rock-shoulder-r02.blend'),{scene},fake_user=True)
(out/'rockShoulderR02.js').write_text('export default '+json.dumps({'source':'assets/models/optimized/citadel-rock-shoulder/rock-shoulder-r02.blend','positions':positions,'normals':normals,'colors':colors},separators=(',',':'))+';')
print(json.dumps({'triangles':len(positions)//9,'scene':scene.name}))
