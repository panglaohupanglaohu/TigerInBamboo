# Read-only drawing-source audit

Actual checked entry: TigerMessenger/AGENTS.md and current STATE.md. The requested /Users/panglaohu/.agents/skills/threejs-game-director/SKILL.md and its directory are absent on this host; no claim of loading the threejs skill. No production source mutation in this audit. CPU-only diagnostic `tests/world/swampDrawCensus.verify.mjs` builds seed7711, updates to 6 seconds, installs current Harbor with both original boats, and counts material-visible + ancestor-visible source surfaces. Artifact: `draw-source-census.json`.

## What the factory actually submits in principle

903 eligible visible mesh nodes, 1,183,660 triangles before camera culling and shadow passes. 193 ink nodes account for 216,466 triangles. These are CPU scene-graph totals, not GPU draw calls; renderer material groups, instances, camera culling and shadow passes differ.

The initial count of 1241 surfaces mistakenly omitted material.visible; this was corrected before any proposed implementation. In particular all 223 original v2-curved-rim-branch meshes have material.visible=false and their geometry is already present in 11 greg-coral-trunk-render-batch meshes. Rebatching those sources would duplicate geometry. Roots likewise already have nine render batches. No new branch batch is justified.

- ten fan crowns: 306,504 triangles, ten surfaces, already batched;
- branch/trunk batches: 49,232 triangles, eleven surfaces;
- bowed-root batches: 10,368 triangles, nine surfaces;
- fine-animal ink shells: 193,804 triangles, 54 surfaces, active animal animation and screen-width shader callbacks;
- one actual coral longship: 66 visible surfaces, 98,204 triangles, no inverse-hull ink nodes; WarshipV6 already combines static material groups and instances dynamic originals;
- one classic longship: 70 surfaces, 82,474 triangles; same render architecture.

The two ships are not responsible for thousands of draw calls. The high triangle count of crowns is real but cannot be addressed by static batching because the ten crown surfaces are already combined; any retessellation needs explicit silhouette/vein comparison, not a hidden-object FPS claim.

## Low-risk next decisions after formal frame attribution

1. Root's formal full-scene one-frame source histogram is required to distinguish lake, bookshop robots, far buildings and shadow draws. CPU lake totals cannot explain 6500–8200 actual full-scene calls alone.
2. Current robot models already perform static merges inside independent articulated joints. Existing same-type three-actor batching reduces calls but added matrix/update cost and widened bounds: formal combined trial was 17.9 FPS versus 18.6 default. Keep it disabled unless a new attributable bottleneck and verified improvement appear. Do not repeat that old candidate as a completed fix.
3. If a large set of identical static metal detail leaves is found by the formal histogram, retain source nodes/raycasts and use render-only batches inside one current rigid joint or small spatial cell. Preserve original geometry-local positions for wornMetal's vAlloyPosition; preserve exact material, cast/receive-shadow, layers, order, source visibility and dynamic ancestors. Never merge transparent stencils, muzzles, suspension, cup, unknown hooks or independent pivots. New source ownership needs root coordination.
4. The only currently owned Harbor submission candidate is each existing monkey tool's static shaft + head/carried timber, two small surfaces into one vertex-colour surface under the same original moving tool group. This saves at most six submissions and is too small to prioritize as a full-scene fix. No implementation or GPU improvement is claimed.

No character, crown, ship or target-composition geometry has been hidden or simplified in this audit. Formal root GPU before/after attribution remains the next evidence.

## Formal histogram interpretation correction

Read `full-scene-draw-source-gpu.json`: mesh onBeforeRender buckets total 1881 callbacks / 2,859,840 nominal triangles, while renderer.info reports 4768 calls / 7,445,774 triangles. The difference is not yet a measured shadow share.

Specific local source evidence:
- main.js sets renderer.info.autoReset=false (line 178), resets at the beginning of its own frame (line 1953).
- current review.html's drawaudit onclick manually calls renderer.render without resetting info first. Thus the reported renderer count includes pre-existing main-frame work plus the extra manual render. The bucket callbacks cover only that manual render.
- diagnostic wraps only isMesh nodes, missing Lines, Points and Sprites.
- Three's transparent DoubleSide path calls onBeforeRender once but renderBufferDirect twice (vendor/three.module.js 16282 onward).
- shadow draws invoke onBeforeShadow and renderBufferDirect directly (vendor/three.module.js 8690 onward), bypassing onBeforeRender. Because this app uses autoReset=false, actual shadow draws would be retained in a correctly reset one-frame renderer count.

Therefore neither 2887 calls nor 4,585,934 triangles can currently be attributed wholesale to shadows. The root was notified to reset info immediately before a controlled diagnostic and temporarily wrap renderBufferDirect, record renderer.info.render deltas per call, distinguish scene===null shadow pass, preserve original callbacks and restore all wrappers in finally. Record actual lines/sprites too. Diagnostic overhead is not an FPS measure.

Observed mesh bucket names are still useful: swamp 744 callbacks/1.152M nominal triangles, whole bookshop district 407/1.002M, live robot operations 294/155850, tram112/266448. `bookshop-steampunk-robots` is the whole ground/plaza/three factories/harbor/three display robots, not solely robot bodies. Do not optimize all of that label as if it were robots.

Actual benefit candidate selection remains contingent on corrected attribution. If shadow passes dominate, first inspect which real light cameras/caster clusters submit repeated geometry; preserve caster shadows rather than globally disable shadows. If main bookshop/robot draws dominate, existing rigid-joint material merges and prior cross-robot batch must be considered before implementing another duplicate batch. No new source changes or claimed FPS gain in this follow-up.
