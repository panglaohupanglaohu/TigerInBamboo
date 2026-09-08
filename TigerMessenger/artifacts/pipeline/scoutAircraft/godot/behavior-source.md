# Scout original runtime contract and Godot adapter

Implementation: godot/scripts/scout_runtime_adapter.gd, used live by scout_candidate.gd. It adds the original missing point light below archived n44 and drives the original mounted-aircraft callback every frame. It does not replace currentResource, deploy aircraft in the world or implement new flight gameplay.

| Original source / line | Node/parameter | Implemented here |
|---|---|---|
| src/world/planetV8/tripleGateScout.js:190–199 | basePosition + up * sin(t*1.7+.35)*.32; requires BOTH placement fields; lastDelta=dt | Yes, configure_hover then update_original. Without mount data returns without updating light/position/delta |
| tripleGateScout.js:165–172,195–197 | n41 left cyan(-.94,.02,-.2), n42 right yellow(.94,.02,-.2), n43 orange beacon(0,.18,-1.65); pulse=.78+.22*sin(t*5.2); n44 point light .45+pulse*.35, range5 decay2, color ff9a43 | Existing three mesh nodes retained. n43 opacity property changes; n44 OmniLight recreated. Point-light appearance is engine-specific, numerical energy curve matches |
| tripleGateScout.js:44–49 | Navigation meshes use opaque MeshBasicMaterial; setting opacity alone does not enable blending | Preserved opaque setting, not invented mesh flashing. The point light produces visible illumination modulation |
| tripleGateScout.js:130–138 | n26 legacy propeller group at(0,0,3.02), n27 cream spinner at localz.42 | Static, no blades and no rotation animation. Old file header mention of propeller is stale |
| tripleGateScout.js:141–151 | n31/n34 gun muzzle anchors at(±.7,-.16,1.6) | World-coordinate accessors tested after parent rotation/hover |
| tripleGateScout.js:174–177; src/player/scoutAircraftRide.js:179–190 | n45 cockpit eye at(0,.48,.72); camera uses world anchor and tangent forward looking40 ahead | Anchor accessor implemented and tested; camera possession not implemented |
| tripleGateScout.js:83–102 | n9 canopy geometry; fixed frame n10 | Static glass adapter retained. Source does not animate an opening canopy |
| tripleGateScout.js:209–250 | mounted gate scale.86, hover9, forward offset4.5, lateral0; radius160; source placement uses radial/tangent basis | This isolated inspection uses declared local base and up, no fabricated world placement. Sphere mounting remains integration work |
| src/world/scoutDefense.js:519–524 | callback first; manual exits; beacon override1.4 if flashT>0 else.55 | update_defense_light reproduces override and manual exception, tested separately. No false claim of complete squad AI |
| scoutDefense.js:381–390,606–620 | flashT=.22; paired muzzle world origins; units factory scale.72; no basePosition/up set on defense units | Muzzle world sampling implemented. Defense units must stay unmounted for model hover callback; do not accidentally apply the gate bob to a squad aircraft |

Remaining original systems inventoried, not ported: scoutDefense.js defines count5, speed21, scan.32, zone dwell18, attack range10.5, shot interval1.55 and minimum formation gap7.2; fleet orbit radius62, altitude46, angular speed.55, minimum AGL30 and pitchlimit.40. It moves/orients entire aircraft, manages pending bird/fleet targets and tracers. These depend on world/ecology systems, not on model bones. scoutAircraftRide.js:8–14,109–160,193–239 defines F boarding range11, speed15, turn1.65, vertical8, hover7..78, FOV72, hides player model, obtains manual pilot ownership and sets spherical position each frame. None is substituted by an invented orbit in the preview.

## Verification

behavior-fixture.json was produced by extracting and executing the actual original JS update callback with minimal position/material mocks, not by duplicating its formula as expected values. The source SHA256 and exact callback text are stored with6 samples t=0,.25,.75,1,2,10, nonvertical up(.6,.8,0), base(2,3,4). Godot matches position/opacity/energy within1e-5 and exact dt.

Run: Godot --path TigerMessenger/godot --script res://scripts/test_scout_behavior.gd. Passed actual graphical run includes unmounted early-return, six source samples, stationary legacy spinner, manual/defense light order, rotated cockpit/muzzle world anchors, and screenshots behavior-0.png / behavior-2.png. Both actual images were viewed; the aircraft changes height and local illumination while the inspection camera remains fixed. No source model or front Blender operation required.

This proves mounted model animation and light/anchor adapters. It does not mark fleet behavior, piloting, weapons or world integration complete. Godot OmniLight attenuation is an engine approximation; matching the JS numeric intensity does not imply photometric pixel parity.
