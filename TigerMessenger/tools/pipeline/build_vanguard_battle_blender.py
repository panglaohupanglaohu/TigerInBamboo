"""Original-node Vanguard candidate; independent background Blender authoring."""
import bpy,bmesh,json,math,hashlib,struct,sys
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/models/optimized/vanguard-battle-v1';ART=ROOT/'artifacts/pipeline/vanguard-battle-v1'
SOURCE=ROOT/'assets/models/originals/supplemental/blender-r3/vanguardTrooper.blend';SNAP=ROOT/'assets/models/originals/supplemental/vanguardTrooper.source.json'
C=Matrix.Rotation(math.pi/2,4,'X');CI=C.inverted()
def ident(o):return o.get('three_node_id',o.get('vanguard_added_id'))
def flat(m):return [m[r][c] for c in range(4) for r in range(4)]
def local(o):return CI@o.matrix_basis@C
def setm(o,m):o.matrix_basis=C@m@CI
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def mesh(name,vs,fs,parent,mat,tag):
 d=bpy.data.meshes.new(name);d.from_pydata([C.to_3x3()@Vector(v) for v in vs],[],fs);d.update()
 o=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(o);o.parent=parent;o['vanguard_added_id']=tag
 if mat:d.materials.append(mat)
 return o
def box_geometry(size):
 signs=[(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]
 return [tuple(s[k]*size[k]/2 for k in range(3)) for s in signs],[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]
def bevel(o,width=.007):
 o.data=o.data.copy();bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 bpy.context.view_layer.objects.active=o;o.hide_viewport=False;o.hide_set(False)
 mod=o.modifiers.new('Small armor edge chamfer','BEVEL');mod.width=width;mod.segments=1;mod.limit_method='ANGLE';mod.angle_limit=.3;bpy.ops.object.modifier_apply(modifier=mod.name)
 # Source facet meshes contain custom corner normals; after topology changes
 # they must not smooth across the new armor chamfers.
 for p in o.data.polygons:p.use_smooth=False
 if o.data.has_custom_normals:o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))
def box(name,size,center,parent,mat,tag,width=.004):
 v,f=box_geometry(size);o=mesh(name,v,f,parent,mat,tag);setm(o,Matrix.Translation(Vector(center)))
 if width:bevel(o,width)
 return o
def cylinder(name,r,length,parent,mat,tag):
 vs=[(r*math.cos(i*math.tau/10),y,r*math.sin(i*math.tau/10)) for y in [-length/2,length/2] for i in range(10)];fs=[tuple(range(9,-1,-1)),tuple(range(10,20))]+[(i,(i+1)%10,(i+1)%10+10,i+10) for i in range(10)]
 return mesh(name,vs,fs,parent,mat,tag)
def orient_y(o,point,axis):setm(o,Matrix.Translation(Vector(point))@Vector((0,1,0)).rotation_difference(Vector(axis).normalized()).to_matrix().to_4x4())
def rod(name,start,end,r,parent,mat,tag):
 d=Vector(end)-Vector(start);o=cylinder(name,r,d.length,parent,mat,tag);orient_y(o,(Vector(start)+Vector(end))/2,d);return o
def chain_matrix(o,stop):
 m=local(o);p=o.parent
 while p and p!=stop:m=local(p)@m;p=p.parent
 return m
def added(tag):return next((o for o in bpy.context.scene.objects if o.get('vanguard_added_id')==tag),None)

def glove(o,side,hole=.0305):
 vs=[];fs=[]
 def part(v,f):
  k=len(vs);vs.extend(v);fs.extend(tuple(i+k for i in face) for face in f)
 v,f=box_geometry((.024,.102,.080));part([(x-hole-.015,y,z) for x,y,z in v],f)
 for y in [-.036,-.012,.012,.036]:
  for i in range(8):
   a=-2.45+i*4.9/8;b=-2.45+(i+1)*4.9/8
   v=[(r*math.cos(t),y+dy,r*math.sin(t)) for r in [hole,hole+.016] for t in [a,b] for dy in [-.010,.010]]
   part(v,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)])
 for center,size in [((-.023,.049,.024),(.050,.022,.022)),((.008,.037,.018),(.024,.026,.023))]:
  v,f=box_geometry(size);part([tuple(p[k]+center[k] for k in range(3)) for p in v],f)
 if side=='L':vs=[(x,y,-z) for x,y,z in vs];fs=[tuple(reversed(f)) for f in fs]
 temp=mesh('Articulated armored '+side+' glove',vs,fs,o.parent,o.data.materials[0],'add:temp');o.data=temp.data;bpy.data.objects.remove(temp,do_unlink=True)
 o['candidateGlove']='4 closed segmented fingers plus opposed thumb; complete wrist roll from elbow-to-grip';o['gripHoleRadius']=hole

