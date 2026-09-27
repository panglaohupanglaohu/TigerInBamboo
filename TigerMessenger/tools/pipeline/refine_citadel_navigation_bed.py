import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger');F=ROOT/'assets/models/optimized/citadel-front-coast'
data=json.loads((F/'frontCoastR03.js').read_text().removeprefix('export default ').strip().removesuffix(';'))
route=json.loads((ROOT/'assets/navigation/citadel-red-arrival-candidate.json').read_text())
points=[Vector(p).normalized()*160 for p in route['ocean']['points']]
segments=[(a,b-a,(b-a).length_squared) for a,b in zip(points,points[1:])]
part=next(p for p in data['parts'] if p['name']=='planet-surface')
vertices=[Vector(part['positions'][i:i+3]) for i in range(0,len(part['positions']),3)]
colors=[Vector(part['colors'][i:i+3]) for i in range(0,len(part['colors']),3)]
cache={}
def distance(v):
    key=tuple(round(x,5) for x in v)
    if key in cache:return cache[key]
    p=v.normalized()*160
    best=min((p-(a+d*max(0,min(1,(p-a).dot(d)/l)))).length for a,d,l in segments)
    cache[key]=best;return best
out=[];cs=[];changed=0;max_drop=0
inner,outer,target=9,13,157.6
def deform(v):
    global changed,max_drop
    r=distance(v)
    if r>=outer:return v
    t=max(0,min(1,(r-inner)/(outer-inner)));weight=1-t*t*(3-2*t)
    drop=max(0,v.length-target)*weight
    if drop>1e-6:changed+=1;max_drop=max(max_drop,drop)
    return v.normalized()*(v.length-drop)
def refine(tri,colors,depth=0):
    spans=[(tri[i]-tri[(i+1)%3]).length for i in range(3)];center=sum(tri,Vector())/3
    if distance(center)<outer+max(spans) and max(spans)>2 and depth<12:
        i=spans.index(max(spans));a,b,c=tri[i],tri[(i+1)%3],tri[(i+2)%3];mid=(a+b)*.5;cm=(colors[i]+colors[(i+1)%3])*.5
        refine([a,mid,c],[colors[i],cm,colors[(i+2)%3]],depth+1);refine([mid,b,c],[cm,colors[(i+1)%3],colors[(i+2)%3]],depth+1);return
    out.extend(deform(v) for v in tri);cs.extend(colors)
for i in range(0,len(vertices),3):refine(vertices[i:i+3],colors[i:i+3])
bpy.ops.wm.open_mainfile(filepath=str(F/'front-coast-r03.blend'))
obj=bpy.data.objects.get('planet-surface-0');assert obj is not None
mesh=bpy.data.meshes.new('Harbor_route_seabed');mesh.from_pydata([(v.x,-v.z,v.y) for v in out],[],[(i,i+1,i+2) for i in range(0,len(out),3)]);mesh.update()
for mat in obj.data.materials:mesh.materials.append(mat)
obj.data=mesh
part['positions']=[float(x) for v in out for x in v];part['colors']=[float(x) for c in cs for x in c];part['normals']=[float(x) for face in mesh.polygons for _ in face.vertices for x in (face.normal.x,face.normal.z,-face.normal.y)]
part['indices']=None
source='assets/models/optimized/citadel-front-coast/front-coast-navigation.blend';data['source']=source
report={'source':source,'innerWidth':inner*2,'outerWidth':outer*2,'bedRadius':target,'changedSamples':changed,'maxDrop':max_drop,'triangles':len(out)//3,'routePoints':[list(p) for p in points],'scope':'Only original underwater planet mesh; coast, water level, buildings and NPC geometry unchanged. Vessel route requires revalidation.'}
data['navigationBed']=report
data['geometrySignature']=hashlib.sha256(json.dumps([{k:p[k] for k in ['name','ordinal','positions','matrix']} for p in data['parts']],separators=(',',':')).encode()).hexdigest()
bpy.ops.wm.save_as_mainfile(filepath=str(F/'front-coast-navigation.blend'))
(F/'frontCoastNavigation.js').write_text('export default '+json.dumps(data,separators=(',',':'))+';\n')
(ROOT/'godot/data/citadel-front-coast.json').write_text(json.dumps({**data,'parts':[{k:v for k,v in p.items() if k!='sourcePositions'} for p in data['parts']]},separators=(',',':')))
(ROOT/'artifacts/pipeline/citadel-master-terrain/navigation-bed-blender.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='routePoints'}))
