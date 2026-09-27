"""Gate meeting heroes. Run in foreground Blender; only TM_Gate_Heroes is rebuilt.
No open_mainfile / factory reset / save-mainfile: other scenes remain untouched.
"""
import bpy, bmesh, json, math, hashlib
from pathlib import Path
from mathutils import Matrix, Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/models/optimized/gate-heroes'
C=Matrix.Rotation(math.pi/2,4,'X'); CI=C.inverted()
SOURCE=ROOT/'assets/models/optimized/roman-family-v1/romanSoldier_gladius_blue.blend'
SCENE='TM_Gate_Heroes'

def mat(name,rgb,metal=0):
 m=bpy.data.materials.new('GateHero_'+name);m.diffuse_color=(*rgb,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.72
 return m

def node(name,parent=None,pos=(0,0,0)):
 o=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(o);o.parent=parent;o.matrix_basis=C@Matrix.Translation(pos)@CI;return o

def mesh(name,vs,fs,material,parent):
 d=bpy.data.meshes.new(name);d.from_pydata([C.to_3x3()@Vector(v) for v in vs],[],fs);d.materials.append(material);d.update()
 o=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(o);o.parent=parent;return o

def form(name,rings,material,parent,n=12):
 # Elliptical, alternating pleats produce dimensional fabric/armour surfaces.
 vs=[(x+rx*math.cos(i*math.tau/n),y,z+rz*math.sin(i*math.tau/n)) for x,y,z,rx,rz in rings for i in range(n)]
 fs=[tuple(range(n-1,-1,-1)),tuple(range((len(rings)-1)*n,len(rings)*n))]
 fs += [(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rings)-1) for i in range(n)]
 return mesh(name,vs,fs,material,parent)

def limb(name,a,b,r1,r2,material,parent):
 d=Vector(b)-Vector(a);q=Vector((0,1,0)).rotation_difference(d.normalized())
 o=form(name,[(0,0,0,r1,r1),(0,d.length,0,r2,r2)],material,parent,10)
 o.matrix_basis=C@(Matrix.Translation(a)@q.to_matrix().to_4x4())@CI;return o

