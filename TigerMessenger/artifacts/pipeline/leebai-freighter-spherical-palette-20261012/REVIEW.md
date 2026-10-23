# Spherical hull palette review

Read-only production-source review and CPU test. No hull, material source, root, dock or transportation anchor changed by this batch.

Production world vertices now use clearance = world radius - (R + officialOceanLevelAt(direction)); retained dark teal and red transition over -0.35 to +0.15 world metres. This is the same continuous sea authority used by official ocean compilation. Actual ocean geometry was compiled from that same source (72x48 triangle shell).

Default production placement: 424 fully topside vertices, 933 fully antifouling vertices, 37 blended vertices; maximum RGB mismatch from independently computed authority colors 7.1065507e-09. At blended vertices the actual triangle sea lies below continuous authority by 0.053894 to 0.227207 world units. Thus shader-rendered triangle water and mathematical authority are not identical; the vertex wave bound is +/-0.067 world units. Palette is authority-aligned, not a claim of exact rendered water-edge alignment.

A CPU fixture translated the existing parent root radially +1.25 world units BEFORE first update. Colors initially mismatched the new location by 0.220107, then first update repainted to mismatch 7.3700954e-09. Subsequent 1/5/10/20-second bob updates preserved the exact color buffer. Material isolation checked: the hull material is a clone not shared with other meshes; 344 non-hull mesh/material references retain colors and vertexColors.

LIMIT: moving the parent AFTER first update does not trigger another paint. A second +1.25 translation after finalization produces mismatch 0.220107. The one-shot implementation therefore supports external final placement before first update only. It does not support late world relocations or arbitrary reparenting. Small bob color mismatch is documented in palette-cpu.json, expected because per-frame recoloring was intentionally disabled.

Test source: tests/world/bookshopFreighterSphericalPalette.verify.mjs. Full actual authority/triangle/color sample evidence: palette-cpu.json. GPU tools unavailable; visual color band, water transparency and aliasing not accepted.
