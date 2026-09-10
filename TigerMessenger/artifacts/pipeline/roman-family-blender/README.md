# Roman family Blender review candidates

Six complete actors are in `assets/models/optimized/roman-family-v1/`: blue/red short sword, spear and longbow soldiers. Each has a `.blend`, static `.glb`, and portable `.assembly.json`. `manifest.json` lists exact hashes, source preservation and validation scope.

The overview is `roman-family-v1-overview.blend`, with six named candidate collections and three packed reference sheets. Its display wrappers are separate from the origin-centered individual game roots.

Shared changes: fitted faceted blue tunic and short sleeves, ten hanging skirt plates, fitted galea and longitudinal crest, low-poly human face, articulated arms, handed thumbs and real gripping hands. Sword and spear use real handles; the archer has curved limbs, exact tip–nock strings, a hooked drawing hand and an open back quiver with a diagonal strap.

The `.blend` files contain review animation. Sword/spear have 4/5 authored key poses; longbow has 480 explicit samples at 120 Hz with original phase/release/arrow-visibility events. Every `.glb` is a **static review pose**, not a completed game animation integration.

Original six archives and snapshots remain unchanged. This work used independent background Blender only. Web/Godot runtime, foreground Blender and MCP scenes were not modified.

Reproduce one candidate with background Blender and `tools/pipeline/build_roman_family_blender.py -- --role gladius --side blue --refine-helmet --refine-face`. `--render-saved` only reads saved models and refreshes evidence images; `--overview` builds the separate gallery. Independent checks are provided by `tools/pipeline/test_roman_family_blender.py` and the validation reports maintained outside this output directory.

Production status: **review candidates**. The final batch validation result belongs in `manifest.json`; sampled contact checks do not certify every possible full-body pose. Applicable authoring guidance: `threejs-game-director` and `threejs-aaa-graphics-builder` skills, with the three user-approved concept sheets taking precedence.
