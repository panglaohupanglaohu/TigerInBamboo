"""Split the existing Blender east curtain into an upper wall and a rock footing."""
import bpy,bmesh,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/models/optimized/citadel-plaza-retaining'
data=json.loads((OUT/'plazaRetainingR03.js').read_text().split('export default ',1)[1].strip().removesuffix(';'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
rock=[];cut_y=0.0
def seam(v):return .8*math.sin(v[2]*.55)+.3*math.cos(v[2]*1.3)
def clip(poly,upper):
    result=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        da=a[1]-seam(a);db=b[1]-seam(b)
        ia=da>=0 if upper else da<=0
        ib=db>=0 if upper else db<=0
        if ia:result.append(a)
        if ia!=ib:
            t=da/(da-db);result.append(tuple(a[j]+t*(b[j]-a[j]) for j in range(3)))
    return result
def triangles(poly):return [(poly[0],poly[i],poly[i+1]) for i in range(1,len(poly)-1)]
def refine(tri,depth=0):
    lengths=[sum((tri[i][j]-tri[(i+1)%3][j])**2 for j in range(3)) for i in range(3)]
    k=max(range(3),key=lambda i:lengths[i])
    if lengths[k]<=9 or depth>=10:return [tri]
    a,b,c=tri[k],tri[(k+1)%3],tri[(k+2)%3];mid=tuple((a[j]+b[j])/2 for j in range(3))
    return refine((a,mid,c),depth+1)+refine((mid,b,c),depth+1)
def bake(name,triangles,color):
    verts=[(v[0],-v[2],v[1]) for tri in triangles for v in tri]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],[tuple(range(i,i+3)) for i in range(0,len(verts),3)])
    # Clipping opens the seam temporarily. Preserve original triangle winding;
    # a volume-based normal recalculation can invert unrelated open wall bays.
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(mesh);bm.free()
    ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
    mat=bpy.data.materials.new(name);mat.diffuse_color=(*color,1);mesh.materials.append(mat)
    mesh.calc_loop_triangles();p=[];n=[]
    for tri in mesh.loop_triangles:
        for vi in tri.vertices:
            v=mesh.vertices[vi].co;normal=tri.normal;p.extend([v.x,v.z,-v.y]);n.extend([normal.x,normal.z,-normal.y])
    return {'positions':p,'normals':n}
parts=[]
for i,part in enumerate(data['parts']):
    a=part['positions'];stone=[]
    for j in range(0,len(a),9):
        tri=[tuple(a[j+k:j+k+3]) for k in [0,3,6]]
        east=min(v[0] for v in tri)>90.29 and min(v[2] for v in tri)>60
        if east and min(v[1]-seam(v) for v in tri)<0:
            stone.extend(triangles(clip(tri,True)));rock.extend(triangles(clip(tri,False)))
        else:stone.append(tri)
    result=bake('upper-stone-'+str(i),stone,(.78,.76,.70));result['sourceDigest']=part['sourceDigest'];parts.append(result)
refined=[]
for tri in rock:
    for t in refine(tri):
        row=[]
        for x,y,z in t:
            # Zero displacement at the masonry seam; deterministic ridges share vertices.
            fade=min(1,max(0,(-y-1.2)/2.5))
            offset=fade*(.4+.35*math.sin(z*1.7+y*.42)+.2*math.sin(z*.63-y*.88))
            row.append((x+offset,y,z))
        refined.append(row)
rock_part=bake('east-rock-footing',refined,(.20,.29,.39))
result={'source':'assets/models/optimized/citadel-plaza-retaining/plaza-retaining-r04.blend','parts':parts,'rockPart':rock_part,'wallRockSeamY':cut_y}
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'plaza-retaining-r04.blend'))
(OUT/'plazaRetainingR04.js').write_text('export default '+json.dumps(result,separators=(',',':'))+';\n')
print('EAST_ROCK',len(rock_part['positions'])//9,'triangles; upper contact preserved')
