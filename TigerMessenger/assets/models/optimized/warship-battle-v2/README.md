# Warship v2 — synchronized motion candidate

V1 and original archives are unchanged. All890 mesh local vertex arrays, original340 node parents,26 oars and26 rowers are retained. This revision only changes rowing/rower timing and the resulting real hand constraints. It is not a new ship or a new rower face/helmet family.

Original per-oar phase: index ×0.22 + sideOffset. Candidate: sideOffset only (0 on -Z side,0.11 on +Z side). Both oar and corresponding rower use the same phase. Sweep amplitude, dip/flare, speed smoothing, source time progression and original side identities remain unchanged. Original source userData is an archive; do not use its index×0.22 phase to override the V2 motionRevision contract.

Saved301-frame neighboring-oar intersections: V1=36, V2=0. Every saved frame also passes handle/body, shaft+handle/deck/rail, leg/deck and leg/seat checks, with real hand constraints retained. No collision criterion was removed.

Coverage must remain separate:
-901 in-memory study cases =181 actual captured start/stop states +720 full-cycle phase states (180 samples at25%,50%,75%,100% speed).46,852 hand constraints, max error1.72e-7.
-301 saved Blender/assembly frames =the same181 start/stop +120 boarding deployment/hold/retraction frames. All301 were reread and geometrically checked, with15,652 hand constraints. The extra720 study states are not saved animation frames.
-GLB is static frame1, no animation clip. The two final images use freshly imported GLB geometry with actual V2 local matrices from frame51 (formerly an original contact frame).
-V2 boarding transition matrices differ from V1 by at most1.73e-6 from numeric formula evaluation; geometry unchanged. This revision did not rerun the separate229-position V1 soldier route or add25-agent scheduling.

Formal runtime integration remains pending. Keep original root placement, source IDs/parents,26 independent rower state, casualty/sedation/night/wake ownership, and all V1 board/rigging geometry anchors. Use V2 assembly local matrices or port its matching source-pose/hand solver; merely rotating oars under the old per-row animation detaches the hands. Sedated/dead candidate poses are still unvalidated.

No runtime code or Godot copies were made in this revision. Do not treat successful model motion tests as fleet performance or completed battle integration. Retain the original InstancedMesh owner/index mapping for later batching. V1's single actor route is not a25-person scheduler.

Files: warship-battle-v2.blend, warship-battle-v2.glb, warship-battle-v2.assembly.json, validation-summary.json and manifest.json. Detailed unchanged structural/boarding dimensions are in ../warship-battle-v1/PLACEMENT.md; its old36-frame motion blocker applies to V1, superseded for V2 by the explicit checks here.

Commands:
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/pipeline/build_warship_battle_v2_blender.py -- --no-render
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/pipeline/validate_warship_battle_v2.py -- --no-render
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/pipeline/render_warship_battle_v2.py

The source-vs-synchronized interactive trajectory study remains at artifacts/pipeline/warship-battle-v1/oar-sync-trajectories.html.
