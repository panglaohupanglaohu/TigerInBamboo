# LeeBai original production freighter

Reference: user screenshot `codex-clipboard-20becbd0-70ca-4ee9-a349-307a9025d033.png` and approved direction `target-v1.png`. The changed model is `bookshop-steam-parts-freighter` in `bookshopFactoryBase.js`, not the newer Duke vessel.

Ownership: only the original freighter hull creation and name installation in `src/world/bookshopFactoryBase.js`, plus new `src/world/bookshopFreighterHull.js`. Dock/factory structure, original vessel placement/quaternion/scale, cargo/boiler/single funnel/rear bridge/fore derrick, mooring and update loops were retained. Duke source untouched. Original factory source is backed up in `source-before/bookshopFactoryBase.js`.

The old extruded straight-wall body is replaced by a closed waterline loft. Its upper +Z prow narrows, the waist blends into a lower forward round nose, the belly draws into a keel and the stern draws inward. Shared monotone Hermite section slopes round the transition without overshooting the reserved bounding envelope. Each geometry has 29 rings, 1394 vertices and 2784 triangles. The local forward nose reaches Z10.20 at Y-2.05, ahead of the upper prow Z9.60, and the narrow keel is at Y-3.40. The old and new actual triangle side/top projections are `hull-profile-cpu.png`, explicitly labelled CPU, not a game screenshot.

Both bow sides carry separate conforming texture meshes reading large 李 with LeeBai below. The canvas is 1024², uses Songti/PingFang/Noto CJK/YaHei system fallbacks, and uses a serif English line. All three original NORTHWARD sign-board maps are also replaced with compact 李 · LeeBai maps after those boards' material merges; their existing physical boards remain. The large two-sided hull names are added outside the detail merge and retain actual UV maps. `leebai-name-canvas.png` is the actual locally drawn Canvas image, visually inspected with a valid Songti Chinese glyph.

## CPU verification

`tests/world/bookshopFreighterHull.verify.mjs` builds the production factory base with an actual spherical town pose, then verifies both 1.9 and 3.4 depth variants. Every hull edge has exactly two incident faces with opposite directed edges, signed volume is positive, and no triangle is degenerate. The new X/Z enclosing box lies inside the original hull's enclosing box. The curved plan shape is not identical to the old surface footprint; the retained outer envelope is the conservative clearance boundary. The actual placed new hull enclosing box intersects zero real berth/quay triangles.

Both hull-name meshes face outward, keep texture maps and parent to the moving ship. Every name-patch grid vertex is ray-tested against the actual hull; name offsets are positive and remain within 0.052 local units. A locally rendered texture has 93,569 nontransparent Chinese pixels and 25,149 English pixels. Five update times confirm original ship X/Z, quaternion and fivefold scale remain unchanged, with only its original ≤.055 local-unit bob. Source diff confirms the other production factory/handling code is unchanged.

Full evidence: `hull-name-cpu.json`.

## Remaining visual boundary

Current embedded-browser/GPU controller is unavailable. The new production ship has not been visually accepted in a fresh formal game frame; real sea occlusion, apparent hull/nose proportions, letter size under the player's camera, lighting and existing shell fittings need that GPU review. The target image and CPU projection are not proof of the game's rendered result. No FPS improvement or score is claimed. No commit/publication/external transmission.

## Five-hour batch — 2026-10-11 14:44 UTC
Production hull now has ship-local vertex colours: dark teal topsides #29434b and red-brown lower shell #87483b, softly transitioning at 46–52% hull depth. Shared factory iron material remains unchanged; no extra hull draw calls. Existing closed-shell/quay/name/animation CPU verification passed again (hull-palette-cpu.json). Actual ocean waterline alignment and apparent colours remain GPU-unverified. JEV text-only call used 869 input/91 output tokens, suggested review (.94); required fresh GPU gate remains missing. Identical request then served from cache. Flower-navigation worker resumed for safe longer routes; no broadened route yet accepted.

五小时15:24UTC：LeeBai四条护舷条改为实际壳面曲线，18舷窗104铆钉按三角壳外法线贴附；正式工厂CPU及船壳回归通过，记录leebai-freighter-fittings-20261011/。新增leebai-freighter-20261011/review.html直接加载完整正式游戏，检查摄像机不隐藏物体，脚本语法通过；尚未实际GPU运行。环境代理继续小批打散石肩/树干叶片重复尺度，不增加植株预算。

## 16:04 UTC spherical palette correction
Read-only actual ocean survey found the earlier fixed local-y antifouling band lay about 6.9 world units below the amidship waterline. Production colour sampling now uses each actual vertex transformed into world space and the shared officialOceanLevelAt direction authority, retaining dark teal/red-brown with -0.35 to +0.15 world-unit transition. No ship position, hull, dock or sea-level changes. One build pass plus one first-runtime-update pass accounts for final parent placement; no per-frame colour loop. Revised world-authority hull colour assertions and existing shell/name/quay/animation checks passed in spherical-palette-cpu.json. Actual triangle ocean differs slightly from continuous authority; fresh GPU still unverified.

五小时16:24UTC：独立CPU确认球面palette误差<7.1e-9，实际海洋三角面与连续authority差0.054–0.227米；父层须首update前放置完成，bob不重涂。新增船专用米白驾驶舱及暖铜单烟囱材质，工厂共享材质不动，几何/名字/码头/动画回归及新材质断言通过。新GPU仍未验，见superstructure-colour-cpu.json。

五小时截止交付：截止北京时间2026-10-12 03:23已过，临时automation已删除。李/LeeBai英文浸水窄修已完成：名字贴片缩至Y-.05..-.65、Z7..8保持比例，两侧实际alpha均100%位于authority/实际三角海面上，壳外偏移及原回归通过。最终目标改动全部进入正式源；集中查看ship-swamp-five-hour-20261012/index.html。明确缺项：新GPU截图、同机位目标对照、完整场景FPS、连续碰撞/包含未验；不称90分或视觉已完成。新用户书店目标转由Jakub智能体负责具体艺术指导，不等于继续自动实施。
