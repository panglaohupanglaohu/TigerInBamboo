import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/models/optimized/canal-junction';ART=ROOT/'artifacts/pipeline/canal-junction-target'
source=json.loads((OUT/'modules-source.json').read_text());base=json.loads((OUT/'foundation.json').read_text());regions=base['regions']
name='TM_Junction_Target_v1';old=bpy.data.scenes.get(name)
if old:
 if bpy.context.window.scene==old:bpy.context.window.scene=next(s for s in bpy.data.scenes if s!=old)
 for o in list(old.objects):bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.scenes.remove(old)
sc=bpy.data.scenes.new(name);bpy.context.window.scene=sc
palette={'coral':'c78269','teal':'6f9c9b','yellow':'d1ac66','cream':'d7ccb1','roof':'384d63','stone':'c8b99b'}
def rgb(h):
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)];return [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
colors={k:rgb(v) for k,v in palette.items()};batches={}
def add(n,ps,ns,c,walk=False,solid=False):
 key=(tuple(round(v,4) for v in c),walk,solid)
 b=batches.setdefault(key,{'positions':[],'normals':[],'color':c,'walkable':walk,'solid':solid});b['positions']+=ps;b['normals']+=ns
for p in source['parts']:
 n=p['name'];ps=p['positions'];c=p['color'];walk=n.startswith(('irregular-quay','central-open-court','quay-court-step','court-keep-step','berth-deck','court-left-support','court-right-support','court-rear-support','keep-bearing'))
 if n.startswith(('town-dome','town-crenel','town-balcony','town-window','town-gate-portico')):continue
 # Door geometry in main keep's central entry must not plug the WFC void.
 xs=ps[0::3];ys=ps[1::3];zs=ps[2::3];cx=sum(xs)/len(xs);cz=sum(zs)/len(zs)
 if n.startswith(('town-gate','town-door','town-support-edge','town-arcade-column','town-arch')) and abs(cx)<1.7 and cz< -9 and min(ys)<10:continue
 if n=='town-cell':
  region=min(regions,key=lambda r:(r[1]-cx)**2+(-r[2]-cz)**2);c=colors[region[-1]]
 add(n,ps,p['normals'],c,walk,n=='town-cell' or n.startswith(('front-arch','arch-jamb')))
def faces(n,v,fs,c,solid=True,walk=False):
 ps=[];ns=[]
 for f in fs:
  for j in range(1,len(f)-1):
   tri=[Vector(v[k]) for k in (f[0],f[j],f[j+1])];normal=(tri[1]-tri[0]).cross(tri[2]-tri[0]).normalized()
   for q in tri:ps+=list(q);ns+=list(normal)
 add(n,ps,ns,c,walk,solid)
# Close the transition from the last entry step to the open courtyard.
def block(n,x,y,z,w,h,d,c,walk=False):
 v=[(x+sx*w/2,y+sy*h/2,z+sz*d/2) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]]
 faces(n,v,[(1,2,3,0),(7,6,5,4),(4,5,1,0),(5,6,2,1),(6,7,3,2),(7,4,0,3)],c,not walk,walk)
block('court-arrival-landing',0,3.2,2.5,4,0.3,2,colors['stone'],True)
for n,x,y,z,w,d,h,mat in regions:
 y=-y;top=z+max(2,round(h/1.7))*1.7
 if 'tower' in n:
  v=[(x+math.cos(i*math.tau/8)*w*.75,top,y+math.sin(i*math.tau/8)*w*.75) for i in range(8)]+[(x,top+3.2,y)]
  faces(n+'-conical-roof',v,[(i,8,(i+1)%8) for i in range(8)]+[tuple(range(8))],colors['roof'])
 elif n=='rear-keep':
  block('keep-roof-terrace',x,top+.06,y,w+.22,.12,d+.3,colors['stone'],True)
  for side in [-1,1]:
   block('keep-roof-parapet',x,top+.48,y+side*d*.5,w+.3,.84,.24,colors['cream'])
   for xx in [-3,-1.5,0,1.5,3]:block('keep-roof-merlon',x+xx,top+1.12,y+side*d*.5,.64,.48,.4,colors['cream'])
 else:
  y-=.8;d=3.2
  v=[(x-w*.56,top,y-d*.56),(x+w*.56,top,y-d*.56),(x+w*.56,top,y+d*.56),(x-w*.56,top,y+d*.56),(x,top+1.8,y-d*.56),(x,top+1.8,y+d*.56)]
  faces(n+'-gable',v,[(0,4,1),(3,2,5),(0,3,5,4),(1,4,5,2)],colors['roof'])
