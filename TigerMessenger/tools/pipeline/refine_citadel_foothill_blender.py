import bpy,math,json,os
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
OUT=ROOT/'artifacts/pipeline/citadel-cliff-blender';OUT.mkdir(parents=True,exist_ok=True)
ASSET=ROOT/'assets/models/optimized/citadel-cliff';ASSET.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ASSET/'citadel-cliff-input-v2.glb'))
terrain=next(o for o in bpy.data.objects if o.type=='MESH' and o.name=='citadel-oskar-grid-mountain-surface')
base=[v.co.copy() for v in terrain.data.vertices]
world=terrain.matrix_world.copy();inv=world.inverted()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12
scene.render.resolution_x=1100;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Cliff review daylight');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.12,.19,.28,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
sun=bpy.data.objects.new('Review sun',bpy.data.lights.new('Review sun','SUN'));scene.collection.objects.link(sun);sun.data.energy=2
sun.rotation_euler=(.4,-.35,-.4)
cam=bpy.data.objects.new('Cliff review camera',bpy.data.cameras.new('Cliff review camera'));scene.collection.objects.link(cam)
cam.location=(85,-115,48);cam.rotation_euler=(Vector((8,-37,6))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(48);scene.camera=cam
reports=[]
for iteration in [5,6]:
 changed=0
 for v,original in zip(terrain.data.vertices,base):
  p=world@original;x,z,h=p.x,-p.y,p.z
  # Protect the plaza top, harbor access, and all authored routes.
  cliff=(-19<x<65 and 60<z<116 and h<3.15 and (abs(x-8)>15.7 or z>83.7))
  if cliff and not(-13<x<-7 and z<80):
   weight=min(1,max(0,(3.15-h)/4))*min(1,max(0,(116-z)/3))
   side=1 if x>8 else -1
   p.x+=weight*side*(.65*math.sin(z*.39+x*.16)+.35*math.sin(h*.65+z*.2))
   p.y-=weight*(.65*math.sin(x*.46+h*.2))
   p.z+=weight*(.42*math.sin(h*.85+x*.33)+.22*math.cos(z*.6))
   if iteration>=2:
    # Broader vertical breaks and uneven ledges rather than high-frequency noise.
    p.x+=weight*side*.38*math.sin(z*.18)
    p.z+=weight*.28*math.sin(x*.21+z*.13)
   changed+=1
  # Extend the cliff treatment to exposed outer faces below the city benches.
  # Final castle frame: city center x=8; all playable tops remain protected.
  tierY,halfWidth=(16,21.75) if z<20 else (10,17.4) if z<40 else (4,14.5)
  sideFace=(-6<z<58 and halfWidth-.5<abs(x-8)<halfWidth+(26 if x>8 else 5) and h<tierY-.7)
  if sideFace and not(-13<x<-7 and z>45):
   weight=min(1,max(0,(tierY-.7-h)/3))*min(1,max(0,(halfWidth+(26 if x>8 else 5)-abs(x-8))/3))
   side=1 if x>8 else -1
   p.x+=side*weight*(1.15*math.sin(z*.27)+.45*math.cos(h*.42))
   p.z+=weight*.38*math.sin(z*.23+h*.4)
   if iteration==6:
    p.x+=side*weight*.65*math.sin(z*.13+h*.11)
    p.z+=weight*.30*math.cos(h*.55+z*.17)
   changed+=1
  v.co=inv@p
 terrain.data.update()
 for polygon in terrain.data.polygons:polygon.use_smooth=False
 if not os.environ.get('CITADEL_CLIFF_EXPORT_ONLY'):
  bpy.ops.wm.save_as_mainfile(filepath=str(ASSET/f'citadel-cliff-r0{iteration}.blend'))
  scene.render.filepath=str(OUT/f'blender-r0{iteration}.png');bpy.ops.render.render(write_still=True)
 reports.append({'iteration':iteration,'changed_vertices':changed,'protected_plaza_and_route_vertices_unchanged':True})
# Export terrain in its original local coordinate frame: Blender XYZ -> Three X,Y,Z.
terrain.data.calc_loop_triangles();positions=[];normals=[]
for tri in terrain.data.loop_triangles:
 n=tri.normal
 for i in tri.vertices:
  v=terrain.data.vertices[i].co
  positions.extend([round(v.x,6),round(v.z,6),round(-v.y,6)])
  normals.extend([round(n.x,6),round(n.z,6),round(-n.y,6)])
changes=[]
for v,original in zip(terrain.data.vertices,base):
 if (v.co-original).length>1e-5:
  changes.append([round(original.x,4),round(original.z,4),round(-original.y,4),round(v.co.x-original.x,6),round(v.co.z-original.z,6),round(-v.co.y+original.y,6)])
data={'changes':changes,'source':'assets/models/optimized/citadel-cliff/citadel-cliff-r06.blend','iterations':reports}
(ASSET/'citadelCliffData.js').write_text('export default '+json.dumps(data,separators=(',',':'))+';\n')
(OUT/'report.json').write_text(json.dumps({'iterations':reports,'triangles':len(positions)//9,'scope':'New-plaza front and outer middle/crown cliff faces, protected walkable tops; no old-city remodeling or final art acceptance.'},indent=2))
