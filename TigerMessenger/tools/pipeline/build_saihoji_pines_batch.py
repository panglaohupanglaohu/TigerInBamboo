"""Batch the approved original-pine refinement against 25 exact source seeds.
Runs in Blender background; leaves the single-pine generator and all sources unchanged.
"""
import bpy,json,hashlib,sys,time
from pathlib import Path
B=Path(__file__).resolve().parents[2];SRC=B/'assets/models/originals/saihoji-pines-r1';OUT=B/'assets/models/optimized/saihoji-pines-v1';EV=B/'artifacts/pipeline/saihoji-pines-v1';OUT.mkdir(parents=True,exist_ok=True);EV.mkdir(parents=True,exist_ok=True)
manifest=json.loads((SRC/'manifest.json').read_text());GEN=B/'tools/pipeline/build_ancient_pine_candidate.py';generator_sha=hashlib.sha256(GEN.read_bytes()).hexdigest();template=GEN.read_text().split('# Two-sided same-camera review:')[0]
# Deliberately reuse the accepted geometry algorithm; suppress its per-model
# nine renders. The batch renderer imports actual GLBs into one contact sheet.
assert "SOURCE=BASE/'assets/models/originals/blender-r3/pine.blend'" in template
seed_args=[int(v) for v in sys.argv[sys.argv.index('--')+1:] if v.isdigit()] if '--'in sys.argv else []
rows=[];start=time.time()
for entry in manifest['files']:
 seed=entry['seed']
 if seed_args and seed not in seed_args:continue
 stem='ancient-pine-'+str(seed);out=OUT/str(seed);ev=EV/str(seed);out.mkdir(exist_ok=True);ev.mkdir(exist_ok=True)
 code=template.replace("OUT=BASE/'assets/models/optimized/ancient-pine-v1';EV=BASE/'artifacts/pipeline/ancient-pine-v1'",'OUT=Path('+repr(str(out))+');EV=Path('+repr(str(ev))+')')
 code=code.replace("SOURCE=BASE/'assets/models/originals/blender-r3/pine.blend';SNAPSHOT=BASE/'assets/models/originals/pine.source.json'",'SOURCE=Path('+repr(str(SRC/'blender-r3'/(stem+'.blend')))+');SNAPSHOT=Path('+repr(str(SRC/(stem+'.source.json')))+')')
 code=code.replace("print(json.dumps(rows))",'')
 code=code.replace('leaf_intermediate=remesh_and_reduce(foliage,.025,2050,1);leaf_master=foliage.data.copy()', 'leaf_intermediate=remesh_and_reduce(foliage,.025,2050,1);remove_tiny_islands(foliage);leaf_master=foliage.data.copy()')
 code=code.replace("root['candidate_id']='ancient-pine-v1';root['source_asset_id']='pine'", "root['candidate_id']='saihoji-pines-v1';root['source_seed']="+str(seed)+";root['source_asset_id']='"+stem+"'")
 code=code.replace("'ancient-pine-v1-lod%d.glb'","'"+stem+"-lod%d.glb'")
 code=code.replace("material['candidate_palette_source']='pine.source.json'", "material['candidate_palette_source']='"+stem+".source.json'")
 scope={'__file__':str(__file__),'__name__':'__seed_candidate__'}
 exec(compile(code,str(GEN)+' [seed '+str(seed)+']','exec'),scope)
 bpy.context.window.scene=scope['scene'];blend=out/(stem+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(blend))
 source_hashes=scope['before_hashes'];assert source_hashes['snapshot']==entry['sha256'];assert source_hashes=={'blend':scope['sha'](scope['SOURCE']),'snapshot':scope['sha'](scope['SNAPSHOT'])}
 contract={'seed':seed,'sourceScenePlacement':entry['placement'],'nodeIDsPreserved':17,'rootLocalMatrixFromSnapshot':json.loads(scope['SNAPSHOT'].read_text())['nodes'][0]['matrix'],'sourceParentIDsExact':True,'sourceLocalMatrixMaxError':scope['matrix_error'],'originalBranchCenterlines':[{'a':list(s['a']),'b':list(s['b']),'sourceID':s['sourceID'],'sourceSegment':s['sourceSegment']}for s in scope['segments']],'originalLeafClumpCenters':[list(p)for p in scope['clumps']],'anchorSpace':'root-local Blender +Z up; unchanged construction inputs, not a claim that remeshed volume centroids are identical','paletteUnchanged':True,'worldPlacementBaked':False,'runtimeRule':'Copy actual old world root transform onto imported root. In the source, placeOnDirection overwrites factory yaw while preserving 1.02 * spec.scale * 6 scale. Do not multiply captured factory yaw twice. Preserve spec spread2 and lift spec.lift+.44; world terrain adaptation is separate.'}
 (out/'placement-contract.json').write_text(json.dumps(contract,indent=2)+'\n')
 report={'seed':seed,'zone':entry['zone'],'stage':'Blender geometry candidate; actual GLB contact checks and batch visual review pending','sourceHashes':source_hashes,'sourceHashesUnchanged':True,'originalTriangles':scope['original_count'],'lods':scope['metrics'],'originalBranchSegments':len(scope['segments']),'originalClumpCenters':len(scope['clumps']),'sourceParentsExact':True,'sourceMatrixError':scope['matrix_error'],'actualGlbMaterialChecks':scope['material_checks'],'blend':str(blend.relative_to(B)),'blendSha256':scope['sha'](blend),'reference':'assets/concepts/ancient-pine-target-v1.png','baseGeneratorSHA256':generator_sha,'placement':entry['placement'],'runtimeIntegrated':False}
 (ev/'report.json').write_text(json.dumps(report,indent=2)+'\n');rows.append(report)
 progress={'completed':len(rows),'requested':len(seed_args) or 25,'elapsedSeconds':time.time()-start,'completedSeeds':[r['seed']for r in rows],'latest':seed};(EV/'build-progress.json').write_text(json.dumps(progress,indent=2)+'\n');print('PINE_SEED_DONE '+json.dumps(progress),flush=True)
 del scope
assert hashlib.sha256(GEN.read_bytes()).hexdigest()==generator_sha
# Summarize all existing exact-seed reports, enabling safe per-seed reruns.
all_rows=[json.loads(p.read_text())for p in sorted(EV.glob('*/report.json'))]
(OUT/'manifest.json').write_text(json.dumps({'id':'saihoji-pines-v1','scope':'25 exact original seed candidates, three LODs each; no world placement baked','sourceManifest':'assets/models/originals/saihoji-pines-r1/manifest.json','sourceManifestSHA256':hashlib.sha256((SRC/'manifest.json').read_bytes()).hexdigest(),'baseGeneratorSHA256':generator_sha,'target':'assets/concepts/ancient-pine-target-v1.png','seeds':all_rows,'runtimeIntegrated':False},indent=2)+'\n')