# Target-inspired details stay outside the verified x=0 circulation corridor.
colors.update({k:rgb(v) for k,v in {'leaf':'58704e','leafLight':'7d8a58','wood':'73523b','window':'4d4540','metal':'41464b','flower':'bb8668'}.items()})
def shrub(x,y,z,r):
 v=[(x,y+r,z),(x+r,y,z),(x,y,z+r),(x-r,y,z),(x,y,z-r),(x,y-r*.35,z)]
 faces('faceted-garden-shrub',v,[(0,2,1),(0,3,2),(0,4,3),(0,1,4),(5,1,2),(5,2,3),(5,3,4),(5,4,1)],colors['leaf'],False)
def planter(x,y,z,w=1.5,d=.7):
 block('stone-planter',x,y+.22,z,w,.44,d,colors['stone'])
 for dx in (-.35,.35):shrub(x+dx,y+.65,z,.5)
# Explicit street-facing frames: retain original windows, give the same facade readable depth.
for n,x,yy,z,w,d,h,mat in regions:
 front=-yy+math.floor(d/1.6+.5)*.8+.13;floor_count=max(2,round(h/1.7))
 for level in range(1,floor_count):
  for dx in (-w*.25,w*.25):
   wy=z+level*1.7+.65
   window_front=front-(1.6 if 'tower' not in n and n!='rear-keep' and level==floor_count-1 else 0)
   block('window-dark-recess',x+dx,wy,window_front,.48,.70,.035,colors['window'])
   for sx in (-.30,.30):block('window-stone-frame',x+dx+sx,wy,window_front+.03,.09,.86,.08,colors['cream'])
   block('window-sill',x+dx,wy-.43,window_front+.08,.76,.11,.22,colors['stone'])
 # Thin masonry bands relate floors without random floating face patches.
 for level in (0,floor_count):
  if n=='rear-keep' and level==0:
   for dx in (-2.6,2.6):block('facade-door-flank-cornice',x+dx,z+.12,front,1.8,.12,.18,colors['stone'])
  else:block('facade-cornice',x,z+level*1.7+.12,front-(1.6 if level==floor_count and 'tower' not in n and n!='rear-keep' else 0),w+.18,.12,.18,colors['stone'])
# Complete side and rear fenestration replaces the overlapping source decor planes.
for n,x,yy,z,w,d,h,mat in regions:
 floors=max(2,round(h/1.7));cz=-yy
 actual_w=max(1,math.floor(w/1.6+.5))*1.6;actual_d=max(1,math.floor(d/1.6+.5))*1.6
 for level in range(1,floors):
  wy=z+level*1.7+.65
  for side in [-1,1]:
   wall=x+side*(actual_w*.5+.07)
   for dz in [-actual_d*.24,actual_d*.24]:
    if 'tower' not in n and n!='rear-keep' and level==floors-1 and dz>0:continue
    block('side-window-recess',wall,wy,cz+dz,.06,.70,.46,colors['window'])
    for zz in [-.29,.29]:block('side-window-frame',wall+side*.03,wy,cz+dz+zz,.1,.85,.085,colors['cream'])
    block('side-window-sill',wall+side*.06,wy-.42,cz+dz,.20,.1,.72,colors['stone'])
  for dx in [-w*.25,w*.25]:
   block('rear-window-recess',x+dx,wy,cz-actual_d*.5-.07,.46,.7,.06,colors['window'])
   block('rear-window-sill',x+dx,wy-.42,cz-actual_d*.5-.12,.72,.1,.2,colors['stone'])
# Two supported intermediate garden terraces between street houses.
for side in (-1,1):
 x=side*11;yy=6.0;zz=2.85
 block('terrace-garden-deck',x,yy-.15,zz,4.4,.3,1.35,colors['stone'],True)
 for dx in (-1.8,1.8):block('terrace-support',x+dx,(yy+3.35)/2,zz,.32,yy-3.35,.45,colors['stone'])
 for dx in (-1.55,1.55):planter(x+dx,yy,zz,1.1,.6)
 block('garden-terrace-low-wall',x,yy+.42,zz+.65,4.4,.84,.16,colors['stone'])
