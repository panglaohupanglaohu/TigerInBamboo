2026-10-07 user target: shorter tapered upper tiers, thicker engraved stone parapet, aged stone and actual rock-supported vegetation. Gate throat stays 14.4m; rail curve, pedestrian lower decks and approach structure are fixed. Own procedural implementation, not Oskar's unpublished shader. Read skill rendering and implementation recipes: roots must follow final supported surface, and preserve rail swept envelope. GPU/normal browser verification unavailable due explicit browser safety refusal.

Implemented in normal `installHighlandGate` path:
- Upper tiers are closed chamfered frusta, lower/top widths 9.0→7.8m and 7.8→6.6m; depths 10.4→8.9m and 8.9→7.4m. Caps reduced to y24.2/23.6 (formerly27.8/26.3); real window/jamb vertices follow tapered facades.
- Original arch void remains14.4m, main arch/deck and lower approach remain. Iron bridge rail removed, replaced by two2.45m-high/.72m-thick stone parapets, coping and carved circular/cross seal. Central deck passage remains open.
- Restrained block tonal variation, fine eroded joints, rain/foot patina; real .18m corner chamfers and pre-existing worn coping geometry. Project-authored shader only; not a reproduction of an Oskar shader. No GPU shader acceptance claimed.
- New `highlandGateLandscape.js` runs AFTER the real rail warp. Adds114 shrubs rooted on actual final rock triangles plus108 small rooted wall-vine samples. Four merged material draws. Rejects covered/blocked walk sites, using actual geometry instead of guessed planting heights; cpu.json retains exact rejection counts. Roots have stems and overlapping 3D leaves; no billboard dirt. Adds no geometry into rail corridor or retained walk planes.

CPU final default gate installation with actual current tram factory curve and final strict terrain fixture:
- All114 roots re-hit retained rock; maximum root error5.90222e-14m, missing0.
-1305 actual curve-following swept line segments (d=-36..36/.5m, lateral-2/0/2, h=.2/2/3.8) vs final solid gate geometry:0 collisions.
- Conservative bound from sampled rail centerline to full added vegetation envelopes:16.26236m minimum, subtracts canopy height+radius and .25m rail sampling uncertainty; exceeds4.5m vehicle-envelope reserve. Wall vines included.
- Model/warp tests7 pass, including exact original lower walk/throat/approach triangle preservation, real taper/outward-face rays, thick parapets and open upper passage. Combined statue/gate tests16 pass.

Limits: segment probes are finite, not a full continuous train mesh sweep. This fixture is gate+actual tram/finalterrain, not fullworld other structures. GPU view, shader compilation and silhouette/atmosphere acceptance remain unverified because browser tool safety refused normal-page recovery; no bypass used. Root agent owns final whole-production assembly and visual follow-up.
