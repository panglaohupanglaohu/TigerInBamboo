# Actual name alpha / sea-level review and narrow fix

Owned source: only installLeeBaiHullNames patch coordinates in src/world/bookshopFreighterHull.js. Original restored source in source-before/. Hull vertices, palette, factory, equipment and transforms not changed.

Measured actual native Songti SC / serif Canvas alpha pixels and their actual24x12 UV-triangle positions under production matrixWorld. Both continuous world authority R+officialOceanLevelAt and exact radial intersections with the compiled72x48 actual ocean triangles are used. Chinese93569 pixels and English25149 pixels per side; ratios are alpha-weighted, not concept-art estimates.

## Before

| Side | Chinese above authority | English above authority | English above triangle ocean | Lowest English authority height |
|---|---|---|---|---|
| -1 | 100.00% | 2.81% | 6.01% | -1.585770m |
| 1 | 100.00% | 4.14% | 8.23% | -1.589282m |

English was significantly submerged. Final patch moved/contracted to localY=-0.05..-0.65 andZ=7..8. FormerZ=5.75..8,Y=-0.08..-1.44. Contracted both dimensions in near-original aspect ratio (1/0.6=1.667 versus2.25/1.36=1.654), to avoid squashing letters with a Y-only compression. Actual large Chinese on top / smaller LeeBai below texture remains unchanged. Patches still conform to current beamAt and independently checked actual triangle shell offsets.

## After

| Side | Chinese/English above authority | Chinese/English above triangle ocean | Lowest English authority height | Lowest English triangle height |
|---|---|---|---|
| -1 | 100% /100% |100% /100% |2.670150m |2.840230m |
| 1 | 100% /100% |100% /100% |2.668269m |2.878248m |

All opaque glyph pixels exceed the conservative shader0.067m wave plus0.275m bob bound at base placement. Actual shell ray regression remains passed: name vertex side offset 0.028010..0.048008 ship-local units, both maps preserved and three original legacy boards retain Chinese/English replacements. Hull manifold/footprint/quay regressions passed.

## Boundaries

This predicts water coverage from geometry and alpha, not camera visibility, perceptual font legibility, curvature foreshortening or GPU transparency. The narrower lettering is still world-sized about5m wide by3m high overall; only actual GPU screenshots can accept visual readability. GPU controller unavailable; no visual acceptance claimed. Exact radial actual-ocean triangles are sampled via their angular cell and adjacent cells, using actual compiled vertex arrays.

Files: name-before-cpu.json, name-after-cpu.json, hull-name-regression-cpu.json, copied bookshopFreighterNameWaterline.inspect.mjs, source-before/bookshopFreighterHull.js. Formal test source tests/world/bookshopFreighterNameWaterline.inspect.mjs.
