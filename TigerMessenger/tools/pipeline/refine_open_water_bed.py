import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger');F=ROOT/'assets/models/optimized/citadel-front-coast'
data=json.loads((F/'frontCoastNavigation.js').read_text().removeprefix('export default ').strip().removesuffix(';'))
samples=json.loads((F/'ocean-seafloor-samples.json').read_text());assert samples['error']<.0001
part=next(p for p in data['parts'] if p['name']=='planet-surface');raw=part['positions'];assert len(raw)//3==len(samples['waterLevels'])
vertices=[];changed=0;protected=0;max_drop=0
for i,level in enumerate(samples['waterLevels']):
    v=Vector(raw[i*3:i*3+3]);radius=v.length
    if level is None or level-radius<=.15:protected+=1;vertices.append(v);continue
    t=max(0,min(1,(level-radius-.15)/.25));weight=t*t*(3-2*t)
    drop=max(0,radius-(level-2.8))*weight
    if drop>1e-6:changed+=1;max_drop=max(max_drop,drop)
    vertices.append(v.normalized()*(radius-drop))
bpy.ops.wm.open_mainfile(filepath=str(F/'front-coast-navigation.blend'))
obj=bpy.data.objects['planet-surface-0'];mesh=bpy.data.meshes.new('Measured_ocean_seafloor');mesh.from_pydata([(v.x,-v.z,v.y) for v in vertices],[],[(i,i+1,i+2) for i in range(0,len(vertices),3)]);mesh.update()
for mat in obj.data.materials:mesh.materials.append(mat)
obj.data=mesh
part['positions']=[float(x) for v in vertices for x in v];part['normals']=[float(x) for face in mesh.polygons for _ in face.vertices for x in (face.normal.x,face.normal.z,-face.normal.y)]
source='assets/models/optimized/citadel-front-coast/front-coast-open-water.blend';data['source']=source
report={'source':source,'targetDepth':2.8,'changedVertices':changed,'protectedVertices':protected,'maxDrop':max_drop,'scope':'Measured submerged base-planet vertices only, dry/missing-water vertices protected. Separate authored land, water surfaces, buildings and characters unchanged. Navigation still requires current-world route validation.'}
data['openWaterBed']=report
data['geometrySignature']=hashlib.sha256(json.dumps([{k:p[k] for k in ['name','ordinal','positions','matrix']} for p in data['parts']],separators=(',',':')).encode()).hexdigest()
bpy.ops.wm.save_as_mainfile(filepath=str(F/'front-coast-open-water.blend'))
(F/'frontCoastOpenWater.js').write_text('export default '+json.dumps(data,separators=(',',':'))+';\n')
(ROOT/'godot/data/citadel-front-coast.json').write_text(json.dumps({**data,'parts':[{k:v for k,v in p.items() if k!='sourcePositions'} for p in data['parts']]},separators=(',',':')))
(ROOT/'artifacts/pipeline/citadel-master-terrain/open-water-bed-blender.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
