"""Round 5: reshape preserved V7 shore bases into quiet asymmetric chalk cliffs."""
import bpy, math, json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/models/optimized/crystal-v7/crystal-v7-r03.blend'))
keep=[bpy.data.objects.get('bank-rock-'+str(i)) for i in range(3)]
for o in list(bpy.context.scene.objects):
 if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
sites=[(3,40,9),(-42,-29,5),(43,-29,5)]
parts=[]
palette=['eee2c8','dbbda8','b2abc8','d7cedd','f2e6d0']
def linear(h):
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)];return [v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in c]
for owner,o in enumerate(keep):
 x,y,z=sites[owner]
 for v in o.data.vertices:
  dx,dy=v.co.x-x,v.co.y-y;a=math.atan2(dy,dx);level=round(v.co.z,2)
  factor=1+.10*math.sin(a*3+.4)+.06*math.cos(a*5+owner)
  v.co.x=x+dx*factor;v.co.y=y+dy*(1+.08*math.cos(a*3))
  # Vertical undercut shores; broad ledges rather than regular contour steps.
  if level<0:v.co.z=z-14+(1 if level> -3 else 0)
  else:v.co.z=z+(-1.2 if level<z-1 else -.25)
 o.data.materials.clear()
 for h in palette:
  m=bpy.data.materials.new('chalk_'+h);m.diffuse_color=(*linear(h),1);o.data.materials.append(m)
 o.data.update()
 for p in o.data.polygons:p.material_index=0 if p.normal.z>.5 else (2 if p.normal.y>.25 else (1 if p.normal.x>.5 else 3))
 o.data.calc_loop_triangles();positions=[];colors=[]
 for t in o.data.loop_triangles:
  col=o.data.materials[t.material_index].diffuse_color[:3]
  for i in t.vertices:
   v=o.data.vertices[i].co;positions.extend([round(v.x-x,5),round(v.z-z,5),round(-(v.y-y),5)]);colors.extend(col)
 parts.append({'owner':owner,'positions':positions,'colors':colors})
out=root/'assets/models/optimized/crystal-v9';out.mkdir(exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'v9-shore-cliffs.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'v9-shore-cliffs.glb'),export_format='GLB')
(root/'src/assets/crystalV9CliffsData.js').write_text('export const V9_CLIFFS='+json.dumps(parts,separators=(',',':'))+';\n')
print('Authored three source-derived cliff bases')
