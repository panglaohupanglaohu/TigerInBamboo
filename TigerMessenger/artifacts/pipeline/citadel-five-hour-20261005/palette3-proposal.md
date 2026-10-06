# Palette 3: pure rock albedo candidate

Reviewed actual r16 bay/day, left-terrace/day and bay/dusk screenshots. Daylight rock is close in value to the city masonry; in dusk both become muted rose-grey. This experiment modestly raises rock value without strengthening face-to-face contrast. It does not claim to solve angular geometry or eliminate large faceting.

| Uniform | Palette 2 (unchanged) | Palette 3 |
|---|---|---|
| mtBase | #a7a9aa | #b4b3ae |
| mtShade | #747d83 | #858b90 |
| mtChalk | #cec8bb | #d3cfc4 |
| mtVerdure | #647363 | #647363 |

`citadelMountainPalette=3` selects the candidate; use `citadelMountainLightPass=0` for an isolated comparison. No default or release manifest change was made here. Keep normal4, relief .22, detail .35, ridge/turf and the exact camera/time of day fixed. Palette 2 vegetation shader, moss cap .24, shared city material, light and geometry are preserved. The shade lifts with the base rather than deepening to exaggerate folds. Risk: in bright daylight the higher value may look too chalky; dusk must not become yellow limestone against an orange sky. Reject if this makes cliff folds louder or reduces city separation.

Validation: production material test passes, including palette 3 vs 2 identical rock shader source, identical vegetation shader source, distinct P3 cache key, moss/detail clone cases, stable geometry and instance hashes. Independent pre-edit source comparison covers 96 palette0/1/2 combinations (rock/plant, light on/off, detail, moss): shader text, cache key, metadata and relevant uniforms exactly unchanged. GPU and visual acceptance are pending parent review; these are Node checks only.

Source frozen after these checks. Files changed: mountainLightField.js and test_mountain_light_field.mjs. Tests that intentionally cover old default options now explicitly request citadelMountainRelease=0; published defaults are checked elsewhere.
