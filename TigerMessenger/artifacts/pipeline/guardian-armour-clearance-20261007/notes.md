# Actual-size guardian clearance

The previous `citadel-route-curvature-20261007/verify-guardian-integration.mjs` constructed the horse with factory scale .72 AND actor scale .72. Normal `citadelRange.js` constructs factory default scale 1, then actor scale .72. Therefore the previous production-integration-cpu evidence does not prove normal-sized horse clearance. Its original result has not been altered.

This independent verify.mjs uses the normal factory inputs (seed 9901, factory default 1, actor .72), current strict final terrain, current shared production city options, actual landmark migration and actual guardian controller. Includes secondary streets and old-city wings. No substitute simplified scene for production result.

The first run exposed 79 sampled spear-shaft/ferrule surface crossings into the actual-size horse. The old -2.4rad shoulder turn moved the hand across the chest; the spear butt ran through the torso. Asset-only correction: raise the right arm outward, keep rigid spear grip at palm, rotate its lean forward at the mounted endpoint, and carry its butt outboard during the lift. Both rest and mounted endpoint lean are exactly 18 degrees. Transition stow ramps in after clearing the stone pedestal. No telescoping, no controller edits, no horse shrinking. Shoulder meshes and actual widened spear blade remain unchanged.

Final cpu.json: 16 actual controller poses covering standing/awakening/mounted/return, 1002 mesh candidate pairs, zero bidirectional triangle-edge surface intersections. Includes real instanced nearby structure geometry expanded to world transforms. Four actual production wheel locations checked on actual paving: 64 hits, maximum radial gap 6.10793e-9 m. Guardian made 158 supported moves and returned to idle.

Dense additional replay-lift.mjs reconstructs the actual recorded production standing/mount transforms and the controller's interpolation (101 poses, 1% steps), using original full-size horse and original stone pedestal: zero surface crossings in lift-replay.json. This denser pass found and removed collisions missed by earlier half-second samples.

Limits: finite sampled triangle-edge crossings are not a continuous swept-volume proof and do not exclude fully contained volumes without surface crossings. The denser replay covers horse/pedestal only; full nearby structure checks are the 16 production poses. No browser/GPU screenshots, visual acceptance, or continuous running/galloping claim. Existing browser safety refusal was respected.

Tests: plazaStatueRig and plazaStatueArmour, 9 passed. Regression holds the mounted palm outside torso and verifies exact endpoint spear angle. Ray probe through grip uses y=.001 to avoid a numerical triangle seam at exact shaft midpoint; palm/grip coincidence is independently checked to 1e-8.