def hand_matrix(target,axis,wrist,side):
 y=Vector(axis).normalized();x=Vector(wrist)-y*Vector(wrist).dot(y)
 if x.length<1e-6:x=Vector((1,0,0))
 x.normalize();z=x.cross(y).normalized();return Matrix.Translation(Vector(target))@Matrix((x,y,z)).transposed().to_4x4()
def segment_part(o,start,end,source_length,coverage=.72):
 a=Vector(start);b=Vector(end);q=Vector((0,1,0)).rotation_difference((b-a).normalized())
 setm(o,Matrix.Translation((a+b)/2)@q.to_matrix().to_4x4()@Matrix.Diagonal((1,(b-a).length*coverage/source_length,1,1)))

def arm(nodes,side,target,axis,pole):
 ids={'L':('n27','n28','n30','n32','n34',['n36','n37','n38']),'R':('n47','n48','n50','n52','n54',['n56','n57','n58'])}[side]
 pivot,pauldron,upper,fore,hand,bands=[nodes[x] if isinstance(x,str) else [nodes[k] for k in x] for x in ids]
 shoulder=Vector((.21 if side=='L' else -.21,1.12,0));dest=Vector(target)-shoulder;direction=dest.normalized();length=max(.245,dest.length*.51);half=dest.length/2;h=math.sqrt(max(0,length*length-half*half));hint=Vector(pole);hint=(hint-direction*hint.dot(direction)).normalized();elbow=direction*half+hint*h
 setm(pivot,Matrix.Translation(shoulder));segment_part(upper,Vector(),elbow,.20,.73);segment_part(fore,elbow+(dest-elbow).normalized()*.025,dest-(dest-elbow).normalized()*.10,.20,1.0)
 setm(pauldron,Matrix.Translation((0,-.013,0))@Matrix.Rotation(.12 if side=='L' else -.12,4,'Z'))
 # Collar under the shoulder plate and an actual visible cylindrical elbow joint.
 hinge_axis=elbow.cross(dest-elbow).normalized()
 for name,point,r,length in [('shoulder',Vector((0,-.065,0)),.064,.09),('elbow',elbow,.043,.095),('wrist',dest-(dest-elbow).normalized()*.05,.034,.105)]:
  o=added('add:'+side+'-'+name);orient_y(o,point,(dest-elbow).normalized() if name=='wrist' else hinge_axis)
 for i,band in enumerate(bands):
  q=Vector((0,1,0)).rotation_difference(elbow.normalized());setm(band,Matrix.Translation(elbow*(.28+i*.17))@q.to_matrix().to_4x4())
 setm(hand,hand_matrix(dest,axis,dest-elbow,side))
 return {'shoulder':list(shoulder),'elbow':list(shoulder+elbow),'grip':list(target),'axis':list(Vector(axis).normalized()),'handNode':ids[4]}

def leg(nodes,side,hip_x,knee_bend):
 ids=('n64','n65','n67','n68','n70','n72') if side=='L' else ('n74','n75','n77','n78','n80','n82');pivot,thigh,stripe,knee,shin,boot=[nodes[k] for k in ids]
 setm(pivot,Matrix.Translation((hip_x,.70,0)))
 kp=Vector((.022 if side=='L' else -.022,-.29,.025));ankle=kp+Vector((0,-.285*math.cos(knee_bend),-.285*math.sin(knee_bend)))
 segment_part(thigh,Vector(),kp,.26,.85);setm(stripe,Matrix.Translation(kp*.34)@Vector((0,1,0)).rotation_difference(kp.normalized()).to_matrix().to_4x4())
 segment_part(shin,kp,ankle,.24,.80);setm(knee,Matrix.Translation(kp+Vector((0,0,.055)))@Matrix.Diagonal((1,1,.55,1)))
 setm(boot,Matrix.Translation(ankle+Vector((0,-.046,.035))))
 for name,point,r,length in [('knee',kp,.050,.16),('ankle',ankle,.041,.145)]:orient_y(added('add:'+side+'-'+name),point,(1,0,0))
 o=added('add:'+side+'-kneecap');setm(o,Matrix.Translation(kp+Vector((0,0,.093))))
 return {'hip':list(Vector((hip_x,.70,0))),'knee':list(Vector((hip_x,.70,0))+kp),'ankle':list(Vector((hip_x,.70,0))+ankle)}

