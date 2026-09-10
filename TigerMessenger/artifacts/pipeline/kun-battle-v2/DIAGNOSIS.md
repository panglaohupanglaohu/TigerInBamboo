# Kun v1 mouth — read-only diagnosis

Inspected the approved target, actual Godot swallow screenshot, v1 builder, runtime adoption/morph code and actual GLB geometry. The candidate and Godot GLB hashes match: `1b7190a3861514c141355c7967f8418c37877f5ddfe6ba7e6a8a07e571699260`. V1 files were not modified.

The gray triangular plate is chiefly geometry/readability, not missing material. Actual GLB lower lining BaseColor is (.105,.096,.083,1); roof is (.070,.064,.057,1). Both are opaque, non-emissive and double-sided. Godot adopts the expected nodes and applies the expected 38° jaw rotation and membrane/shell/lip weights. Color adaptation only enables existing vertex colors; the new roof/floor have no color attribute overriding these factors.

`build_kun_battle_blender.py` creates both roof and floor as 33 triangles sharing one central vertex. Roof spans original X24–43 but stays almost on the seam plane (rim offset +.025, center +.08). Its center is (33.20013,-9.43471,-.49344), referenced by all 33 triangles. This is an upper-palate plate, not an arched throat roof.

Lower lining is a boundary scaled .88 toward its center and shifted down .65, with one center pushed down 3.5. The shared center in jaw-local coordinates is (9.20013,-1.51471,-.49344), again referenced by every triangle. A shallow fan/bowl occupies the opening, so front-high viewing reveals large uniformly lit gray faces. The lining has no ThroatInflation morph while the outer jaw shell does: external pouch expansion does not expand the visible interior.

The rear membrane is only a strip X23–24, 20 triangles, using the pale lip material. It couples to the hinge but is not a dark narrowing throat passage. Existing side-low images expose the almost planar roof; lighting hides some of this in three-quarter renders, while the native front-high screenshot makes it conspicuous.

## Minimal independent v2 direction

Keep all 295 original IDs/parents/transforms, body identity, eye and back-island placement. Retain add:jaw-pivot, mouth-roof, mouth-floor, throat-membrane, jaw-shell, lower-lip and existing morph names/runtime bindings. Change only candidate mouth surfaces: replace center fans with a small sequence of inset rings along the rearward -X direction, narrowing behind the hinge into a recessed dark throat; curve the roof and cheek transition continuously instead of closing the visible opening with one plane. Build inward-facing wall normals and deliberate thickness; preserve the existing warm lip and outer pouch.

Give the interior floor a matching, bounded pouch deformation so shell inflation increases actual visible volume. Existing runtime coupling must remain exact, with added channels optional until explicitly adopted. Check front/high, side/below, closed, intermediate gape and engulf, including mouth ray depth and lip/jaw intersections. Do not fix the symptom by merely making the whole mouth black, adding lights or replacing the whale. This diagnosis does not itself create or approve v2 geometry.
