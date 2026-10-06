# Coastal geometry advisor report — 2026-09-29

## Evidence and limitations

Conference coverage remains in `artifacts/research/oskar-engine/conference-study.md` and `conference-coverage.json`. No complete conference video was watched; failed YouTube player screenshots are not learning evidence. Beyond Townscaper's public mirrored transcript was partly read, with provenance and limitations recorded separately. No remote video downloaded.

Actual photographic pixels were reviewed using the parent-produced browser screenshot `/tmp/twelve-apostles-reference-browser.png`. Source: https://offloadmedia.feverup.com/secretmelbourne.com/wp-content/uploads/2023/12/08154739/new-lookouts-port-campbell-national-park.jpg . This is a third-party published photograph, **not an official Parks Victoria image**. Observation: thick freestanding stacks, broad blunt fractured tops, horizontal beds interrupted by vertical joints, shallow undercuts/darker wet feet, low scrub on cliff tops; shoreline stacks need not all have tall attached terraces. The requested blue-grey palette derives from the user's target illustration rather than the warm limestone colour in that photograph. Official coastal descriptions researched earlier and this photo observation are distinct evidence.

## Implementation

`src/world/seaStackCoastalGeometry.js` replaces radial rings with three overlapping authored scalar slab volumes (main remnant, asymmetrical cliff shoulder, low toe). A deterministic 18 × 32 × 18 grid and marching tetrahedra extract one connected closed surface. Geometry is indexed, position-welded at 1e-5, and has area-weighted normals. Actual planar upper ledges remain for raycast-supported vegetation. This surface algorithm is **not WFC**.

The existing one-dimensional six-role WFC selects among 12 modules with only three valid combinations. Its lower, terrace, upper, shore and crown parameters now drive profile width, shoulder height/width, upper retreat, erosion depth and top respectively. Narrow terrace makes a tall isolated remnant with a small low shelf; jointed lower cliff makes a lower double-shoulder remnant; wide terrace makes a shouldered stack. Seed changes orientation, bedding silhouette and ledge elevation. Lateral composition is authored, not a 3D WFC solver.

Fixed the initial blue holes using each tetrahedron's planar cut normal rather than the nonlinear union-field gradient; welded corner-coincident vertices and removed collapsed-index faces. No DoubleSide workaround. Bottom closure stays at -height/2; actual measured footprint is exposed for placement checks. Shader and layout are parent-owned and not changed by this helper work.

## Verification

`node --test TigerMessenger/tests/world/gateSeaStacks.test.mjs TigerMessenger/tests/world/seaStackCoastalGeometry.test.mjs` passes both tests. The original 27-seed deterministic/finite/closed/envelope test is unchanged in strength. New 40-seed test verifies one connected component, every shared edge oppositely directed, positive signed volume, nontrivial genuinely upward ledge area, bottom plane, footprint <15 for r12, and <10,000 triangles per rock. Three variants observed; maximum 9,480 triangles, maximum measured construction 36.3ms in this test run (machine/run dependent).

Parent inspected isolated front/white/side renders and is responsible for final whole-scene gate-left, railway, plaza and planted-root checks. Earlier `sea-stacks-bad-north/module-checks.json` describes the retired ring revision; its area/count values do not describe this helper.

Geometry frozen after tests; no changes to seatTerracedSeaStacks.
