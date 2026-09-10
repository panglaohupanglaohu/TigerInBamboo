"""Read-only oar synchronization study; no Blender save or export."""
import bpy,math,json,hashlib,importlib.util
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_ray_tri
ROOT=Path(__file__).resolve().parents[2];ART=ROOT/'artifacts/pipeline/warship-battle-v1'
spec=importlib.util.spec_from_file_location('ship',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
# Reuse the exact existing triangle-edge/face test, not a weaker substitute.
text=(ART/'check_oar_neighbors.py').read_text();exec(text[text.index('def geo('):text.index('bpy.ops.wm.open_mainfile')])
PS=json.loads((ART/'source-poses.json').read_text())
def flat(m):return [float(m[r][c]) for c in range(4) for r in range(4)]
def err(a,b):return max(abs(a[r][c]-b[r][c]) for r in range(4) for c in range(4))
def om(i,phase,speed,step):
 o=PS['oars'][i];side=o['side'];p=phase+o['index']*step+(.11 if side>0 else 0);power=math.sin(p)**3;lift=max(0,-math.cos(p));x,y,z,w=o['baseQuat']
 return Matrix.Translation((-1.7+o['index']*.27,.50,side*.50))@Quaternion((w,x,y,z)).to_matrix().to_4x4()@Matrix.Rotation((-.22*power+.28*lift)*speed*side,4,'X')@Matrix.Rotation((.06+.1*lift)*speed*side*.35,4,'Y')@Matrix.Rotation(.55*power*speed,4,'Z')
def pose(phase,speed,step):
 tr=dict(PS['frames'][0]['transforms'])
 for i in range(26):
  side=-1 if i<13 else 1;idx=i%13;p=phase+idx*step+(.11 if side>0 else 0);power=math.sin(p)**3;base=Matrix.Rotation(math.pi if side<0 else 0,4,'Y');pos=Vector((-1.7+idx*.27,.99,side*.28));body=Matrix.Translation(pos)@base@Matrix.Rotation(side*speed*(.24*power-.14),4,'Z')
  tr['n'+str(63+i*5)]=flat(om(i,phase,speed,step))
  for n in range(220,227):tr['n'+str(n)+':i'+str(i)]=flat(body)
  for n,off in [(229,(.035,.01,.014)),(230,(-.035,.01,-.014))]:tr['n'+str(n)+':i'+str(i)]=flat(Matrix.Translation(pos+base.to_3x3()@Vector(off))@base@Matrix.Rotation(side*(.42+speed*.16*power),4,'Z'))
 return {'transforms':tr}
def main():
 paths=[s.SOURCE,s.SNAP,s.OUT/'warship-battle-v1.blend',s.OUT/'warship-battle-v1.glb',ROOT/'src/assets/harbor.js'];hashes={str(p.relative_to(ROOT)):s.sha(p) for p in paths}
 e=0
 for f in PS['frames'][1:]:
  for k,v in pose(f['phase'],f['speed'],.22)['transforms'].items():
   if not k.startswith(('n227:','n228:')):e=max(e,err(s.mat(v),s.mat(f['transforms'][k])))
 print('SOURCE_FORMULA_ERROR',e,flush=True)
 if e>2e-6:raise RuntimeError('Source formula mismatch')
 bpy.ops.wm.open_mainfile(filepath=str(s.OUT/'warship-battle-v1.blend'));scene=bpy.context.scene;scene.frame_set(1);obs={s.ident(o):o for o in scene.objects if s.ident(o)}
 for o in obs.values():o.animation_data_clear()
 parts=[obs['n'+str(n+5*i)] for i in range(26) for n in [64,66]]
 def neighbors():
  g=geo(parts);return [h for h in crossings(g,g) if (int(h[0][1:])-64)//5!=(int(h[1][1:])-64)//5]
 cases=[('captured-'+str(f['frame']),f['phase'],f['speed']) for f in PS['frames']]+[('steady-'+str(j),j*math.tau/240,1) for j in range(240)]
 search=[]
 for step in [.22,.11,.055,0.0]:
  bad=[]
  for label,phase,speed in cases:
   for i in range(26):
    m=om(i,phase,speed,step);m.translation.y+=.20;s.setm(obs['n'+str(63+i*5)],m)
   bpy.context.view_layer.update();hits=neighbors()
   if hits:bad.append({'case':label,'pairs':hits})
  search.append({'phaseStep':step,'testedCases':len(cases),'failedCases':len(bad),'examples':bad[:8]});print('SEARCH',step,len(bad),flush=True)
 (ART/'oar-sync-search.json').write_text(json.dumps({'formulaError':e,'search':search},separators=(',',':')))
 handles=[obs['add:oar-handle-'+str(i)] for i in range(26)];shafts=[obs['n'+str(64+5*i)] for i in range(26)];body=[obs['n'+str(n)+':i'+str(i)] for i in range(26) for n in [220,221,222,223,224,225,226,229,230]];body=[o for o in body if not o.hide_render];legs=[obs['n'+str(n)+':i'+str(i)] for i in range(26) for n in [229,230]]
 deck=[o for k,o in obs.items() if o.type=='MESH' and not o.hide_render and (k in ['n231','n233','n253'] or k.startswith('add:deck-plank-'))];seats=[o for k,o in obs.items() if k.startswith(('add:bench-','add:seat-leaf-'))]
 cases=[('captured-'+str(f['frame']),f['phase'],f['speed']) for f in PS['frames']]+[('speed-'+str(speed)+'-phase-'+str(j),j*math.tau/180,speed) for speed in [.25,.5,.75,1] for j in range(180)]
 bad=[];grip=0
 for count,(label,phase,speed) in enumerate(cases):
  s.pose(obs,pose(phase,speed,0),obs['add:boarding-hinge']);bpy.context.view_layer.update();dg=geo(deck)
  checks={'neighbors':neighbors(),'handleBody':crossings(geo(handles),geo(body)),'oarDeck':crossings(geo(handles+shafts),dg),'legsDeck':crossings(geo(legs),dg),'legsSeats':crossings(geo(legs),geo(seats))}
  if any(checks.values()):bad.append({'case':label,**checks})
  for i in range(26):
   for limb,along in [('L',-.15),('R',-.23)]:grip=max(grip,(obs['add:hand-'+str(i)+limb].matrix_world.translation-obs['n'+str(63+5*i)].matrix_world@(s.C.to_3x3()@Vector((0,along,0)))).length)
  if count%100==0:print('FULL',count,len(cases),'bad',len(bad),flush=True)
 traj=[]
 for j in range(49):
  phase=j*math.tau/48;row={'phase':phase,'source':{},'synchronized':{}}
  for label,step in [('source',.22),('synchronized',0)]:
   for i in [0,1,6,11,12,13,14,24,25]:
    m=om(i,phase,1,step);m.translation.y+=.20;p=m@s.local(obs['n'+str(66+5*i)])@Vector((0,0,0));row[label][str(i)]=[round(v,7) for v in p]
  traj.append(row)
 unchanged=all(s.sha(p)==hashes[str(p.relative_to(ROOT))] for p in paths)
 report={'status':'parameter_study_only','modelExported':False,'filesUnchanged':unchanged,'inputFiles':hashes,'sourceFormulaMaxMatrixError':e,'search':search,'selectedPhaseStep':0,'selectedSideOffset':.11,'fullCases':len(cases),'gripChecks':len(cases)*52,'maxGripError':grip,'passed':not bad and grip<1e-5 and unchanged,'failures':bad,'trajectory':traj,'scope':'Actual retained triangle meshes; adjacent shafts/blades, all26 bodies vs handles, oars/deck/rails, legs/deck/seats. Real handle IK maintained. Captured start/stop and full cycles at4 speeds.','notYetDone':['No candidate file or runtime updated','No sedated/dead states or25-agent boarding']}
 (ART/'oar-sync-study.json').write_text(json.dumps(report,separators=(',',':')))
 print('RESULT',report['passed'],'bad',len(bad),'grip',grip,'filesUnchanged',unchanged,flush=True)

if __name__=="__main__":main()
