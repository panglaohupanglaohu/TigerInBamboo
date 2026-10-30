"""New horse anatomy following current tiger V3: metaball -> voxel skin -> armature -> GLB.
Authored horse anatomy, not a tiger reshape or legacy segmented horse export.
Three local units match existing horse scale .6075 and seat (0,2.38,-.1).
"""
import bpy,bmesh,math,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2];OUT=R/'assets/models/morris-horse';REV=R/'artifacts/pipeline/morris-character-pipeline-20261027';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def B(p):return Vector((p[0],-p[2],p[1]))
def mat(n,h):
 m=bpy.data.materials.new(n);m.use_nodes=True;c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in c];m.diffuse_color=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.84;return m
coat=mat('warm white horse','e1dccd');hair=mat('ivory mane','c5bca4');hoof=mat('dark horn hoof','35322d');dark=mat('deep brown eye','302c26');gold=mat('antique gold weave','b59b59');red=mat('brick red brocade','782d34');blue=mat('deep indigo saddle','214c54');brocade=mat('navy brocade cloth','214c54')
mb=bpy.data.metaballs.new('HorseAnatomy');mb.resolution=.045;mb.render_resolution=.045;mb.threshold=.6;o=bpy.data.objects.new('HorseAnatomy',mb);bpy.context.collection.objects.link(o);F=.574
# Tiger's calibrated ellipsoid fields give organic shoulder/quarter unions.
def ell(c,r):
 e=mb.elements.new();e.type='ELLIPSOID';e.co=B(c);e.radius=1;e.stiffness=2;e.size_x=r[0]/F;e.size_y=r[2]/F;e.size_z=r[1]/F
# Barrel, chest, croup and withers. Back remains a real saddle bearing surface.
for c,r in [((0,1.75,-.05),(.54,.50,.98)),((0,1.74,.65),(.49,.59,.48)),((0,1.76,-.78),(.57,.56,.49)),((0,2.07,.43),(.35,.33,.44)),((0,2.00,-.48),(.44,.32,.46)),((0,1.43,.23),(.42,.35,.72))]:ell(c,r)
# Sloping chest-to-poll neck and long horse head, lower muzzle and chin.
for c,r in [((0,2.03,.86),(.36,.48,.40)),((0,2.40,.99),(.30,.48,.34)),((0,2.76,1.10),(.235,.40,.29)),((0,3.02,1.30),(.22,.27,.27)),((0,2.87,1.51),(.185,.27,.29)),((0,2.65,1.77),(.15,.20,.23)),((0,2.59,1.93),(.16,.14,.18)),((0,2.58,1.70),(.14,.14,.22))]:ell(c,r)
# Throatlatch concavity separates the jaw from the front neck, avoiding the
# inflated straight triangular profile produced by overlapping positive fields.
e=mb.elements.new();e.type='ELLIPSOID';e.co=B((0,2.30,1.62));e.radius=1;e.stiffness=1.2;e.use_negative=True;e.size_x=.32/F;e.size_y=.29/F;e.size_z=.30/F
# Full connected limb chains: shoulder/thigh, upper, carpus/hock, cannon, fetlock.
legspec=[]
for side in [-1,1]:
 for front in [True,False]:
  x=side*.40;z=.69 if front else -.80
  if front:pts=[(x,1.85,z),(x,1.31,z-.06),(x, .86,z-.01),(x,.34,z+.04),(x,.12,z+.13)];r=[.22,.16,.115,.085,.10]
  else:pts=[(x,1.82,z),(x,1.30,z+.20),(x,.90,z-.15),(x,.32,z-.05),(x,.12,z+.04)];r=[.29,.205,.125,.085,.10]
  legspec.append((side,front,pts))
  for k in range(len(pts)-1):
   a=Vector(pts[k]);b=Vector(pts[k+1]);num=max(2,int((a-b).length/.10))
   for j in range(num):t=j/num;pos=a.lerp(b,t);rad=r[k]*(1-t)+r[k+1]*t;ell(pos,(rad,rad,rad))
  ell(pts[-1],(.15,.125,.21))
