"""Stage-one R07 blockout: reshape the master surface, not extra rock props.

Construction lots in this proposal are future layout envelopes. Existing lots
are deliberately not constraints; buildings must be reconciled in stage three.
"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Matrix, Vector

root=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
folder=root/'artifacts/pipeline/citadel-master-terrain'
out=root/'assets/models/optimized/citadel-master-terrain'
d=json.loads((folder/'source.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(out/'master-terrain-baseline.blend'))
revision=9 if '--revision=9' in sys.argv else 8 if '--revision=8' in sys.argv else 7
tag=f'r{revision:02d}'
scene=bpy.context.scene;scene.name='TigerMessenger_Master_Terrain_'+tag.upper()+'_Structure'
def matrix(a):return Matrix([[a[c*4+r] for c in range(4)] for r in range(4)])
city=matrix(d['cityMatrix']);ci=city.inverted();old=matrix(d['oldFrame']);oi=old.inverted()
def smooth(t):
 t=max(0.,min(1.,t));return t*t*(3-2*t)
def lerp(a,b,t):return a+(b-a)*t
def profile(z,knots):
 for (a,h),(b,k) in zip(knots,knots[1:]):
  if z<=b:return lerp(h,k,smooth((z-a)/(b-a)))
 return knots[-1][1]
sea=next(p for p in d['parts'] if p['kind']=='water')['vertices']
def sea_y(x,z):
 u=max(0,min(41.999,(x+150)/6));v=max(0,min(34.999,(z+70)/6));i,j=int(u),int(v);a,b=u-i,v-j
 return lerp(lerp(sea[j*43+i][1],sea[j*43+i+1][1],a),lerp(sea[(j+1)*43+i][1],sea[(j+1)*43+i+1][1],a),b)

# Unequal small terraces follow the rotated old hillside; no continuous bands.
lots=[{'x':x,'z':z,'y':y,'width':w,'depth':dep} for x,z,y,w,dep in
 [(-17,0,5,12,8),(1,-4,7,13,8),(16,-11,10,10,8),(-12,-14,12,12,8),
  (3,-22,16,11,8),(-17,-28,19,10,7),(13,-33,23,10,7)]]
segments=[]
for route in d['routes']:
 for a,b in zip(route,route[1:]):segments.append((ci@Vector(a),ci@Vector(b)))
def route_cap(x,z):
 cap=1e9
 for a,b in segments:
  dx,dz=b.x-a.x,b.z-a.z;den=dx*dx+dz*dz
  t=max(0,min(1,((x-a.x)*dx+(z-a.z)*dz)/den)) if den>1e-8 else 0
  if (x-a.x-t*dx)**2+(z-a.z-t*dz)**2<4.5**2:cap=min(cap,lerp(a.y,b.y,t)-.65)
 return cap

def reshape(v):
 p=Vector(v);o=oi@p;n=ci@p;water=sea_y(p.x,p.z)
 # The spherical mesh also contains deep returning flanks. They are not
 # construction surfaces, even where the local sea envelope is lower still.
 coastal=smooth((p.y-water-.5)/5)*smooth((p.y+8)/12)
 if p.y-water<=.5:return p
 y=p.y
 # Replace the old broad cut shelves with a continuous climbing slope.
 weight=smooth((32-abs(o.x))/8)*smooth((o.z+45)/10)*smooth((12-o.z)/9)
 if weight:
  desired=4.1+max(0,-o.z)*.57+.8*math.sin(o.x*.17+o.z*.09)
  for lot in lots:
   dist=math.hypot(max(0,abs(o.x-lot['x'])-lot['width']/2),max(0,abs(o.z-lot['z'])-lot['depth']/2))
   desired=lerp(desired,lot['y']-.15,1-smooth(dist/3.5))
  y=lerp(y,desired,weight*coastal)
 # Directional ridge behind the old city, with a saddle towards the bay.
 weight=smooth((-o.z-25)/14)*smooth((o.z+66)/10)*smooth((49-abs(o.x))/12)
 if weight:
  ridge=22+19*math.exp(-((o.x+12)/24)**2-((o.z+45)/30)**2)
  ridge+=5*math.sin(o.x*.13+o.z*.08)
  y=lerp(y,ridge,weight*coastal)
 # New city: one descending shoulder from keep to plaza, broad mid-slope.
 outer=smooth((132-n.x)/30) if revision>=9 else smooth((104-n.x)/14)
 weight=smooth((n.x-28)/12)*outer*smooth((n.z-3)/13)*smooth((96-n.z)/10)
 if weight:
  grade=profile(n.z,[(3,23),(22,15.2),(36,9.2),(59,3.25),(86,3.25),(96,-4)])
  shoulder=max(0,abs(n.x-62)-23)
  desired=grade-shoulder*1.05+.35*math.sin(n.x*.27+n.z*.19)
  if revision>=8:
   # Bring the upper outer shoulder down toward its actual curved shoreline,
   # rather than leaving a horizontal table terminating in a vertical wall.
   flank=smooth((abs(n.x-62)-18)/24)
   desired=lerp(grade,water+1.2,flank)
   desired+=.5*math.sin(n.x*.28+n.z*.17)*flank
   # Keep the broad plaza's construction envelope, lower only its outside.
   if 59<n.z<87 and 44.85<n.x<87:desired=3.25
  desired=min(desired,route_cap(n.x,n.z))
  if revision>=9 and p.y<4:
   # Lower the exposed lower flank too; never lift deep returning geometry.
   y=lerp(y,min(y,desired),weight*smooth((p.y-water-.5)/5))
  else:y=lerp(y,desired,weight*coastal)
 p.y=y
 return p

parts=[];stats=[]
for part in d['parts']:
 if part['name'] not in ['citadel-oskar-grid-mountain-surface','citadel-coastal-cliff-seal']:continue
 obj=scene.objects.get(part['name']);rows=[];cache={}
 for i,v in enumerate(part['vertices']):
  key=tuple(round(k,4) for k in v)
  if key not in cache:cache[key]=reshape(v)
  p=cache[key]
  if (p-Vector(v)).length<.00001:continue
  obj.data.vertices[i].co=(p.x,-p.z,p.y);rows.append([i,*v,*p])
 obj.data.update()
 parts.append({'name':part['name'],'vertexCount':len(part['vertices']),'changes':rows})
 stats.append({'name':part['name'],'changedVertices':len(rows),'maximumHeightChange':max((abs(r[5]-r[2]) for r in rows),default=0)})
payload={'source':f'assets/models/optimized/citadel-master-terrain/master-terrain-{tag}.blend','frame':'castleContainer','stage':'Stage 1 structural proposal; old buildings need later relocation','parts':parts}
(out/f'masterTerrain{tag.upper()}.js').write_text('export default '+json.dumps(payload,separators=(',',':'))+';')
(folder/f'{tag}-layout.json').write_text(json.dumps({'oldFrame':d['oldFrame'],'oldConstructionEnvelopes':lots,'status':'planning envelopes, not migrated buildings','stats':stats},indent=2))
scene['status']='Stage 1 structural blockout; terrain changed, existing buildings not migrated. Not accepted.'
bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(out/f'master-terrain-{tag}.blend'))
scene.render.filepath=str(folder/f'blender-{tag}.png');bpy.ops.render.render(write_still=True)
print(json.dumps(stats))
