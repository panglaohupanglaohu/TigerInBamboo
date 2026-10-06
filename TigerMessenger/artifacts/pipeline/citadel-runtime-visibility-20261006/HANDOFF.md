# Runtime visibility reference cache

Scope: `targetCityRuntime.js` and its dedicated tests only. No candidate, structure, main, terrain or browser changes. Runtime version is `target-city-runtime-2`. The previous source is preserved in `targetCityRuntime.before.js` in this directory.

The confirmed hot-path work was repeated UUID resolution, not a measured primary cause of the reported 7–10 FPS. Both `runtime.update()` and the wrapped distance-culling update enforce visibility. Previously each enforcement allocated a combined report array and called recursive `castle.getObjectByProperty` separately for every turf/decorations record.

Now installation and explicit `refresh()` collect requested UUIDs, deduplicate them and resolve them in one castle traversal. Enforcement retains the same execution points and only uses cached references. `refresh()` binds after culling recollection, rereads changed report lists, discovers newly attached UUIDs, and drops stale detached/replaced references. Missing UUIDs remain unresolved until a subsequent refresh. Callers that change suppression reports or replace their objects must call `refresh()`; ordinary frames deliberately do not discover layout changes. Existing cloud references and legacy references retain their original visibility/ownership contracts.

The runtime does not restore report-only decoration visibility itself: those materials/appearance factories still own their restoration. Failed installation and normal disposal clear the new cache. Live actor visibility is not captured or rewritten by the per-frame cache. The culling wrapper still preserves arguments, receiver, return value and its `finally` enforcement.

Validation: `node --test tests/world/targetCityRuntime.test.mjs` — **10 passed, 0 failed**. Existing real landmark migration/rollback, active-horse teardown guard, resource disposal and update-error checks remain. New tests verify changed/missing UUID lists, identity replacement, late attachment during recollect, dynamic actor visibility and disposed-cache inertness.

Operation-count evidence on the same test scene, with 256 additional kept nodes and duplicate suppression records: 200 prior-algorithm enforcement equivalents caused **159,800 recursive search visits**. 100 runtime updates plus 100 wrapped culling updates caused **0 UUID search visits and 0 tree traversals**; the thrown-update path also performed none. This is a deterministic CPU work regression, not a production timing/FPS benchmark. No GPU or browser measurement was performed. The per-frame O(number of hidden references) visibility assignments still exist.

Source ownership is returned to the parent. A new page load/import cache revision may be needed for the running browser to consume the changed runtime; no integration import was edited here.