# Bake true union/remesh, retaining one manifold skin.
dg=bpy.context.evaluated_depsgraph_get();me=bpy.data.meshes.new_from_object(o.evaluated_get(dg));skin=bpy.data.objects.new('horse_continuous_skin',me);bpy.context.collection.objects.link(skin);bpy.data.objects.remove(o)
bpy.context.view_layer.objects.active=skin;skin.select_set(True)
for name,typ in [('uniform voxel skin','REMESH'),('anatomical softening','SMOOTH'),('runtime topology','DECIMATE')]:
 m=skin.modifiers.new(name,typ)
 if typ=='REMESH':m.mode='VOXEL';m.voxel_size=.035
 if typ=='SMOOTH':m.factor=.45;m.iterations=5
 if typ=='DECIMATE':m.ratio=.43
 bpy.ops.object.modifier_apply(modifier=m.name)
skin.data.materials.append(coat)
for p in skin.data.polygons:p.use_smooth=True
from mathutils.bvhtree import BVHTree
bm=bmesh.new();bm.from_mesh(skin.data);bvh=BVHTree.FromBMesh(bm)
def surface_x(y,z):
 hit=bvh.ray_cast(Vector((3,-z,y)),Vector((-1,0,0)),6)[0]
 return abs(hit.x) if hit else .5
parts=[]
def sphere(n,p,s,ma,bone='neck'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=B(p));o=bpy.context.object;o.name=n;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(ma)
 for f in o.data.polygons:f.use_smooth=True
 parts.append((o,bone));return o
def tube(n,pts,rad,ma,bone='chest'):
 cu=bpy.data.curves.new(n,'CURVE');cu.dimensions='3D';cu.resolution_u=2;cu.bevel_depth=rad;cu.bevel_resolution=2;sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
 for p,co in zip(sp.points,pts):p.co=(*B(co),1)
 o=bpy.data.objects.new(n,cu);bpy.context.collection.objects.link(o);o.data.materials.append(ma);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object;parts.append((o,bone));return o
for side in [-1,1]:
 sphere('dark eye',(side*(surface_x(2.98,1.43)+.012),2.98,1.43),(.028,.022,.028),dark)
 sphere('nostril',(side*(surface_x(2.64,1.96)+.005),2.64,1.96),(.025,.032,.055),dark)
 # Horse ears are a short pointed lance, not long rabbit lobes.
 ear=sphere('lanceolate ear',(side*.123,3.26,1.20),(.052,.14,.045),coat);ear.rotation_euler[1]=side*.16
 sphere('ear inner',(side*.123,3.26,1.248),(.025,.085,.012),hair)
 for front in [True,False]:
  z=.82 if front else -.76;name=('front' if front else 'hind')+('.L' if side>0 else '.R')
  sphere('complete hoof',(side*.40,.115,z),(.165,.12,.23),hoof,name+'_hoof')
# Tiger-style measured skin contact: mane follows actual posterior neck surface.
def back_z(y):
 hit=bvh.ray_cast(Vector((0,3,y)),Vector((0,-1,0)),6)[0]
 return -hit.y if hit else .6
for side in [-1,1]:
 for k in range(30):
  f=k/29;y=3.18-f*.91;z=back_z(y) if y>2.42 else .72-.35*(2.42-y)
  pts=[]
  for j in range(13):
   t=j/12;length=(.34-.17*f)*(1+.18*math.sin(k*1.73));yy=y-length*t;zz=z+.15*t+.032*math.sin(t*8+k*.65)*math.sin(t*math.pi);xx=surface_x(yy,zz)+.018+.016*math.sin(t*8+k);pts.append((side*xx,yy,zz))
  tube('swept neck mane',pts,.008+(k%3)*.0015,hair,'neck')
