# GatePod family review evidence

For each variant, `*-before.png` renders the original source, `*-three-quarter.png` shows the candidate with complete wings, `*-belly.png` shows its two winches, and `*-deployed.png` demonstrates Blender-only rope deployment. `*-glb-roundtrip.png` and `*-belly-glb-roundtrip.png` are real fresh-import renders of the exported GLB without review ropes.

The neutral Cycles / AgX studio is consistent across variants. No frontmost Blender scene or external model package was used.

Rebuild all three from the project root:

```
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/pipeline/build_gatepod_escort_blender.py
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python artifacts/pipeline/gatepod-escort-v1/validate_and_roundtrip.py
```

The builder reuses generic mesh/bevel/UV/studio helpers from the Vanguard builder, with separate files, export tags, coordinates and output paths. It does not call Vanguard authoring or change that asset.

Read each `*-validation.json`, `validation-summary.json`, the asset `PLACEMENT.md`, and the variant assembly. Scope is bounded asset validation, not whole-world gameplay acceptance.
