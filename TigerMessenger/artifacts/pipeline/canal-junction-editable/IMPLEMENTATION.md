# Canal junction editable regions

This is a project implementation inspired by Townscaper's editable occupancy and neighborhood-dependent assembly. It reuses the project's `buildCitadelTownAssembly` and its WFC role selection. It is not a reproduction of Oskar's private source or a global unconstrained WFC solver.

## Identity and reconstruction

The 11 authored regions in `foundation.json` retain their original world-local positions, 1.6 m cell widths, 1.7 m cell heights, base elevations, initial colors, and seeds. The source's foundation parts remain fixed. A cell is identified by `(regionId, ix, iy, iz)`, never by a merged material part or a global 2 m grid. Each edit constructs a candidate assembly for the changed region before replacing the old assembly. This rebuilds that region's roofs, exposed walls, windows, arches and other owned decorations. Other region assemblies and foundation meshes retain identity. Neighborhood rules do not extend across independent region boundaries; erasing supporting cells does not claim structural engineering simulation.

The former baked version remains accessible with `junctionEditable=0`. Existing legacy custom junction layouts retain their existing loading precedence. New module saves use `tiger:canal-junction:regions:v1` and `junction-regions-v1`, leaving all old keys untouched. Opening, editing, switching instances, undo and redo do not persist anything. Only explicit Save / Ctrl+S writes. Successful unsaved panel drafts and undo stacks are preserved across instance switches.

## Input and collision

Selection chooses the nearest visible hit across registered instances, after a confirmed click rather than on pointer-down. A right-drag cannot switch the editing target. Nested module meshes resolve to their real region/cell; spanning decoration uses its nearest occupied owning cell. Deleted footprints retain region-plane placement. Existing palette controls change color; top clicks grow by one cell; right-click removes one unit. The incompatible legacy global-grid canvas/import/reset controls are hidden for this adapter.

Ground support recursively collects real module meshes and filters hit normals. Wall collision cache rebuilds when the region root revision changes. The editor's camera obstacle cache also tracks this revision. These are existing ray-based collision mechanisms, not capsule-solid physics.

## Verification

Run `node tools/pipeline/test_canal_junction_editable.mjs` from TigerMessenger. It creates real assemblies (3360 initial meshes), verifies nested ray picking, edits, unchanged foundation/other-region identity, undo/redo, bounded cell coordinates, memory-only explicit saving/reload, and deliberate construction failure rollback. `test_citadel_target_picking.mjs` checks nearest visible selection and drag discrimination. These tests do not touch user browser storage.

Browser verification is assigned to the main agent. Read-only diagnostic entry: `city.userData.junctionEditor.snapshot()` and `.revision`. `cellWorld({regionId:'left-front-coral',ix:1,iy:2,iz:0})` gives a candidate world-space roof point; `pick(raycaster)` returns its cell. Verify actual right click, visible neighboring roof change, Undo, Redo, left top growth, and target switching without saving. No claim of completed browser validation is made in this document.

## WFC audit (verified source path and executed result)

`citadelTown.js` calls `resolveTownSelection`, which calls `solveTownSelection`, compiles 22 prototypes into 48 Y4 variants, constructs compatibility tables, applies exposure/height/isolation bans and runs `procgen/wfc/solver.js`. This solver propagates domains, selects weighted alternatives and performs bounded backtracking (64 default). Horizontal graph edges join same-color occupied cells; vertical edges join occupied cells regardless of color. Empty cells, foundation and region placement remain authored/player-owned.

The actual geometry consumers are `partitionRoofComponent` (sloped versus flat roof partitions) and the enclosed garden pass. Body/tower/passage roles are part of the solver vocabulary, but walls/corners/arches/decorations still use the existing occupancy-adjacency builders. Their exact WFC orientation/role is NOT fully wired into geometry. Accordingly this is real region-local WFC selection with partial geometry consumption, not full-city procedural synthesis or arbitrary module replacement. The existing mechanism is reused rather than adding a second solver.

Every constructed nonempty region must now report a successful WFC solution before publication; failure retains the previous region rather than presenting manual fallback as WFC success. `city.userData.junctionEditor.audit()` publishes revision, per-region solution hash, occupancy count, per-cell assignment and explicit geometry-consumer limits. The review UI includes this audit. Tests independently compile the compatibility table and check every assigned neighboring pair: current edited fixture has 398 assigned cells / 1572 directed compatible edges, all pass. Default and edited assemblies both execute the real solver.

## Actual browser verification, 2026-10-05

The main agent used real pointer clicks in the full game: occupancy 398 -> 397 with right click, undo restored the exact 398-cell snapshot, left rooftop click grew to 399, and redo restored that exact snapshot. All five captured states reported successful region WFC solutions and no captured page errors. No Save was invoked. See browser-verification.json and before-pointer / after-pointer-delete / after-pointer-add PNGs. This does not certify whole-game frame rate or GPU memory.