# Tail has a continuous volume and layered fine flowing locks, not one thin rod.
vv=[];ff=[];rings=29;radial=20
centers=[Vector((0,2.03-(j/(rings-1))*1.54,-1.20-.36*math.sin((j/(rings-1))*math.pi*.82))) for j in range(rings)]
for j,c in enumerate(centers):
 f=j/(rings-1);d=(centers[min(rings-1,j+1)]-centers[max(0,j-1)]).normalized();u=Vector((1,0,0));v=d.cross(u).normalized();rr=(.075+.075*math.sin(f*math.pi))*(1-.65*f)
 for k in range(radial):
  a=k/radial*math.tau;vv.append(tuple(c+u*math.cos(a)*rr+v*math.sin(a)*rr))
 if j:
  for k in range(radial):a=(j-1)*radial+k;b=(j-1)*radial+(k+1)%radial;ff.append((a,b,b+radial,a+radial))
ff.extend([tuple(range(radial-1,-1,-1)),tuple((rings-1)*radial+k for k in range(radial))]);me=bpy.data.meshes.new('continuous tail volume');me.from_pydata([B(v) for v in vv],[],ff);me.update();ob=bpy.data.objects.new('continuous tail hair core',me);bpy.context.collection.objects.link(ob);ob.data.materials.append(hair)
for f in me.polygons:f.use_smooth=True
parts.append((ob,'tail'))
for k in range(30):
 a=k/30*math.tau;pts=[]
 for j in range(23):
  f=j/22;pts.append((math.sin(a)*(.09+.065*math.sin(f*math.pi))+math.sin(f*14+a)*.015,2.03-f*1.53,-1.20-.36*math.sin(f*math.pi*.82)+math.cos(a)*.07))
 tube('long tail lock',pts,.014,hair,'tail')
# Bridle holds correct brow/cheek/muzzle surfaces.
for side in [-1,1]:
 tube('cheek leather',[(side*.20,3.10,1.29),(side*.215,2.98,1.43),(side*.16,2.65,1.91)],.016,red,'neck')
 for p in [(side*.215,2.98,1.43),(side*.16,2.65,1.91)]:sphere('bridle rosette',p,(.033,.033,.015),gold)
tube('noseband',[(-.16,2.68,1.94),(0,2.75,2.0),(.16,2.68,1.94)],.021,red,'neck')
tube('browband',[(-.19,3.08,1.38),(0,3.14,1.48),(.19,3.08,1.38)],.019,gold,'neck')
# Cloth wings are new continuous curved surfaces, botanically woven along the flank.
for side in [-1,1]:
 vv=[];ff=[];rows=14;cols=25
 for j in range(rows):
  t=j/(rows-1)
  for k in range(cols):
   u=k/(cols-1);vv.append((side*(.40+.21*math.sin(t*math.pi*.65)),2.19-t*1.02,-1.02+u*1.96))
 for j in range(rows-1):
  for k in range(cols-1):a=j*cols+k;ff.append((a,a+1,a+cols+1,a+cols))
 me=bpy.data.meshes.new('brocade');me.from_pydata([B(v) for v in vv],[],ff);me.update();o=bpy.data.objects.new('continuous brocade cloth',me);bpy.context.collection.objects.link(o);o.data.materials.append(brocade);parts.append((o,'chest'));sol=o.modifiers.new('fabric thickness','SOLIDIFY');sol.thickness=.012;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=sol.name)
 for y,x in [(2.17,.42),(1.18,.60)]:tube('cloth border',[(side*x,y,-1.02+k*.0817) for k in range(25)],.017,gold)
 for k in range(7):
  z=-.87+k*.26;pts=[(side*(.50+.10*j/10),2.12-j*.084,z+.045*math.sin(j*.6)) for j in range(11)];tube('woven botanical stem',pts,.009,gold)
  for j in [3,6,9]:
   x,y,z0=pts[j]
   for d in [-1,1]:tube('paired woven leaf',[(x,y,z0),(x+side*.008,y+.035,z0+d*.04),(x,y+.045,z0+d*.065)],.008,gold)
 for k in range(5):
  zz=-.77+k*.35
  for row in range(3):
   yy=1.40+row*.25;xx=side*max(.60,surface_x(yy,zz)+.037)
   for sign in [-1,1]:
    leaf=sphere('woven gold leaf',(xx,yy,zz+sign*.055),(.009,.075,.029),gold,'chest');leaf.rotation_euler[0]=sign*.55
   for petal in range(6):
    aa=petal*math.tau/6;sphere('woven flower petal',(xx+side*.012,yy+.10+math.sin(aa)*.036,zz+math.cos(aa)*.036),(.008,.025,.016),gold,'chest')
 for k in range(15):
  z=-.99+k*.132;tube('fringe',[(side*.60,1.17,z),(side*.61,1.02,z)],.010,gold);sphere('fringe knot',(side*.61,1.00,z),(.021,.041,.021),gold,'chest')
