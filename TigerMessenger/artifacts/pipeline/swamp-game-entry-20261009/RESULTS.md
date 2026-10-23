# Factory-to-production whale integration — 2026-10-09

## Result

The whale model factory and formal swamp use the same `buildBelugaWhale` function in `src/world/moebiusSwamp.js`. The builder is exported as `SWAMP_COMPONENT_BUILDERS.whale`; the production swamp directly calls it for the adult, pup, and shipyard escort. Its closed continuous body, rounded fins, side eyes, and mouth are therefore production geometry, not review-only geometry.

The production entry had a stale fixed `main.js` cache key, and the lake tour camera was buried behind the canopy. `index.html` now uses `20261009-swamp-production-factory` so a fresh page load fetches the current scene module. The optional `?tour=swamp&autostart=1` camera now sits inside the bowl and frames the swimming whales. This tour camera affects only that URL; the normal story start and saves remain unchanged.

## Live verification

Reloaded the actual game page at `http://localhost:8931/TigerMessenger/?tour=swamp&autostart=1`, waited for world initialization, started the game, and visually verified the production scene. The screen shows both whale instances in the lake among lotus boats, boys, and the central tree. The review factory is not the page being used for this check.

## Checks

- `node --check src/main.js`: passed.
- `git diff --check`: passed.
- Whale geometry test (`swampCoralActors.test.mjs`, name-filtered): passed.
- The broader three-file run finished 13/15 passing. The remaining failures are outside this entry/camera change: `swampBridgeFormalStartup` cannot complete its Node shim fetch, and an older factory story-anchor assertion expects a different feeder-raft location than the current source. These were left untouched.
- Live game HUD reported about 10 FPS during this visual check; no performance-pass claim is made.

## Recovery copies

`source-before/index-before-factory-cache-bump.html`, `source-before/main-before-visible-swamp-tour-camera.js`, and `source-before/main-before-whale-focus-camera.js` preserve the files before these edits.
