# Palette 3 final visual decision: accept, modest benefit

Actually inspected the six PNGs: r16/r19 left-terrace daylight, bay daylight and bay dusk. Accept palette 3 over palette 2, with light pass 0 and all r16 geometry/turf settings kept. No more source changes.

Day close-up: the rock moves from slightly greenish cool grey to a paler, near-neutral limestone. City masonry remains darker and more yellow. Mid-bay daylight: this small value separation makes the rock/city distinction clearer. Shadow color also rises rather than deepening, so face-to-face contrast is not visibly exaggerated. Broad triangular cliff folds still exist: palette 3 has not repaired geometry or normal transport.

Dusk: differences are weak. The rock remains muted rose-grey under the existing orange sky, without a new yellow cast. This is not completion of the sunset reference target and not evidence of improved atmospheric lighting.

Evidence read from r19-left-terrace-day-noCloud-plants.json: 262 programs, all shaders compiled and programs linked, GL errors empty, page errors empty. Dusk JSON: 263 programs, same clean results. These represent capture-time GPU checks, not all-frame proof. Camera and clock equal r16 exactly in both JSON pairs; surfaceNormals, terraceProfile and silhouetteProfile equal r16 field-for-field. Bay/day PNG was inspected; its matching JSON was absent at review time, so no bay/day-specific GPU count is asserted. Renderer memory counts differ across sessions; no performance-equivalence claim follows.

Additional independent material evidence: 96 combinations of prior palettes 0/1/2 retain exact generated shader text, cache keys, metadata and relevant uniforms. Palette3 vs2 has identical rock/vegetation shader operations and vegetation colors; only rock base/shade/chalk uniforms differ. Position/instance hashes and original shared materials pass the material suite. Those Node checks are distinct from the visual judgment above.
