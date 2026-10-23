# Guardian armour, stance and battle materials — 2026-10-07

Implemented in the normal `src/world/citadel/plazaStatue.js` factory from the four user-supplied current/reference images. Source id: `roman-ivory-stone-guardian-5-pointed-armour`. This is project reference-driven geometry, not an external author's renderer or a generated concept image.

Shoulders now use a thick closed pointed shell with two front and two rear overlapping lames. The former round pauldron sphere was removed. Thigh and calf armour use variable closed cross sections, pointed front ridges and rear shells. Left leg bears the weight; right foot is set back and outward. Both soles remain at figure y=.45 on the original stone plinth. Original pedestal geometry/materials, Roman helmet/face and all 13 joints remain.

The spear is a rigid group pivoted at the actual right palm `[1.18,3.89,.34]`, angled 18 degrees outward. Shaft, ferrules, blade and tip share one axis. Its bottom remains at rest y=.49. `heroRig.anchors.spearGrip` was added; existing `seat`, `spearTip`, `getSpearTipWorld`, `setPose`, detach and restore APIs remain. Rest joints' positions changed with the stance, but mounted/raiseSpear pose parameters retain their previous meaning. The figure-local spear tip x increases to approximately 2.12, so production envelope validation must use the actual new model.

`statue.userData.guardianAppearance.setAwake(bool)` switches only figure mesh material references. True lazily creates iron-silver armour, dark iron recess/frame and aged-gold details. False restores every original stone material reference exactly and disposes the three temporary metal materials. Pedestal material references never change. `awake` is a getter; `dispose()` restores stone and releases temporary materials. Root agent owns controller lifecycle wiring.

Eight asset tests passed: closed shoulder depth and layered geometry; tapered leg cross sections; asymmetric stance and seated soles; 13 pose samples with shaft through palm and correct strike tip; three complete material replacement/restoration/disposal cycles; existing joint/reset/detach and finite-animation tests. Actual evidence: `cpu-armour.json`; prior factory: `source-before.js`.

No normal-scene/GPU visual acceptance was performed, and no browser safety restriction was bypassed. These CPU checks do not establish visual equivalence to the detailed target, full-scene navigation clearance or completed locomotion. Root agent performs production/guardian integration checks.
