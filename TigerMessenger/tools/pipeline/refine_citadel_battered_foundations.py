import bpy,json,math
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
folder=ROOT/'assets/models/optimized/citadel-compact-foundations'
source=json.loads((folder/'compactFoundationsR02.js').read_text().removeprefix('export default ').strip().removesuffix(';'))
frames=json.loads((ROOT/'artifacts/pipeline/citadel-compact-ascent/foundation-source.json').read_text())['parts']
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.name='Citadel_Upper_Foundations_R04'
result=[]
def clip(poly,side,seam):
    output=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        da=seam(a)*side;db=seam(b)*side
        if da>=0:output.append(a)
        if (da>=0)!=(db>=0):output.append(a.lerp(b,da/(da-db)))
    return output
def triangles(poly):return [[poly[0],poly[i],poly[i+1]] for i in range(1,len(poly)-1)]
for part in source['parts']:
    candidates=[p for p in frames if p['name']==part['name']];record=candidates[part['ordinal']]
    M=Matrix([record['matrix'][i:i+4] for i in range(0,16,4)]).transposed();inverse=M.inverted()
    floor=10 if part['name']=='middle-terrace-solid' else 16
    def seam(v):return v.y-(floor-1.4+.24*math.sin(v.x*.57)+.12*math.sin(v.z*.8))
    stone=[];rock=[]
    for i in range(0,len(part['positions']),9):
        tri=[M@Vector(part['positions'][i+j:i+j+3]) for j in [0,3,6]]
        # Linear clipping values at original triangle vertices. All top rails,
        # slab tops and routes above this low seam remain unmodified.
        stone.extend(triangles(clip(tri,1,seam)));rock.extend(triangles(clip(tri,-1,seam)))
    refined=[]
    def subdiv(tri,depth=0):
        lengths=[(tri[i]-tri[(i+1)%3]).length for i in range(3)]
        if max(lengths)>2.5 and depth<7:
            i=lengths.index(max(lengths));a,b,c=tri[i],tri[(i+1)%3],tri[(i+2)%3];m=(a+b)*.5
            subdiv([a,m,c],depth+1);subdiv([m,b,c],depth+1);return
        normal=(tri[1]-tri[0]).cross(tri[2]-tri[0]).normalized()
        for v in tri:
            # Continuous local relief depends only on position, not triangle:
            # no cracks between neighbouring facets. Upper seam is anchored.
            fade=min(1,max(0,(floor-1.9-v.y)/3.5))
            # Battered rock shoulders widen toward their foot. Keep the
            # whole central stair/courtyard corridor and upper seam fixed.
            corridor=min(1,max(0,(abs(v.x-60)-7)/4))
            horizontal=Vector((v.x-60,0,(v.z-(32 if floor==10 else 14))*.55))
            if horizontal.length>0:
                horizontal.normalize()
                facets=.78+.22*math.sin(v.x*.87+v.z*.65+v.y*.8)
                v=v+horizontal*(2.35*fade*corridor*facets)
            refined.append(inverse@v)
    for tri in rock:subdiv(tri)
    parts={}
    for name,verts in [('stone',[inverse@v for tri in stone for v in tri]),('rock',refined)]:
        mesh=bpy.data.meshes.new(part['name']+'-'+name)
        mesh.from_pydata([(v.x,-v.z,v.y) for v in verts],[],[(i,i+1,i+2) for i in range(0,len(verts),3)]);mesh.update()
        obj=bpy.data.objects.new(mesh.name,mesh);scene.collection.objects.link(obj);obj.matrix_world=C@M@C.inverted()
        mat=bpy.data.materials.new(name);mat.diffuse_color=(.58,.60,.59,1) if name=='stone' else (.14,.22,.32,1);mat.roughness=.98;obj.data.materials.append(mat)
        positions=[];normals=[]
        for f in mesh.polygons:
            for idx in f.vertices:
                v=mesh.vertices[idx].co;n=f.normal;positions.extend([v.x,v.z,-v.y]);normals.extend([n.x,n.z,-n.y])
        parts[name]={'positions':positions,'normals':normals}
    result.append({**{k:part[k] for k in ['name','ordinal','sourceDigest','changedVertices']},**parts['stone'],'rock':parts['rock']})
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'compact-foundations-r04.blend'))
(folder/'compactFoundationsR04.js').write_text('export default '+json.dumps({'source':'assets/models/optimized/citadel-compact-foundations/compact-foundations-r04.blend','parts':result,'refinement':{'scope':'battered rock lower shoulders; upper stone, floors and central route protected','maximumOutwardRelief':2.35,'protectedCentralHalfWidth':7}},separators=(',',':'))+';\n')
print(json.dumps([{'name':p['name'],'stone':len(p['positions'])//9,'rock':len(p['rock']['positions'])//9} for p in result]))
