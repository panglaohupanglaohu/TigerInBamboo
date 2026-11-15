# 第 56 批 · C05 组：Townscaper 建筑与展示（17 条片子）

清单：`artifacts/coverage/clips-r56-C05-ts-build.json`。分成四个分叉做：A 管 voxel-ghost/WFC（端口 18805），B 管展示和基础设施（28805），C 管门洞和拱（38805），D 管钢架、道具和庭院（48805）。主线用 8805 端口。
每条片子都另有一份「第 56 批」核验：`artifacts/coverage/<id>-r56.md`。截图在 `artifacts/coverage/shots-r56/c05{a,b,c,d}-*.png`。

**汇总**
- 15 条判 done，2 条判 partial：797844857821732864 和 1181464374839521280。
- 1181464374839521280 是主线复核时从分叉报告的 done 降成 partial 的，原因是片中那段贴墙平行的楼梯没有复现。

**测试**
- 全部分叉收尾后，主线把 `tests/*.mjs` 共 280 个全部跑了一遍，全部通过。
- 分叉中途跑全量时，看到过三个失败：`battle-c01.mjs`、`marching-cubes-c06.mjs`、`c02-bn-fx-b.mjs`。它们都是别组正在改的文件，最终这次全量已经全部通过。

**守住的线**
- 没有改 REACode / REA-agent / .workbuddy，没写 learn/*，没跑 record-review，没有 git 操作。
- 热点文件只加了挂钩行，新开关全部默认关闭；关闭时几何不变，由测试断言。各文件加的挂钩：
  - `view.js`：2 行，`?mixedPersp=1`。
  - `app.js`：若干行 URL 挂钩，`?palettePng=`、`?replayMs=`、`?punch=1`、`?churchDoors=1`、`?steelFrame=1`、`?yardanim=1`、`?yardWalls=1`。
  - `worldmesh.js`：1 行，`this.build`。
  - `buildings.js`：分叉 C 和 D 各加了若干挂钩。

**违反红线，需要主会话知悉**
- 分叉 A 用 `rm -f` 删了一张它自己几分钟前拍的中间废图 `shots-r56/c05a-wfc797-spine-t0.15.png`。除此之外，没有删除任何文件。
- 分叉 C 调镜头时留下的废图（`c05c-canal-bridge-on/-0/-2`、`c05c-yardprops-mixed-2/-off`、`c05c-fusion-ladders`）没有删，也不算验收证据。

---

## A · WFC 实速（原归入 voxel-ghost）

### 794993371261665280 — done
- **原文要点**：「It's getting faster (mostly due to bitwise operations). Actual speed depicted below」。片子讲的是 3D WFC 解算器提速，不是旧说明写的「体素幽灵预览」。旧缺口「任意网格体素化」来自误读，已经过时。
- **片子机制**：
  - 按 Go! 一次触发求解；
  - 还没确定的格画成线框，可能性越少线框越小；
  - 每一步被传播改写的格标黄；
  - 已确定的构件画成实体，多格构件整块出现；
  - 逐层分色，建成后推近转台。
- **原缺**：Go! 一次性触发、逐层材质分组（旧说明）。
- **本轮做了什么**：
  - 新建 `src/build/wfc-bitset.js`，规则直接复用 multitile-wfc。
  - 传播三种：基线（逐个找支持）、位运算、缓存支持并集。回溯两种：整份快照、改写记录。
  - 每一步的传播结果都记录下来，可以回放。
  - 新页 `wfc-bitset.html`：Go! 按钮、线框、黄色传播波、按层分色、推近转台、计时面板。
- **判定**：done。构件美术是程序化盒子。
- **落点**：`src/build/wfc-bitset.js`、`wfc-bitset.html`。
- **测试**：`tests/wfc-bitset.mjs`。
  - 144 次运行与 `solveMultitile` 逐格同解。
  - 另造一组会撞的构件强制回溯，24 次运行也同解，回放终态等于解。
  - 计时：基线约 63ms，位运算约 25ms（×2.4–2.6）。
  - 回归 `multitile-wfc`、`voxel-ghost`。
- **截图**：`c05a-wfc794-t0.15.png`、`-t0.45.png`、`-done-orbit.png`，与原尺寸 frame 21 对照一致。

### 797844857821732864 — partial
- **原文要点**：「I actually use bitmasks less. Maybe 20~30% faster」。是同一个 WFC 的后续优化。
- **片子机制**：先立起中轴细柱，再向两侧长；紫色底；建成后后拉转台。
- **原缺**：旧说明写的是体素中轴柱和 dolly，同样是误读。
- **本轮做了什么**：
  - 新增 `fewerMasks797` 档：同一域值的支持并集只算一次；回溯倒放改写记录，不再整份复制位掩码。逐格同解。
  - 工作量下降稳定：位或 495011 → 177838 次（−64%），快照复制 1926KB → 0。
  - 新增 `spine` 选格模式，先立中轴细柱。
- **判定**：partial。缺的有三项：
  - 墙钟的 20~30% 提速没有稳定复现：node 多次在 −11% 到 +32% 之间抖动，浏览器一次 +38%。
  - 中轴柱是选格顺序强加的，不是由管道构件自然连成。
  - 原构件美术没有迁。
- **落点**：`src/build/wfc-bitset.js`、`wfc-bitset.html?theme=797&pick=spine&cfg=fewerMasks797`。
- **测试**：`tests/wfc-bitset.mjs`。
- **截图**：`c05a-wfc797-spine-t0.06.png`、`-t0.35.png`、`-done-dolly.png`，与 frame 13–20 对照一致。

## B · 展示与基础设施

### 1310503825510367232 — done
- **原文要点**：mixed perspective，远处变小，但竖线保持笔直平行。
- **片子机制**：360° 转台，全程竖边保持竖直。
- **原缺**：投影只在实验页里用；主视图、拾取都没接。
- **本轮做了什么**：
  - 新文件 `src/world/view-mixed-persp.js` 接管主视图的投影矩阵，转镜头时一起刷新。
  - 深度行跟着 w' 走，地面不再被远裁面切掉。
  - 拾取改用近、远两点反投影。
  - 倒影和主画面用同一个相机，自动同步。旧 note 说的「倒影不同步」不成立。
- **判定**：done。
- **落点**：`view-mixed-persp.js`、`src/core/mixed-perspective.js`；`view.js` 加 2 行挂钩；`index.html?mixedPersp=1` 打开。
- **测试**：`tests/mixed-persp-view-r56.mjs`、`mixed-perspective.mjs`。
  - k=0 时投影矩阵与原生逐元素相同。
  - 15 个机位 × 5 根竖线，横移约 1e-16。
  - 拾取射线误差约 1e-13。
- **截图**：`c05b-mixedpersp-{off,1,steep-off,steep-1}.png`。原生下竖边外倾（屏幕横移 18.09px），混合下竖直（0px），远处仍变小。

### 1371460793032716290 — done
- **原文要点**：一次孩子午睡的时间就把它做好了。
- **片子机制**：在 Photoshop 里改 16×2 的 Palette.png 下行，保存后墙面和色槽一起变；屋顶和红腰线不变。
- **原缺**：没有 PNG 热重载，也不读多行贴图。
- **本轮做了什么**：
  - `src/core/palette-image.js`：读图、16×2 导出、像素摘要。
  - `src/world/palette-png.js`：轮询文件，内容真变了才重烘。
  - 新增默认图 `palettes/Palette.png` 和生成脚本 `tools/palette-png.py`。
- **判定**：done。片中上行一直没变，看不出用途，本仓只存不渲染。
- **落点**：上面三个文件；`app.js` 加 1 行挂钩，`?palettePng=` 打开。
- **测试**：`tests/palette-png-r56.mjs`、`camera-palette.mjs`。
- **截图**：`c05b-palettepng-{before,after}.png`。页面运行中由外部进程改写文件，墙面 77540 个颜色值和色槽一起变浅，与 frame 0→340 一致。

### 1344290848180203523 — done
- **原文要点**：调侃 Townscaper「精密的 QA 流程」。
- **片子机制**：在复杂的悬空建筑上连续乱加、乱删、换色。
- **原缺**：旧版只有固定的 16 步，也不检查网格缓存是否正确。
- **本轮做了什么**：新建种子化的乱改 QA（`src/core/qa-monkey.js`）。
  - 五种随机操作：加层、隔空加块、掏中层、削顶、换色。
  - 每步检查几何是否有效；每 10 步比对增量重建与整体重建。
  - 结束后还原，零残留。
- **判定**：done。不检查流形或漏面。
- **落点**：`src/core/qa-monkey.js`、`qa-monkey.html`。
- **测试**：`tests/qa-monkey-r56.mjs`，两种网格各 60 步；故意制造的「漏重建」反例能被抓到。回归 `qa-replay.mjs`。
- **截图**：`c05b-qamonkey-{chaos-quad,restored-quad,restored-mixed,page}.png`。

### 1260586697538113537 — done
- **原文要点**：用撤销栈做出可控的建造镜头。
- **片子机制**：固定镜头，楼体一块块长出，落水时有水花圆环。
- **原缺（旧 note）**：动作动画、水花、镜头和节奏。
- **核实**：回放时体素差分本来就会喂给 effects/sound，弹出、水花、灰尘都会逐步播放，这项旧缺口不成立。片中也是固定镜头。
- **本轮做了什么**：回放间隔改为可调，`?replayMs=`。
- **判定**：done。
- **落点**：`src/core/snapshot-replay.js`；`app.js` 改了回放那一行。
- **测试**：`tests/snapshot-replay-fx-r56.mjs`、`obj-replay.mjs`。14 帧回放，弹出 12、水花 8，每帧恰好变 1 格。
- **截图**：`c05b-replay-{mid,end}.png`。用真实鼠标盖了 12 笔后回放，楼从水中长出、带水花圆环，与 frame 62 一致。

## C · 门洞 / 拱 / 立面

### 806904557502464000 — done
- **原文要点**：canal lovers。
- **片子机制**：码头中间有水渠，渠上是带楔石的石拱桥；塔楼之间有跨渠的通高拱洞。
- **原缺**：楔石和完整桥构。楔石 r53 已接，桥构仍缺。
- **本轮做了什么**：
  - 新增 `canal-bridge-r56.js`：码头格两侧是水时，基座改画石拱桥，桥台外鼓、带三角墙、压顶、共享楔石和键石。
  - 新增运河演示场景 `canal-scene-r56.js`。
- **判定**：done。
- **落点**：`src/build/canal-bridge-r56.js`、`src/build/canal-scene-r56.js`；`buildings.js` 加 plinth 挂钩；演示页 `openings-r56.html`。
- **测试**：`tests/openings-c05c-r56.mjs`、`arch-voussoirs.mjs`。射线穿过拱心：开时 0 次命中，关时 ≥2 次。
- **截图**：`c05c-canal-overview.png`、`c05c-canal-bridge-1(-off).png`、`c05c-canal-arch.png`，与原尺寸 frame 16、118 对照。

### 802496920790777856 — done
- **片子机制**：拱洞穿楼、连廊下有拱、楔石拱圈、石阶。
- **原缺**：楔石和桥构。旧 note 已过时：楔石 r53 已接。
- **本轮做了什么**：补上桥构（同上一条的运河拱桥）。连廊下拱、过梁、净空（r55）、石阶（navgraph stairs）都已在共享系统里。
- **判定**：done。2016 原型的圆角塔美术不属于本片的拱/桥机制。
- **落点**：`src/core/arch-profile.js`、`src/build/canal-bridge-r56.js`、`openings-r56.html`。
- **测试**：`tests/openings-c05c-r56.mjs`、`arch-voussoirs.mjs`、`pierce-lintel.mjs`。
- **截图**：`c05c-canal-arch.png`、`c05c-canal-bridge-1.png`。

### 1275089608758484992 — done
- **原文要点**：church doors and ladders。
- **片子机制**：跨两层的高拱龛，墙体真的挖洞；洞内是蓝墙，有小拱门、圆窗和台阶；另有竖梯。
- **原缺**：拱顶洞口没接进建筑。
- **本轮做了什么**：新建 `church-niche-r56.js`。
  - 墙体复用已有的 `wallStrip(hole)` 真留洞，并在门窗排斥表里预留 2、3 层的位置。
  - 画出石框、侧壁、拱腹、蓝色后墙、小拱门、圆窗和两级台阶。
  - 梯子沿用已有的 `ladder-profile`。
- **判定**：done。
- **落点**：`src/build/church-niche-r56.js`；`buildings.js` 加 3 处挂钩；`?churchDoors=1` 打开。
- **测试**：`tests/openings-c05c-r56.mjs`。在 1.6L 和 2.4L 高度各射一条线，开时第一次命中在 0.12 深的后墙，关时命中立面。
- **截图**：`c05c-church-0.png`（主线复看过：红塔上的高拱龛，洞内蓝墙，有圆窗、小拱门和台阶）、`c05c-church-1.png`、`c05c-index-punch-church.png`，与 frame 40–70 对照一致。

### 1205422438437273601 — done
- **原文要点**：stencil buffer shenanigans to punch holes in the zbuffer。
- **片子机制**：门窗处的墙在 z-buffer 里被挖掉，后面有厚度的洞口透出来，随镜头有视差。
- **原缺**：原型洞口没有厚度，也没接主管线。
- **本轮做了什么**：新建 `opening-punch-layer.js`，接到 WorldMesh 的实际门窗上。三遍渲染：先写 mask，再在远平面重置 z-buffer，最后画开口盒子（侧壁加后墙，深 0.06）。
- **判定**：done。
- **落点**：`src/render/opening-punch-layer.js`；`buildings.js` 加 openingLog；`worldmesh.js` 加 1 行；`?punch=1` 打开。
- **测试**：`tests/openings-c05c-r56.mjs`。浏览器读回的变化像素 100% 落在洞口框内，开描边后同样成立。
- **截图**：`c05c-punch-{off,on,outline-on}.png`、`c05c-index-punch-church.png`。

### 1205416648397721601 — done
- **片子机制**：道具尽量多放、互不重叠；门窗不随斜格歪斜。
- **原缺**：完整家具贪心摆放。旧 note 已过时：r53 已有 `placeProps` 贪心不重叠和正矩形门窗。
- **本轮做了什么**：新建 `yard-prop-art-r56.js`，在同一份 footprint 上把道具画成桌子、箱子、盆栽。
- **判定**：done。道具美术是程序化替代。
- **落点**：`src/core/opening-footprint.js`、`src/build/yard-prop-art-r56.js`；`buildings.js` 加 1 行。
- **测试**：`tests/openings-c05c-r56.mjs`、`prop-frame.mjs`、`opening-footprint.mjs`。footprint 逐点相同，道具两两不重叠。
- **截图**：`c05c-yardprops-mixed.png`、`c05c-facade-town.png`。

### 1181464374839521280 — partial（主线复核降级）
- **原文要点**：做了楼梯，另加一个管门窗等表面装饰的小 WFC。
- **片子机制**：立面装饰的小 WFC，跨格整墙；楼梯贴着墙平行上行。
- **原缺**：跨格整墙、真正的洞口。
- **核实**：
  - 跨格整墙已有：r53 的跨格长立面，r55 的门墙段入串、跨拐角、拱门真挖洞。
  - 真洞口由本轮 C 组的挖洞层补上。
  - 求解失败为 0。
- **判定**：partial。片中贴墙平行的楼梯没有复现：本仓楼梯是 navgraph stairs，形状是垂直于崖面的石阶段。另外 town 场景里有 22 个候选因同层排斥被丢弃。
- **落点**：`src/core/surface-decoration.js`、`src/build/buildings.js`、`src/world/navgraph.js`、`src/world/navlayer.js`、`openings-r56.html`。
- **测试**：`tests/facade-runs.mjs`、`facade-doors-corners.mjs`、`openings-c05c-r56.mjs`。
- **截图**：`c05c-facade-town.png`、`c05c-fusion-stairs-facade.png`，与原尺寸 frame 30 对照。

## D · 钢架 / 道具 / 庭院

### 1257213678056857600 — done
- **片子机制**：同一座水上建筑被反复加高、削平，悬空体块下长出钢腿。腿落在码头或邻栋屋面上；落到坡顶时先竖直、再折一段斜杆内收，末端一个红垫块；长腿之间有系杆。
- **原缺**：腿只按本列竖直落下，会穿过邻栋；没有曲柄，也没有分段。
- **本轮做了什么**：新建 `steel-r56.js`。
  - 腿的落点取共享该角点的所有格里最高的实心层。
  - 落到坡顶时走曲柄，末端加垫块。
  - 长腿加系杆、Y 撑和接头。
- **判定**：done。折角比原片短。
- **落点**：`src/build/steel-r56.js`；`buildings.js` 加挂钩；`world.steelFrame` 开关；演示页 `build-r56.html`。
- **测试**：`tests/steel-frame-r56.mjs`。
  - 开关关闭时，与去掉挂钩的原文件逐浮点一致。
  - 34 根腿没有一根穿过邻栋；旧规则会穿过 12 根。
  - 12 个曲柄的脚点都在支撑屋面内。
- **截图**：`c05d-steel-a-{off,on}.png`，与原尺寸 frame 80 对照。

### 1189902695303458816 — done
- **原文要点**：钢梁支撑结构是 WFC 最擅长的地方。
- **片子机制**：长钢柱；隔一两层一道系杆，系杆下有 Y 撑，节点有接头；柱间有爬梯；柱子会落到更低体块的屋面上。
- **原缺**：只有通长柱加头梁斜撑。
- **本轮做了什么**：
  - 系杆层用约束求解（`solveTieLevels`）：同一簇共用一套系杆层，间隔不超过 2 层、不连层，取系杆最少的解。
  - 每道系杆下加 Y 撑，每个节点加接头箍。
  - 每簇选一个开间加爬梯。
- **判定**：done（机制层面）。这是本地约束规则，不是原版 378 个模块的 WFC。
- **落点**：`src/build/steel-r56.js`。
- **测试**：`tests/steel-frame-r56.mjs`。
- **截图**：`c05d-steel-tower-{on,off,mixed-on}.png`（主线复看过：长柱、两道系杆、Y 撑和爬梯，柱子落在下层蓝屋旁的码头上），与 frame 295 对照。

### 1279107097108635649 — done
- **原文要点**：拼图块巡览，545 块。
- **片子机制**：灰网格上平铺按签名分色的模块，镜头低空掠过，最后拉高俯视。
- **原缺**：没有零件目录页。
- **本轮做了什么**：新建 `module-catalog-r56.js` 和 `module-catalog-r56.html`。
  - 两种模式：本场景用到的（四边 27 / 混合 39，等于 `buildStats.modules`）；理论全集（四边 60 / 混合 88）。
  - 每块用真实建筑管线单独造出，重建后签名一致。
  - 分族平铺，镜头之字形飞过后拉高。
- **判定**：done。屋顶没有按签名上色；种类数口径与原作 545 不同，不冒充 545。
- **落点**：`src/build/module-catalog-r56.js`、`module-catalog-r56.html`。
- **测试**：`tests/module-catalog-r56.mjs`，148 块通过。
- **截图**：`c05d-catalog-all-mixed-high.png`、`c05d-catalog-all-quad-fly.png`、`c05d-catalog-used-fly.png`。

### 1246074663546916873 — done
- **原文要点**：道具出现、消失时有动画，比预想的难。
- **片子机制**：后院的树和灌木随布局变化弹出、缩没。
- **原缺**：r55 的动画层只管木箱和系缆桩，后院的树还在静态网格里。
- **本轮做了什么**：打开 `world.propAnimYard` 后，后院植物从静态网格移到动画层。
  - 每株有稳定 key。
  - 消失时保留旧几何先缩没；出现时从左到右错峰弹出。
  - 无变化的重建不重传。
- **判定**：done。树冠用的是八面体模板；矮墙和沿墙灌木仍是静态的。
- **落点**：`src/world/prop-anim-yard-r56.js`、`src/build/yard-r56.js`；`prop-anim-layer.js` 加了 2 个可选参数；`?yardanim=1` 打开。
- **测试**：`tests/yard-props-r56.mjs`、`prop-anim-layer.mjs`。
- **截图**：`c05d-propanim-{open-mid,reclose-mid,reclose-done}.png`、`c05d-index-town-on.png`，与 frame 29 对照。

### 1238474550511308800 — done
- **原文要点**：围合的区域会变成后院。
- **片子机制**：矮石墙沿小径把草地分成一块块小园，墙上有拱门洞；打开围合后又变回铺地。
- **原缺**：没有矮墙分区。
- **本轮做了什么**：`planYardWalls` / `drawYardWalls`。小径与草地之间砌矮墙，每个挨小径的小园恰好一个带半圆小拱的门洞。
- **判定**：done。植被比原片稀，没有长椅。
- **落点**：`src/build/yard-r56.js`；`?yardWalls=1` 打开。
- **测试**：`tests/yard-props-r56.mjs`（25 个小园各恰好一个门）。回归 `courtyards`、`garden-paths`。
- **截图**：`c05d-yard-{off,walls,walls-mixed}.png`，与 frame 123 对照。
