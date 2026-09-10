"""V2: only synchronize tested oar/rower phases, reuse V1 geometry unchanged."""
import bpy,json,importlib.util,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('sync',ROOT/'tools/pipeline/analyze_warship_oar_sync.py');sync=importlib.util.module_from_spec(spec);spec.loader.exec_module(sync);s=sync.s
V1=s.OUT;A1=s.ART;s.OUT=ROOT/'assets/models/optimized/warship-battle-v2';s.ART=ROOT/'artifacts/pipeline/warship-battle-v2';s.g.ART=s.ART
s.OUT.mkdir(parents=True,exist_ok=True);s.ART.mkdir(parents=True,exist_ok=True)
before={str(p.relative_to(ROOT)):s.sha(p) for p in [s.SOURCE,s.SNAP,V1/'warship-battle-v1.blend',V1/'warship-battle-v1.glb']}
a=json.loads((V1/'warship-battle-v1.assembly.json').read_text());ps=json.loads((A1/'source-poses.json').read_text())
for f in ps['frames']:f['transforms']=sync.pose(f['phase'],f['speed'],0)['transforms']
bpy.ops.wm.open_mainfile(filepath=str(V1/'warship-battle-v1.blend'));sc=bpy.context.scene;sc.frame_set(1);bpy.context.view_layer.update();obs={s.ident(o):o for o in sc.objects if s.ident(o)}
geometry_before={k:[tuple(v.co) for v in o.data.vertices] for k,o in obs.items() if o.type=='MESH'}
for o in sc.objects:o.animation_data_clear()
sc.timeline_markers.clear()
frames=s.bake(obs,ps,obs['add:boarding-hinge']);sc.frame_set(1);bpy.context.view_layer.update()
if any(geometry_before[k]!=[tuple(v.co) for v in obs[k].data.vertices] for k in geometry_before):raise RuntimeError('V1 geometry changed')
a.update(stage='v2 synchronized motion candidate; saved-file validation required',readyForBattle=False,poseFrames=frames,restTransforms={k:s.flat(s.local(o)) for k,o in obs.items()},grips=s.pose(obs,ps['frames'][0],obs['add:boarding-hinge']))
a['motionRevision']={'version':2,'sourcePerOarPhaseStep':.22,'candidatePerOarPhaseStep':0,'retainedSideOffset':.11,'sourceGeometry':'assets/models/optimized/warship-battle-v1/warship-battle-v1.blend','sourceGeometrySHA256':before[str((V1/'warship-battle-v1.blend').relative_to(ROOT))],'same26OarsAndRows':True,'originalStrokeAmplitudeAndDipAndFlareAndTimeLawRetained':True}
a['limitations']=['Candidate motion fixed; formal runtime integration is separate.','Static GLB rest frame1;301 saved review frames contain181 start/stop frames and120 boarding/retract frames.','901 memory study cases = same181 captured start/stop +720 full-cycle states at four speeds; these720 states are not saved timeline frames.','No25-actor boarding scheduling, arbitrary terrain footIK, sedated/dead rower validation or fleet batching/performance certification.']
a['boarding']['pathContract']='../warship-battle-v1/boarding-path.json';a['boarding']['pathReuse']='Unchanged stopped/boarding geometry and speed0 poses; no new25-person route.'
bpy.ops.wm.save_as_mainfile(filepath=str(s.OUT/'warship-battle-v2.blend'))
s.export_warship(list(obs.values()),s.OUT/'warship-battle-v2.glb')
(s.OUT/'warship-battle-v2.assembly.json').write_text(json.dumps(a,separators=(',',':')))
assert all(s.sha(ROOT/k)==v for k,v in before.items())
(s.ART/'build-provenance.json').write_text(json.dumps({'v1AndOriginalUnchanged':True,'inputFiles':before,'geometryMeshCount':len(geometry_before),'geometryChanged':False,'savedFrames':len(frames),'studyReport':'artifacts/pipeline/warship-battle-v1/oar-sync-study.json'},indent=2))
print('V2_SAVED_GEOMETRY_UNCHANGED',len(geometry_before),flush=True)
