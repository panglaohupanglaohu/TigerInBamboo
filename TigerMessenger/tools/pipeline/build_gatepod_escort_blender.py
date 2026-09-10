"""Source-preserving three-variant escort fittings; background Blender only."""
import bpy,json,math,struct,sys,importlib.util
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/models/optimized/gatepod-escort-v1';ART=ROOT/'artifacts/pipeline/gatepod-escort-v1'
spec=importlib.util.spec_from_file_location('primitives',ROOT/'tools/pipeline/build_vanguard_battle_blender.py');v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
C=v.C;CI=v.CI;setm=v.setm;local=v.local;flat=v.flat;sha=v.sha
VARIANTS=['pod-55-2','pod-41-7','pod-08-9']
def ident(o):return o.get('three_node_id',o.get('gatepod_added_id'))
v.ident=ident;v.ART=ART

def tag(o):
 if 'vanguard_added_id' in o:o['gatepod_added_id']=o['vanguard_added_id'];del o['vanguard_added_id']
 return o
def box(*a,**kw):return tag(v.box(*a,**kw))
def cylinder(*a,**kw):return tag(v.cylinder(*a,**kw))
def rod(*a,**kw):return tag(v.rod(*a,**kw))
def empty(name,key,parent,point):
 o=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(o);o.parent=parent;o['gatepod_added_id']=key;setm(o,Matrix.Translation(Vector(point)));return o

def export(objects,path):
 bpy.ops.object.select_all(action='DESELECT');transforms={ident(o):flat(local(o)) for o in objects}
 for o in objects:o.hide_viewport=False;o.hide_set(False);o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_animations=False,export_current_frame=True,export_texcoords=True,export_vertex_color='ACTIVE')
 raw=path.read_bytes();length,typ=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+length]);tail=raw[20+length:]
 for n in doc['nodes']:
  ex=n.get('extras',{});key=ex.get('three_node_id',ex.get('gatepod_added_id'))
  if key in transforms:
   for k in ['translation','rotation','scale']:n.pop(k,None)
   n['matrix']=transforms[key]
  if ex.get('candidateHidden') and 'mesh' in n:ex['archivedHiddenMeshIndex']=n.pop('mesh')
 for m in doc.get('materials',[]):
  encoded=m.get('extras',{}).get('three_source')
  if not encoded:continue
  src=json.loads(encoded);p=m.setdefault('pbrMetallicRoughness',{});p['baseColorFactor']=[*src.get('color',[1,1,1]),src.get('opacity',1)];p['metallicFactor']=src.get('metalness',0);p['roughnessFactor']=src.get('roughness',.85);m['emissiveFactor']=src.get('emissive',[0,0,0]);m['extras']['originalColorFactorRestored']=True
 js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(js)+len(tail))+struct.pack('<II',len(js),typ)+js+tail)

