# Citadel vegetation — 2026-09-29

Implemented in the live world, retaining the accepted terrain geometry and city layout.

- 225 cypress placements and 393 shrub placements; 618 supported roots, zero missing support.
- Groundcover: 508 supported rock triangles, approximately 882 square scene units. Uphill faces only; wet foot, steep cliffs and high tops excluded. Expanded triangle footprints avoid railway and protected structures.
- 23,049 railway probes: zero hits and zero wet-track samples. Protected structure signature unchanged: 514 meshes, 59,267 vertices, hash 3924031306.
- Two groundcover unit tests passed. No runtime page errors. The three pre-existing terrain/parcels/lighting warnings remain unchanged.
- Visually inspected overview and cloud-disabled ridge screenshots. Cypress and scrub now read across the middle shoulder. Grass is still subdued at overview distance; no claim of lush forest coverage or the original Oskar grass shader.

Before images are the accepted landform round. Original planting source is preserved under source-before/. Remove the groundcover call/import and restore that snapshot to undo this batch.
