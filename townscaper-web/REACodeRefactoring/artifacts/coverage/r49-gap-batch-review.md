# 第 49 轮缺口批（4 处代码补丁；只做 node 验收，未浏览器验收）

都来自 learn/coverage-progress.json 的 next 缺口清单，判读沿用前几轮已全帧核过的证据（不重计帧数）：

1. **1707490932017279035 / 1707497006640365880 纯纹理灌木 · 带宽随崖高**（第 47 轮缺口：原片高崖带宽、矮台地边窄）
   - `src/terrain/terrainmesh.js`：本格最大落差 drop → 格心那端的 aEdge = 1 / min(1.8, 1 + 0.35·(drop−1))；同一宽度阈值在高崖格盖住更多格面。
   - `tests/shrub-texture.mjs` 新增断言：存在加宽格、且格心值只在 [1/1.8, 1) 档内。PASS（quad 灌木占顶面 18.4% / mixed 22.0%，94.5% 仍在崖边带）。
   - 仍缺：崖壁竖向三档色、灌木投影与进倒影。
2. **946660607008403456 船体浸血**（第 43 轮缺口：原片整条船底浸透成片红，本仓只有斑点 decal）
   - `src/badnorth/battle.js` `#bleed(..., boat)`：boat.gore 累加（每次 +1.6×血斑尺寸，封顶 1），船体自己的材质 `hullMat` 从木色 #6a4a52 往暗红 #7a1c22 插值（gore^0.8）。
   - `tests/stun-stars-boat-gore.mjs`：两箭后变红、多次死伤后 gore=1（红度 0.068 → 0.095 → 0.181）PASS。仍缺：白色尸体压在船上的姿态。
3. **984813819280191488 僵直可读性**（第 45 轮缺口：僵直无头顶提示）
   - `battle.js`：新 InstancedMesh `mStun`，僵直单位头顶 3 颗小黄星绕圈，随 bodyScale 缩放，僵直结束即消失。
   - 同测 PASS（3 颗、在头顶一圈、bodyScale 2 抬高、结束清零）。
4. **1120036868966502401 整格选中高亮**（第 44/48 轮缺口）
   - `src/world/contour-overlay.js` `selectCell(cell)`：整格黄色半透明填充（四边形 2 三角、三角格 1 三角），画在格顶高；`view.updateHover` 在 contours 开着时跟随鼠标格。
   - `tests/contour-regions.mjs` 新增断言 PASS。仍缺：1px 屏幕空间折线、gizmo。

TigerMessenger 的 vendor battle.js 同步了 2、3（维京战场）；TigerMessenger 三个维京 / REA 测试回归通过。

验证：`tests/*.mjs` 全部 node 测试通过（见 CHANGELOG 第 49 轮）。浏览器未跑（本 VM 无 Chrome）——1707490932017279035 / 946660607008403456 / 984813819280191488 已有别轮的浏览器验收，本轮不重写它们的记账（record-review 会把 runtimeAccepted 覆盖成 0），只在本证据与 CHANGELOG 记补丁。
