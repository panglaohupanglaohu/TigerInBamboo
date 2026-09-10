"""Original warship and 26 independent rowers; background Blender candidate."""
import bpy,json,math,sys,importlib.util
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/models/optimized/warship-battle-v1';ART=ROOT/'artifacts/pipeline/warship-battle-v1';SOURCE=ROOT/'assets/models/originals/blender-r3/fisherBoat.blend';SNAP=ROOT/'assets/models/originals/fisherBoat.source.json'
spec=importlib.util.spec_from_file_location('gate_helpers',ROOT/'tools/pipeline/build_gatepod_escort_blender.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g);v=g.v;C=g.C;CI=g.CI;setm=g.setm;local=g.local;flat=g.flat;sha=g.sha

def ident(o):
 if o is None:return None
 if 'three_node_id' in o:return o['three_node_id']
 if 'three_instance_owner' in o:return str(o['three_instance_owner'])+':i'+str(o['three_instance_index'])
 return o.get('warship_added_id')
g.ident=ident;v.ident=ident;g.ART=ART

def tag(o):
 for prop in ['vanguard_added_id','gatepod_added_id']:
  if prop in o:o['warship_added_id']=o[prop];del o[prop]
 return o
def box(*a,**kw):return tag(v.box(*a,**kw))
def cyl(*a,**kw):return tag(v.cylinder(*a,**kw))
def mesh(*a,**kw):return tag(v.mesh(*a,**kw))
def empty(name,key,parent,point):
 o=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(o);o.parent=parent;o['warship_added_id']=key;setm(o,Matrix.Translation(Vector(point)));return o
def rootmat(o,root):return v.chain_matrix(o,root)
def setroot(o,m,root):setm(o,rootmat(o.parent,root).inverted()@m if o.parent!=root else m)
def mat(vals):return Matrix([[vals[c*4+r] for c in range(4)] for r in range(4)])
def ring(name,parent,material,key,inner=.03,outer=.045,length=.07):
 vs=[(r*math.cos(i*math.tau/10),y,r*math.sin(i*math.tau/10)) for y,r in [(-length/2,outer),(length/2,outer),(length/2,inner),(-length/2,inner)] for i in range(10)];fs=[(a*10+i,a*10+(i+1)%10,b*10+(i+1)%10,b*10+i) for a,b in [(0,1),(1,2),(2,3),(3,0)] for i in range(10)];return mesh(name,vs,fs,parent,material,key)
def hand(parent,material,key):
 vs=[];fs=[]
 for j in range(4):
  y=(j-1.5)*.0105
  for k in range(10):
   a=k*math.tau/10;b=(k+1)*math.tau/10;start=len(vs);vs.extend((r*math.cos(t),y+d,r*math.sin(t)) for r in [.026,.036] for t in [a,b] for d in [-.0045,.0045]);fs.extend(tuple(start+i for i in face) for face in [(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3)])
 bv,bf=v.box_geometry((.017,.025,.026));start=len(vs);vs.extend((x-.029,y+.023,z+.018) for x,y,z in bv);fs.extend(tuple(start+i for i in f) for f in bf)
 return mesh('Rower gripping fingers '+key,vs,fs,parent,material,key)

def fit(obs,source,poses):
 root=obs['n0'];wood=obs['n231'].data.materials[0];dark=obs['n233'].data.materials[0];bronze=obs['n51'].data.materials[0];skin=obs['n227:i0'].data.materials[0]
 for o in obs.values():
  if o.type=='MESH' and len(o.data.materials)==1:
   for poly in o.data.polygons:poly.material_index=0
  if o.hide_render:o['candidateHidden']=True
 # Preserve the main hull silhouette, bow eyes, ram, sail and all source colors.
 for key in ['n231','n233','n253','n273','n275','n277','n279','n281','n283']:v.bevel(obs[key],.006)
 for j,key in enumerate(['n273','n275','n277','n279']):
  o=obs[key];center=local(o).translation;side=-1 if j%2==0 else 1;center.x=-2.09+(j//2)*.37;center.z=side*.145;center.y=1.108+max(abs((CI.to_3x3()@vv.co).y) for vv in o.data.vertices);setm(o,Matrix.Translation(center))
 # Original rails/posts move to the existing hull edge, away from rowers.
 for side,start in [(-1,233),(1,253)]:
  m=local(obs['n'+str(start)]);m.translation.z=side*.49;setm(obs['n'+str(start)],m)
  for j in range(9):
   o=obs['n'+str(start+2+j*2)];m=local(o);m.translation.z=side*.49;m.translation.x=-1.7+(round(j*12/8)+.5)*.27;setm(o,m)
 # A real bow-side gate: terminate the retained positive-side rail before the board.
 rail=obs['n253'];rail.data=rail.data.copy()
 for vertex in rail.data.vertices:
  p=CI.to_3x3()@vertex.co;p.x=min(p.x,1.70-local(rail).translation.x);vertex.co=C.to_3x3()@p
 # Narrow separated planks retain the old deck as their structural underside.
 for j in range(26):box('Deck plank '+str(j),(.145,.012,.82),(-1.80+j*.147,.657,0),root,wood,'add:deck-plank-'+str(j),.002)
 # Bow transfer landing stays behind the existing ram and forward of last oar.
 box('Bow transfer deck',(.49,.045,.91),(1.94,.642,0),root,wood,'add:bow-landing',.009)
 for i,oar in enumerate(poses['oars']):
  side=oar['side'];x=-1.7+oar['index']*.27;rig=obs[oar['id']]
  box('Oarlock shoe '+str(i),(.12,.025,.12),(x,.661,side*.49),root,dark,'add:oarlock-shoe-'+str(i),.005)
  for dx in [-.043,.043]:
   o=cyl('Oarlock bearing '+str(i),.014,.10,root,bronze,'add:oarlock-pin-'+str(i)+'-'+str(dx));setm(o,Matrix.Translation((x+dx,.699,side*.50)))
  ring('Oar pivot collar '+str(i),rig,bronze,'add:oar-collar-'+str(i),.032,.043,.065)
  inner=cyl('Inner oar handle '+str(i),.025,.285,rig,dark,'add:oar-handle-'+str(i));setm(inner,Matrix.Translation((0,-.1425,0)))
  box('Rower bench '+str(i),(.07,.035,.12),(x-.19,.732,side*.36),root,wood,'add:bench-'+str(i),.004)
  vv,ff=v.box_geometry((.07,.035,.20));vv=[(a,b,c-side*.10) for a,b,c in vv];leaf=mesh('Folding inner rowing seat '+str(i),vv,ff,root,wood,'add:seat-leaf-'+str(i));setm(leaf,Matrix.Translation((x-.19,.732,side*.30)))
  for limb in ['L','R']:
   parent=obs['n227' if limb=='L' else 'n228'];cyl('Rower forearm '+str(i)+limb,.019,.11,parent,skin,'add:forearm-'+str(i)+limb);hand(parent,skin,'add:hand-'+str(i)+limb)
  attach=obs['n'+str(193+i)];m=local(attach);m.translation.z=side*.16;m.translation.x-=.10;setm(attach,m)
 pivot=empty('Retractable bow-side boarding board','add:boarding-hinge',root,(1.94,.664,.48));length=1.35
 for j in range(9):box('Boarding plank '+str(j),(.40,.038,.146),(0,0,(j+.5)*.15),pivot,wood,'add:boarding-plank-'+str(j),.004)
 for x in [-.17,.17]:
  box('Board side beam',(.035,.065,length),(x,-.028,length/2),pivot,dark,'add:boarding-beam-'+str(x),.006)
  for z in [.10,1.23]:
   box('Board rail post',(.028,.24,.028),(x,.12,z),pivot,dark,'add:boarding-post-'+str(x)+'-'+str(z),.004)
  rail=cyl('Board hand rope',.012,1.13,pivot,dark,'add:boarding-rope-'+str(x));v.orient_y(rail,(x,.24,.665),(0,0,1))
 for label,p in [('deck',[0,.024,0]),('foot',[0,.024,length]),('left-lash',[-.20,.03,.04]),('right-lash',[.20,.03,.04])]:empty('Board '+label,'add:boarding-'+label,pivot,p)
 return pivot

def pose(obs,sourcePose,pivot,angle=-math.pi/2,boarding=0):
 root=obs['n0']
 for key,values in sourcePose['transforms'].items():
  m=mat(values)
  if ':i' in key:
   idx=int(key.split(':i')[1]);side=-1 if idx<13 else 1;m.translation.z+=side*(-.12+.19*min(1,boarding*2));m.translation.x-=.10
  else:m.translation.y+=.20
  setm(obs[key],m)
 # Keep complete seated bodies together; lift only enough to prevent either
 # original animated lower leg entering the actual planked deck.
 for i in range(26):
  low=min((rootmat(obs['n'+str(n)+':i'+str(i)],root)@(CI.to_3x3()@vertex.co)).y for n in [229,230] for vertex in obs['n'+str(n)+':i'+str(i)].data.vertices)
  lift=max(0,.665-low)
  for n in range(220,231):
   o=obs['n'+str(n)+':i'+str(i)];m=local(o);m.translation.y+=lift;setm(o,m)
  leaf=obs.get('add:seat-leaf-'+str(i))
  if leaf is not None:
   side=-1 if i<13 else 1;x=-1.7+(i%13)*.27;setm(leaf,Matrix.Translation((x-.19,.732,side*.30))@Matrix.Rotation(side*math.pi/2*max(0,boarding*2-1),4,'X'))
  attach=obs['n'+str(193+i)];m=local(attach);m.translation=rootmat(obs['n220:i'+str(i)],root).translation;setm(attach,m)
 grips=[]
 for i in range(26):
  side=-1 if i<13 else 1;oar=obs['n'+str(63+i*5)];om=rootmat(oar,root);body=rootmat(obs['n220:i'+str(i)],root)
  for limb,along,sx in [('L',-.15,-.042),('R',-.23,.042)]:
   target=om@Vector((0,along,0));shoulder=body@Vector((sx,.135,0));dest=target-shoulder;direction=dest.normalized();L=max(.105,dest.length*.515);half=dest.length/2;h=math.sqrt(max(0,L*L-half*half));pole=Vector((sx*3,-.20,side*.6));pole=(pole-direction*pole.dot(direction)).normalized();elbow=shoulder+direction*half+pole*h
   upper=obs[('n227' if limb=='L' else 'n228')+':i'+str(i)];axis=elbow-shoulder;q=Vector((0,-1,0)).rotation_difference(axis.normalized());setroot(upper,Matrix.Translation(shoulder)@q.to_matrix().to_4x4()@Matrix.Diagonal((1,axis.length/.15,1,1)),root)
   fore=obs['add:forearm-'+str(i)+limb];axis=target-elbow;q=Vector((0,1,0)).rotation_difference(axis.normalized());setroot(fore,Matrix.Translation((elbow+target)/2)@q.to_matrix().to_4x4()@Matrix.Diagonal((1,axis.length/.11,1,1)),root)
   hm=om.copy();hm.translation=target;setroot(obs['add:hand-'+str(i)+limb],hm,root);grips.append({'rower':i,'limb':limb,'oar':ident(oar),'point':[0,along,0],'hand':'add:hand-'+str(i)+limb,'target':list(target),'shoulder':list(shoulder),'elbow':list(elbow)})
 setm(pivot,Matrix.Translation((1.94,.664,.48))@Matrix.Rotation(angle,4,'X'))
 return grips


def bake(obs,sourcePoses,pivot):
 sc=bpy.context.scene;cloth=[obs['n'+str(i)] for i in range(291,323,2)];clothBase={ident(o):local(o).copy() for o in cloth};foreBase=local(obs['n325']).copy();dynamic={ 'n'+str(i) for i in range(193,219)}|{'n325'}|set(sourcePoses['frames'][0]['transforms'])|{k for k in obs if k.startswith('add:forearm-') or k.startswith('add:hand-') or k.startswith('add:seat-leaf-')}|{ident(pivot)}|set(clothBase);frames=[]
 for f in range(1,302):
  source=sourcePoses['frames'][min(f-1,180)]
  if f<=181:deploy=0
  elif f<=211:deploy=(f-181)/30
  elif f<=271:deploy=1
  else:deploy=1-(f-271)/30
  deploy=max(0,min(1,deploy));ease=deploy*deploy*(3-2*deploy);angle=-math.pi/2+(.12+math.pi/2)*ease
  pose(obs,source,pivot,angle,ease)
  fold=Matrix.Translation((0,3.125,0))@Matrix.Diagonal((1,1-.78*ease,1,1))@Matrix.Translation((0,-3.125,0))
  for o in cloth:setm(o,fold@clothBase[ident(o)])
  # Running fore-stay moves to the opposite bow cleat only while boarding.
  top=Vector((.55,3.77,0));bottom=Vector((2.18,.64,-.40*ease));d=bottom-top;old=Vector((1.63,-3.13,0));rotation=foreBase.copy();rotation.translation=(0,0,0);q=old.normalized().rotation_difference(d.normalized());setm(obs['n325'],foreBase if ease==0 else Matrix.Translation((top+bottom)/2)@q.to_matrix().to_4x4()@rotation@Matrix.Diagonal((1,d.length/old.length,1,1)))
  record={'frame':f,'sourceFrame':source['frame'],'sourcePhase':source['phase'],'sourceSpeed':source['speed'],'boarding01':ease,'boardingRotationX':angle,'sailHeightFactor':1-.78*ease,'seatedLateralPosition':.16+.19*min(1,ease*2),'seatInnerLeafFold01':max(0,ease*2-1),'foreStayLowerPoint':[2.18,.64,-.40*ease],'transforms':{key:flat(local(obs[key])) for key in sorted(dynamic)}};frames.append(record)
  for key in dynamic:
   o=obs[key];o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_euler',frame=f);o.keyframe_insert('scale',frame=f)
 for o in obs.values():
  if not o.animation_data:continue
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for curve in bag.fcurves:
      for key in curve.keyframe_points:key.interpolation='LINEAR'
 sc.frame_start=1;sc.frame_end=301;sc.render.fps=60
 for label,f in [('idle',1),('rowing',61),('stop-command',121),('stopped',181),('boarding-ready',211),('boarding-hold',241),('retract',272),('stowed',301)]:sc.timeline_markers.new(label,frame=f)
 sc.frame_set(61);g.render('rowing-three-quarter.png',direction=(4,-5,3));sc.frame_set(241);g.render('boarding-furled.png',direction=(4,-5,3));g.render('boarding-deck-top.png',direction=(0,-.01,5));sc.frame_set(1)
 return frames

def export_warship(objects,path):
 # Generic exporter preserves source material factors. Final pass uses our own
 # instance/addition tags and exact local transforms, including source instances.
 for o in objects:
  if o.get('warship_added_id'):o['gatepod_added_id']=o['warship_added_id']
 g.export(objects,path)
 import struct
 raw=path.read_bytes();length,typ=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+length]);tail=raw[20+length:];transforms={ident(o):flat(local(o)) for o in objects}
 for n in doc['nodes']:
  ex=n.get('extras',{});key=ex.get('three_node_id',ex.get('warship_added_id'))
  if 'three_instance_owner' in ex:key=ex['three_instance_owner']+':i'+str(ex['three_instance_index']);ex['three_instance_key']=key
  if key in transforms:
   for k in ['translation','rotation','scale']:n.pop(k,None)
   n['matrix']=transforms[key]
  ex.pop('gatepod_added_id',None)
 for m in doc.get('materials',[]):
  encoded=m.get('extras',{}).get('three_source')
  if encoded:
   source=json.loads(encoded);strength=source.get('emissiveIntensity',1);m['emissiveFactor']=[float(c)*strength for c in source.get('emissive',[0,0,0])]
 js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(js)+len(tail))+struct.pack('<II',len(js),typ)+js+tail)
 for o in objects:
  if 'gatepod_added_id' in o:del o['gatepod_added_id']

