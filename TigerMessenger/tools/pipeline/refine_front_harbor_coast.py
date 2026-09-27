import bpy,json,math,hashlib,sys
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
FOLDER=ROOT/'assets/models/optimized/citadel-front-coast'
data=json.loads((FOLDER/'source.json').read_text())
revision=3 if '--round3' in sys.argv else (2 if '--round2' in sys.argv else 1)
if revision>=2:data['basin'].update(radii=[35,27],inner=.72)
def mat(a):return Matrix([a[i:i+4] for i in range(0,16,4)]).transposed()
city=mat(data['cityMatrix']);ci=city.inverted();basin=data['basin']
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.name='Citadel_Front_Harbor_Coast_R%02d'%revision
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
def coords(v):
    # A common spherical direction, independent of mesh altitude.
    p=ci@(v.normalized()*160)
    if p.y < -70:return (999,999)
    return ((p.x-basin['center'][0])/basin['radii'][0],(p.z-basin['center'][1])/basin['radii'][1])
def distance(v):
    x,z=coords(v);return math.hypot(x,z)
def touch(tri):
    a=[coords(v) for v in tri]
    return min(p[0] for p in a)<=1 and max(p[0] for p in a)>=-1 and min(p[1] for p in a)<=1 and max(p[1] for p in a)>=-1
parts=[]
for part in data['parts']:
    M=mat(part['matrix']);inv=M.inverted();raw=part['positions'];indices=part['indices'] or list(range(len(raw)//3));verts=[M@Vector(raw[i:i+3]) for i in range(0,len(raw),3)]
    out=[];outcolors=[];changed=0;maximum=0
    colors=[Vector(part["colors"][i:i+3]) for i in range(0,len(part["colors"]),3)] if part.get("colors") else None
    def deform(v):
        global changed,maximum
        r=distance(v)
        if r>=1:return v
        t=max(0,min(1,(r-basin['inner'])/(1-basin['inner'])));blend=1-t*t*(3-2*t)
        drop=max(0,v.length-basin['seabedRadius'])*blend
        if drop>1e-6:changed+=1;maximum=max(maximum,drop)
        return v.normalized()*(v.length-drop)
    def refine(tri,cs,depth=0):
        spans=[(tri[i]-tri[(i+1)%3]).length for i in range(3)]
        if touch(tri) and max(spans)>1.5 and depth<14:
            i=spans.index(max(spans));a,b,c=tri[i],tri[(i+1)%3],tri[(i+2)%3];middle=(a+b)*.5
            cm=(cs[i]+cs[(i+1)%3])*.5 if cs else None
            refine([a,middle,c],[cs[i],cm,cs[(i+2)%3]] if cs else None,depth+1);refine([middle,b,c],[cm,cs[(i+1)%3],cs[(i+2)%3]] if cs else None,depth+1);return
        out.extend(inv@deform(v) for v in tri)
        if cs:outcolors.extend(float(v) for color in cs for v in color)
    for i in range(0,len(indices),3):refine([verts[j] for j in indices[i:i+3]],[colors[j] for j in indices[i:i+3]] if colors else None)
    if part['name']=='hills':
        changed=0;maximum=0
        out=[inv@deform(v) for v in verts]
        outcolors=part['colors'] or []
    if not changed:continue
    mesh=bpy.data.meshes.new(part['name']);mesh.from_pydata([(v.x,-v.z,v.y) for v in out],[],[tuple(indices[i:i+3]) for i in range(0,len(indices),3)] if part['name']=='hills' else [(i,i+1,i+2) for i in range(0,len(out),3)]);mesh.update()
    obj=bpy.data.objects.new(part['name']+'-'+str(part['ordinal']),mesh);scene.collection.objects.link(obj);obj.matrix_world=C@M@C.inverted()
    material=bpy.data.materials.new(obj.name);material.diffuse_color=(*part['color'],1);material.roughness=.98;mesh.materials.append(material)
    positions=[];normals=[]
    for face in mesh.polygons:
        for i in face.vertices:
            v=mesh.vertices[i].co;n=face.normal;positions.extend([v.x,v.z,-v.y]);normals.extend([n.x,n.z,-n.y])
    if part['name']=='hills':
        positions=[float(a) for v in mesh.vertices for a in (v.co.x,v.co.z,-v.co.y)]
        normals=[float(a) for v in mesh.vertices for a in (v.normal.x,v.normal.z,-v.normal.y)]
    parts.append({'indices':indices if part['name']=='hills' else None,'name':part['name'],'ordinal':part['ordinal'],'sourcePositions':raw,'positions':positions,'normals':normals,'colors':outcolors or None,'matrix':part['matrix'],'changedSamples':changed,'maxDrop':maximum})
result={'source':'assets/models/optimized/citadel-front-coast/front-coast-r%02d.blend'%revision,'cityMatrix':data['cityMatrix'],'basin':basin,'parts':parts,'scope':data['scope']}
bpy.ops.wm.save_as_mainfile(filepath=str(FOLDER/('front-coast-r%02d.blend'%revision)))
(FOLDER/('frontCoastR%02d.js'%revision)).write_text('export default '+json.dumps(result,separators=(',',':'))+';\n')
shared={**result,'parts':[{k:v for k,v in part.items() if k!='sourcePositions'} for part in result['parts']]}
(ROOT/'godot/data/citadel-front-coast.json').write_text(json.dumps(shared,separators=(',',':')))
print(json.dumps([{'name':p['name'],'ordinal':p['ordinal'],'changed':p['changedSamples'],'triangles':len(p['positions'])//9,'maxDrop':p['maxDrop']} for p in parts]))
