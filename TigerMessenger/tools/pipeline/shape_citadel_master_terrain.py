"""R01 landform candidate, edited on the measured Blender terrain copy.

Raise side slopes between the three existing levels. Keep the coast, original
route clearance and original vertices below water; do not move buildings.
"""
import bpy,json,math,sys
from pathlib import Path
from mathutils import Matrix,Vector
root=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
folder=root/'artifacts/pipeline/citadel-master-terrain'
out=root/'assets/models/optimized/citadel-master-terrain'
revision=3 if '--revision=3' in sys.argv else 2 if '--revision=2' in sys.argv else 1
tag=f'r{revision:02d}'
data=json.loads((folder/'source.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(out/'master-terrain-baseline.blend'))
scene=bpy.data.scenes['TigerMessenger_Master_Terrain_Baseline'];scene.name='TigerMessenger_Master_Terrain_'+tag.upper()
values=data['cityMatrix'];city=Matrix([[values[c*4+r] for c in range(4)] for r in range(4)]);inverse=city.inverted()
sea=next(p for p in data['parts'] if p['kind']=='water')['vertices']
def sea_y(x,z):
 u=max(0,min(41.999,(x+150)/6));v=max(0,min(34.999,(z+70)/6));i,j=int(u),int(v);a,b=u-i,v-j
 return (sea[j*43+i][1]*(1-a)+sea[j*43+i+1][1]*a)*(1-b)+(sea[(j+1)*43+i][1]*(1-a)+sea[(j+1)*43+i+1][1]*a)*b
segments=[]
for route in data['routes']:
 for a,b in zip(route,route[1:]):segments.append((inverse@Vector(a),inverse@Vector(b)))
def route_cap(x,z):
 cap=1e6
 for a,b in segments:
  dx,dz=b.x-a.x,b.z-a.z;den=dx*dx+dz*dz
  t=max(0,min(1,((x-a.x)*dx+(z-a.z)*dz)/den)) if den>1e-8 else 0
  if (x-a.x-t*dx)**2+(z-a.z-t*dz)**2<4.5**2:cap=min(cap,a.y+t*(b.y-a.y)-.65)
 return cap
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
changes=[];stats=[]
for part in data['parts']:
 if part['name'] not in ['citadel-oskar-grid-mountain-surface','citadel-coastal-cliff-seal','new-city-rock-shoulder']:continue
 obj=scene.objects.get(part['name']);rows=[]
 for i,original in enumerate(part['vertices']):
  source=Vector(original);p=inverse@source;x,z=p.x,p.z
  if revision==3 and (z>58 or part['name']=='new-city-rock-shoulder'):continue
  edge=smooth((x-30)/10)*smooth((102-x)/12)*smooth((z-2)/10)*smooth((101-z)/12)
  above=source.y-sea_y(source.x,source.z)
  if edge<1e-6 or above<.4:continue
  # Established 16/10/4 metre levels. The side profile descends continuously
  # between levels, while the real route envelope caps every nearby vertex.
  grade=15.2 if z<24 else 15.2-(z-24)*.6 if z<34 else 9.2 if z<38 else 9.2-(z-38)*.6 if z<48 else 3.2
  half=21 if z<34 else 22 if z<58 else 24
  lateral=max(0,abs(x-62)-half)
  rough=.38*math.sin(x*.43+z*.29)+.18*math.sin(z*.79-x*.27)
  desired=min(grade-lateral*1.4+rough,route_cap(x,z))
  if z>=58 and 44<x<89:desired=min(desired,3.3)
  blend=edge*smooth((above-.4)/5)
  if revision==3:blend*=smooth((58-z)/10)
  rise=(min(4,max(0,desired-p.y)) if revision==3 else max(0,desired-p.y))*blend
  p.y+=rise
  outward=(3.2 if revision==3 else 6)*edge*smooth((x-76)/10)*math.exp(-((p.y-(grade-2.3))/3)**2)*smooth((above-.4)/4) if revision>=2 else 0
  if rise<.005 and outward<.005:continue
  p.x+=outward;result=city@p
  obj.data.vertices[i].co=(result.x,-result.z,result.y)
  rows.append([i,*original,*result])
 obj.data.update();changes.append({'name':part['name'],'vertexCount':len(part['vertices']),'changes':rows})
 stats.append({'name':part['name'],'changed':len(rows),'maxRise':max((r[5]-r[2] for r in rows),default=0)})
payload={'source':f'assets/models/optimized/citadel-master-terrain/master-terrain-{tag}.blend','frame':'castleContainer','stage':'candidate only; no default integration','parts':changes}
(out/f'masterTerrain{tag.upper()}.js').write_text('export default '+json.dumps(payload,separators=(',',':'))+';')
(folder/f'{tag}-report.json').write_text(json.dumps({'stats':stats,'routeClearance':.65,'routeRadius':4.5,'coastUnchangedBelow':.4,'status':'Blender candidate; Web/Godot validation pending'},indent=2))
scene['status']='R01 candidate: continuous new-city side slopes; coastline and route envelope retained. Not accepted.'
bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(out/f'master-terrain-{tag}.blend'))
scene.render.filepath=str(folder/f'blender-{tag}.png');bpy.ops.render.render(write_still=True,scene=scene.name)
print(json.dumps(stats))
