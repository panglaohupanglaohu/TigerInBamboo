# Actual startup support adapter

Version: `east-crossing-startup-support-1`. Default off. This is a startup transaction adapter, not a main entry-point installation or GPU acceptance.

## Input and startup order

Import `createTargetEastCrossingStartupSupport` from `src/world/citadel/targetEastCrossingStartupSupport.js`.

1. Construct the tram with the enabled crossing option. Keep its pending group hidden and do not start animation.
2. Build the mountain with `tramSystem.bootstrapCurves/bootstrapRelease`; install its exact artifact after production refinement and before any surface consumers.
3. Construct hills, planet, ocean, and runtime using the final terrain and new consumer curves. Runtime must be attached to the actual castle and register its source surface bindings.
4. Prepare this adapter using the actual attached objects:

```js
const support = createTargetEastCrossingStartupSupport({
  enabled: true,
  scene,
  castle,
  tramSystem,
  runtime,
  planet: scene.getObjectByName('planet-surface'),
  hills, // actual { mesh, skirt }, not an analytic substitute
  ocean: scene.getObjectByName('planet-v8-curved-ocean'),
  radius: 160,
});
try {
  support.commit();
  // Complete the startup's other reversible checks before finalization.
  support.finalize();
} catch (error) {
  support.dispose();
  throw error; // reject startup; caller owns restoring its old configuration
}
```

The adapter finds the actual runtime group `citadel-target-cliff-transit-structure`; it passes that object to `tramSystem.prepareCrossingSupport`. It does not build another city or rail curve. Native tram checks still verify the generated old-source deck interface and actual support/vehicle geometry.

## Actual sampling and strict binding

- The mountain must be the original named source Mesh with an installed strict startup handle. `mountainStudy.exactRemesh` must be the same strict report object. Its source epoch must match the bundle artifact.
- Final source position/index bytes are independently compared to the artifact transformed into that actual source frame. A boolean installation report alone cannot satisfy this check.
- Ground indexing includes actual final mountain, `planet-surface`, `hills.mesh`, and `hills.skirt` triangles in WORLD space. Rays point radially toward the world origin. There is no constant ground fallback or castle-local vertical sampling on the back hemisphere.
- Ocean indexing uses actual ocean triangles and a temporary copy displaced radially by the production shader upper bound `.045 + .022 = .067` in local units. The actual shader, ocean water kind, centered transform, and positive uniform world scale are checked; world wave displacement is `.067 * scale`. Nonuniform scale is rejected. Both triangulated ocean height and the continuous official ocean upper envelope are supplied to the support factory.
- Before commit and finalize, fresh checks verify actual curve identities, source identity, runtime/terrain sampler binding, geometry attribute identity/version/content hash, material side, draw range, group ranges, matrices, and city Mesh identities. Even an array mutation that forgot `needsUpdate` rejects the transaction.

## Ownership and rollback

Preparation owns only temporary indices and one temporary ocean-wave geometry. It borrows all actual materials, terrain, runtime, hills, ocean, and tram. It does not dispose these borrowed objects.

`commit()` publishes the native prepared support transaction. A failed freshness check before or immediately after commit rolls it back and releases adapter resources. `rollback()` and pre-finalize `dispose()` restore the native pending supports and hidden/pause state; they are idempotent. `finalize()` verifies freshness again, lets the native transaction release its provisional supports, and releases all adapter temporary resources. After finalize, adapter `dispose()` does not dispose the active tram. Full shutdown remains the caller's `tramSystem.dispose()` / runtime shutdown responsibility. Rollback after finalization explicitly rejects; callers must finalize only after all reversible startup checks succeed.

## CPU evidence and limits

Command: `node --test tests/world/targetEastCrossingStartupSupport.test.mjs tests/world/targetEastCliffStartupTerrain.test.mjs`.

Result: **7 passed, 0 failed**, approximately 34.3 seconds. The actual-final fixture produced 3,915 ground queries and 5,926 sea queries, with zero missing samples. It used the production refined source epoch `2638422502`, strict source-Mesh installation, native tram factory, actual planet/hills/ocean geometries, actual candidate city structure, and real candidate sampling callbacks. Prepared, committed, rolled-back, and finalized paths were exercised. Stale geometry, stale city binding, malformed water kind, nonuniform ocean scale, and city replacement rejected without leaving the new support transaction active.

Saved measurements: `startup-adapter-cpu.json`.

The runtime object in this CPU fixture implements the runtime public binding contract around the actual candidate. It does **not** simulate original actor relocation, the whole main startup lifecycle, browser rendering, or continuous player movement. Main integration and GPU remain unverified. `accepted` remains false; `installed` in the saved report describes only the tested CPU transaction.
