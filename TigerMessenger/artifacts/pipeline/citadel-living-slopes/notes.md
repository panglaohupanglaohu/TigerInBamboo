# Citadel living slopes — 2026-09-30

Implemented in runtime. The advisor researched existing primary-source records and owned the final-terrain cloud field. This is a project interpretation, not Oskar's original algorithm or a full impostor/depth-atlas implementation. See advisor-cloud-method.md for source links and evidence limits.

## Vegetation
Shared low-frequency habitat field drives turf and woodland clusters. Terrain triangles provide exact short-grass roots. Known reversed-winding authored mountain sheets have their copied turf orientation repaired; original rock vertices are unchanged. Arbitrary downward faces still rejected. Seven focused tests passed across groundcover and cloud cache.

272 trees; 459 shrubs; 8000 short-grass instances; 7170 turf triangles covering 6762.9 square scene units. Opaque short grass uses normal depth testing and lighting, not Oskar's background-contrast billboard shader. Tree prototypes retained. Coarse source triangles leave angular patch edges; this does not recreate a lush continuous landscape everywhere.

## Cloud
Old baked HF removed. Final mesh cache uses 682 samples, 68 valid points, 29 spawning cells, 384 particles. At capture 354 active, 28 unsupported and suppressed. Four-corner maximum is a conservative lift heuristic, not exact continuous terrain clearance. Wind/contour advection reads cache, no per-frame raycasts. Clouds remain restrained/partly terrain-occluded in the main city view. Not WFC fluid simulation and not recovered author source.

## Runtime checks
23,049 rail probes: zero hits, zero wet-track samples. 731 root checks: zero unsupported. 514 protected structural meshes / 59,267 vertices retain hash 3924031306. No page errors. Three existing terrain/parcel/lighting warnings persist unchanged. Runtime frame snapshot is not an FPS benchmark.

Actual overview and cloud-disabled ridge images inspected; short grass is visible along supported ledges. Before images are prior vegetation batch (predating the separate small tower crown correction). First candidate rejected for underplanting from reversed winding; preserved in candidate1. Close-up captures additionally show turf and cloud habitat.

## Files / rollback
Original planting, groundcover and cloud files retained in source-before. New mountainHabitat.js, mountainGrass.js and ridgeCloudField.js; mountainStudy now refreshes clouds after final terrain. To roll back restore snapshots and remove the refresh import/call/metadata from mountainStudy. No Blender or Godot assets re-exported.


## Final cloud coordinate repair
Final rendered cloud mesh retained composition translation -52; shader inputs were already final castle coordinates. Added explicit castle-to-cloud-local conversion, verified by transformed-frame test. Final close-up and overview inspected: clearly visible valley mist, cities and rail remain clear in these views. Cloud diagnostic: no page errors, nearest active cloud centre to rail about61.05 units. 8 total tests pass. This supersedes the earlier thin/occluded-cloud diagnosis above; other archived intermediate views predate this fix. Final images: cloud-fixed.png and cloud-fixed-overview.png.
