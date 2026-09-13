import bpy,bmesh,json,math
from pathlib import Path
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
data=json.loads((ROOT/'artifacts/pipeline/citadel-middle-terraces/blender-source.json').read_text())
scene=bpy.data.scenes.get('TigerMessenger_Middle_Terraces_Review') or bpy.data.scenes.new('TigerMessenger_Middle_Terraces_Review');bpy.context.window.scene=scene
for o in list(scene.objects):bpy.data.objects.remove(o,do_unlink=True)
parts=[]
for i,p in enumerate(data['parts']):
 a=p['positions'];vertices=[(a[j],-a[j+2],a[j+1]) for j in range(0,len(a),3)];faces=[(j,j+1,j+2) for j in range(0,len(vertices),3)]
 mesh=bpy.data.meshes.new('plaza-stone');mesh.from_pydata(vertices,[],faces);mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 # Dissolve the flat box-face triangulation before cutting narrow stone edges.
 bmesh.ops.dissolve_limit(bm,angle_limit=.001,verts=list(bm.verts),edges=list(bm.edges),use_dissolve_boundaries=False)
 edges=[e for e in bm.edges if len(e.link_faces)==2 and e.calc_face_angle()>0.3]
 bmesh.ops.bevel(bm,geom=edges,offset=.035,segments=1,affect='EDGES',clamp_overlap=True)
 bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update()
 obj=bpy.data.objects.new('harbor-curtain-part-'+str(i),mesh);scene.collection.objects.link(obj)
 mat=bpy.data.materials.new('plaza-stone-'+str(i));mat.diffuse_color=(*p['color'],1);obj.data.materials.append(mat)
 positions=[];normals=[]
 for poly in mesh.polygons:
  for vi in poly.vertices:
   v=mesh.vertices[vi].co;n=poly.normal;positions.extend([v.x,v.z,-v.y]);normals.extend([n.x,n.z,-n.y])
 digest=2166136261
 for value in p['positions']:digest=((digest^(math.floor(value*10000+.5)&0xffffffff))*16777619)&0xffffffff
 parts.append({'positions':positions,'normals':normals,'sourceDigest':digest})
folder=ROOT/'assets/models/optimized/citadel-middle-terraces'
bpy.data.libraries.write(str(folder/'middle-terraces-r02.blend'),{scene},fake_user=True)
(folder/'middleTerracesR01.js').write_text('export default '+json.dumps({'source':'assets/models/optimized/citadel-middle-terraces/middle-terraces-r02.blend','parts':parts},separators=(',',':'))+';\n')
print('Blender stone edge triangles:',sum(len(p['positions'])//9 for p in parts))