def fit(nodes,source):
 root=nodes['n0'];byPart={}
 for n in source['nodes']:
  part=n.get('userData',{}).get('podPart')
  if part:byPart.setdefault(part,[]).append(nodes[n['id']])
 hull=byPart['body'][0].data.materials[0];dark=nodes['n17'].data.materials[0];accent=byPart['tail'][0].data.materials[0];black=next(o.data.materials[0] for o in byPart['thruster']);orange=nodes['n'+str(int(ident(byPart['thruster'][0])[1:])+1)].data.materials[0]
 for o in nodes.values():
  if o.type!='MESH':continue
  if len(o.data.materials)==1:
   for poly in o.data.polygons:poly.material_index=0
  if o.hide_render:o['candidateHidden']=True;continue
  # Preserve the faceted sphere nose and all thin decals. Chamfer only the
  # original substantial boxes; their source UV layer is retained.
  dims=o.data.dimensions if hasattr(o.data,'dimensions') else None
  if ident(o) in ['n13','n15','n17','n19'] or o in byPart.get('wing',[]):v.bevel(o,.023 if o in byPart.get('wing',[]) else .045)
 # Exact coaming ring around the existing canopy, no new cabin or pilot.
 coaming=nodes['n28'];coaming['candidateRole']='Original canopy coaming, unchanged dimensions and parent'
 for sx in [-1,1]:
  box('Cockpit base latch',(.10,.055,.16),(sx*.47,1.24,.36),root,dark,'add:canopy-latch-'+str(sx),.015)
 # Pair each original wing with its original pylon and two struts by adjacency.
 sn=source['nodes']
 for wing in byPart['wing']:
  idx=int(ident(wing)[1:]);sx=-1 if local(wing).translation.x<0 else 1
  pylon=nodes['n'+str(idx+4)];v.bevel(pylon,.035)
  for j in [0,1]:
   o=nodes['n'+str(idx+6+j)]
   # Anchor against actual wing matrix, not an independent guessed slope.
   top=local(wing)@Vector((-sx*1.75,-.05,(-.20 if j==0 else .20)))
   foot=Vector((sx*.93,.08,.45+j*.52));d=top-foot
   setm(o,Matrix.Translation((top+foot)/2)@Vector((0,1,0)).rotation_difference(d.normalized()).to_matrix().to_4x4()@Matrix.Diagonal((1,d.length/1.75,1,1)))
   for label,point in [('foot',foot),('wing',top)]:box('Wing strut '+label+' clamp',(.13,.12,.14),point,root,dark,'add:wing-clamp-'+str(sx)+'-'+str(j)+'-'+label,.018)
 # Two winches forward of the retained six thrusters, beneath real belly.
 anchors=[];drums=[]
 for seat,(side,x) in enumerate([('left',-.50),('right',.50)]):
  base=empty(side+' winch carriage','add:winch-'+side,root,(x,-1.27,-.15))
  box(side+' mounting shoe',(.40,.075,.46),(0,0,0),base,dark,'add:winch-shoe-'+side,.035)
  for xx in [-.145,.145]:box(side+' cheek bearing',(.045,.28,.27),(xx,-.16,0),base,black,'add:winch-bearing-'+side+str(xx),.022)
  drum=cylinder(side+' orange spool',.115,.255,base,orange,'add:winch-drum-'+side);v.orient_y(drum,(0,-.15,0),(1,0,0));drums.append(drum)
  for xx in [-.12,.12]:
   cap=cylinder(side+' spool flange',.145,.025,base,dark,'add:winch-flange-'+side+str(xx));v.orient_y(cap,(xx,-.15,0),(1,0,0))
  # Rope guide is a true hollow ring, not a closed orange cylinder.
  vs=[(r*math.cos(i*math.tau/12),y,r*math.sin(i*math.tau/12)) for y,r in [(-.28,.075),(-.39,.075),(-.39,.038),(-.28,.038)] for i in range(12)]
  fs=[(a*12+i,a*12+(i+1)%12,b*12+(i+1)%12,b*12+i) for a,b in [(0,1),(1,2),(2,3)] for i in range(12)]
  tag(v.mesh(side+' hollow rope guide',vs,fs,base,orange,'add:rope-guide-'+side))
  anchor=empty(side+' external rope origin','add:rope-anchor-'+side,base,(0,-.39,0));anchors.append({'seat':seat,'side':side,'node':ident(anchor),'parent':ident(base),'point':[0,0,0],'actorLocalPoint':[x,-1.66,-.15],'externalRope':True})
  # Unexported studio rope/hook: gives deployment review without baking a
  # second rope into the runtime actor. Explicit name, no asset node tag.
  rope=cylinder('REVIEW ONLY '+side+' rope',.018,1,anchor,black,'review:rope-'+side);del rope['gatepod_added_id'];rope['reviewOnly']=True
  outline=[(0,0),(-.075,-.08),(-.11,-.25),(.11,-.25),(.075,-.08)];inner=[(0,-.05),(-.048,-.10),(-.065,-.215),(.065,-.215),(.048,-.10)]
  hv=[(x,y,z) for z in [-.022,.022] for poly in [outline,inner] for x,y in poly];hf=[]
  for i in range(5):
   j=(i+1)%5;hf.extend([(i,j,j+5,i+5),(i+10,i+15,j+15,j+10),(i,i+10,j+10,j),(i+5,j+5,j+15,i+15)])
  hook=tag(v.mesh('REVIEW ONLY '+side+' hook',hv,hf,anchor,dark,'review:hook-'+side));del hook['gatepod_added_id'];hook['reviewOnly']=True
  rope['reviewSide']=side;hook['reviewSide']=side
 return anchors,drums

def render(name,direction=(3,-4,2.2),focus=None):
 if '--no-render' in sys.argv:return
 sc=bpy.context.scene;bpy.context.view_layer.update();obs=[o for o in sc.objects if (ident(o) or o.get('reviewOnly')) and o.type=='MESH' and not o.hide_render and (not focus or ident(o) in focus)]
 ps=[o.matrix_world@vv.co for o in obs for vv in o.data.vertices];center=sum(ps,Vector())/len(ps);cam=sc.camera;cam.location=center+Vector(direction).normalized()*12;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update();inv=cam.matrix_world.inverted();points=[inv@p for p in ps];xs=[p.x for p in points];ys=[p.y for p in points];cam.location+=cam.rotation_euler.to_matrix()@Vector(((max(xs)+min(xs))/2,(max(ys)+min(ys))/2,0));aspect=sc.render.resolution_x/sc.render.resolution_y
 cam.data.ortho_scale=(max(max(xs)-min(xs),(max(ys)-min(ys))*aspect) if aspect>=1 else max(max(ys)-min(ys),(max(xs)-min(xs))/aspect))*1.16
 sc.render.filepath=str(ART/name);bpy.ops.render.render(write_still=True)

