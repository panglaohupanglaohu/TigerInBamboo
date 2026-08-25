# Planet V8 baseline

This is the production truth table for the spherical natural-world migration. The report source is the Oskar Stålberg terrain/cloud analysis supplied by the project owner.

| Capability | Current V8 source | Consumer | Rollback |
| --- | --- | --- | --- |
| Main/dual spherical graph | `src/procgen/planet/geodesicGrid.js` | planet compiler/WFC | `planetGraphV1=0` |
| Terrain tile WFC | `src/procgen/planet/terrainTiles.js`, `sphericalWfc.js` | field composer | `planetTerrainV1=0` |
| Scalar field/MC | `planetFieldComposer.js`, existing `field/marchingCubes.js` | chart mesh | keep legacy planet mesh |
| Semantics/forest | `terrainSemanticBake.js` | shader/vegetation/nav | `terrainSemanticShaderV1=0` |
| Curved water | `world/waterV8/curvedWaterCompiler.js` | ocean/lake/routes | `curvedWaterV1=0` |
| World routes | `waterRouteFleet.js`, `loadTraffic.js` adapter | boat/logistics | `oceanWorldRoutesV1=0`, `legacyCanalWorld=1` |
| Surface/nav | `surfaceProviderV8.js`, `navigationV8.js` | collision/path/migration | legacy `groundLiftAt` fallback |
| Cloud atlas | `render/clouds/*` | instanced shader | `cloudImpostorV1=0` |
| Worker | `procgen/worker/planetWorker.js` | async compilation | main-thread bounded fixture only |

## Promotion order

`DEFINED → TESTED → WIRED → VISUAL_ACCEPTED → PERF_ACCEPTED → DEFAULT_ON → LEGACY_RETIRED`.

No flag is promoted because a Node test passes alone. The runtime caller records a V8 snapshot, and the old world remains available until route, save, collision and visual gates have evidence.

## Fixed hard locks

Highland terrace numbering/waterfalls/wood horse, Crystal Canyon corridor, Saihoji battlefield and pine keepout, Swamp closed basin, Bookshop–Saihoji hill link, Triple Gate high ground, and old harbor coastal anchor are direction-based manifest entries. They must not be represented only as legacy flat x/z positions.
