# Junction WFC passage candidate

Status: **default off, visual structure experiment; not approved for player traversal**. This consumes the existing real region WFC solution. It is not a new city generator or a reproduction of Oskar's private engine.

Review: `http://localhost:8931/TigerMessenger/artifacts/pipeline/canal-junction-editable/live.html?junctionWfcPassage=1`. Reuses the existing live editor harness. Choose “查看 WFC 贯通拱门” for the first arch, “全城视角” for the whole junction. The existing editor target, right-click delete, Undo/Redo remain available. The harness does not invoke Save. Main-scene query: `?junctionWfcPassage=1` (with junctionEditable left enabled). Omit it or use `0` for the unchanged default route.

## Actual change

The 11 region footprints, original 398 occupied cells, layer heights, region seeds, and foundation geometry remain fixed. Existing WFC assignments contain 23 `body.passage` cells in six regions. Their actual `rot` and socket direction now select an X- or Z-axis U-shaped solid: two side piers, curved inner arch, and upper load-bearing slab. It replaces that cell's solid box; it is not an arch ornament in front of a box. Interior cells of a passage chain are emitted even if ordinary exposure culling would hide them. The mesh retains its exact cell owner for editing.

Passage cells suppress their old ground-floor door/plinth/decor branch. Legacy upper-story gate groups were also discovered to place their geometry at ground height; such gates are suppressed for passage columns. Adjacent decorative gate-portico columns whose footprints intersect the aperture are suppressed as well. Occupied building cells and other regions are retained. Generic walls/corners and suspended arches remain adjacency-built, not claimed as WFC geometry consumers.

`makeTownRoleOracle` now exposes `assignmentAt` and `passageAt` with the solver's rotation. The scoped `wfcPassageV1` option is forwarded only by the opt-in junction caller; all other towns retain their default. Candidate use with `cornerModulesV1`, warped `gridV6`, or partial dirty-cell builds is explicitly rejected. The junction editor already performs a full rebuild of only its changed region, so these unsupported paths are not used. Save schema and key remain `junction-regions-v1` and `tiger:canal-junction:regions:v1`; assignment is deterministically regenerated from saved occupancy and the original seed.

Before publishing an edit, actual triangle-ray checks cover all candidate apertures plus unchanged neighboring regions and fixed foundations. A blocked candidate is discarded transactionally. These samples do not certify a full solid-volume/capsule sweep or outside approach routes.

## Clearance and inherited support limitation

Actual player constants: height **1.66 m**, radius **0.35 m**. With unchanged 1.70 m cells, these arches provide center height **1.428 m**, width **1.056 m** and a **0.272 m** crown. They are too low for the current player; `playerTraversable` is explicitly false. No collision dimensions were changed to bypass this.

Independent downward ray measurements show **22 apertures** rest on the original fixed foundation at Y = 3.35 (Float32 error about 9.54e-8 m). `left-watchtower / 0,0,1` instead has the original `irregular-quay` 2.70 m below its aperture floor. That inherited footprint/support mismatch is recorded in `foundationSupport`, `fixedFoundationSupported:22`, and the live review warning. This one location is **not accepted as supported or traversable**. Foundations, occupancy, solver seed and layer heights were deliberately not changed to conceal it.

## CPU evidence

`geometry-tests.json`:

- 398 cells, 11 regions, 23 actual arch bodies; initial save data identical to default.
- 552 independent bidirectional interior rays: no box, door, foundation or neighbor decoration hits.
- 69 solid-side/roof/player-head rays: walls and crown remain solid; the player's head height is genuinely blocked.
- 3 complete chain rays through both X- and Z-oriented passages.
- 23 foundation probes: 22 supported, 1 explicitly unsupported as above.
- Both rotated arch geometries closed, finite and nondegenerate.
- Same occupied fixture pinned by the actual solver to plain / passage-r0 / passage-r90 produces three distinct geometry hashes and correctly rotated holes. Invalid upper-floor passage pin fails.
- Delete/Undo/Redo recovers assignment and order-independent geometry hashes, preserves untouched-region identity and foundation identity. Save/reload preserves schema and geometry. A real inserted obstacle rejects publication and leaves state/history unchanged.
- Arbitrarily translated/rotated junction frame and unsupported-context rejection checked.

`lifecycle-tests.json`: 30 delete/undo cycles, 60 region rebuilds, stable retained CPU resources; 5,654 created resources were disposed and shared textures were not disposed. This is not a GPU-memory benchmark.

`default-regression.txt`: prior default editor tests pass, including 1,572 compatible directed WFC edges. Default versus explicit-off geometry hashes also match in the new suite. These do not claim a byte-level comparison against an archived pre-change executable.

Browser/GPU screenshots and visual acceptance are for the parent agent to add after loading the review URL. No save or default publication was performed by this implementation.

## Actual browser evidence

Actual 3D canvas right-click deleted one cell, Undo restored398, Redo returned397, final Undo restored the exact initial398-cell snapshot; Save was not invoked. GPU program samples (up to283) compiled/linked with empty error queues and no captured page errors. `browser-verification.json`, `browser-arch.png`, and `browser-wide.png` record this. The low-clearance/one-foundation limitation remains; this is not promoted to default.