def controls(name):
 d={'direction':Vector((0,.95,.312)),'right':Vector((-.34,.765,.22)),'blade_axis':Vector((.02,-.925,.38)),'bend':.08,'lean':0.,'drop':0.,'rope':0.}
 if name=='aim':d.update(direction=Vector((0,0,1)),right=Vector((-.33,.76,.19)))
 elif name=='windup':d.update(right=Vector((-.33,1.14,.30)),blade_axis=Vector((-.08,.90,.42)),bend=.14)
 elif name=='slash':d.update(right=Vector((-.32,.80,.38)),blade_axis=Vector((.25,-.83,.50)),bend=.20)
 elif name=='stagger':d.update(right=Vector((-.38,.85,.20)),blade_axis=Vector((-.25,-.90,.36)),bend=.38,lean=-.08,drop=-.018)
 elif name=='rope':d.update(right=Vector((-.31,.75,.18)),blade_axis=Vector((0,-.96,.28)),bend=.50,rope=1.)
 return d
def pose(nodes,name,mix=None):
 d=controls(name)
 if mix:
  other,t=mix;end=controls(other)
  d={k:v+(end[k]-v)*t for k,v in d.items()}
 fig=nodes['n1'];setm(fig,Matrix.Translation((0,d['drop'],0))@Matrix.Rotation(d['lean'],4,'X'));gun_origin=Vector((.255,1.46,-.085))
 direction=d['direction'].normalized();right=d['right'];blade_axis=d['blade_axis'].normalized();bend=d['bend']
 q=Vector((0,0,1)).rotation_difference(direction).to_matrix().to_4x4();gun_fig=Matrix.Translation(gun_origin)@q
 left=gun_fig@Vector((0,-.11,-.12));left_axis=q.to_3x3()@Vector((0,1,0))
 left=left.lerp(Vector((.47,1.48,.14)),d['rope']);left_axis=left_axis.lerp(Vector((0,1,0)),d['rope']).normalized()
 hands={'L':arm(nodes,'L',left,left_axis,(1,-1,.12)),'R':arm(nodes,'R',right,blade_axis,(-1,-.2,-.6))}
 setm(nodes['n39'],local(nodes['n27']).inverted()@gun_fig)
 blade_fig=Matrix.Translation(right)@Vector((1,0,0)).rotation_difference(blade_axis).to_matrix().to_4x4();setm(nodes['n59'],local(nodes['n47']).inverted()@blade_fig)
 # Cannon is borne by a pivoted shoulder/back frame, independently of the hand.
 socket=added('add:cannon-axis');orient_y(socket,gun_origin,(1,0,0))
 for side in [-1,1]:
  o=added('add:cannon-fork-'+str(side));setm(o,Matrix.Translation(gun_origin+Vector((side*.057,-.055,0)))@Matrix.Rotation(-.12,4,'X'))
 setm(added('add:rope-grip'),Matrix.Translation(left))
 legs={'L':leg(nodes,'L',.135,bend),'R':leg(nodes,'R',-.135,-bend*.45)}
 return {'name':name,'hands':hands,'legs':legs,'weaponGrip':{'blade':list(right),'gun':list(gun_fig@Vector((0,-.11,-.12)))},'gunDirection':list(direction),'leftHandRole':'rope' if d['rope']>=.999 else ('transition to/from rope' if d['rope']>0 else 'gun grip'),'transforms':{ident(o):flat(local(o)) for o in bpy.context.scene.objects if ident(o)}}