# Courtyard tree offset from the axial route; human-sized planter and crown.
planter(-4.7,3.35,-1.5,2.0,1.8)
block('court-tree-trunk',-4.7,4.9,-1.5,.26,2.4,.24,colors['wood'])
for dx,dz,dy in [(-.6,0,0),(.55,.15,.2),(0,-.5,.4)]:shrub(-4.7+dx,6.25+dy,-1.5+dz,1.05)
# Quay cargo only on side strips; walking apron and berth center remain open.
for side in (-1,1):
 for j in range(3):
  x=side*(13.5+j*.75);z=11.4
  block('cargo-crate',x,1.03,z,.62,.76,.66,colors['wood'])
  for dy in (-.24,.24):block('crate-band',x,1.03+dy,z+.337,.65,.065,.035,colors['metal'])
 for z in (14.5,17.4):
  block('mooring-post',side*12,.99,z,.18,.68,.18,colors['wood'])
  block('mooring-cap',side*12,1.36,z,.32,.12,.32,colors['metal'])
# Small quay stall, confined to one side of the watergate approach.
for x in (5.7,8.1):
 for z in (11.5,12.6):block('stall-post',x,1.85,z,.09,2.4,.09,colors['wood'])
block('stall-counter',6.9,1.15,12.4,2.4,1,.55,colors['wood'])
faces('blue-stall-awning',[(5.5,3.1,11.3),(8.3,3.1,11.3),(8.3,2.9,12.9),(5.5,2.9,12.9)],[(0,3,2,1)],colors['roof'],False)

# Target-driven waterside curtain walls: keep the four-metre gate route open.
for side in (-1,1):
 block('watergate-flanking-wall',side*8.4,2.55,9.48,10.8,3.8,.75,colors['stone'])
 block('watergate-wall-coping',side*8.4,4.52,9.48,11,.18,.92,colors['cream'])
 for j in range(9):
  xx=side*(3.5+j*1.22)
  block('watergate-merlon',xx,4.98,9.48,.65,.76,.85,colors['cream'])
 # Courtyard side edges establish protected open space between the original WFC rows.
 block('court-parapet',side*6.4,3.83,-1.3,.3,.96,7.8,colors['stone'])
 for zz in [-4.5,-2.8,-1.1,.6,2.3]:
  block('court-parapet-post',side*6.4,4.28,zz,.5,.48,.5,colors['cream'])
 for xx,zz in [(side*5.65,-4.6),(side*5.65,.4)]:planter(xx,3.35,zz,1.0,.65)
 # Window gardens on the existing street elevations, not roofs floating over the court.
 for xx,zz,yy in [(side*11,8.6,6.8),(side*12,2.35,8.5)]:planter(xx,yy,zz,2.3,.65)
 # Joint lines on the waterside wall; closed slivers avoid duplicated coplanar triangles.
 for row in range(5):
  yy=.94+row*.67
  for j in range(9):
   xx=side*(3.35+j*1.18+(.5 if row%2 else 0))
   if abs(xx)>13.7:continue
   block('wall-vertical-mortar',xx,yy,9.862,.022,.59,.012,colors['cream'])
  block('wall-bed-joint',side*8.4,yy+.31,9.865,10.8,.022,.013,colors['cream'])
# The existing arch stays open; top wall and battlements join the two wings.
block('gate-wall-head',0,5.65,9.4,6.1,.5,1.2,colors['stone'])
for xx in [-2.5,-1.25,0,1.25,2.5]:block('gate-wall-merlon',xx,6.17,9.4,.65,.56,1.18,colors['cream'])
# Slate courses and broad eaves add legible roof scale without altering the WFC topology.
for n,x,yy,z,w,d,h,mat in regions:
 if 'tower' in n or n=='rear-keep':continue
 cz=-yy;top=z+max(2,round(h/1.7))*1.7
 if n!='rear-keep':cz-=.8;d=3.2
 for side in [-1,1]:
  block('roof-eave',x+side*w*.56,top-.045,cz,.14,.12,d*1.12,colors['roof'])
  for t in [.25,.50,.75]:
   xx=x+side*w*.56*t;hh=top+1.8*(1-t)
   block('slate-roof-course',xx,hh+.015,cz,.045,.04,d*1.12,colors['stone'])