def block(name,c,s,material,parent):
 vs=[tuple(c[k]+s[k]*v[k]/2 for k in range(3)) for v in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
 return mesh(name,vs,[(0,2,6,4),(1,5,7,3),(0,4,5,1),(2,3,7,6),(0,1,3,2),(4,6,7,5)],material,parent)

def source_fit(src,name,center,size,material,parent):
 # Source soldier faces +X; hero faces -Z. Reuse solid mesh, no outlines.
 ps=[CI.to_3x3()@v.co for v in src.data.vertices]
 ps=[Vector((p.z,p.y,-p.x)) for p in ps]
 lo=Vector([min(p[i] for p in ps) for i in range(3)]);hi=Vector([max(p[i] for p in ps) for i in range(3)])
 vs=[tuple(center[i]+(p[i]-(lo[i]+hi[i])/2)*size[i]/max(hi[i]-lo[i],1e-6) for i in range(3)) for p in ps]
 o=mesh(name,vs,[tuple(p.vertices) for p in src.data.polygons],material,parent);o['sourceNode']=src.get('three_node_id','unknown');return o

def build_actor(role,sources,palette):
 P=palette;root=node(role);root['identity']=role;root['front']='-Z';root['feetY']=0
 is_o=role=='odysseus';head_y=1.48 if is_o else 1.46
 for side,x in [('L',-.10),('R',.10)]:
  leg=node(role+'_leg'+side,root,(x,.72,0))
  limb(role+'_calf'+side,(0,-.60,0),(0,0,0),.057,.075,P['skin'] if not is_o else P['clothDark'],leg)
  block(role+'_sandal'+side,(0,-.67,-.037),(.13,.10,.24),P['leather'],leg)
  for yy in [-.59,-.50]:limb(role+'_sandal_strap'+side+str(yy),(-.059,yy,0),(.059,yy,0),.016,.016,P['leather'],leg)
 body=node(role+'_body',root)
 form(role+'_torso',[(0,.79,0,.14,.085),(0,1.08,0,.19,.10),(0,1.27,0,.21,.11),(0,1.33,0,.10,.075)],P['cloth'] if is_o else P['bronze'],body)
 form(role+'_neck',[(0,1.28,0,.056,.055),(0,1.41,0,.06,.057)],P['skin'],body)
 head=node(role+'_head',root)
 form(role+'_face',[(0,head_y-.125,-.025,.046,.054),(0,head_y-.085,-.012,.078,.076),(0,head_y+.025,-.012,.089,.09),(0,head_y+.105,.0,.077,.077),(0,head_y+.125,.005,.055,.059)],P['skin'],head,10)
 # Nose and brow make a readable human face under dark hair/helmet.
 form(role+'_nose',[(0,head_y-.035,-.112,.023,.025),(0,head_y+.015,-.12,.016,.028)],P['skin'],head,6)
 for x in [-.042,.042]:block(role+'_eye'+str(x),(x,head_y+.022,-.112),(.019,.01,.008),P['hair'],head)
 if is_o:
  form('odysseus_long_pleated_robe',[(0,.15,0,.215,.125),(0,.35,0,.205,.125),(0,.70,0,.155,.095),(0,.88,0,.14,.087)],P['cloth'],body,18)
  for i in range(9):
   a=i*math.tau/9
   limb('odysseus_robe_fold'+str(i),(.213*math.cos(a),.16,.128*math.sin(a)),(.15*math.cos(a),.83,.095*math.sin(a)),.013,.008,P['clothDark'],body)
  # Draped shoulder mantle has full thickness and asymmetric silhouette.
  form('odysseus_mantle',[(0,.67,.085,.22,.085),(-.025,1.06,.06,.245,.115),(-.025,1.30,.035,.245,.12)],P['clothDark'],body)
  form('odysseus_hair',[(0,1.565,.018,.103,.09),(0,1.625,.018,.098,.085),(0,1.66,.024,.045,.045)],P['hair'],head)
  form('odysseus_back_hair',[(0,1.37,.073,.078,.038),(0,1.57,.068,.103,.05)],P['hair'],head)
  for x in [-.09,.09]:form('odysseus_side_hair'+str(x),[(x,1.40,.026,.021,.027),(x,1.58,.025,.03,.066)],P['hair'],head,6)
  form('odysseus_beard',[(0,1.30,-.081,.025,.025),(0,1.39,-.095,.078,.044),(0,1.46,-.086,.083,.04)],P['hair'],head,10)
 else:
  source_fit(sources['n9'],'achilles_bronze_helmet',(0,1.52,.012),(.245,.275,.25),P['bronze'],head)
  # Solid sagittal horsehair crest, no feather billboard.
  form('achilles_red_crest',[(0,1.59,0,.031,.13),(0,1.71,.02,.038,.125),(0,1.75,.02,.026,.085)],P['red'],head,10)
  for s in [-1,1]:
   form('achilles_pauldron'+str(s),[(s*.21,1.17,0,.075,.10),(s*.215,1.28,0,.09,.11),(s*.21,1.32,0,.04,.065)],P['gold'],body)
   form('achilles_chest_plate'+str(s),[(s*.092,1.03,-.067,.075,.035),(s*.092,1.17,-.08,.085,.055),(s*.092,1.25,-.075,.063,.043)],P['gold'],body)
  for i in range(10):
   a=i*math.tau/10;x=.153*math.cos(a);z=.10*math.sin(a)
   form('achilles_leather_pteruges'+str(i),[(x*1.22,.58,z*1.22,.036,.023),(x,.88,z,.034,.025)],P['red'] if i%2 else P['leather'],body,6)
  for x in [-.10,.10]:form('achilles_greave'+str(x),[(x,.13,-.025,.064,.060),(x,.48,-.025,.062,.072),(x,.56,-.025,.048,.05)],P['bronze'],body)
 form(role+'_belt',[(0,.84,0,.151,.10),(0,.885,0,.151,.10)],P['leather'],body)
 block(role+'_buckle',(0,.864,-.104),(.065,.047,.018),P['gold'],body)
 for side,sign in [('L',-1),('R',1)]:
  shoulder=(sign*.22,1.24,0);arm=node(role+'_arm'+side,root,shoulder)
  elbow=(sign*.055,-.25,-.07 if is_o else .005);hand=(sign*.03,-.30,-.29) if is_o else (sign*.035,-.50,-.02)
  limb(role+'_upper_arm'+side,(0,0,0),elbow,.062,.044,P['cloth'] if is_o else P['skin'],arm)
  limb(role+'_forearm'+side,elbow,hand,.044,.034,P['skin'],arm)
  form(role+'_hand'+side,[(hand[0],hand[1]-.037,hand[2],.040,.033),(hand[0],hand[1]+.035,hand[2],.037,.032)],P['skin'],arm,8)
  if is_o and side=='R':
   letter=node('odysseus_letter',arm,hand);block('odysseus_letter_paper',(-.14,.035,-.03),(.32,.21,.009),P['paper'],letter)
   for j in range(4):block('odysseus_letter_ink'+str(j),(-.14,.08-j*.032,-.036),(.23,.008,.002),P['ink'],letter)
  if not is_o and side=='L':
   shield=node('achilles_shield',arm,(sign*.05,-.35,-.09))
   # Rings in XY with forward-convex center, built along Y then rotated.
   sh=form('achilles_round_shield',[(0,-.045,0,.30,.30),(0,.02,0,.315,.315),(0,.06,0,.265,.265),(0,.085,0,.08,.08)],P['bronze'],shield,24)
   sh.matrix_basis=C@Matrix.Rotation(-math.pi/2,4,'X')@CI
   boss=form('achilles_shield_boss',[(0,0,0,.078,.078),(0,.065,0,.025,.025)],P['gold'],shield,12);boss.matrix_basis=C@(Matrix.Translation((0,0,-.087))@Matrix.Rotation(-math.pi/2,4,'X'))@CI
 # Recenter the head at its neck so acknowledgement nods never orbit the feet.
 neck=Vector((0,1.36,0));head.matrix_basis=C@Matrix.Translation(neck)@CI
 for child in head.children:
  if child.type=='MESH':
   for vertex in child.data.vertices:vertex.co-=C.to_3x3()@neck
 return root

def export_actor(root):
 obs=[root,*root.children_recursive];bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=root;bpy.context.view_layer.update()
 path=OUT/(root.name+'.glb');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_animations=False,export_extras=True)
 (ROOT/'godot/assets/art-pilots').mkdir(parents=True,exist_ok=True)
 (ROOT/'godot/assets/art-pilots'/('gate-'+root.name+'.glb')).write_bytes(path.read_bytes())
 nodes=[];bounds=[];tris=0
 for o in obs:
  m=CI@o.matrix_basis@C;n={'name':o.name,'parent':o.parent.name if o.parent in obs else None,'matrix':[m[r][c] for c in range(4) for r in range(4)]}
  if o.type=='MESH':
   o.data.calc_loop_triangles();ps=[];ns=[]
   for tri in o.data.loop_triangles:
    normal=CI.to_3x3()@tri.normal
    for idx in tri.vertices:ps.extend(CI.to_3x3()@o.data.vertices[idx].co);ns.extend(normal)
   n.update(positions=ps,normals=ns,color=list(o.data.materials[0].diffuse_color[:3]),sourceNode=o.get('sourceNode'));tris+=len(o.data.loop_triangles)
   bounds.extend(CI@(o.matrix_world@v.co) for v in o.data.vertices)
  nodes.append(n)
 result={'name':root.name,'nodes':nodes,'triangles':tris,'bounds':[[min(p[i] for p in bounds),max(p[i] for p in bounds)] for i in range(3)]}
 (OUT/(root.name+'.json')).write_text(json.dumps(result,separators=(',',':')));return result