def build(variant):
 sourcepath=ROOT/('assets/models/originals/supplemental/blender-r3/gatePodEscort_'+variant+'.blend');snap=ROOT/('assets/models/originals/supplemental/gatePodEscort_'+variant+'.source.json');source=json.loads(snap.read_text());sourcehash=sha(sourcepath)
 bpy.ops.wm.open_mainfile(filepath=str(sourcepath));sc=bpy.context.scene;nodes={o['three_node_id']:o for o in sc.objects if 'three_node_id' in o};parents={k:ident(o.parent) if o.parent else None for k,o in nodes.items()};v.studio(sc);sc.render.resolution_x=1400;sc.render.resolution_y=1000
 render(variant+'-before.png');anchors,drums=fit(nodes,source);objects=[o for o in sc.objects if ident(o)];poses=[];reviews=[o for o in sc.objects if o.get('reviewOnly')]
 for frame in range(1,122):
  t=(frame-1)/120;deploy=math.sin(math.pi*t)**2;length=.16+2.65*deploy
  for drum in drums:
   m=local(drum);m=Matrix.Translation(m.translation)@Matrix.Rotation(deploy*math.tau*3,4,'X')@Vector((0,1,0)).rotation_difference(Vector((1,0,0))).to_matrix().to_4x4();setm(drum,m)
  for o in reviews:
   if 'rope' in o.name.lower():setm(o,Matrix.Translation((0,-length/2,0))@Matrix.Diagonal((1,length,1,1)))
   else:setm(o,Matrix.Translation((0,-length,0)))
   o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_euler',frame=frame);o.keyframe_insert('scale',frame=frame)
  p={'frame':frame,'ropeLength':length,'deployment01':deploy,'transforms':{ident(o):flat(local(o)) for o in objects}};poses.append(p)
  for o in objects:
   o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_euler',frame=frame);o.keyframe_insert('scale',frame=frame)
 for o in sc.objects:
  if not o.animation_data:continue
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for curve in bag.fcurves:
      for k in curve.keyframe_points:k.interpolation='LINEAR'
 sc.frame_start=1;sc.frame_end=121;sc.render.fps=30
 for name,frame in [('stowed',1),('deploying',31),('lowered',61),('recovering',91),('stowed',121)]:sc.timeline_markers.new(name,frame=frame)
 for o in objects:v.ensure_uv(o)
 sc.frame_set(1);render(variant+'-three-quarter.png');render(variant+'-belly.png',direction=(3,-4,-2.5));sc.frame_set(61);render(variant+'-deployed.png',direction=(3,-4,-1.7));sc.frame_set(1)
 blend=OUT/(variant+'.blend');glb=OUT/(variant+'.glb');bpy.ops.wm.save_as_mainfile(filepath=str(blend));export(objects,glb)
 assert sha(sourcepath)==sourcehash and all((ident(o.parent) if o.parent else None)==parents[k] for k,o in nodes.items())
 a={'asset':'gatepod-escort-v1','variant':variant,'source':{'blend':str(sourcepath.relative_to(ROOT)),'snapshot':str(snap.relative_to(ROOT)),'sha256':sourcehash},'reference':{'path':'assets/concepts/gatepod-escort-target-v1.png','sha256':sha(ROOT/'assets/concepts/gatepod-escort-target-v1.png')},'originalNodeCount':len(nodes),'sourceRootMatrix':source['nodes'][0]['matrix'],'originalParentsPreserved':True,'sourceUserData':source['nodes'][0]['userData'],'axes':'Three/glTF +Z nose,+Y up; signed anchor X is explicit','ropeAnchors':anchors,'addedNodes':[{'id':ident(o),'parent':ident(o.parent),'name':o.name} for o in objects if o.get('gatepod_added_id')],'poseFrames':poses,'fps':30,'frameCount':121,'GLB':'static stowed frame1; no clips; no review ropes/hooks','limitations':['Deployment is authored Blender review; runtime retains actual external ropes and flight/assault behavior.','No troops, global formations or spherical placements baked.'],'files':{p.name:{'sha256':sha(p),'path':str(p.relative_to(ROOT))} for p in [blend,glb]}}
 (OUT/(variant+'.assembly.json')).write_text(json.dumps(a,indent=2));print('GATEPOD_READY '+variant,flush=True)

if __name__=='__main__':
 OUT.mkdir(parents=True,exist_ok=True);ART.mkdir(parents=True,exist_ok=True)
 choice=sys.argv[sys.argv.index('--variant')+1] if '--variant' in sys.argv else None
 for variant in [choice] if choice else VARIANTS:build(variant)
