2026-10-31 · Morris lake construction moved from REACode to REACodeRefactoring

Every game-side REACode integration now runs on the refactored system (townscaper-web/REACodeRefactoring), vendored unchanged under src/vendor/townscaper-rea-refactoring (src/ + learn/). The previous integration is backed up in TigerMessenger/_backup-before-reacode-refactor-20261031/.

What changed
- src/world/morrisTownscaper.js: grid = refactor buildQuadGrid (radius 28, hexSize 1, x3 into the island chart, covers the whole lake); data = refactor World (solid / rock / color / river, 12 levels); editing follows refactor app.js applyAt (build fills the clicked empty level or stacks, erase removes one voxel, terrain can be dug, paint recolours); saves = refactor save v5 (URL ?morrisTown=, local key morris-townscaper-refactor-v1, named saves morris-townscaper-refactor-saves-v1). Old REACode v3 saves (current castle and named list) are migrated once by cell centroid via src/world/morrisTownscaperLegacy.js; the old keys are left untouched as backup. Roof colour does not exist in the refactor World: migrated columns take the wall colour, else the old roof colour.
- src/world/morrisTownStage.js (new): the refactor View (world/view.js) re-hosted for the game: WorldMesh (terrain + buildings + baked AO/bounce), OutlineLayers (ink + backlit rim), Birds, Vegetation (+ octagonal impostors, clouds), Atmosphere, Effects (splash / pop / fire), Decor (flags, Italian wires, butterflies), Sound, NavLayer, reflection, shore skirt + looping waves, hover, debug overlays, day / dusk / night profiles. It lives in its own untilted scene in town units and is drawn after the main pass with a proxy camera = inverse(anchor) x game camera, so depth equals the main pass (banks still occlude) and the refactor's world-Y shaders run unchanged. Renderer tone mapping / exposure / colour space are set to the refactor's for that pass only and restored.
- src/main.js: when the camera is within 1400 units of the lake the main pass stays direct (no bloom composer) and morrisViewer.renderTownOverlay draws the town; elsewhere nothing changes. The old build-mode lighting override (morrisViewer.beginTownRender) is no longer installed.
- src/world/morrisTownscaperMenu.js: refactor learnpanel (window.LEARN / PIPELINE / ARCH loaded from the vendored learn/*.js; thumbs, clips and page links rewritten to the vendored copy, REA-agent/gifs and townscaper-web/REACodeRefactoring), refactor PALETTES, scene generators town / terrain / fusion (clipped to the lake), v5 share links.
- src/world/morrisCastlePatrolRoute.js: World field color (was colors). Castle seeding and the patrol route are otherwise unchanged.
- src/world/reaGullFlock.js (new) + airshipEscort.js: airship escort gulls use the refactor Birds flying instanced mesh.
- Lake surface for the town pass is a polar strip mesh (~12k triangles) instead of the ~82k-triangle game lake mesh; the game lake mesh is hidden, its geometry kept for raycasts.
- Version strings bumped along index.html -> main.js -> registry -> messengerIsland -> morrisIsland -> morrisLake. Release bundle rebuilt (runtime/game-c3869e77b274.js).

No longer imported: src/world/morrisTownscaperEffects.js, src/world/morrisTownscaperLighting.js and the old src/vendor/townscaper-rea modules except quadgrid/town/save, which only the one-way save importer reads. They were left on disk because deleting files in this folder is not enabled for the session.

Verified (checks.json, screenshots): legacy save + named save migration, pointer build / erase / undo / redo / paint, named save / clear / load, all three refactor scene generators inside the lake, time of day, learnpanel switches, airship gull adapter, no browser errors. Not verified: full game start and manual play in the complete game (headless software rendering does not reach Morris in reasonable time).

## r2 (2026-10-31)
- 莫里斯山：src/world/morrisMountain.js（穹顶高度场 + 重构版 fbm/ridged，偶数层 2..10，两座尖峰到 12；carveRivers 1 条、addFeatures 悬挑/拱门/海蚀柱；山顶城堡 + 堤道）。建城菜单右上 ♜ 可重新生成。
- 返回玩家视角：按钮现在会结束建造、清除建城相机、恢复 fov/far/up，并通过 morrisViewer.returnToPlayer 关闭莫里斯巡览镜头（若开着）并 cameraRig.snapToPlayer()。
- 进入莫西斯湖 = 建造时光照：相机进入湖半径 1.8 倍（离开 2.1 倍，防抖）或建城相机/建造模式开启时，主画面隐藏游戏灯光与雾，换成重构版 day 灯组（同色、同强度、同方向，ACES 曝光 1.08，背景 #6aa8b0），小镇舞台同时强制 day；离开后恢复游戏昼夜。主画面灯组不投影（性能），小镇本身阴影不变。
- 版本链 reacode-refactor-r2；release bundle runtime/game-c5dcbc06c489.js。
