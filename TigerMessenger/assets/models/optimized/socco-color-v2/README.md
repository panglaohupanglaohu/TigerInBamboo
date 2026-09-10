# socco-color-v2

Color-only target revision, based on socco-craft-v1. Original files are retained read-only.

The palette in material-mapping.json starts as sRGB hex and is converted once to linear Blender/glTF factors. Metallic, roughness, transparency, node hierarchy, geometry and animation are unchanged. Existing emissive surfaces retain their effective emission-strength ratios.

The GLB keeps the exact source binary chunk and every non-material JSON field. The saved Blend is reopened and compared for mesh positions, faces, UVs, parent/basis data and each existing saved timeline frame. The new GLB is freshly imported and its actual material factors checked. See validation.json.

Reuse the exact existing animation/boarding contracts listed in contract-reuse.json. The SOCCO main Blend is static; this revision does not claim to add a boarding animation. Vanguard retains its161 saved frames.

Actual fresh-GLB before/after images use identical cameras, illumination and color management in artifacts/pipeline/socco-color-v2. Target: assets/concepts/socco-craft-target-v1.png. SOCCO images are empty-craft color comparisons; no old-colored transport crew are included.

World integration and in-game lighting review are owned by the main task. This asset package itself does not certify gameplay or performance. No foreground Blender or source files were modified.
