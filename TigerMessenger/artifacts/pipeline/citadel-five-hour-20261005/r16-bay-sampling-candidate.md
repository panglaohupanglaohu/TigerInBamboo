# Bay surface sampling candidate — not visually accepted

`citadelBaySurfacePass=1` is opt-in; absence/0 retains the former bay mapping. The implementation refines only verified original top faces 4536, 4317, 4097 before the existing nonlinear bay transformation. Exact source positions (2e-5 tolerance) and zero `shoreBoundaryBottom` identity must match; mismatch skips the candidate. It does not move original vertices or alter the map, city, bridge, or rail transformations.

Three parents receive n=16 barycentric sampling, with shared edge indices. Six adjacent original faces use conforming transition fans. All original attribute arrays remain exact prefixes, including fixed coast identity. Source triangles increase 17,860 → 18,742 (+882), vertices 10,953 → 11,394 (+441). Pure Node construction measured about 7 ms on this machine; this excludes subsequent landform/relief rebuild and rendering.

`tools/pipeline/test_citadel_bay_surface_sampling.mjs` passes: source signature rejection, deterministic output, all original attributes and bay-mapped positions exactly unchanged, unchanged boundary-edge set, no new nonmanifold edges, raw child winding and summed parent area preserved. The test reproduces the actual exported castle matrix.

357 local vertical probes on the three parent patches report multilayer hits 98 → 0. Including six transition parents reports 156 → 67, with identical total covered probes (354). The three-parent footprint itself changes from 208 to 105 covered probes because accurate nonlinear sampling no longer stretches the parent chord across the same area; it must not be reported as equal coverage. Residual transition folds are real and are not hidden by this report. This candidate does not prove global injectivity or safety against all city/rail geometry: actual scene hash, track, support, and same-camera visual checks are still required before acceptance.

This is a local sampling correction to this project's nonlinear bay deformation, not Oskar's WFC implementation or a full mountain remesher. No renderer or lighting changes were made here.