def build():
 OUT.mkdir(parents=True,exist_ok=True);ART.mkdir(parents=True,exist_ok=True);source=json.loads(SNAP.read_text());ps=json.loads((ART/'source-poses.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(SOURCE));sc=bpy.context.scene;obs={ident(o):o for o in sc.objects if ident(o)};v.studio(sc);sc.render.resolution_x=1500;sc.render.resolution_y=1100;g.render('before-three-quarter.png',direction=(4,-5,3));pivot=fit(obs,source,ps);obs={ident(o):o for o in sc.objects if ident(o)};grips=pose(obs,ps['frames'][0],pivot);g.render('idle-three-quarter.png',direction=(4,-5,3));g.render('idle-deck-top.png',direction=(0,-.01,5));pose(obs,ps['frames'][0],pivot,.12);g.render('boarding-open.png',direction=(4,-5,3));pose(obs,ps['frames'][0],pivot)
 frames=bake(obs,ps,pivot)
 for o in obs.values():v.ensure_uv(o)
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'warship-battle-v1.blend'))
 export_warship(list(obs.values()),OUT/'warship-battle-v1.glb')
 assembly={'stage':'motion review candidate','source':{'blend':str(SOURCE.relative_to(ROOT)),'snapshot':str(SNAP.relative_to(ROOT)),'sha256':sha(SOURCE)},'sourceNodes':340,'sourceInstances':286,'rowers':26,'oars':26,'landingSoldiersBaked':0,'axes':'Three +X bow,+Y up,Z across ship','grips':grips,'originalSourceUserData':source['nodes'][0]['userData'],'addedNodes':[{'id':ident(o),'parent':ident(o.parent),'name':o.name} for o in obs.values() if o.get('warship_added_id')],'restTransforms':{ident(o):flat(local(o)) for o in obs.values()},'poseFrames':frames,'fps':60,'frameCount':301,'limitations':['Saved source-derived rowing and authored boarding/furled sail; full clearance review pending.','GLB static frame1; original runtime poses require documented pivot/rower offsets and hand solver.'],'boarding':{'hinge':'add:boarding-hinge','foot':'add:boarding-foot','rootPoint':[1.94,.664,.48],'length':1.35,'stowedRotationX':-math.pi/2,'reviewDeployedRotationX':.12,'runtimeGroundMustSetAngle':True,'requiredStopped':True,'gateSide':'+Z','gateWidth':.45,'foreStayNode':'n325','foreStayTop':[.55,3.77,0],'foreStayLowerSailing':[2.18,.64,0],'foreStayLowerBoarding':[2.18,.64,-.40],'rowerSeatZDuringRowing':.16,'rowerSeatZWhileBoarding':.35,'rowerSeatXOffset':-.10,'rowerFootMinimumY':.665}}
 (OUT/'warship-battle-v1.assembly.json').write_text(json.dumps(assembly,separators=(',',':')));print('WARSHIP_FIRST_READY',flush=True)
if __name__=='__main__':build()
