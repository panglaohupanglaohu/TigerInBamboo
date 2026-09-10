"""Package explicit two-pass evidence; never upgrades an untested candidate to runtime."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[2]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for version in [3,4]:
    name='warship-battle-v'+str(version);out=ROOT/'assets/models/optimized'/name;art=ROOT/'artifacts/pipeline'/name
    reports={key:json.loads((art/(key+'.json')).read_text()) for key in ['validation','rowing-seat-audit','oar-neighbor-validation','new-shape-validation']}
    passed=all(r['passed'] for r in reports.values())
    structural=reports['validation'];new=reports['new-shape-validation']
    summary={'asset':name,'status':'geometry_and_motion_checked_candidate' if passed else 'retained_failed_first_pass','passedWithinListedScope':passed,'runtimeIntegrated':False,'readyForFullBattle':False,
      'originalNodes':structural['originalNodes'],'originalInstances':structural['originalInstances'],'rowers':26,'oars':26,'sourcePaletteFactorsChecked':structural['sourceMaterialFactors'],'visibleUVMeshes':structural['visibleUVMeshes'],
      'savedFrames':301,'gripChecks':structural['gripChecks'],'maximumGripError':structural['maxGripAnchorError'],'maximumSavedMatrixError':structural['maxSavedMatrixError'],'maximumGLBMatrixError':structural['maxGLBReimportMatrixError'],
      'all301PortableMotionRecordsExactlyEqualV2':new['all301MotionRecordsExactlyEqualV2'],
      'newHullFailedFrames':len(new['failedFrames']),'eyeHullContacts':new['eyeHullTriangleContacts'],'maximumEyeCenterMotion':new['maxEyeCenterMotion'],'boardingJunction':new['boardingJunction'],
      'differentOarsPassed':reports['oar-neighbor-validation']['passed'],'deckSeatsAndBodyPassed':reports['rowing-seat-audit']['passed'],
      'shapeChecks':'Saved new n1 shell against specified26 body parts and oar handles/shafts, new landing supports against these bodies/oars, eyes against shell; existing deck/seat and different-oar checks rerun.',
      'coverageLimits':['No full-body/self/cabin/cargo collision claim.','No single-soldier traversal rerun on changed deck; no25-person scheduler.','The V2 901-state study was NOT repeated on changed geometry; new checks cover301 saved frames.','No runtime/Godot integration; GLB is static frame1, Blend/assembly retain301 frames.','26 original rowers retain their old simple face/helmet family.'],
      'referenceDecision':'Follow target main3q eyes on curled -X end; conflicting target sideview is not used for eye placement. Original +X navigation/ram stays unchanged.'}
    a_path=out/(name+'.assembly.json');a=json.loads(a_path.read_text())
    a['stage']=summary['status'];a['motionClearancePassed']=passed;a['runtimeIntegrated']=False;a['readyForBattle']=False
    a['testCoverage']={'newSavedFrames':301,'all301PortableMotionRecordsExactlyEqualV2':True,'newHullAndLandingChecked':True,'newShapePassed':new['passed'],'prior901StateStudyNotRepeatedForNewGeometry':True,'scope':summary['shapeChecks'],'limits':summary['coverageLimits']}
    a['limitations']=summary['coverageLimits']+[summary['referenceDecision']]
    a_path.write_text(json.dumps(a,separators=(',',':')))
    (out/'validation-summary.json').write_text(json.dumps(summary,indent=2))
    for key,r in reports.items():(out/(key+'.json')).write_text(json.dumps(r,indent=2))
    text=f"""# {name}

Status: {summary['status']}. Runtime integrated: **false**. Full battle ready: **false**.

Round 1 (v3): eyes moved to the curled end and both ends lightly narrowed. Retained failed evidence: eye white faces intersect the hull, and the first seated pair/oars intersect the original rising hull cap.

Round 2 (v4): explicit triangulated almond eyes on the flatter curled-end side; narrower curved cross sections at both ends; lower end chine; matching tapered upper aft cabin/platform with original boxes; boarding ledge and supported hinge transition. The rising source hull cap is lowered below the real deck in the rowing bay. Original 26 rowers/oars and all 301 pose matrices remain unchanged from V2.

Target main3q and sideview conflict. Eye placement follows main3q (-X curled end), while original +X ram/navigation remains unchanged.

## Evidence
The saved Blend and fresh GLB are independently reread for original340 IDs/parents,286 crew instances,301 matrices,15,652 grips,UVs and original colors. New hull/body/oar tests and the retained deck/seat/oar tests run for all301 saved frames. Eye centers are checked each frame. Boarding junction uses450 actual floor rays; this is not a walking-character or crowd validation.

301 saved frames =181 start/stop +120 boarding/retract. V2's901-state in-memory study has NOT been repeated against the changed geometry. No inherited geometry pass.

GLB stores static frame1; Blend and assembly contain301 review frames. No25-person scheduling, full-body/cabin/cargo collision audit, route rerun or official game integration. Original rower faces/helmets are a separate old family.

Images: ../../../../artifacts/pipeline/{name}/glb-frame51-three-quarter.png and glb-frame51-top.png. V4 includes glb-eye-closeup.png. Same V2-calibrated camera and light for both rounds.

Build: tools/pipeline/build_warship_two_pass_blender.py -- --version {version}
Validate: tools/pipeline/validate_warship_two_pass_blender.py -- --version {version}
Run both using independent background Blender. Source and V2 stay read-only.
"""
    (out/'README.md').write_text(text)
    files={p.name:{'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(out.iterdir()) if p.is_file() and p.name!='manifest.json'}
    (out/'manifest.json').write_text(json.dumps({'asset':name,'status':summary['status'],'passedWithinListedScope':passed,'runtimeIntegrated':False,'readyForFullBattle':False,'files':files,'evidenceDirectory':str(art.relative_to(ROOT)),'retainedPrevious':['warship-battle-v2','warship-battle-v3'] if version==4 else ['warship-battle-v2']},indent=2))
    print(name,summary['status'],'new hull failed frames',summary['newHullFailedFrames'],'eye contacts',summary['eyeHullContacts'],'boarding missing',len(summary['boardingJunction']['missingSupport']))
