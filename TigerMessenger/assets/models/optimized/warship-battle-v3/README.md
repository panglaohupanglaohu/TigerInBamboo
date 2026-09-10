# warship-battle-v3

Status: retained_failed_first_pass. Runtime integrated: **false**. Full battle ready: **false**.

Round 1 (v3): eyes moved to the curled end and both ends lightly narrowed. Retained failed evidence: eye white faces intersect the hull, and the first seated pair/oars intersect the original rising hull cap.

Round 2 (v4): explicit triangulated almond eyes on the flatter curled-end side; narrower curved cross sections at both ends; lower end chine; matching tapered upper aft cabin/platform with original boxes; boarding ledge and supported hinge transition. The rising source hull cap is lowered below the real deck in the rowing bay. Original 26 rowers/oars and all 301 pose matrices remain unchanged from V2.

Target main3q and sideview conflict. Eye placement follows main3q (-X curled end), while original +X ram/navigation remains unchanged.

## Evidence
The saved Blend and fresh GLB are independently reread for original340 IDs/parents,286 crew instances,301 matrices,15,652 grips,UVs and original colors. New hull/body/oar tests and the retained deck/seat/oar tests run for all301 saved frames. Eye centers are checked each frame. Boarding junction uses450 actual floor rays; this is not a walking-character or crowd validation.

301 saved frames =181 start/stop +120 boarding/retract. V2's901-state in-memory study has NOT been repeated against the changed geometry. No inherited geometry pass.

GLB stores static frame1; Blend and assembly contain301 review frames. No25-person scheduling, full-body/cabin/cargo collision audit, route rerun or official game integration. Original rower faces/helmets are a separate old family.

Images: ../../../../artifacts/pipeline/warship-battle-v3/glb-frame51-three-quarter.png and glb-frame51-top.png. V4 includes glb-eye-closeup.png. Same V2-calibrated camera and light for both rounds.

Build: tools/pipeline/build_warship_two_pass_blender.py -- --version 3
Validate: tools/pipeline/validate_warship_two_pass_blender.py -- --version 3
Run both using independent background Blender. Source and V2 stay read-only.