def build():
 OUT.mkdir(parents=True,exist_ok=True)
 old=bpy.data.scenes.get(SCENE)
 if old:
  if bpy.context.window.scene==old:bpy.context.window.scene=next(s for s in bpy.data.scenes if s!=old)
  for o in list(old.objects):bpy.data.objects.remove(o,do_unlink=True)
  bpy.data.scenes.remove(old)
 sc=bpy.data.scenes.new(SCENE);bpy.context.window.scene=sc
 # Append readonly data from optimized soldier; only retain selected source geometry.
 with bpy.data.libraries.load(str(SOURCE),link=False) as (a,b):b.objects=a.objects
 loaded=[o for o in b.objects if o];sources={o.get('three_node_id'):o for o in loaded if o.get('three_node_id') in ['n7','n9']}
 P={k:mat(k,c,.35 if k in ['bronze','gold'] else 0) for k,c in {'skin':(.54,.30,.16),'cloth':(.045,.22,.24),'clothDark':(.023,.10,.13),'hair':(.025,.018,.013),'bronze':(.40,.23,.075),'gold':(.65,.43,.16),'red':(.29,.022,.018),'leather':(.075,.037,.022),'paper':(.78,.69,.49),'ink':(.12,.075,.035)}.items()}
 actors=[build_actor(name,sources,P) for name in ['odysseus','achilles']]
 for o in loaded:bpy.data.objects.remove(o,do_unlink=True)
 for actor in actors:
  for obj in actor.children_recursive:
   if obj.type=='MESH':
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free();obj.data.update()
 data=[export_actor(a) for a in actors]
 (OUT/'gateHeroesData.js').write_text('export default '+json.dumps({'actors':data},separators=(',',':'))+';\n')
 manifest={'status':'authored; pending in-scene visual review','reference':'assets/concepts/gate-of-sighs/target-v2.png','source':str(SOURCE.relative_to(ROOT)),'sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'sourceNodes':{'n7':'reference inspected; final face authored as closed faceted rings','n9':'Achilles helmet from optimized solid soldier'},'authored':['Odysseus pleated teal robe, dark mantle, hair and beard','Achilles muscle cuirass, red crest, pteruges, greaves and convex round shield','Odysseus hand-held paper with ink marks'],'axes':'Y up, feet Y=0, forward -Z; local actor exports','poses':'named armL/armR nodes are rigid articulated pivots; no skinning or baked clips','palette':{k:list(v.diffuse_color[:3]) for k,v in P.items()},'actors':[{'name':d['name'],'bounds':d['bounds'],'triangles':d['triangles']} for d in data],'limitations':['Reference interpretation, not claimed exact concept match','Rigid joints; no facial animation','Faceted hero face newly authored; current courierCodrops/head-38 not modified']}
 (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2));print('GATE_HEROES_READY '+json.dumps(manifest['actors']))
 # Review-only spread after export. No gallery positions baked into actors.
 actors[0].location.x=-.50;actors[1].location.x=.50
 bpy.data.libraries.write(str(OUT/'gate-heroes.blend'),{sc},fake_user=True)
 return manifest

if __name__=='__main__':build()
