"""R04: preserve occupied WFC lots, blend unused shelf gaps into the mountain."""
import bpy,json,math
from pathlib import Path
from mathutils import Matrix,Vector
root=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
folder=root/'artifacts/pipeline/citadel-master-terrain';out=root/'assets/models/optimized/citadel-master-terrain'
d=json.loads((folder/'source.json').read_text())
payload=json.loads((out/'masterTerrainR03.js').read_text().removeprefix('export default ').rstrip(';'))
bpy.ops.wm.open_mainfile(filepath=str(out/'master-terrain-r03.blend'))
scene=bpy.context.scene;scene.name='TigerMessenger_Master_Terrain_R04'
v=d['oldFrame'];frame=Matrix([[v[c*4+r] for c in range(4)] for r in range(4)]);inv=frame.inverted()
part=next(p for p in d['parts'] if p['name']=='citadel-oskar-grid-mountain-surface')
obj=scene.objects.get(part['name']);target=next(p for p in payload['parts'] if p['name']==part['name']);rows={r[0]:r for r in target['changes']}
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
count=0;max_change=0;protected=0;minimum_distance=1e6
for i,xyz in enumerate(part['vertices']):
 p=inv@Vector(xyz);x,z=p.x,p.z
 if abs(x)>28 or not -29<z<-1 or p.y<3:continue
 distance=min(math.hypot(max(0,abs(x-l['x'])-1.7),max(0,abs(z-l['z'])-1.7)) for l in d['oldLots'])
 # Keep the central original tower and a generous margin around actual lots.
 if distance<2.5 or (abs(x)<5.5 and abs(z)<5.5):protected+=1;continue
 blend=smooth((distance-2.5)/3)*smooth((28-abs(x))/5)*smooth((z+29)/4)*smooth((-1-z)/3)
 desired=4.87+6*smooth((-z-1)/9)+6*smooth((-z-11)/12)
 desired+=.45*math.sin(x*.31+z*.2)*math.sin(z*.23)
 delta=max(-4,min(4,desired-p.y))*blend
 if abs(delta)<.01:continue
 p.y+=delta;result=frame@p;obj.data.vertices[i].co=(result.x,-result.z,result.y)
 rows[i]=[i,*xyz,*result];count+=1;max_change=max(max_change,abs(delta));minimum_distance=min(minimum_distance,distance)
obj.data.update();target['changes']=list(rows.values())
payload['source']='assets/models/optimized/citadel-master-terrain/master-terrain-r04.blend'
(out/'masterTerrainR04.js').write_text('export default '+json.dumps(payload,separators=(',',':'))+';')
report={'oldLots':len(d['oldLots']),'changedOldVertices':count,'protectedVertices':protected,'maximumVerticalChange':max_change,'minimumDistanceOutsideLotRectangles':minimum_distance,'scope':'occupied lot rectangles expanded by 2.5m plus central tower preserved; actual corner rays still required','defaultIntegrated':False}
(folder/'r04-report.json').write_text(json.dumps(report,indent=2))
bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(out/'master-terrain-r04.blend'))
scene.render.filepath=str(folder/'blender-r04.png');bpy.ops.render.render(write_still=True,scene=scene.name)
print(json.dumps(report))