def setup(nodes):
 fig=nodes['n1'];dark=nodes['n6'].data.materials[0];plate=nodes['n2'].data.materials[0];light=nodes['n4'].data.materials[0]
 for k,o in nodes.items():
  if o.type=='MESH' and len(o.data.materials)==1:
   # Three BoxGeometry's six groups reference one material in this factory;
   # archive face indices 1..5 are not six different material assignments.
   for poly in o.data.polygons:poly.material_index=0
  if o.type!='MESH' or o.hide_render:continue
  src=json.loads(o.data.materials[0].get('three_source','{}'))
  if src.get('type')!='MeshBasicMaterial' and k!='n60':bevel(o,.005 if k in ['n26','n36','n37','n38','n56','n57','n58','n67','n77'] else .008)
 glove(nodes['n54'],'R',.0305);glove(nodes['n34'],'L',.043)
 # Gun grip's square diagonal is .0424, hence the separate glove opening.
 for side,pivot in [('L',nodes['n27']),('R',nodes['n47'])]:
  for name,r,length in [('shoulder',.064,.09),('elbow',.043,.095),('wrist',.034,.105)]:cylinder(side+' '+name+' hinge',r,length,pivot,dark,'add:'+side+'-'+name)
 for side,pivot in [('L',nodes['n64']),('R',nodes['n74'])]:
  for name,r,length in [('knee',.05,.16),('ankle',.041,.145)]:cylinder(side+' '+name+' hinge',r,length,pivot,dark,'add:'+side+'-'+name)
  box(side+' fitted knee shield',(.115,.075,.027),(0,-.30,.085),pivot,light,'add:'+side+'-kneecap',.012)
 # Front toe/heel and backpack remain the original objects, with bevelled edges.
 for side,x in [('L',-.1),('R',.1)]:
  for j in range(4):box('Backpack vent '+side+str(j),(.087,.010,.008),(x,1.065-j*.025,-.283),fig,dark,'add:pack-vent-'+side+str(j),.001)
 cylinder('Cannon trunnion',.055,.15,fig,dark,'add:cannon-axis')
 neck=cylinder('Neck articulated collar',.073,.055,fig,dark,'add:neck-collar');setm(neck,Matrix.Translation((0,1.175,0)))
 for side in [-1,1]:box('Cannon fork '+str(side),(.022,.16,.10),(0,0,0),fig,plate,'add:cannon-fork-'+str(side),.008)
 box('Backpack cannon foot',(.13,.075,.11),(.19,1.17,-.19),fig,plate,'add:cannon-foot',.008)
 rod('Cannon support rear strut',(.19,1.15,-.21),(.255,1.33,-.10),.025,fig,dark,'add:cannon-strut')
 cable=[(.275,1.415,-.12),(.36,1.36,-.17),(.38,1.23,-.23),(.35,1.12,-.29),(.17,1.07,-.29)]
 for i,(a,b) in enumerate(zip(cable,cable[1:])):rod('Cannon power cable '+str(i),a,b,.016,fig,dark,'add:cannon-cable-'+str(i))
 # Hollow muzzle collar keeps the original cyan emitter visibly inset.
 vs=[(r*math.cos(i*math.tau/10),r*math.sin(i*math.tau/10),z) for z,r in [(.44,.056),(.48,.056),(.48,.046),(.44,.046)] for i in range(10)]
 fs=[(ring*10+i,ring*10+(i+1)%10,next_ring*10+(i+1)%10,next_ring*10+i) for ring,next_ring in [(0,1),(1,2),(2,3)] for i in range(10)]
 mesh('Cannon muzzle protective collar',vs,fs,nodes['n39'],dark,'add:muzzle-collar')
 # Guard keeps the blade emitter out of the finger curl; original hilt, edge and halo survive.
 box('Laser emitter guard',(.026,.10,.10),(.095,0,0),nodes['n59'],light,'add:blade-guard',.008)
 grip=bpy.data.objects.new('Rope hand anchor (rope belongs to world)',None);bpy.context.scene.collection.objects.link(grip);grip.parent=fig;grip['vanguard_added_id']='add:rope-grip'

def studio(sc):
 sc.render.engine='CYCLES';sc.cycles.samples=24;sc.render.resolution_x=1100;sc.render.resolution_y=1300;sc.render.resolution_percentage=100;sc.view_settings.view_transform='AgX'
 w=bpy.data.worlds.new('Vanguard neutral studio');w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.34,.39,.45,1);w.node_tree.nodes['Background'].inputs[1].default_value=.65;sc.world=w
 for name,loc,power,size in [('Key',(3,-4,5),550,4),('Fill',(-3,-2,2),220,3),('Rim',(1,3,4),380,3)]:
  o=bpy.data.objects.new(name,bpy.data.lights.new(name,'AREA'));sc.collection.objects.link(o);o.location=loc;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,.85))-o.location).to_track_quat('-Z','Y').to_euler()
 cam=bpy.data.objects.new('Vanguard review camera',bpy.data.cameras.new('Vanguard review camera'));sc.collection.objects.link(cam);cam.data.type='ORTHO';sc.camera=cam