sphere('saddle seat',(0,2.28,-.1),(.43,.11,.57),blue,'chest')
# Seat flank cloth and embroidery on measured continuous anatomy, like tiger nose seating.
for obj,bn in parts:
 if bn=='chest' and any(word in obj.name for word in ['brocade','cloth','woven','fringe']):
  for v in obj.data.vertices:
   w=obj.matrix_world@v.co;y=w.z;z=-w.y;side=1 if w.x>=0 else -1;w.x=side*max(abs(w.x),surface_x(y,z)+.022);v.co=obj.matrix_world.inverted()@w
# Actual armature. Rest points use same contract as authored continuous body.
arm=bpy.data.armatures.new('horse_rig');ao=bpy.data.objects.new('MorrisHorseRig',arm);bpy.context.collection.objects.link(ao);bpy.context.view_layer.objects.active=ao;ao.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bs={};segments={}
def bone(n,a,b,parent=None,deform=True):
 o=arm.edit_bones.new(n);o.head=B(a);o.tail=B(b);o.use_deform=deform
 if parent:o.parent=bs[parent]
 bs[n]=o
 if deform:segments[n]=(B(a),B(b))
bone('root',(0,0,0),(0,.4,0),None,False);bone('chest',(0,1.75,-.45),(0,1.82,.68),'root');bone('neck',(0,1.97,.83),(0,3.08,1.4),'chest');bone('tail',(0,1.95,-1.13),(0,1.42,-1.40),'chest');bone('tail.mid',(0,1.42,-1.40),(0,.92,-1.54),'tail');bone('tail.tip',(0,.92,-1.54),(0,.45,-1.45),'tail.mid')
for side,front,pts in legspec:
 n=('front' if front else 'hind')+('.L' if side>0 else '.R');bone(n+'_upper',pts[0],pts[1],'chest');bone(n+'_lower',pts[1],pts[2],n+'_upper');bone(n+'_cannon',pts[2],pts[3],n+'_lower');bone(n+'_hoof',pts[3],pts[4],n+'_cannon')
bpy.ops.object.mode_set(mode='OBJECT')
# Smooth deterministic distance weights: every vertex gets normalized influences. Unlike
# automatic heat failure this is auditable, and does not claim production weight painting.
def distance(p,a,b):
 d=b-a;t=max(0,min(1,(p-a).dot(d)/d.length_squared));return (p-(a+d*t)).length
for n in segments:skin.vertex_groups.new(name=n)
for v in skin.data.vertices:
 ds=sorted((distance(v.co,a,b),n) for n,(a,b) in segments.items());nearest=ds[0][0];chosen=[(d,n) for d,n in ds[:3] if d<nearest+.20];ws=[math.exp(-(d-nearest)*16) for d,n in chosen];tot=sum(ws)
 weights={n:w/tot for (d,n),w in zip(chosen,ws)}
 def smooth01(a,b,x):
  f=max(0,min(1,(x-a)/(b-a)));return f*f*(3-2*f)
 # The croup and barrel belong to the torso, not the rotating upper-leg bone.
 # Blend only the lower shoulder/thigh into the actual limb chain.
 yy=v.co.z;zz=-v.co.y;xx=abs(v.co.x)
 torso=max(smooth01(1.42,1.98,yy),smooth01(1.15,1.55,yy)*(1-smooth01(.12,.40,xx)))*(1-smooth01(.65,1.15,zz))
 weights={n:w*(1-torso) for n,w in weights.items()};weights['chest']=weights.get('chest',0)+torso
 for n,w in weights.items():
  if w>1e-8:skin.vertex_groups[n].add([v.index],w,'REPLACE')
