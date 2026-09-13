"""R06: locally damp horizontal displacement until projected faces keep orientation."""
import bpy,json
from pathlib import Path
root=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger');folder=root/'artifacts/pipeline/citadel-master-terrain';out=root/'assets/models/optimized/citadel-master-terrain'
source=json.loads((folder/'source.json').read_text());payload=json.loads((out/'masterTerrainR04.js').read_text().removeprefix('export default ').rstrip(';'))
bpy.ops.wm.open_mainfile(filepath=str(out/'master-terrain-r04.blend'));scene=bpy.context.scene;scene.name='TigerMessenger_Master_Terrain_R06'
def area(a,b,c):return (b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0])
reports=[]
for patch in payload['parts']:
 part=next(p for p in source['parts'] if p['name']==patch['name']);original=part['vertices'];current=[list(v) for v in original]
 for row in patch['changes']:current[row[0]]=list(row[4:])
 faces=[part['indices'][i:i+3]for i in range(0,len(part['indices']),3)]
 groups={}
 for i,v in enumerate(original):groups.setdefault(tuple(round(q*10000) for q in v),[]).append(i)
 siblings={i:group for group in groups.values()for i in group}
 old_areas=[area(*(original[j]for j in f))for f in faces];edited=set();initial=None
 for iteration in range(40):
  bad=[f for f,a in zip(faces,old_areas)if abs(a)>.001 and area(*(current[j]for j in f))*a<a*a*.02]
  if initial is None:initial=len(bad)
  if not bad:break
  affected=set(k for f in bad for j in f for k in siblings[j])
  for i in affected:
   for axis in (0,2):current[i][axis]=original[i][axis]+(current[i][axis]-original[i][axis])*.5
   edited.add(i)
 else:raise RuntimeError('Unresolved projected face folds: '+part['name'])
 # Include siblings that were previously unchanged, otherwise the exported patch
 # would still split the seam when replayed in Web/Godot.
 changed_ids=set(row[0]for row in patch['changes'])|edited
 patch['changes']=[[i,*original[i],*current[i]]for i in sorted(changed_ids)]
 max_seam=0
 for group in groups.values():
  a=current[group[0]]
  for j in group[1:]:max_seam=max(max_seam,sum((current[j][k]-a[k])**2 for k in range(3))**.5)
 if max_seam>.001:raise RuntimeError('Duplicate-position seam split: '+str(max_seam))
 obj=scene.objects.get(part['name'])
 for i,p in enumerate(current):obj.data.vertices[i].co=(p[0],-p[2],p[1])
 obj.data.update();reports.append({'name':part['name'],'initialFoldOrCollapsedFaces':initial,'remaining':0,'horizontalVerticesDamped':len(edited),'iterations':iteration,'maxDuplicateVertexSeparation':max_seam})
payload['source']='assets/models/optimized/citadel-master-terrain/master-terrain-r06.blend'
(out/'masterTerrainR06.js').write_text('export default '+json.dumps(payload,separators=(',',':'))+';')
(folder/'r06-topology-audit.json').write_text(json.dumps(reports,indent=2));bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(out/'master-terrain-r06.blend'))
scene.render.filepath=str(folder/'blender-r06.png');bpy.ops.render.render(write_still=True,scene=scene.name);print(json.dumps(reports))
