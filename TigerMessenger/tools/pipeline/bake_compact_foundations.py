import bpy,bmesh,json,math
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
data=json.loads((ROOT/'artifacts/pipeline/citadel-compact-ascent/foundation-source.json').read_text())
scene=bpy.data.scenes.get('TigerMessenger_Compact_Foundations') or bpy.data.scenes.new('TigerMessenger_Compact_Foundations');bpy.context.window.scene=scene
for obj in list(scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
parts=[];occurrences={}
for p in data['parts']:
 name=p['name'];ordinal=occurrences.get(name,0);occurrences[name]=ordinal+1
 if not p['changes']:continue
 vertices=[(p['positions'][i],-p['positions'][i+2],p['positions'][i+1]) for i in range(0,len(p['positions']),3)]
 for i,x,y,z in p['changes']:vertices[int(i)]=(x,-z,y)
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],[(i,i+1,i+2) for i in range(0,len(vertices),3)]);mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update()
 obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj)
 M=Matrix([p['matrix'][i:i+4] for i in range(0,16,4)]).transposed();obj.matrix_world=C@M@C.inverted()
 mat=bpy.data.materials.new(name+'-stone');mat.diffuse_color=(*p['color'],1);mat.roughness=.96;obj.data.materials.append(mat)
 positions=[];normals=[]
 for face in mesh.polygons:
  for vi in face.vertices:
   v=mesh.vertices[vi].co;n=face.normal;positions.extend((v.x,v.z,-v.y));normals.extend((n.x,n.z,-n.y))
 parts.append({'name':name,'ordinal':ordinal,'sourceDigest':p['sourceDigest'],'positions':positions,'normals':normals,'changedVertices':len(p['changes'])})
folder=ROOT/'assets/models/optimized/citadel-compact-foundations'
bpy.data.libraries.write(str(folder/'compact-foundations-r01.blend'),{scene},fake_user=True)
(folder/'compactFoundationsR01.js').write_text('export default '+json.dumps({'source':'assets/models/optimized/citadel-compact-foundations/compact-foundations-r01.blend','parts':parts},separators=(',',':'))+';\n')
print('Compact foundation parts:',len(parts),'triangles:',sum(len(p['positions'])//9 for p in parts))
