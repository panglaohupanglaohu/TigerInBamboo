# Vegetation and terrain-cloud method boundary — 2026-09-30

The existing research ledger is partial. No additional claim of having watched complete talks or the 545 X media entries is made.

- Oskar's 2022 grass experiment discusses billboards and contrast-dependent outlines/depth: https://x.com/OskSta/status/1590669875869286400 ; previously read author-text mirror: https://threadreaderapp.com/thread/1590669875869286400.html . Previously sampled frames visibly show contiguous ground colour plus fine clustered plant silhouettes. This is a later experiment, not proof that Bad North or Townscaper shipped this exact shader.
- 2024 tree/cloud candidate links remain incomplete evidence: https://x.com/OskSta/status/1849427564034498642 and https://x.com/OskSta/status/1852421920219635966 . Existing notes mention public repost text about shared impostor representations, but do not establish the complete shader, atlas, depth, lighting, or simulation method. Do not call the implementation here Oskar's original algorithm.
- WFC chooses compatible modules. It does not by itself simulate growth or advect clouds. Shared final-surface sampling, habitat fields and protected corridors are this project's engineering design.

## Cloud changes

The old cloud sampler read a static baked heightfield from before the terrain changes. `ridgeFlowClouds.js` now waits for `mountainStudy.js` to publish final meshes and protection inputs. `ridgeCloudField.js` builds an 8-unit low-frequency cache from actual rendered rock raycasts; the animation only reads that cache. No per-frame terrain raycasts.

The cache rejects sea/submerged samples and reserves 32 units around sampled railway points, 22 around protected architecture/path boxes. All four cell corners must be valid for interpolation. Unknown/boundary cells return no support and particles become invisible there. Modest wind and contour gradients drive slower, smaller 384-particle mist; the existing generated puff texture remains compatible. This remains a transparent billboard implementation with depth testing, not a reconstructed volumetric impostor renderer. It also is not a fluid simulation.

Positions use the sampled castle-local surface height and local radial lift; they no longer reinterpret old radial HF values as final land heights. Rebuilding from new mesh geometry refreshes the cache. Rendering extent and coarse-cache safety are conservative; runtime screenshots must confirm that enough suitable mist habitat remains, that skyline readability is preserved and that projected haze does not cover important city views.

## Tests

`tests/world/ridgeCloudField.test.mjs`: both tests pass. Checks affine height/gradient interpolation, rejection of incomplete cells, zero additional callback calls during repeated animation queries, refresh after actual mesh rises seven units, and exclusion of the actual railway neighbourhood. Main-agent runtime checks remain necessary for city visibility, final cloud cell count and visual quality.

## Visibility follow-up

First runtime cache contained 68 valid sample points and 29 spawning cells, so it was not empty, although the overview showed little foreground mist. Added active/unsupported/alphaSum and spawnBounds diagnostics. Cloud lift now uses the maximum of its four valid cached corner heights plus radial lift, to reduce underestimation around convex ridges. This is a conservative corner envelope, not a proof of exact sub-cell clearance: a peak between samples may still exceed it. Protected cells and exclusion distances remain unchanged. Final visibility remains a runtime screenshot check.

## Verified frame bug and correction

Runtime `cloud-diagnostic.json` confirmed the cloud mesh inherited an x=-52 translation from the early composition pass. Cached particle positions were already in the final castle frame, so shader modelViewMatrix applied that offset a second time. A sampled maximum-alpha particle's actual and intended world centres were 52 units apart; the actual centre was about 19.74 units below the ray-hit rock surface. Active-particle counts alone had hidden this problem.

The update now explicitly transforms castle-frame particle positions into the cloud mesh frame with inverse(mesh.matrixWorld) × castle.matrixWorld. A regression test covers a rotated and translated castle with a -52-offset child mesh. All three cloud tests pass. Capture cameras must subsequently interpret iPos with mesh.localToWorld, not castle.localToWorld. The final screenshot check records actual world-position railway distance, terrain gap and page errors; it does not alter any image pixels or change the cloud exclusions.
