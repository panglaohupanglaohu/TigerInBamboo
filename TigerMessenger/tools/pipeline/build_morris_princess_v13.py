"""Reference-led mounted princess. Courier V2 method: authored lofts and empty pivots, NOT skinning.
Standalone background Blender only. Coordinates Three metres, seat origin, face +Z.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2]; OUT=R/'assets/models/morris-princess'; REVIEW=R/'artifacts/pipeline/princess-rebuild-20261028';OUT.mkdir(parents=True,exist_ok=True);REVIEW.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def B(p):return (p[0],-p[2],p[1])
def mat(name,h):
 m=bpy.data.materials.new(name);m.diffuse_color=(*[((int(h[i:i+2],16)/255+.055)/1.055)**2.4 if int(h[i:i+2],16)/255>.04045 else int(h[i:i+2],16)/255/12.92 for i in (0,2,4)],1);m.use_nodes=True
 c=m.node_tree.nodes.get('Principled BSDF');c.inputs['Base Color'].default_value=m.diffuse_color;c.inputs['Roughness'].default_value=.84
 return m
ivory=mat('warm ivory linen','e4d7b6');green=mat('moss botanical','465744');gold=mat('antique gold thread','b49a58');red=mat('brick red woven cloak','782b2b');skin=mat('skin ochre rose','d5ae91');hair=mat('gold chestnut hair','80512c');hairLight=mat('hair lit ridges','a37543');dark=mat('deep brown leather','382b24');eye=mat('olive iris','55513c');white=mat('eye ivory','ded6c4');lip=mat('muted rose','995f52')
for hm in [hair,hairLight]:
 bs=hm.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.56
skin.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.65
gold.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.65
gold.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.46
root=bpy.data.objects.new('MorrisPrincess',None);col=bpy.data.collections.new('COL_MorrisPrincess');bpy.context.scene.collection.children.link(col);col.objects.link(root)
def group(name,parent=root):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;return o
body=group('body');head=group('head',body);cape=group('cape');armL=group('armL',body);armR=group('armR',body)
def mesh(name,verts,faces,material,parent=body):
 m=bpy.data.meshes.new(name);m.from_pydata([B(v) for v in verts],[],faces);m.update();o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);o.data.materials.append(material);o.parent=parent
 for p in m.polygons:p.use_smooth=True
 return o
def sphere(name,p,s,material,parent=body):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=B(p));o=bpy.context.object;o.name=name;o.scale=(s[0],s[2],s[1]);o.data.materials.append(material);o.parent=parent
 for f in o.data.polygons:f.use_smooth=True
 return o
def sweep(name,points,radii,material,parent=body,segments=12):
 ps=[Vector(p) for p in points];vv=[];ff=[]
 for i,p in enumerate(ps):
  tangent=(ps[min(i+1,len(ps)-1)]-ps[max(0,i-1)]).normalized();u=tangent.cross(Vector((0,0,1)))
  if u.length<.01:u=tangent.cross(Vector((1,0,0)))
  u.normalize();v=tangent.cross(u).normalized();rr=radii[i] if isinstance(radii,list) else radii;rx,ry=rr if isinstance(rr,tuple) else (rr,rr)
  for k in range(segments):
   a=k/segments*math.tau;vv.append(tuple(p+u*math.cos(a)*rx+v*math.sin(a)*ry))
  if i:
   for k in range(segments):a=(i-1)*segments+k;b=(i-1)*segments+(k+1)%segments;ff.append((a,b,b+segments,a+segments))
 ff += [tuple(range(segments-1,-1,-1)),tuple((len(ps)-1)*segments+k for k in range(segments))]
 return mesh(name,vv,ff,material,parent)
def loft(name,keys,material,parent=body,n=48,steps=5):
 vv=[];ff=[]
 for idx in range(len(keys)-1):
  a,b=keys[idx:idx+2]
  for j in range(steps):
   t=j/steps;prev=keys[max(0,idx-1)];nxt=keys[min(len(keys)-1,idx+2)]
   y,w,d,z=[(2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*(b[k]-prev[k])*.5+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*(nxt[k]-a[k])*.5 for k in range(4)]
   for k in range(n):
    q=k/n*math.tau;vv.append((w*math.cos(q),y,z+d*math.sin(q)))
 y,w,d,z=keys[-1]
 for k in range(n):q=k/n*math.tau;vv.append((w*math.cos(q),y,z+d*math.sin(q)))
 rows=len(vv)//n
 for j in range(rows-1):
  for k in range(n):a=j*n+k;b=j*n+(k+1)%n;ff.append((a,b,b+n,a+n))
 ff +=[tuple(range(n-1,-1,-1)),tuple((rows-1)*n+k for k in range(n))]
 return mesh(name,vv,ff,material,parent)
import numpy as np
standing='--standing' in sys.argv
# Two packed, UV mapped textile maps: curving stems, paired lobed leaves and tiny flowers.
def textile(name,bg,leaf):
 size=512;pix=np.empty((size,size,4),dtype=np.float32);pix[:]=(*bg,1)
 def disk(x,y,rx,ry,a,color):
  xmin=max(0,int(x-rx-ry));xmax=min(size,int(x+rx+ry+1));ymin=max(0,int(y-rx-ry));ymax=min(size,int(y+rx+ry+1))
  if xmax<=xmin or ymax<=ymin:return
  yy,xx=np.mgrid[ymin:ymax,xmin:xmax];dx=xx-x;dy=yy-y;u=dx*math.cos(a)+dy*math.sin(a);v=-dx*math.sin(a)+dy*math.cos(a);mask=(u/rx)**2+(v/ry)**2<=1
  pix[ymin:ymax,xmin:xmax][mask]=(*color,1)
 def polygon(points,color):
  xmin=max(0,int(min(x for x,y in points)));xmax=min(size,int(max(x for x,y in points))+1);ymin=max(0,int(min(y for x,y in points)));ymax=min(size,int(max(y for x,y in points))+1)
  if xmax<=xmin or ymax<=ymin:return
  yy,xx=np.mgrid[ymin:ymax,xmin:xmax];inside=np.zeros(xx.shape,dtype=bool)
  for i,(x1,y1) in enumerate(points):
   x2,y2=points[(i+1)%len(points)];inside^=((y1>yy)!=(y2>yy)) & (xx<(x2-x1)*(yy-y1)/(y2-y1+1e-12)+x1)
  pix[ymin:ymax,xmin:xmax][inside]=(*color,1)
 def lobedLeaf(x,y,side,color):
  contour=[(0,0),(4,4),(8,2),(10,7),(15,5),(19,10),(25,8),(28,12),(34,7),(38,9),(33,2),(36,-2),(28,-4),(24,-1),(20,-6),(16,-3),(12,-7),(8,-3),(4,-4)]
  polygon([(x+side*a,y+b+a*.50) for a,b in contour],color)
  vein=tuple(min(1,c*1.25+.035) for c in color)
  for k in range(37):disk(x+side*k,y+k*.5,.6,.6,0,vein)
 for col in range(4):
  motif=leaf
  if 'ivory' in name and col in [0,3]:
   pix[:,col*128:col*128+128]=(.10,.16,.08,1);motif=(.60,.45,.20)
  for j in range(500):
   y=j+6;x=col*128+52+19*math.sin(y*.019+col*.5);disk(x,y,1.4,1.4,0,motif)
  for j in range(12):
   y=20+j*41;x=col*128+52+19*math.sin(y*.019+col*.5)
   for side in [-1,1]:
    lobedLeaf(x+side*2,y,side,motif)
   if j%2==1:
    for k in range(6):a=k*math.tau/6;disk(x+math.cos(a)*9,y+21+math.sin(a)*9,5,3,a,(.52,.32,.10))
    disk(x,y+21,3,3,0,(.75,.58,.28))
   for side in [-1,1]:
    for t in range(26):disk(x+side*(14+t*.6),y+20+t*.8,.65,.65,0,motif)
    for t in range(5):
     ax=x+side*(14+t*3);ay=y+20+t*4
     disk(ax,ay,2,4,side*.7,motif)
 im=bpy.data.images.new(name,width=size,height=size);im.pixels.foreach_set(pix.ravel());im.filepath_raw=str(REVIEW/(name+'-v13.png'));im.file_format='PNG';im.save();im.pack()
 return im
capeTex=textile('red-gold-botanical',(.19,.025,.028),(.58,.38,.13));dressTex=textile('ivory-moss-botanical',(.76,.69,.53),(.16,.23,.11))
def fabric(name,image):
 m=mat(name,'ffffff');bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.82;t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=image;m.node_tree.links.new(t.outputs['Color'],bs.inputs['Base Color']);return m
capeMat=fabric('MAT_BrickRed_Botanical',capeTex);gownMat=fabric('MAT_Ivory_MossGold',dressTex)
def uvGrid(o,cols,rows,repeat=1):
 uv=o.data.uv_layers.new(name='UVMap')
 for poly in o.data.polygons:
  for li in poly.loop_indices:
   idx=o.data.loops[li].vertex_index;uv.data[li].uv=((idx%cols)/(cols-1)*repeat,1-(idx//cols)/(rows-1))
# Newly shaped torso: adult clavicle/shoulder, fitted waist, continuous neck.
loft('SM_Linen_Bodice',[(0,.139,.103,0),(.16,.112,.080,0),(.28,.129,.091,.005),(.38,.153,.097,.004),(.44,.164,.078,0),(.475,.137,.065,0),(.49,.085,.052,.002)],gownMat,n=64,steps=5)
loft('SM_Neck',[(.47,.055,.038,-.013),(.515,.037,.030,-.016),(.565,.033,.029,-.017),(.635,.039,.030,-.012)],skin,n=48,steps=5)
# Continuous adult face with recessed eye sockets and nose grown from the face surface.
face=loft('SM_Head_Anatomical',[(.620,.023,.022,.040),(.631,.039,.036,.030),(.650,.053,.050,.016),(.674,.066,.062,.005),(.694,.074,.071,-.002),(.729,.076,.071,-.006),(.763,.075,.071,-.007),(.805,.064,.060,-.011),(.829,.033,.032,-.012),(.836,.004,.006,-.012)],skin,head,n=64,steps=5)
for v in face.data.vertices:
 x=v.co.x;y=v.co.z;z=-v.co.y
 front=max(0,min(1,(z+.008)/.065))
 nose=.017*math.exp(-(x/.015)**2-((y-.694)/.013)**2)+.009*math.exp(-(x/.008)**2-((y-.711)/.020)**2)
 sockets=sum(.008*math.exp(-((x-side*.033)/.019)**2-((y-.728)/.014)**2) for side in [-1,1])
 cheek=sum(.004*math.exp(-((x-side*.043)/.023)**2-((y-.695)/.021)**2) for side in [-1,1])
 v.co.y-=(nose-sockets+cheek)*front
# Subtle almond eyes seated within the orbital contour, not external eyeballs.
for side in [-1,1]:
 x0=side*.032
 vv=[(x0,.728,.0655)];ff=[];n=32
 for k in range(n):
  a=k/n*math.tau;vv.append((x0+.014*math.cos(a),.728+.0048*math.sin(a),.064+.001*math.cos(a)))
 for k in range(n):ff.append((0,1+k,1+(k+1)%n))
 mesh('SM_Almond_Eye',vv,ff,white,head)
 sphere('SM_Hazel_Iris',(x0,.728,.0665),(.0038,.0038,.00065),eye,head);sphere('SM_Pupil',(x0,.728,.0675),(.0021,.0028,.0007),dark,head)
 for upper in [True,False]:
  pts=[]
  for k in range(21):
   a=k/20*math.pi;pts.append((x0+.014*math.cos(a),.728+(.0050 if upper else -.0045)*math.sin(a),.065+.001*math.cos(a)))
  sweep('SM_Eyelid',pts,.00065,skin,head,8)
 sweep('SM_Eyebrow',[(x0-side*.017,.748,.063),(x0,.752,.066),(x0+side*.017,.749,.059)],.0015,hair,head,10)
 sphere('SM_Ear',(side*.075,.710,-.007),(.010,.020,.013),skin,head)
 # Subtle nostril wings lie at the base of the continuous bridge.
 # Nose wings integrated into continuous surface; avoid external spherical nostrils.
# Two thin lip surfaces grow along the muzzle contour rather than tubular mouth props.
for upper in [True,False]:
 vv=[];ff=[];nx=33;ny=7
 for j in range(ny):
  f=j/(ny-1)
  for k in range(nx):
   u=k/(nx-1)*2-1;x=u*.015;edge=(1-u*u)
   mid=.665+.001*math.cos(u*math.pi*2)
   y=mid+(.003 if upper else -.004)*math.sin(f*math.pi/2)*edge
   z=.068+.004*edge*math.sin(f*math.pi)
   vv.append((x,y,z))
 for j in range(ny-1):
  for k in range(nx-1):
   a=j*nx+k;ff.append((a,a+1,a+nx+1,a+nx))
 mesh('SM_Lip_Surface',vv,ff,lip,head)
# Scalp with close crown flow; broad long curls surround the head and descend below shoulders.
scalp=loft('SM_Scalp',[(.765,.077,.073,-.012),(.800,.074,.073,-.012),(.834,.050,.052,-.012),(.845,.009,.012,-.012)],hair,head,n=64,steps=5)
for vert in scalp.data.vertices:
 z=-vert.co.y;y=vert.co.z
 if z>0 and y<.805:
  vert.co.z+=.028*max(0,1-abs(vert.co.x)/.08)
  vert.co.y-=.0025*math.cos(math.atan2(vert.co.x,z+.012)*12)
 else:vert.co.y-=.0015*math.cos(math.atan2(vert.co.x,z+.012)*18)
# Open lower scalp boundary: a nonplanar capped n-gon made the triangular forehead plate.
scalp.data.polygons[-2].use_smooth=True
import bmesh
bm=bmesh.new();bm.from_mesh(scalp.data);bm.faces.ensure_lookup_table();bmesh.ops.delete(bm,geom=[bm.faces[-2]],context='FACES');bm.to_mesh(scalp.data);bm.free()
for k in range(20):
 q=(k/19)*math.pi;side=-1 if k%2 else 1;u=(k//2)/9;x0=side*(.01+.081*u);z0=-.075-.026*(1-u)
 pts=[];rr=[]
 for j in range(64):
  f=j/63;wave=math.sin(f*18+(k//2)*.12);x=x0*(.60+.40*min(1,f*8))+side*.014*math.sin(math.pi*f)+wave*(.004+.008*f);y=.815-f*(.55+.025*math.sin(k));z=z0*(.55+.45*min(1,f*8))-.045*f+math.cos(f*18+(k//2)*.12)*.002
  pts.append((x,y,z));taper=(1-f)**.35*min(1,.10+f*10);rr.append((.017*taper+.0005,.0032*taper+.0005))
 sweep('SM_Long_Wave',pts,rr,hairLight if k%7==0 else hair,head,8)
# Region-based crown guides follow the scalp from centre part to temples/back.
# Individual radiating guides replace the stacked identical forward arch.
for side in [-1,1]:
 for k in range(16):
  az=.12+k/15*2.70;pts=[];rr=[]
  for j in range(28):
   f=j/27;t=.10+f*1.35
   x=side*.078*math.sin(t)*math.sin(az)
   z=-.012+.075*math.sin(t)*math.cos(az)
   y=.767+.078*math.cos(t)
   pts.append((x,y,z));r=.0025+.0018*math.sin(math.pi*f);rr.append((r,r*.70))
  sweep('SM_Crown_Flow',pts,rr,hairLight if k%5==0 else hair,head,8)
# Cheek-framing waves: flow from the part into the temples, then open curls.
for side in [-1,1]:
 for k in range(3):
  pts=[];rr=[]
  for j in range(40):
   f=j/39;x=side*(.014+.068*math.sin(min(1,f*2.3)*math.pi/2)+.006*math.sin(f*12+k*.9))
   y=.822-.235*f-k*.003;z=.046+.025*math.sin(f*math.pi)-.042*f+k*.002
   pts.append((x,y,z));rr.append((.009*(1-.60*f)+.0005,.0018*(1-.6*f)+.0004))
  sweep('SM_Temple_Curl',pts,rr,hairLight if k==2 else hair,head,8)
# Fine leaf circlet and engraved shoulder clasps.
pts=[(.080*math.sin(k/96*math.tau),.783+.006*math.cos(k/96*math.tau),.074*math.cos(k/96*math.tau)-.01) for k in range(97)]
sweep('SM_Circlet',pts,.0018,gold,head,8)
for k in range(30):
 q=k/30*math.tau;sphere('SM_Circlet_Leaf',(.081*math.sin(q),.786,.075*math.cos(q)-.01),(.004,.002,.008),gold,head)
for side,parent in [(-1,armL),(1,armR)]:
 if standing:pts=[(side*.16,.44,0),(side*.19,.28,0),(side*.205,.10,.015),(side*.22,-.07,.03)]
 else:pts=[(side*.16,.44,0),(side*.205,.36,.05),(side*.21,.25,.14),(side*.15,.23,.31),(side*.12,.23,.37)]
 sweep('SM_Linen_Sleeve',pts,[.051,.047,.044,.041]+([.036] if not standing else []),gownMat,parent,24)
 hand=pts[-1]
 if standing:
  sphere('SM_Hand',(hand[0],hand[1]-.035,hand[2]+.01),(.023,.040,.021),skin,parent)
  for k in range(4):
   x=hand[0]+(k-1.5)*.009
   sweep('SM_Finger',[(x,hand[1]-.04,hand[2]+.02),(x,hand[1]-.073,hand[2]+.028),(x,hand[1]-.08,hand[2]+.017)],.004,skin,parent,8)
 else:
  # Grip around the existing production local rein anchor (sign*.13,.22,.41).
  cx=side*.13;sphere('SM_Grip_Palm',(cx,.232,.392),(.022,.022,.023),skin,parent)
  for k in range(4):
   x=cx+(k-1.5)*.009
   sweep('SM_Curled_Finger',[(x,.233,.401),(x,.222,.424),(x,.204,.421),(x,.211,.405)],.0042,skin,parent,8)
  sweep('SM_Opposed_Thumb',[(cx-side*.020,.242,.39),(cx-side*.027,.225,.411),(cx-side*.012,.217,.416)],.005,skin,parent,8)
 sphere('SM_Shoulder_Clasp',(side*.127,.458,.065),(.020,.020,.006),gold)
 for k in range(12):
  a=k/12*math.tau;sphere('SM_Clasp_Petal',(side*.127+.012*math.cos(a),.458+.012*math.sin(a),.072),(.004,.004,.002),gold)
# Actual UV textile surfaces, consistent garment shape and continuous folds.
cols=65 if standing else 41;rows=43 if standing else 33;vv=[];ff=[]
if standing:
 for j in range(rows):
  f=j/(rows-1);radius=.12+.16*f
  for k in range(cols):
   a=k/(cols-1)*math.tau;fold=1+.035*math.cos(a*14)*f;vv.append((radius*math.cos(a)*fold,.15-f*1.00,.82*radius*math.sin(a)*fold))
else:
 # Two dress drapes flow from seated thighs over the flanks, no standing skirt through saddle.
 for side in [-1,1]:
  vv=[];ff=[]
  for j in range(rows):
   f=j/(rows-1)
   for k in range(cols):
    u=k/(cols-1);vv.append((side*(.105+.34*(1-math.exp(-5*f))+.009*math.sin(u*28)*f),.07-.72*f+.025*math.sin(u*math.pi),(-.27+.59*u)*(.28+.72*math.sin(f*math.pi/2))+.07*math.sin(f*math.pi)))
  for j in range(rows-1):
   for k in range(cols-1):a=j*cols+k;ff.append((a,a+1,a+cols+1,a+cols))
  o=mesh('SM_Mounted_Gown',vv,ff,gownMat,root);uvGrid(o,cols,rows);o.modifiers.new('Fabric thickness','SOLIDIFY').thickness=.003
if standing:
 for j in range(rows-1):
  for k in range(cols-1):a=j*cols+k;ff.append((a,a+1,a+cols+1,a+cols))
 o=mesh('SM_Standing_Gown',vv,ff,gownMat,root);uvGrid(o,cols,rows,2);o.modifiers.new('Fabric thickness','SOLIDIFY').thickness=.003
# One continuous open-front cloak: shoulder wrap, broad sides and rear are a single drape.
nc=81;nr=49;cv=[];cf=[]
for j in range(nr):
 f=j/(nr-1)
 for k in range(nc):
  a=.30+(math.tau-.60)*k/(nc-1)
  w=.174+(.16 if standing else .24)*f
  d=.080+(.13 if standing else .19)*f
  fold=1+.030*math.sin(a*18)*f
  x=w*math.sin(a)*fold
  y=.480-(1.29 if standing else .77)*f-.027*abs(math.sin(a))*(1-f)
  z=d*math.cos(a)*fold-(.025 if standing else .13)*f
  cv.append((x,y,z))
for j in range(nr-1):
 for k in range(nc-1):
  a=j*nc+k;cf.append((a,a+1,a+nc+1,a+nc))
o=mesh('SM_Continuous_Shoulder_Cloak',cv,cf,capeMat,cape);uvGrid(o,nc,nr,2);o.modifiers.new('Woven cloak thickness','SOLIDIFY').thickness=.003
for edge in [0,nc-1]:sweep('SM_Cloak_Front_Border',[cv[j*nc+edge] for j in range(nr)],.0028,gold,cape,8)
sweep('SM_Cloak_Hem',[cv[(nr-1)*nc+k] for k in range(nc)],.0028,gold,cape,8)
# Belt separates bodice and gown.
pts=[(.119*math.cos(k/96*math.tau),.155,.084*math.sin(k/96*math.tau)) for k in range(97)];sweep('SM_Antique_Belt',pts,.012,gold)
sphere('SM_Belt_Buckle',(0,.155,.096),(.027,.018,.006),gold)
for side in [-1,1]:sphere('SM_Shoe',(side*(.09 if standing else .43),-.84 if standing else -.64,.04 if standing else .14),(.044,.035,.085),dark,root)
# UVs for smooth lo fts / sleeves: local planar projection gives stable textile scale.
for o in list(bpy.data.objects):
 if o.type!='MESH':continue
 if not o.data.uv_layers:
  uv=o.data.uv_layers.new(name='UVMap')
  for poly in o.data.polygons:
   for li in poly.loop_indices:
    v=o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=(v.x*4+.5,v.z*2)
 bpy.context.view_layer.objects.active=o
 for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
# Reference proportion correction: shorten exposed neck by 6.5 cm, preserving facial relations.
# Mesh coordinates are still seat-space at this stage; animation pivots are retained below.
for o in list(head.children):
 if o.type=='MESH':
  o.location.z-=.065
for o in list(body.children):
 if o.type=='MESH' and o.name.startswith('SM_Neck'):
  for v in o.data.vertices:
   if v.co.z>.505:v.co.z-=.065*min(1,(v.co.z-.505)/.115)
# Recalculate closed-surface normals before export; loft winding must not invert face shading.
import bmesh
for o in list(bpy.data.objects):
 if o.type=='MESH':
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
# Merge within each original joint while preserving material slots and UVs.
for parent in [root,body,head,cape,armL,armR]:
 objs=[o for o in parent.children if o.type=='MESH']
 if len(objs)>1:
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs:o.select_set(True)
  bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();objs[0].name=parent.name+'_surface'
for parent,pos in [(head,(0,.71,0)),(cape,(0,.46,-.08)),(armL,(-.16,.44,0)),(armR,(.16,.44,0))]:
 old=[(o,o.matrix_world.copy()) for o in parent.children];parent.location=B(pos);bpy.context.view_layer.update()
 for o,m in old:o.matrix_world=m
root['revision']='reference-rebuilt-v13';root['rig']='named pivots; no facial rig or skinning claim';bpy.context.view_layer.update()
mode='standing' if standing else 'mounted';stem='princess-v13-'+mode
meshes=[o for o in bpy.data.objects if o.type=='MESH'];tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
(REVIEW/(stem+'-report.json')).write_text(json.dumps({'triangles':tris,'mode':mode,'textures':2,'workflow':'new reference-built surfaces and packed botanical textiles','rig':'original named empty pivots'},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(stem+'.blend')))
bpy.ops.export_scene.gltf(filepath=str(OUT/(stem+'.glb')),export_format='GLB',export_extras=True,export_animations=False)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=800;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Reference studio');scene.world.color=(.38,.38,.38)
for loc,power in [((3,-4,4),400),((-3,-1,2),220)]:
 bpy.ops.object.light_add(type='AREA',location=loc);bpy.context.object.data.energy=power;bpy.context.object.data.size=4
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.9;scene.camera=cam
for name,loc in [('front',(0,-4,0)),('side',(4,0,0)),('back',(0,4,0)),('head',(0,-3,.665))]:
 cam.data.ortho_scale=.36 if name=='head' else 1.9;target=Vector((0,0,.665 if name=='head' else 0));cam.location=loc;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(REVIEW/(stem+'-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('REBUILT',mode,tris)
