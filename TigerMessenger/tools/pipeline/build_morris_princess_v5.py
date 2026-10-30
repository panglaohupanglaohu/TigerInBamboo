"""Reference-led mounted princess. Courier V2 method: authored lofts and empty pivots, NOT skinning.
Standalone background Blender only. Coordinates Three metres, seat origin, face +Z.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2]; OUT=R/'assets/models/morris-princess'; REVIEW=R/'artifacts/pipeline/princess-skills-pass-20261028';OUT.mkdir(parents=True,exist_ok=True);REVIEW.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def B(p):return (p[0],-p[2],p[1])
def mat(name,h):
 m=bpy.data.materials.new(name);m.diffuse_color=(*[((int(h[i:i+2],16)/255+.055)/1.055)**2.4 if int(h[i:i+2],16)/255>.04045 else int(h[i:i+2],16)/255/12.92 for i in (0,2,4)],1);m.use_nodes=True
 c=m.node_tree.nodes.get('Principled BSDF');c.inputs['Base Color'].default_value=m.diffuse_color;c.inputs['Roughness'].default_value=.84
 return m
ivory=mat('warm ivory linen','e4d7b6');green=mat('moss botanical','465744');gold=mat('antique gold thread','b49a58');red=mat('brick red woven cloak','782b2b');skin=mat('skin ochre rose','d5ae91');hair=mat('gold chestnut hair','80512c');hairLight=mat('hair lit ridges','a37543');dark=mat('deep brown leather','382b24');eye=mat('olive iris','55513c');white=mat('eye ivory','ded6c4');lip=mat('muted rose','995f52')
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
# Smooth anatomically tapered bodice: one continuous shell, clavicles to waist/hips.
loft('continuous fitted linen bodice',[(-.02,.145,.112,0),(.09,.145,.103,0),(.22,.113,.085,.0),(.34,.15,.105,.005),(.43,.157,.102,0),(.48,.153,.086,-.007),(.51,.12,.065,-.005),(.525,.065,.055,0)],ivory)
loft('continuous neck',[(.49,.058,.043,-.012),(.525,.045,.037,-.014),(.555,.036,.032,-.016),(.58,.034,.030,-.017),(.62,.040,.031,-.013)],skin)
# Face uses jaw/chin/cheek/temple/forehead loft; no separate sphere head.
face=loft('continuous adult face',[(.62,.018,.025,.048),(.633,.037,.041,.035),(.655,.050,.055,.019),(.683,.069,.070,.003),(.72,.081,.079,-.002),(.755,.082,.080,-.004),(.80,.079,.077,-.009),(.835,.061,.060,-.015),(.85,.015,.018,-.015)],skin,head,n=64,steps=5)
# Raise rear jaw underside toward the ears: distinct chin, mandibular angle and recessed throat.
for v in face.data.vertices:
 y=v.co.z;front=-v.co.y
 if y<.683:
  rear=max(0,min(1,(.035-front)/.085));v.co.z += .024*rear*max(0,1-(y-.62)/.063)
# Soft bridge of nose joins face surface, modest rather than cartoon snout.
loft('nose bridge',[(.682,.009,.006,.079),(.690,.012,.010,.084),(.708,.008,.010,.083),(.735,.005,.004,.080)],skin,head,n=20,steps=3)
for side in [-1,1]:
 sphere('ear',(side*.083,.710,-.008),(.013,.026,.017),skin,head)
 sphere('eye ivory',(side*.039,.722,.075),(.016,.005,.006),white,head);sphere('iris',(side*.039,.722,.080),(.0055,.0055,.0014),eye,head);sphere('pupil',(side*.039,.722,.0815),(.0028,.0032,.001),dark,head)
 sweep('upper eyelid',[(side*.021,.724,.081),(side*.039,.729,.084),(side*.057,.723,.077)],.0018,hair,head,8)
 sweep('brow',[(side*.022,.748,.078),(side*.042,.751,.078),(side*.06,.744,.069)],.0025,hair,head,8)
 sphere('mouth upper',(0,.666,.077),(.020,.0035,.0038),lip,head);sphere('mouth lower',(0,.661,.077),(.018,.003,.004),lip,head)
# Broad scalp shell only on back/top; waves grow from it continuously to shoulderblades.
loft('continuous shaped hair cap',[(.782,.096,.087,-.004),(.805,.092,.091,-.004),(.835,.075,.077,-.005),(.856,.045,.050,-.008),(.864,.008,.010,-.008)],hair,head,n=64,steps=5)
backHair=loft('continuous back hair mass',[(.302,.066,.025,-.105),(.39,.100,.035,-.100),(.52,.108,.040,-.092),(.66,.102,.042,-.080),(.78,.084,.048,-.052)],hair,head,n=48,steps=4)
for v in backHair.data.vertices:
 y=v.co.z;v.co.x+=.012*math.sin((y-.30)*35);v.co.y+=.008*math.cos((y-.30)*35+v.co.x*30)
# Broad, flattened grouped waves follow scalp and back mass instead of loose tubes.
for k in range(22):
 side=-1 if k<11 else 1;u=(k%11)/10
 x0=side*(.008+.100*u);z0=-.112-.030*(1-u*u)
 pts=[];r=[]
 for j in range(36):
  f=j/35;wave=math.sin(f*19+k*.45)
  pts.append((x0+side*.014*math.sin(f*math.pi)+wave*(.006+.014*f),.822-f*(.51-.04*u),z0-.065*f+math.cos(f*19+k*.45)*.010))
  taper=math.sin(math.pi*(.12+.86*f))**.5
  r.append((.015*taper,.006*taper))
 sweep('broad grouped wave',pts,r,hairLight if k%4==0 else hair,head,12)
# Locks swept from a central part over the crown and temples.
for side in [-1,1]:
 for k in range(9):
  pts=[];rr=[]
  for j in range(28):
   f=j/27;x=side*(.004+.091*math.sin(f*math.pi/2));y=.850-.105*f*f-k*.001;z=.031+.044*math.sin(f*math.pi*.95)-k*.006
   pts.append((x,y,z));rr.append((.0055*(1-.55*f),.0035*(1-.6*f)))
  sweep('swept scalp wave',pts,rr,hairLight if k%4==0 else hair,head,10)
# Circlet is fine continuous ribbon, leaf grammar in controlled alternating pairs.
pts=[(.097*math.sin(k/80*math.tau),.788+.008*math.cos(k/80*math.tau),.083*math.cos(k/80*math.tau)-.008) for k in range(81)]
sweep('circlet ring',pts,.0034,gold,head,8)
for k in range(18):
 q=k/18*math.tau;p=(.098*math.sin(q),.791,.085*math.cos(q)-.008)
 sphere('circlet leaf',p,(.008,.0035,.013),gold,head)
# Continuous bent sleeves + subtle hand grip. No cylinder elbow seams.
for side,parent in [(-1,armL),(1,armR)]:
 pts=[];rr=[]
 controls=[(side*.156,.461,-.005),(side*.202,.411,.025),(side*.223,.326,.073),(side*.216,.253,.13),(side*.184,.235,.22),(side*.143,.235,.31),(side*.12,.235,.362)]
 for i,p in enumerate(controls):pts.append(p);rr.append((.063-i*.003,.060-i*.003))
 sleeve=sweep('continuous bent sleeve',pts,rr,ivory,parent,24);sm=sleeve.modifiers.new('continuous elbow smoothing','SUBSURF');sm.levels=1
 sweep('cuff piping',[(side*.116,.272,.356),(side*.151,.237,.361),(side*.12,.201,.355)],.004,gold,parent,10)
 sphere('gripping palm',(side*.118,.231,.386),(.027,.027,.043),skin,parent)
 for f in range(4):
  x=side*(.099+f*.010);sweep('curled finger',[(x,.232,.408),(x,.216,.421),(x,.204,.412)],.005,skin,parent,8)
 sweep('thumb',[(side*.094,.248,.384),(side*.091,.232,.414)],.007,skin,parent,8)
 sphere('cloak clasp',(side*.137,.482,.071),(.023,.023,.008),gold)
# Mounted gown follows bent thighs then hangs beside flanks; it is not a standing bell.
for side in [-1,1]:
 vv=[];ff=[];rows=30;cols=33
 for j in range(rows):
  f=j/(rows-1)
  for k in range(cols):
   u=k/(cols-1);x=side*(.11+.36*(1-math.exp(-5*f))+.015*math.sin(u*15+f*4)*f)
   y=.03-f*.70+.06*math.sin(u*math.pi)*math.sin(f*math.pi)
   z=(-.30+.65*u)*(.28+.72*math.sin(f*math.pi/2))+.09*math.sin(f*math.pi)
   vv.append((x,y,z))
 for j in range(rows-1):
  for k in range(cols-1):a=j*cols+k;ff.append((a,a+1,a+cols+1,a+cols))
 dress=mesh('thigh and flank linen drape',vv,ff,ivory,root);sol=dress.modifiers.new('closed fabric thickness','SOLIDIFY');sol.thickness=.004
 for k in [4,10,16,22,28]:
  pts=[]
  for j in range(rows):
   p=Vector(vv[j*cols+k]);p.x+=side*.003;pts.append(tuple(p))
  sweep('gown flowing woven stem',pts,.0018,green,root,6)
# Small continuous seated lap bridges the two hanging cloth sides.
loft('linen seated hips',[(-.04,.155,.12,-.015),(.015,.16,.13,-.01),(.075,.145,.11,0)],ivory,root,n=48,steps=6)
# Boots set on saddle sides without detaching from knees. Hidden uppers remain under drape.
for side in [-1,1]:
 sweep('riding boot',[(side*.44,-.38,.05),(side*.445,-.57,.07),(side*.445,-.66,.12)],[.050,.048,.05],dark,root,20);sphere('boot toe',(side*.445,-.65,.17),(.049,.043,.087),dark,root)
# Cape shell, gathered shoulder saddle and wide lower drape. Thickness via solidify.
vv=[];ff=[];rows=34;cols=37
for j in range(rows):
 f=j/(rows-1)
 for k in range(cols):
  u=k/(cols-1)*2-1;w=.172+.22*f;x=u*w;y=.495-.72*f+.04*math.sin(f*math.pi)+.030*math.sin(u*11+f*5)*f;z=-.10-.30*math.sin(f*math.pi/2)-.09*f-.045*math.cos(u*math.pi*5)*f
  vv.append((x,y,z))
for j in range(rows-1):
 for k in range(cols-1):a=j*cols+k;ff.append((a,a+1,a+cols+1,a+cols))
c=mesh('continuous woven cloak',vv,ff,red,cape);sol=c.modifiers.new('woven cloth thickness','SOLIDIFY');sol.thickness=.004
for side in [-1,1]:
 pts=[]
 for j in range(rows):
  f=j/(rows-1);pts.append((side*(.172+.22*f),.495-.72*f+.04*math.sin(f*math.pi),-.108-.30*math.sin(f*math.pi/2)-.09*f-.045*math.cos(math.pi*5)*f))
 sweep('cloak embroidered border',pts,.004,gold,cape,8)
# Repeated surface-following Morris stems and alternating leaf pairs on the cape.
def capePoint(u,f):
 w=.172+.22*f
 return (u*w,.495-.72*f+.04*math.sin(f*math.pi)+.030*math.sin(u*11+f*5)*f,-.10-.30*math.sin(f*math.pi/2)-.09*f-.045*math.cos(u*math.pi*5)*f-.005)
for col in range(7):
 u0=(col-3)*.24
 pts=[capePoint(u0+.035*math.sin(j*.7+col),.14+j*.035) for j in range(22)]
 sweep('cloak botanical vine',pts,.0015,gold,cape,6)
 for j in range(2,21,3):
  for side in [-1,1]:
   f=.14+j*.035;u=u0+.035*math.sin(j*.7+col)
   sweep('cloak curved paired leaf',[capePoint(u,f),capePoint(u+side*.065,f-.013),capePoint(u+side*.09,f-.04)],[.0015,.0045,.0006],gold,cape,6)
# Sleeves keep their existing hand/rein contact; paired gold sprigs at the cuffs.
for side,parent in [(-1,armL),(1,armR)]:
 for j in range(4):
  x=side*(.125+j*.009)
  sweep('cuff embroidered sprig',[(x,.255,.354),(x,.262,.333),(x+side*.008,.269,.32)],.0015,gold,parent,6)
# Bodice botanical panel: balanced mirrored sprigs, repeated nodes, no random decoration.
for side in [-1,1]:
 pts=[(side*(.025+.020*math.sin(j*.55)),.08+j*.026,.105) for j in range(14)]
 sweep('bodice acanthus spine',pts,.0025,green)
 for j in range(1,13,2):
  x,y,z=pts[j];sweep('bodice paired leaf',[(x,y,z),(x+side*.015,y+.012,z),(x+side*.020,y+.023,z)],.003,gold)
# Bake modifiers and join surfaces per pivot/material, maintaining authored articulation.
for o in list(bpy.data.objects):
 if o.type=='MESH':
  bpy.context.view_layer.objects.active=o
  for m in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=m.name)
for p in [root,body,head,cape,armL,armR]:
 meshes=[o for o in list(p.children) if o.type=='MESH']
 if meshes:
  bpy.ops.object.select_all(action='DESELECT')
  for o in meshes:o.select_set(True)
  bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();meshes[0].name=p.name+'_surface'
# Named pivots keep world coordinates. Engine drives local angular changes only.
for p,pos in [(head,(0,.71,0)),(cape,(0,.48,-.1)),(armL,(-.16,.46,0)),(armR,(.16,.46,0))]:
 old=[(o,o.matrix_world.copy()) for o in p.children];p.location=B(pos);bpy.context.view_layer.update()
 for o,m in old:o.matrix_world=m
 bpy.context.view_layer.update()
head.location.z-=.020
bpy.context.view_layer.update()
root['revision']='reference-skills-v5';root['origin']='mounted hip seat; metres; front +Z after glTF';root['rig']='Courier V2 named empty pivots, not skinned mesh'
# Audit mesh completeness and dimensions explicitly.
meshes=[o for o in bpy.data.objects if o.type=='MESH'];bpy.context.view_layer.update()
coords=[o.matrix_world@v.co for o in meshes for v in o.data.vertices];report={'revision':'reference-skills-v5','workflow':'new continuous authored lofts/sweeps and closed drape; courier-style empty pivots; no skinning claimed','mesh_count':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),'bounds_blender':[[min(p[i] for p in coords) for i in range(3)],[max(p[i] for p in coords) for i in range(3)]],'nodes':['MorrisPrincess','body','head','cape','armL','armR'],'validation':'structural and offline component render only; no game navigation acceptance'}
(REVIEW/'princess-v5-report.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'princess-v5.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'princess-v5.glb'),export_format='GLB',export_yup=True,export_animations=False,export_extras=True)
# Neutral component review: actual geometry, not target image.
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=800;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.world.color=(.42,.42,.42)
for loc,power,size in [((3,-4,4),450,4),((-3,-1,2),240,3),((0,3,3),300,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);bpy.context.object.data.energy=power;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=size
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.85;scene.camera=cam
for name,loc in [('front',(0,-4,.45)),('side',(4,0,.45)),('back',(0,4,.45))]:
 cam.location=loc;cam.rotation_euler=(Vector((0,0,.1))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(REVIEW/f'princess-v5-{name}.png');bpy.ops.render.render(write_still=True)
cam.data.ortho_scale=.48
for name,loc in [('head-side',(3,0,.69)),('head-front',(0,-3,.69)),('head-quarter',(2,-3,.69))]:
 cam.location=loc;cam.rotation_euler=(Vector((0,0,.69))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(REVIEW/f'princess-v5-{name}.png');bpy.ops.render.render(write_still=True)
print(json.dumps(report))