def ensure_uv(o):
 if o.type!='MESH' or o.data.uv_layers:return
 layer=o.data.uv_layers.new(name='CandidatePlanarUV');o.data.update()
 for p in o.data.polygons:
  dominant=max(range(3),key=lambda k:abs(p.normal[k]));axes=[k for k in range(3) if k!=dominant];points=[o.data.vertices[o.data.loops[i].vertex_index].co for i in p.loop_indices]
  low=[min(v[k] for v in points) for k in axes];span=[max(v[k] for v in points)-low[j] for j,k in enumerate(axes)]
  for i,v in zip(p.loop_indices,points):layer.data[i].uv=tuple((v[k]-low[j])/max(span[j],1e-6) for j,k in enumerate(axes))
 o['candidateUV']='Per-face planar UV for newly authored untextured geometry; original mesh UV retained elsewhere.'
def export_glb(objects):
 bpy.ops.object.select_all(action='DESELECT');transforms={ident(o):flat(local(o)) for o in objects}
 for o in objects:o.hide_viewport=False;o.hide_set(False);o.select_set(True)
 path=OUT/'vanguard-battle-v1.glb';bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_animations=False,export_current_frame=True,export_texcoords=True,export_vertex_color='ACTIVE')
 raw=path.read_bytes();length,typ=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+length]);tail=raw[20+length:]
 for n in doc['nodes']:
  ex=n.get('extras',{});key=ex.get('three_node_id',ex.get('vanguard_added_id'))
  if key in transforms:
   for k in ['translation','rotation','scale']:n.pop(k,None)
   n['matrix']=transforms[key]
  if ex.get('candidateHidden') and 'mesh' in n:ex['archivedHiddenMeshIndex']=n.pop('mesh')
 for m in doc.get('materials',[]):
  encoded=m.get('extras',{}).get('three_source')
  if not encoded:continue
  src=json.loads(encoded);color=src.get('color',[1,1,1]);p=m.setdefault('pbrMetallicRoughness',{});p['baseColorFactor']=[*color,src.get('opacity',1)];p['metallicFactor']=src.get('metalness',0);p['roughnessFactor']=src.get('roughness',.85);m['emissiveFactor']=color if src.get('type')=='MeshBasicMaterial' else src.get('emissive',[0,0,0]);m['extras']['originalColorFactorRestored']=True
 js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(js)+len(tail))+struct.pack('<II',len(js),typ)+js+tail)
def render(name,focus=None,direction=(3,-4,2.2)):
 if '--no-render' in sys.argv:return
 sc=bpy.context.scene;bpy.context.view_layer.update();obs=[o for o in sc.objects if ident(o) and o.type=='MESH' and not o.hide_render and (not focus or ident(o) in focus)]
 ps=[o.matrix_world@v.co for o in obs for v in o.data.vertices];lo=Vector(tuple(min(p[k] for p in ps) for k in range(3)));hi=Vector(tuple(max(p[k] for p in ps) for k in range(3)));center=(lo+hi)/2;cam=sc.camera;cam.location=center+Vector(direction).normalized()*8;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update();inv=cam.matrix_world.inverted();points=[inv@p for p in ps];xs=[p.x for p in points];ys=[p.y for p in points];cam.location+=cam.rotation_euler.to_matrix()@Vector(((max(xs)+min(xs))/2,(max(ys)+min(ys))/2,0));cam.data.ortho_scale=max(max(ys)-min(ys),(max(xs)-min(xs))*sc.render.resolution_y/sc.render.resolution_x)*1.17;sc.render.filepath=str(ART/name);bpy.ops.render.render(write_still=True)

