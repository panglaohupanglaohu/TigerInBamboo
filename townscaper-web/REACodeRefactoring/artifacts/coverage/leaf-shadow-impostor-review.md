# 1205420678859632640 残差补全核验（2026-12 本轮）

条目：plants 线「3c 球面叶纹 × 视角alpha：真实贴图/连续覆盖，保留旧噪声对照；阴影与远景impostor待补」（learn-queue score 32）。
残差：「原作手绘轮廓和匹配的阴影caster/impostor仍待补。」本轮只补可实现的两项；原作手绘轮廓属卡点·B（无原资产），如实保留。

## 落点核对（改前现状）

- `src/life/vegetation.js`：树冠 / 树干 `castShadow = true`（行 457），但**没有 customDepthMaterial**——默认 MeshDepthMaterial 不认片元 discard，影子是实心团块、不透叶隙，且风摆只在彩色着色器里，影子不跟摆。灌木 / 草丛不投影是既有取舍，未改。
- `initImpostors(renderer)` 的八方位 impostor 是**全场手动开关**（`impostor` setter 二选一），不是距离阈值 LOD；且必须启动时用 renderer 烘图。

## 本轮新增

- `src/life/leaf-depth.js` — `makeLeafDepthMaterial`：树冠 `customDepthMaterial`，与 `swayMaterial` 同源——同一 uTime 风摆、同一共享 32² 图集（`surface.uniform`/`surface.on` 绑同一 uniform 对象）、同一 `leafCoverage(facing, leafPattern)` 判据；「视角」换成阴影相机（正交取 viewMatrix 第三行，与 impostor.js toCam 同口径），RGBADepthPacking。图集关时退回与彩色材质同式的旧噪声阈值 `rim > 0.52 + 0.4·leaf`。
- `src/life/leaf-impostor.js` — `crossedLeafGeometry`（默认 3 张 60° 交叉面片，包围盒取源树冠几何）+ `LeafImpostorField`（InstancedMesh，set/commit 与 ImpostorField 同 API）。片元把卡片当「球的正面」（与 impostor.js SPHERE 同口径）：`leafCoverage(zz, leafPattern(sph))`，远景仍出叶形轮廓 + 墨线边；材质绑共享 uniform，图集单例不分裂。
- `vegetation.js` — `crownPlacements` 留底 + `updateCrownLOD(camera, distance)`：距离阈值外树冠实例改写入交叉面片场（远树干不画），阈值内回网格；硬边界、无迟滞；`impostorOn`（烘焙）优先；refresh 后按原阈值重划；相机未动不重写实例缓冲。`LEAF_NOISE_GLSL` 上移到 leaf-surface.js 作彩色/深度单一来源。
- `view.js` — `setDebug('treelod')` 开关（默认阈值 8）+ render 循环相机驱动。

## 验证（实跑）

- `node tests/leaf-shadow-impostor.mjs` PASS：17 树；3 树冠 castShadow+customDepthMaterial（RGBADepthPacking）；onBeforeCompile 产物含同式风摆/同源 leafPattern×leafCoverage/正交视角/旧噪声分支；替身 3 面片 12 顶点、绑共享 uniform、两场同一纹理对象；中位阈值近 9/远 8、边界距离≤阈值留网格、阈值 0 全恢复、impostorOn 隐藏远面片、trees 层联动、refresh 后重划、负阈值/越界 commit 拦截。
- `tests/leaf-shadow-impostor-browser.cjs`（Playwright + 本机 Chrome，leaf-surface.html）PASS：79 树；中位阈值 25.24 → 近 40/远 39 分档；`leaf-depth-0.02-28-true` 在 renderer.info.programs 真实编译；阴影图重画无 GL/shader 报错（pageerror/console.error 全程 0）；关闭 LOD 全量恢复。截图 `leaf-shadow-impostor.png` 已人工查看：地形岛植被正常、共享纹理单例 ✓。
- 回归：`tests/leaf-surface-browser.cjs` PASS（atlas/legacy/solid × 3 机位 × MSAA 覆盖不变）；`leaf-atlas.mjs / leaf-atlas-shared.mjs / atlas-crossleaf.mjs / impostor-pitch.mjs / impostor-bend.mjs / c11-grass-shrub.mjs / flora-species.mjs / level-flora-layers.mjs / level-flora-species.mjs / shrub-card.mjs / c09-life.mjs / anchored-billboard.mjs` 全部 PASS。

## 近似边界（如实记录）

- 深度材质用世界空间 object normal（彩色通道用视图空间微扰法线）；深度图无 MSAA，`leafCoverage < .5` 硬裁（.5 = edge 0 轮廓线，与彩色轮廓同一判据）。
- 交叉面片是程序近似，不是原作八角烘焙替身：无逐方位光照图、无俯仰行，明暗用 zz 近似；远树不画树干。
- **原作手绘轮廓仍缺**（卡点·B：无原片美术资产，程序化只能近似），本条保持 partial。
