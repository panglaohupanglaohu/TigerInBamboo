# Morris character pipeline · 2026-10-27

These are actual new Blender-authored candidate meshes, not target pictures and not exports of the old procedural JS character. Production approval is pending the parent agent's normal-entry GPU/riding checks.

## Read and applied

- Courier: `src/assets/characters/courierBlenderV2.js`, `artifacts/pipeline/courier-blender-threeview-20261008/v2/build_courier_v2.py`. The real courier method is reference-led continuous lofts, authored surface details and **named empty pivots**, not existing skeletal skinning. Princess follows that actual workflow.
- Tiger: `artifacts/pipeline/tiger-target-20261009/README.md`, `scripts/build_tiger.py`, `src/assets/characters/tigerSkinV3.js`. Horse follows actual anatomical metaball union, voxel skin, smoothing, decimation and **real armature/skinned mesh**. It uses newly authored horse proportions, not the tiger geometry.
- Viewed approved princess three-view and mounted target, offline new front/side images and parent GPU `component-princess-v1-mounted-side.png`.

## Princess

`assets/models/morris-princess/princess-v1.glb` and `.blend` preserve the first new candidate. `princess-v2.glb` and `.blend` revise hair mass/waves, fitted split riding skirt and shoulder-to-croup cloak in response to actual mounted-side inspection. Source scripts are `tools/pipeline/build_morris_princess_v1.py` and `_v2.py`.

All geometry is metres with the mounted seat at origin and glTF front +Z. Required empty nodes: `body` at origin, `head` at (0,.71,0), `cape` at (0,.48,-.1), `armL`, `armR`. Runtime `animateMorrisPrincess` may safely set body y near zero and head/cape rotations. No skinning claimed. `upgradeMorrisPrincessAsset(root,{url})` hides but retains old geometry and exposes `restore()`.

V2 fixes shape instead of adding decorative parts: two continuous closed-thickness cloth wings follow hips, bent thighs and boots; a seated lap joins them. Cape bends down from the shoulder and has folded relief rather than a straight hanging board. Hair uses a continuous cap/back mass plus thinner curved locks. This remains stylized; it is not a likeness or a finished approval of the supplied detailed target.

## Horse

`assets/models/morris-horse/horse-v1.glb` and `.blend`, source `tools/pipeline/build_morris_horse_v1.py`. New continuous skin has 8,989 vertices / 17,974 triangles; 20 bones. Deterministic normalized nearest-segment weights are an auditable candidate, **not production hand-painted skinning**. Zero unweighted or non-normalized vertices. All attachment meshes also bind to the skeleton.

`upgradeMorrisHorseAsset(root)` preserves existing controls and root scale `.6075`, with local seat (0,2.38,-.1). Call `syncMorrisHorseAsset(root)` **after** existing `animateMorrisHorse`. GLTFLoader sanitizes dots from bone names; adapter indexes original `userData.name`. Restore hides no parent rider objects and retains original meshes.

## Evidence and limits

`gltf-audit.jsonl`: real GLTFLoader parsing, finite geometry, joint/skin counts. `adapter-audit.json`: 35,160 sampled deformed vertices over 60 frames, finite transforms, both rollback paths verified. This is CPU deformation evidence only, not GPU, gait aesthetics or hoof-contact acceptance.

Offline neutral renders `princess-v*-front/side/back.png` and `horse-v1-front/side/back.png` are component review. JEV `evidence.json` / `jev.json` uses compact text only; actual response identifies required normal-game validation. Reuse cache for the identical evidence. Remaining work: actual mounted fit/reins/cloth contact, horse gait foot planting, normal NPC route/interaction and GPU overhead. Do not describe these as already passed.