def run():
 OUT.mkdir(parents=True,exist_ok=True);ART.mkdir(parents=True,exist_ok=True);sourcehash=sha(SOURCE);source=json.loads(SNAP.read_text());bpy.ops.wm.open_mainfile(filepath=str(SOURCE));sc=bpy.context.scene;nodes={o['three_node_id']:o for o in sc.objects if 'three_node_id' in o};parents={k:ident(o.parent) if o.parent else None for k,o in nodes.items()}
 studio(sc);render('before-three-quarter.png');setup(nodes);poses=[]
 phases=[('idle',1),('aim',31),('windup',46),('slash',61),('idle',76),('stagger',101),('rope',131),('idle',161)]
 for frame in range(1,162):
  a,b=next(((a,b) for a,b in zip(phases,phases[1:]) if a[1]<=frame<=b[1]),(phases[-1],phases[-1]));t=(frame-a[1])/max(1,b[1]-a[1]);t=t*t*(3-2*t);p=pose(nodes,a[0],(b[0],t));p['frame']=frame;poses.append(p)
 pose(nodes,'idle');render('idle-three-quarter.png');render('idle-hand-detail.png',['n54','n60','add:blade-guard','n52']);render('idle-cannon-detail.png',['n39','n40','n42','n44','n46','add:cannon-axis','add:cannon-fork--1','add:cannon-fork-1','n28','n34','add:cannon-foot'])
 for o in nodes.values():
  if o.hide_render:o['candidateHidden']=True
 sc.frame_start=1;sc.frame_end=161;sc.render.fps=30
 for p in poses:
  for tag,v in p['transforms'].items():
   o=next(o for o in sc.objects if ident(o)==tag);setm(o,Matrix([[v[c*4+r] for c in range(4)] for r in range(4)]));o.keyframe_insert('location',frame=p['frame']);o.keyframe_insert('rotation_euler',frame=p['frame']);o.keyframe_insert('scale',frame=p['frame'])
 for name,frame in phases:sc.timeline_markers.new(name,frame=frame)
 for o in sc.objects:
  if not ident(o) or not o.animation_data:continue
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for curve in bag.fcurves:
      for key in curve.keyframe_points:key.interpolation='LINEAR'
 for name,frame in phases:
  if name in ['aim','slash','stagger','rope']:sc.frame_set(frame);render(name+'-three-quarter.png')
 sc.frame_set(1);render('idle-three-quarter.png')
 for o in sc.objects:
  if ident(o):ensure_uv(o)
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'vanguard-battle-v1.blend'));export_glb([o for o in sc.objects if ident(o)])
 assert sha(SOURCE)==sourcehash;assert len(nodes)==84;assert all((ident(o.parent) if o.parent else None)==parents[k] for k,o in nodes.items())
 assembly={'stage':'first visual candidate','source':{'blend':str(SOURCE.relative_to(ROOT)),'snapshot':str(SNAP.relative_to(ROOT)),'sha256':sourcehash},'reference':{'path':'assets/concepts/vanguard-trooper-target-v1.png','sha256':sha(ROOT/'assets/concepts/vanguard-trooper-target-v1.png')},'axes':'Three +Z forward,+Y up; C=RotX(+90deg) to Blender','sourceOriginalNodeCount':84,'originalParentsPreserved':True,'factoryParts':source['nodes'][0]['userData']['parts'],'poseFrames':poses,'addedNodes':[{'id':ident(o),'parentId':ident(o.parent),'name':o.name} for o in sc.objects if o.get('vanguard_added_id')],'squadLayoutBaked':False,'runtimeIntegrated':False,'limitations':['Authored review candidate; runtime battle integration and whole-body contact validation remain separate.','Original node parents preserved; new pose transforms deliberately replace rigid original limb animation.','World supplies rope at rope-grip anchor; cannon remains supported while left hand releases its grip.']}
 assembly.update(stage='motion review candidate',fps=30,frameCount=161,keyPhases=[{'name':n,'frame':f} for n,f in phases],glbPose='idle static frame1; no animation clips',uvContract='Source UV loop layers survive armor bevel; new glove and added untextured meshes have explicit per-face planar UV.',materialContract='Original source material colors restored explicitly in glTF; red thigh stripes n67/n77 retain original red material, distinct from blade emission.')
 assembly['anchors']={'swordGrip':{'node':'n59','point':[0,0,0]},'gunGrip':{'node':'n39','point':[0,-.11,-.12]},'cannonMuzzle':{'node':'n39','point':[0,0,.47]},'handR':{'node':'n54','point':[0,0,0]},'handL':{'node':'n34','point':[0,0,0]},'ropeGrip':{'node':'add:rope-grip','point':[0,0,0]}}
 assembly['files']={p.name:{'path':str(p.relative_to(ROOT)),'sha256':sha(p)} for p in [OUT/'vanguard-battle-v1.blend',OUT/'vanguard-battle-v1.glb']}
 (OUT/'vanguard-battle-v1.assembly.json').write_text(json.dumps(assembly,indent=2));print('VANGUARD_FIRST_CANDIDATE_READY',flush=True)

if __name__=='__main__':run()
