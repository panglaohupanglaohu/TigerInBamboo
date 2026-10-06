# Old city v11 — three small street clusters

Compared `marked-stacked-live-front-day.png` with the approved `target-v11-smooth-east-connection.png`. The actual old city leaves a large upper-left terrace empty and its other rows read as isolated tall rooms above pale arcade bands. This change adds six real low modules within existing supported space. It does not claim to achieve the target's density or score before GPU review.

Source: `src/world/citadel/targetOldCity.js`. Version: `target-old-city-11-three-street-clusters`. New factory option `streetInfill` defaults to `true`; pass `false` to reproduce the previous mesh buffers, transforms and colours exactly. The pre-change source is preserved here as `targetOldCity.before.js`.

Three clusters in old-city local coordinates:

- Upper left: two connected, low yellow/teal homes at `[-16.65,8.3,-10.9]` and `[-11.9,8.3,-10.9]`, each 4.55 × 4.35 m, walls 3.45/4.1 m, shallow orange hips. A solid party-wall connection spans their 0.20 m wall gap. Existing terrace deck carries both.
- Middle left: two 1.80 × 1.45 m low rooms attached to `house-1--1-1`, on its existing 2.85 m arcade slab. The central private gallery band and lower through-arches stay open.
- Lower right: corresponding two low rooms on `house-0-1-1`. These reclaim private gallery corners, not the public terrace street. Reports explicitly identify the reclaimed private corners.

All rooms use actual bevel walls, shallow hipped roofs and small white window frames with the existing palette. Existing windows obscured by attached rooms are suppressed during generation. New window/roof/wall geometry is batched into the same owner/material when possible. The two upper homes share six material batches. Performance counts: **268 → 274 meshes**, **25,312 → 25,828 triangles**, **9 → 9 materials**. These are CPU geometry counts, not measured draw calls or frame-rate results.

Preserved: the 15 editable plot IDs and footprints, five implemented roof roles and WFC domains, tower position/33 m height/all 20 tower windows, gate, 40 central steps, public terraces, bridge exit and waterfall-feed port. Public mesh buffers and transforms are byte-equivalent. Four attached rooms belong to their house group and participate in hide/colour/undo through existing wall-material tags. The two upper homes are protected static infill; they are not added to the WFC/editor domain.

Validation: **47 tests passed, 0 failed**, across old-city model, roof WFC, roof session and entity editor suites. New checks include **54 actual terrace/arcade slab support probes**, unchanged overall bounds and plot footprints, finite geometry and disposal, exact geometric rollback, all five legal role overrides on an infill host, and house colour/delete/undo. Existing forward street/body rays, gate through-rays, lower arcade through/side passages, upward tower sightlines and house separation checks remain passing.

CPU report: `cpu-report.json`. No browser actions, GPU integration or new screenshot was performed. The parent should reload the factory dependency and compare the same live daylight view; foreground coverage may hide some low wings at long range. This is a limited six-module density change, not an entire new urban layout or proven completed navigation. No terrain/runtime/main/structure or unrelated agent files were edited. Source ownership returned after delivery.

## Root GPU follow-up 12:54

Normal homepage reloaded actual old-city11. Saved `live-front.png/json` and `live-old-city.png/json`; inspection time .49, glError0/gpuFailures[], console errors[]. Two upper homes visible; four attached wings subtle at panorama distance. Overall density, wide terrace frontage and cloud shape remain unlike target; no new score or acceptance. Runtime2 also loaded, but no controlled FPS comparison. Afterwards restored daySpeed .4 by UI and restored player camera; player remained bookshop.
