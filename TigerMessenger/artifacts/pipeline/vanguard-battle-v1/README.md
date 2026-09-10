# Vanguard battle v1 review evidence

Source-derived Blender candidate. Source archival files unchanged. The rendered actor is a single trooper; no 27-person formation is baked.

- `before-three-quarter.png`: original source geometry.
- `idle-three-quarter.png`, `idle-hand-detail.png`, `idle-cannon-detail.png`: fitted armor and real grip.
- `aim-front.png`, `aim-top.png`, `aim-three-quarter.png`: shoulder cannon direction and head separation.
- `slash-three-quarter.png`, `stagger-three-quarter.png`, `rope-three-quarter.png`: saved authored timeline poses.
- `idle-glb-roundtrip.png`, `aim-glb-roundtrip.png`, `aim-front-glb-roundtrip.png`, `slash-glb-roundtrip.png`: actual freshly imported GLB; subsequent poses applied from portable matrices without rebuilding geometry.

Validation: `validation-report.json` checks all 161 saved frames, 84 original IDs/parents, exact hand/grip anchors, cannon vs tested armor and hand/grip vs forearm triangle intersections. `glb-roundtrip-report.json` checks actual imported nodes/parents/UVs/colors/alpha and static pose. This is bounded asset validation, not full body/world collision or gameplay acceptance.

Reproduce from project root (independent background Blender only):

```
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/pipeline/build_vanguard_battle_blender.py
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python artifacts/pipeline/vanguard-battle-v1/validate_candidate.py
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python artifacts/pipeline/vanguard-battle-v1/render_glb_roundtrip.py
```

Color handling: Blender Cycles, AgX, neutral identical studio settings. Source red m8 thigh stripes remain non-emissive. Two translucent materials store opacity in glTF factor alpha; Blender importer exposes this through the separate Alpha socket.