mod=skin.modifiers.new('normalized skeleton weights','ARMATURE');mod.object=ao;skin.parent=ao
for o,n in parts:
 # Rigid anatomical attachments follow corresponding bones, all surfaces are skinned.
 if n=='tail':
  groups={name:o.vertex_groups.new(name=name) for name in ['tail','tail.mid','tail.tip']}
  for v in o.data.vertices:
   w=o.matrix_world@v.co;f=max(0,min(1,(2.03-w.z)/1.54));rootW=max(0,1-f/.55);tipW=max(0,(f-.45)/.55);midW=max(0,1-rootW-tipW);total=rootW+midW+tipW
   for name,weight in [('tail',rootW),('tail.mid',midW),('tail.tip',tipW)]:
    if weight>0:groups[name].add([v.index],weight/total,'REPLACE')
 else:
  vg=o.vertex_groups.new(name=n);vg.add(list(range(len(o.data.vertices))),1,'REPLACE')
 mod=o.modifiers.new('attachment skeleton','ARMATURE');mod.object=ao;o.parent=ao
# Compact decorations into one skinned mesh per bone, retain proper weights.
for n in segments:
 obs=[o for o,b in parts if b==n]
 if len(obs)>1:
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=n+'_attachments'
root=bpy.data.objects.new('MorrisHorse',None);bpy.context.collection.objects.link(root);ao.parent=root;root['revision']='tiger-workflow-horse-v8';root['rig']='continuous remeshed skin; normalized segment-distance bone weights';root['seat']='0,2.38,-0.1 horse local units; scale existing root .6075'
unweighted=sum(1 for v in skin.data.vertices if not any(g.weight>1e-5 for g in v.groups));nonunit=sum(1 for v in skin.data.vertices if abs(sum(g.weight for g in v.groups)-1)>1e-4)
meshes=[o for o in bpy.data.objects if o.type=='MESH'];report={'eye_surface_x':surface_x(3.038,1.58),'revision':'tiger-workflow-horse-v8','workflow':'new anatomical metaball union, voxel remesh, smoothing, decimation, real armature','skin_vertices':len(skin.data.vertices),'skin_triangles':sum(len(p.vertices)-2 for p in skin.data.polygons),'unweighted_vertices':unweighted,'non_normalized_vertices':nonunit,'bones':list(bs),'weights':'normalized segment-distance candidate weights, not production hand painting','validation':'structural audit and neutral component images only; production gait/nav pending'}
(REV/'horse-v8-report.json').write_text(json.dumps(report,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'horse-v8.blend'));bpy.ops.export_scene.gltf(filepath=str(OUT/'horse-v8.glb'),export_format='GLB',export_skins=True,export_animations=False,export_yup=True,export_extras=True)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1100;scene.render.resolution_y=850;scene.render.resolution_percentage=100;scene.world.color=(.4,.4,.4)
for loc,power,size in [((4,-5,6),700,5),((-4,-1,3),450,4),((0,4,5),600,4)]:
 bpy.ops.object.light_add(type='AREA',location=loc);bpy.context.object.data.energy=power;bpy.context.object.data.size=size
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=4.8;scene.camera=cam
for name,loc in [('side',(7,0,2.3)),('front',(0,-7,2.2)),('back',(0,7,2.2))]:
 cam.location=loc;cam.rotation_euler=(Vector((0,-.25,1.8))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(REV/f'horse-v8-{name}.png');bpy.ops.render.render(write_still=True)
print(json.dumps(report))
