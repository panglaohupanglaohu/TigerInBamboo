# Main island redundant edge cleanup — 2026-10-26

Scope: new standalone `src/world/mainIslandEdgeCleanup.js` only. No Morris, scene, main, hills, platforms or existing R4d files edited.

Actual screenshot inspection: supplied clipboard PNG shows a large low green surface with an abrupt right-angle edge beside the rail and moon/pines. Source diagnosis: platforms.js creates a halfwidth72 square shell (plus ramp), while hills.js defines the principal island radius72 and independently raised camp/bookshop. This mismatch provides a specific redundant apron without guessing an angle from the screenshot. Hills' rectangular grid alone does not justify deleting hills.

Implementation owns only r>72.35m, within actual measured shell radial extent, |flat x/z|<=90m, and analytic source lift<=.61m. Existing installed R4d ownership remains excluded. Collider footprints plus 1m margin (minimum2m), and near-ground sampled rail corridors radius3.8m are excluded. Source meshes remain intact. A finite 1024px nearest-texel texture drives matching visible/depth/distance shader masks and support wrappers. Shader masking has an additional finite radial depth window R-2..R+1.2; no global ocean or replacement invisible floor is generated. Low redundant support returns -Infinity. The mask does not remove high mountains or any unrelated object.

Integrate after `installMoonLakeSceneGarden` and actor/forest collider collection:

```js
import {installMainIslandEdgeCleanup} from '../world/mainIslandEdgeCleanup.js';
const mainIslandEdgeCleanup=installMainIslandEdgeCleanup({platforms,hills,colliders,
 trackCurves:tramSystem?[tramSystem.curve,...Object.values(tramSystem.curves||{})]:[],R});
```

Caller may retain returned report/dispose hook. Installation is idempotent on hills. Disposal restores all old materials, shadow hooks and support functions. If objects without colliders need a protected footprint, add their world position/radius to the collider input copy; no actual scene movement is required.

Validation: test.mjs builds actual buildWorld/buildHills plus existing R4d, then runs12 source-geometry, support, rail/collider preservation, shader-composition, finite-scope and rollback assertions. All pass. Fixture mask texel size .213m; this describes mask precision, not a measured performance improvement. No GPU compile/render, scene integration, dynamic actor traversal or same-camera before/after check was performed by this advisor. Root owns browser verification. A protected narrow rail land corridor may remain where the removed apron formerly supported it; that is deliberate support preservation, not proof of final aesthetic acceptance.

JEV: actual compact-text call returned jev-1.14.0,1106 input/91 output tokens,cache_hit=false. Its review recommendation and missing GPU check are saved. It did not inspect pixels, edit assets, or grant visual acceptance.

This is a local engineering diagnosis, not a claim about an Oskar implementation. The applicable skill's shared ownership/finite protected-boundary principles informed the implementation.
