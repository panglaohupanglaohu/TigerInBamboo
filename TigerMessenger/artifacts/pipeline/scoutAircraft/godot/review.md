# Scout candidate Godot independent inspection

Actual Godot 4.7.2 Compatibility run captured candidate.png and passed validation.json. 46 original IDs are present under node metadata `extras`; 18 archived outline meshes explicitly hidden; 23 visible mesh nodes including one cockpit liner; one canopy receives an engine-specific transparent material. Original weapon muzzle, cockpit and legacy propeller anchors retain their names. No propeller blades added.

Visual review: viewed actual screenshot after correcting a failed first import whose Blender Object Info/Mix color nodes exported white. The final screenshot retains cyan body and wings, cream pointed nose and yellow tip markings. The dark recessed cockpit is visible through the adapted canopy. It still lacks the concept's seat and panel detail; glass is alpha transparency for Compatibility, not Cycles physical refraction. Original outline shaders are not recreated. Jagged edges are visible at this preview resolution, so this is not a finished art acceptance.

Measured full preview frame: 81 draw calls, 2,006 primitives, including UI. The mesh uses many inherited material surface slots, so 23 mesh nodes does not mean 23 draws. Surface consolidation remains a separate optimization; no fleet performance claim. Procedural paint roughness flattened to 0.465 for portable export, while archived diffuse colors replace unsupported Object Info/Mix links. The source blend SHA256 stayed unchanged.

Resource: res://assets/art-pilots/scoutAircraft-art-v1.glb
Inspection scene: res://scenes/scout_candidate.tscn
Adapter: res://scripts/scout_candidate.gd
Test: res://scripts/test_scout_candidate.gd

The raw GLB includes the archived outline geometry to preserve all 46 identities; use the inspection adapter to hide these, rather than displaying raw GLB without adaptation. Exporter explicitly selects Scout Aircraft Art V1 from the scene library, excludes camera/lights/background and applies candidate modifiers in the export process. Source file is never saved. No currentResource, global deployment, Web or live world was replaced; world_integrated remains false.