# Six supported WFC setbacks, each with a clear terrace slab and planted front balustrade.
for n,x,yy,z,w,d,h,mat in regions:
 if 'tower' in n or n=='rear-keep':continue
 floors=max(2,round(h/1.7));ty=z+(floors-1)*1.7;cz=-yy+1.6
 block('setback-terrace-slab',x,ty+.025,cz,4.9,.10,1.72,colors['stone'],True)
 block('setback-front-balustrade',x,ty+.43,cz+.77,4.9,.76,.19,colors['cream'])
 for side in (-1,1):
  block('setback-side-balustrade',x+side*2.36,ty+.43,cz,.18,.76,1.6,colors['cream'])
  planter(x+side*1.7,ty+.82,cz+.67,.8,.38)
 # Small grouped vegetation breaks the parapet silhouette without covering the windows.
 shrub(x-.35,ty+1.02,cz+.65,.34)

# Main keep: a readable gateway and tapered load-bearing buttresses, outside the axial path.
for side in (-1,1):
 x=side*6.16
 v=[(x+dx,yy,zz) for yy,half,front in [(6.59,.58,-8.75),(15.3,.28,-9.42)] for dx,zz in [(-half,front),(half,front),(half,-10.3),(-half,-10.3)]]
 faces('keep-tapered-buttress',v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],colors['stone'])
 for yy in [8.8,11.4,14]:
  t=(yy-6.59)/(15.3-6.59);front=-8.75+(-9.42+8.75)*t
  block('buttress-weather-cap',x,yy,front+.025,1.2-.6*t,.14,.2,colors['cream'])
 # Wall footing beside, never across, the existing 3.2m entry void.
 block('keep-door-footing',side*2.48,6.79,-9.50,1.5,.4,.42,colors['stone'])
 block('keep-entry-jamb',side*1.80,7.80,-9.36,.4,2.42,.38,colors['cream'])
 # Quoins establish scale; avoid repetitive full-width horizontal stripes.
 for row in range(10):
  block('keep-corner-quoin',side*3.02,7.1+row*.91,-9.48,.34+(row%2)*.16,.36,.19,colors['stone'])
 # Blue cloth standard hangs between the tower's paired windows.
 block('keep-standard',side*4.6,12.8,-10.04,.72,3.1,.055,colors['roof'])
 block('standard-top-bar',side*4.6,14.42,-9.99,.96,.07,.12,colors['wood'])
 block('standard-gold-stem',side*4.6,13.0,-9.999,.06,.94,.016,colors['yellow'])
 faces('standard-gold-lozenge',[(side*4.6,13.65,-9.994),(side*4.6+.2,13.3,-9.994),(side*4.6,12.95,-9.994),(side*4.6-.2,13.3,-9.994)],[(0,3,2,1)],colors['yellow'],False)
 planter(side*2.6,16.95,-10.28,.85,.5)
# An extruded radial ring supplies a real opening, no opaque plane across the route.
for i in range(14):
 a=i*math.pi/14;b=(i+1)*math.pi/14
 v=[(rr*math.cos(t),9.0+rr*math.sin(t),zz) for zz in [-9.60,-9.15] for rr,t in [(1.6,a),(2.0,a),(2.0,b),(1.6,b)]]
 faces('keep-arch-stone',v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],colors['cream'] if i%3 else colors['stone'])

parts=[]
for i,b in enumerate(batches.values()):
 ps=b['positions'];verts=[(ps[j],-ps[j+2],ps[j+1]) for j in range(0,len(ps),3)];d=bpy.data.meshes.new('junction-batch');d.from_pydata(verts,[],[tuple(range(j,j+3)) for j in range(0,len(verts),3)]);d.update();m=bpy.data.materials.new('JunctionMat');m.diffuse_color=(*b['color'],1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*b['color'],1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=1;d.materials.append(m);o=bpy.data.objects.new('junction-%02d'%i,d);sc.collection.objects.link(o);b['name']=o.name;parts.append(b)
(OUT/'junctionTargetData.js').write_text('export default '+json.dumps({'parts':parts,'source':'Original Townscaper/WFC, then Blender target refinement','wfc':source['stats'],'triangles':sum(len(p['positions'])//9 for p in parts)})+';\n')
bpy.data.libraries.write(str(OUT/'canal-junction-target-v1.blend'),{sc},fake_user=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'godot/assets/art-pilots/canal-junction-target-v1.glb'),export_format='GLB',use_active_scene=True,export_cameras=False,export_lights=False)
print(json.dumps({'meshes':len(parts),'triangles':sum(len(p['positions'])//9 for p in parts)}))
