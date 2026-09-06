# 城堡建造管线重建 · 计划（v2 · 完整复刻 Townscaper）

> 立项：2026-09-03。v2 修订：2026-09-03 晚。独立于 `docs/OSKAR_OFFICIAL_PLAN.md`——那份记录资产与场效果缺口，
> 本文件只处理**算法本体**：城堡是怎么被生成、怎么被增量编辑的。
>
> 冲突时：**方法与术语**以 `OSKAR_OFFICIAL_PLAN.md` 第 0/1 节为准（来源表 S1–S21）；
> **本管线怎么改、怎么测、谁来做**以本文件为准。
>
> **v2 与 v1 的三点不同**（主人 2026-09-03 拍板）：
> 1. 目标从「换算法」升级为**完整复刻 Townscaper 三层管线**：不规则四边形网格 / WFC / 角落模块（marching cubes），外加 stencil 挖窗。v1 的非目标 N1、N2 改为后置阶段，不再是「不做」。
> 2. 补上 v1 漏审的事实：**仓库里已经有两个 WFC 求解器和一个 Half-Edge 图适配器**（V6 `constraintSolver.js`、V7 `procgen/wfc/*`），只是从未接到生产画面。阶段 2 从「手写求解器」改为「接线 + 补约束」。
> 3. 每一项标注 **[Grok]** 或 **[Claude]**，分工规则见 §9；每个 [Grok] 项在 `docs/CITADEL_GROK_TASKS.md` 有带伪代码的工单（G-01…G-19），派单只复制工单。
>
> **进度（2026-09-03 晚）**：阶段 0/1 已由 Claude 直接做完——门 A 无主 0、门 C 支架回收、门 D P50 558→90.9ms、门 E 生产复验。阶段 0 的实现是**拦截层组 `add`**（`citadelTown.js:1411–1437 ownCell/ownSpanning/stampOwner`），与下文 `makeCellSink` 等价、不改 52 个调用点。

## 0. 证据规则（沿用 OSKAR_OFFICIAL_PLAN 第 0 节）

三栏不混写：**来源事实**（附 URL / 原文）· **画面归纳**（只从公开视频读出）· **项目推导**（本仓库实测，附命令与数字）。

本文件所有「项目推导」数字均可复现，环境：`node v22.12.0` / `seed 20260808` / `latestDesign:true`。
代码行号以 2026-09-03 21:00 工作区为准（`citadelTown.js` 3002 行 / `odysseyCitadel.js` 3430 行）。

---

## 1. 为什么单独立项

OSKAR_OFFICIAL_PLAN 的 12 条缺口都是**加东西**：加岸浪、加 blob shadow、加 impostor。
本项目是**换算法**：城堡的网格拓扑、模块选型、几何装配、增量重建四者要一起改。

| | 资产/场效果缺口 | 本项目 |
| --- | --- | --- |
| 失败形态 | 少了个效果，画面差一点 | **几何丢失 / 重影 / 悬空构件**，玩家直接看到坏 |
| 验收方式 | 有没有那个 mesh / uniform | **不变量**（几何守恒、归属完备、无孤儿、求解确定性） |
| 回滚粒度 | 关一个开关 | 需要贯穿 `citadelTown` / `odysseyCitadel` / `geometryMerge` 的分阶段回滚点 |

2026-09-03 会话里，同一个根因（归属缺口）在四个不同表象下被追了十几个假设：悬空窗、整层墙消失、每层转向错位、增量重影。这说明它值得一个自己的文档。

---

## 2. 调研结论

### 2.1 Oskar 的三层管线（来源事实 S20 / S21 / mxgmn README）

S20（AI and Games 访谈，gamedeveloper.com）原文：

> It procedurally generates the **quadrilateral grids** … The **Wave Function Collapse** of Bad North is used to determine what building tiles are available … once tiles are selected, it uses the **marching cubes** of Brick Block to place them.

关键句逐字：

| # | 原文（S20 逐字） | 含义 |
| --- | --- | --- |
| ① | tiles no longer being complete chunks of building, but rather **corner segments** that can be more easily put together to create shapes that fit within the cells | 模块挂在**角柱**上，不是整格 |
| ② | uses a **stencil buffer** to cut [windows] out of the mesh **after it is placed**, rather than having the windows in the tiles themselves, given there would be many edge cases | 窗是事后挖的，不在 tile 里 |
| ③ | the **decoration** of a tile is **separate** from when it is generated | 先定模块，后装饰 |
| ④ | it is actually allowed to **fail silently** … the main place where that happens is with the **steel support structures** … **loose hanging steel structures** that aren't properly connected | WFC 对细长结构会失败，且被接受 |
| ⑤ | take a fixed **hexagonal grid**, breaking it up into **quads**, then breaking it up into quads **again** and then **moving some of the points** within the grid | 不规则网格 = 六边形 → 随机配对成四边形 → 再细分 → relaxation |
| ⑥ | the garden modules are **super high priority**, but they … can only exist … where they end up next to a wall | 花园是高优先级 recipe，只在封闭区可解 |
| ⑦ | the larger a structure becomes, one change **ripples through the entire connected area** | 传播范围 = 连通区域，这是延迟的来源 |
| ⑧ | I want the **larger shapes** to feel very **predictable**, but the **smaller shapes** are allowed to vary quite a bit | 硬约束管体块，软约束管细节 |

S21（gameres 877989，中文二手转述，只作旁证）：每个 Cube 不是一栋完整房子，房子由若干 4×n 模型块拼成；**每个 Cube 区块的模型根据当前网格的形状做扭曲**（= 模块顶点按不规则格笼形变形）；封闭庭院内**再跑一次 2D WFC** 放围栏/花园。

mxgmn README（来源事实）：最小 Shannon 熵启发式；传播 = AC-4 约束传播；矛盾 = 某格系数全零，NP-hard 所以不保证成功但「surprisingly rarely」；**simple tiled model** 用 D4 对称类缩短邻接表；高维「works completely the same way … though performance becomes an issue」。Notable ports 里点名 Oskar：*3D tiled models for irregular grids on spheres*、Bad North、Townscaper（*combining WFC with marching cubes on irregular grids*）。

### 2.2 视频证据（画面归纳 S19，本会话重新抽帧）

`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1291340/extras/629c1921d8f421a2605001922e524572.mp4`
（3.96s / 750×358；本会话经浏览器 `<video>` seek 抽 12 帧，拼图存 `docs/citadel-s19-frames.jpg`，每帧左上角标时间）

| t | 画面 | 归纳出的机制 |
| --- | --- | --- |
| 0.00 | 水面高亮一个**不规则四边形**（四边不等长、无直角） | 网格拓扑：S20⑤ |
| 0.35 | 放一格 → 石基座（seawall plinth）+ 红色**晒台带栏杆** | 单格孤立 = 平顶晒台；基座是 marching-cubes 式圆角包边 |
| 0.70 | 上面再叠一格 → 栏杆消失，变**人字坡屋顶小屋**，出现门、窗、基座上一段楼梯 | 上层格改变了**下层格**的模块（栏杆 → 墙）：邻接约束向下传播 |
| 1.05 | 旁边地面加一格 → 新晒台，基座**无缝**并入旧基座 | 角落分段（S20①）：基座在两格之间没有接缝 |
| 1.40 | 新格上叠一格 → 屋顶**整体**变成一个更宽的人字坡 + 烟囱，窗位重排 | 传播到整个连通区（S20⑦），不是只在新格出模型 |
| 1.75–2.10 | 稳定；下一格高亮 | — |
| 2.45 | 地面加格 → 晒台；基座继续无缝生长 | 同 1.05 |
| 2.80 | 晒台上**出现盆栽树、花箱**（2.45 帧还没有） | 装饰是滞后的独立 pass（S20③），约 0.3s 延迟 |
| 3.15 | 又一个不规则四边形高亮 | — |
| 3.50 | 放黄色柱 → **圆塔 + 锥顶**；红屋顶重解，**让位于圆塔** | 孤立 1×1 高柱 = 塔；颜色是玩家选的 per-cell 属性；相邻屋顶重解 |
| 3.90 | 塔再长一层 → 尖顶 + 竖排窗 | 窗位随体块重解而重排，且从不跨格角（S20②） |

三条对本项目最硬的画面结论：**(a)** 加一格会改邻居已生成的模块（栏杆→墙、坡顶→合并坡顶、坡顶→让塔）；**(b)** 基座/墙体在格与格之间无接缝；**(c)** 装饰晚于体块出现。查表式选型（哈希）做不出 (a)，整格模块做不出 (b)，装饰混在生成循环里做不出 (c)。

---

### 2.3 本仓库实测（项目推导）

**a) 生产路径的模块选型是纯哈希。** `TigerMessenger/src/world/citadelTown.js:65` 逐字：

```js
let h = (ix*374761393 + iy*668265263 + iz*2246822519
       + char.charCodeAt(0)*3266489917 + salt*1597334677
       + openMask*2971215073) >>> 0;
const pick = (family) => h % TOWNSCAPER_MODULE_FAMILIES[family].length;
```

无可能性空间、无熵、无传播、无矛盾处理、无回溯。`openMask`（`:1403`）只告诉该格自己哪几面临空 → **邻接采样**，不是**邻接约束**。选 A 格的模块永不改变 B 格的可选集。

**b) 仓库里已经有两个 WFC 求解器，v1 漏审了。**

| 层 | 文件 | 已有能力 | 状态 |
| --- | --- | --- | --- |
| V6 | `src/world/citadel/constraintSolver.js:262 solveDirtyRegion` | domain 初始化 → `minEntropyCell` → `propagate`（socket 相容）→ 回溯 ≤32 → `explainConflict` | `TESTED`（`tools/test_v6_g2_solver.mjs`，golden seeds 7/1/42/884，100 seed 零矛盾） |
| V7 | `src/procgen/wfc/solver.js solveWfc` + `propagator.js`（bitset / support-count 两种 AC 闭包）+ `backtracker.js`（Trail 回放）+ `orientationGroup.js`（NONE/Y4/D4/CUBE24）+ `socketCompiler.js` + `compatibilityTable.js`（预编译 BitSet）+ `partialObservation.js`（pins/bans）+ `conflictExplain.js` | 通用、纯数据、确定性 hash、禁 while-restart | `TESTED`（`tools/test_procgen_v7_all.mjs`，`docs/procgen-v7-baseline.md`） |
| 图 | `src/procgen/graph/halfEdgeGraph.js createHalfEdgeGraph` | **任意 n-gon 面列表** → cell-per-face 图，方向 token `e:{minVid}:{maxVid}`，非流形校验 | `TESTED` |
| 骨架 | `src/world/citadel/irregularSkeleton.js` | 方格 ID 不变、视觉 XZ 受限扰动（`SKELETON_AMP_CELL = 0.18`），门/梯/运河顶点锁定 | `TESTED` |
| MC | `src/procgen/field/marchingCubes.js` | 256 case 索引 MC（地形场用） | `TESTED` |

**但它们全部没有接到玩家看到的城堡上**：`src/scenes/messenger/loadCitadel.js:134` 逐字 `const v4Runtime = null;`，注释 *retired-five-terrace-topology*。V4/V6/V7 三代都是 Grok 交付的**数据层**，停在 `TESTED`，没有一代进过 `WIRED`。

**c) V6 求解器有引擎、弱约束。** `src/world/citadel/moduleCatalog.js:26 socketsFor`：除 hole/gate/balcony/stairs 外，所有家族六面 socket 都是 `wall`/`roof`/`support` 三个常量 → 47 模块 / 81 变体两两相容率实测 **74.9%**（水平四向 87.1%，竖向 50.6%；2026-09-03，headless 调 `uniqueTransforms` + `socketsCompatible` 全对枚举，命令见 TODOS C5）→ 传播很少缩小域 → 100 seed 零矛盾**主要不是因为约束好，而是因为约束弱**。这是 v2 阶段 2 的真正工作量所在：**socket 词汇表 + 角落分段目录**，不是求解器。

**d) 网格是抖动的方格，不是 Oskar 的不规则四边形。** `citadelTown.js:282–306`：`JITTER_AMT = 0.056`（格宽 4%），`makeDistortedCellGeometry`（`:442`）只把 BoxGeometry 的角点挪到抖动后的网格顶点；窗、栏杆、门、支架仍按正交偏移摆放。拓扑上每个顶点仍是 4 价方格，做不出 S19 t=0.00 那种四边不等长的格。

**e) 归属缺口 81%。** 层组内网格能否声明自己属于哪一格：

| 指标 | 值 |
| --- | --- |
| 有主 | 17,350 tris |
| **无主** | **74,098 tris（81.0%）** |
| 改用父链继承后 | 80.7%（几乎无效） |

无主 TOP：`town-balcony-rail` 13,680（18.5%）· `town-door-recess` 10,824 · `town-door-leaf` 10,824 · `town-balcony-flower-tile` 10,260 · `town-seawall-plinth` 3,564。父链继承无效，因为它们平级挂在 level 组下：`town-balcony-rail ← town-terrace-0-level-1 ← citadel-layer-1`。`citadelTown.js` 里裸 `levelGroups[iy].add(...)` 共 **52 处**。

**f) 悬空支架是回收漏了，不是 WFC 失败。** `citadelTown.js:2838` `town-support-edge` 网格挂在 `:2883` `town-support-pillar` Group 下，`userData.townModule` 打在 **Group** 上；`odysseyCitadel.js` 摘旧网格判据是 `o.isMesh && (userData.cell || userData.townModule)` → 杆件网格永远摘不掉。支架本身是确定性构造（向下找承重面 → 八面体四边桁架），必然连通。

**g) 增量重建靠整层重来。** `odysseyCitadel.js:2916 expandDirtyToWholeLevels`：改一格 → iy±2 五层全部格标 dirty → 删整层合并块 → 重建。P50 **558ms**（`tools/test_castle_building_experience.mjs`，门槛 150ms）。合并块局部替换原语 `src/world/citadel/mergedCellPatch.js dropCellsFromMerged` 已写好并通过 7 组单测，但归属率 19% 时试接重影 +6.9%，已回退。

---

### 2.4 S23 · 完整实机建城录像逐帧分析（2026-09-04）

**来源**：主人提供的 `docs/824177437-1-208.mp4`（Townscaper 移动版实机，1080×2160 / 30fps / **220.9s** / 6624 帧）。
X 上的原推（`OskSta/status/1277991976135204865`）未登录取不到（页面只给 *Sensitive Content / only available in the X app*，
`cdn.syndication.twimg.com` 也返回 TweetTombstone），本条以主人给的本地录像为准。

**抽帧产物**（都在 `docs/`）：`sheet_0..3.jpg`（0–215s，每 5s 一帧，4 张 4×3 拼图）·
`sheetA.jpg`（0–20s **每秒**一帧，建造机制）· `sheetB.jpg`（112–123s **每 0.5s** 一帧，钢结构）·
`z1.png`（155.5s 立面特写）· `z2.png`（121.2s 钢结构特写）。
复现命令见本节末。

这段录像比 S19 那 4 秒商店片值钱得多：它有**完整的从 0 到一座城**的过程、**撤销计数**（171s 面板显示「撤消 120」）、
**夜间光照**、**设置面板**，以及最关键的——**钢结构支架的生长全过程**。

### 2.4.1 建造机制逐帧（sheetA，0–20s，每秒一帧）

| t | 画面 | 机制 |
| --- | --- | --- |
| 2s | 第一格落水：**石基座从水里升起 + 顶面铺装 + 沿顶缘一圈红陶女儿墙**，四周一圈白色泡沫环与涟漪 | 单格 = 三件套（基座 / 铺装 / 护栏），不是一个「房子」 |
| 3→4s | 相邻加一格：两格的**基座无缝合并**，护栏**沿新的合并轮廓重新流动**——不是两个圈，是一条连续的边 | 角落分段（S20①）+ 护栏由**轮廓**驱动 |
| 5–8s | 继续加格成 L 形；护栏始终贴合外轮廓；铺装是暖灰石板 | 同上 |
| **9s** | 在某格**上面**叠一格 → **立刻变成一栋紫墙 + 麦黄坡屋顶的小房子**，且**该格原本的护栏消失** | 顶格 → 体块的角色切换（我们的 `terrace → body` + 新顶格出 `gable`）。护栏消失 = 护栏只属于顶格 |
| 10–12s | 小房子上陆续补出门、窗、檐口 | 装饰滞后（S20③） |
| **13s** | 房子**整栋消失**（撤销），护栏**立刻重新闭合**那一格 | 删格 → 顶格身份回退 → 护栏重新沿轮廓生成 |
| 14–17s | 继续加格；轮廓长出**内凹缺口**（17s 顶边一个 V 形凹角），护栏跟着凹进去 | 护栏是**轮廓函数**，凹角也要跟 |
| **18s** | 平台**中间**出现一个洞（内部格被删）→ 洞口**也镶一圈护栏** | **洞的内轮廓同样是轮廓**——这条我们现在漏了（见 §10.3） |
| 19–20s | 房子在别处重建 | — |

### 2.4.2 钢结构支架（sheetB 112–123s + z2.png 特写）

Oskar 说的 *loose hanging steel structures*（S20④）在这段录像里**完整长了出来**，形态与我们的八面体桁架**完全不同**：

| 特征 | Townscaper（z2.png 实测） | 我们现在（`citadelTown.js` `town-support-pillar`） |
| --- | --- | --- |
| 拓扑 | **两根细长竖柱**，贴着建筑外侧站立，与墙面留约 0.3 格间隙 | 四个环向节点 + 上下顶点组成的**八面体四边桁架** |
| 落脚 | 直接落在下方屋顶/平台上，**无基座** | 向下找承重面，同样无基座 |
| 连接 | 顶部**水平横梁**把两柱与被托的体块连起来；中段有**斜撑**（λ 形，跨过塔身的拱形凹龛） | 只有从环节点到上下顶点的斜边，无水平横梁 |
| 截面 | **扁方管**（矩形），深蓝灰，带极细高光边 | 0.075×0.075 方杆 |
| 托举对象 | **悬挑出建筑轮廓之外**的整块体块（带橙瓦屋顶的房间） | 悬空格本身 |
| 生长过程 | 113s 先出一根带拱脚的细柱 → 115s 变两腿带拱洞 → 118s 成完整钢架并托起悬挑体块 | 一次性构造 |

**结论**：形态差距是真实的，但**不改「构造式、必然连通」这条**（PLAN §3 问 2 / §4 N3）。
要改的是**几何**：两柱 + 横梁 + 斜撑 + 扁方管截面，见 §10.6。

### 2.4.3 立面（z1.png，155.5s 地面机位特写）

这是本次分析对「品质」最有价值的一张。逐项读数：

**墙**
- 石砌**错缝**（running bond），砖块宽高比 ≈ **2:1**，横缝清晰、竖缝逐行错开半块
- 每块砖**独立的低饱和色扰动**：米黄 / 浅粉 / 浅紫 / 浅绿，明度差 **≤ ±5%**——远看是一片米色，近看有织物般的碎色
- 墙面**本身不描边**；体块转角靠**明暗分界**分开（受光面偏暖白，背光面偏冷粉）
- 屋檐下沿与转角有**极细的白色高光线**（约 1px），这是让低模看起来「有厚度」的关键

**窗**
- 正方形，**2×2 十字窗棂**，玻璃**中蓝**，窗棂白
- 外框**白色厚边**（约窗宽 12%）且**微微外凸**，在墙上投下一道细影
- 同一面墙上窗**上下严格对齐**成竖列，**层高恒定**
- **山墙上是 45° 菱形小窗**（正方形旋转 45°，单格无棂）——山墙专用件，与普通立面窗不是同一个模块
- 窗**从不跨越转角**（S20② 用 stencil 事后挖除的原因）

**屋顶**
- 陶瓦橙红，**瓦垄是沿坡向的平行细线**
- 檐口**出挑**，剖面是**三层色带**：瓦面橙 → **白色檐板** → **暗红封檐**
- 屋脊有**暗红压顶**；屋顶边缘同样有白色高光线
- 矮房的屋顶**直接切进**高塔墙面，交接处**没有缝**（角落分段的直接证据）

**平台 / 附属**
- 铺装是**灰蓝石板**，不规则块，缝隙略深
- 女儿墙 = **红陶压顶 + 深色栏杆**两段式；阳台是**外挑**的深色金属栏杆 + 红陶花箱 + 绿植
- 树 = 小而圆的深绿树冠，根部有**贴地暗斑**（与 S17 一致）

### 2.4.4 水与光

- 水面**青绿**，岸线一圈**浅色泡沫带**；加/删格时有**扩散涟漪 + 白色水花**（一次性粒子）
- 171s 起玩家打开设置面板：**「网格」三档显示模式**（方块 / 圆 / 雪花图标）、**太阳位置二维摇杆**（方位 × 高度）+ 一条滑条，
  以及 `撤消 120 / 重做`——**撤销栈至少 120 步**
- 190–200s 太阳被拖到夜侧：整场变冷蓝，**窗口逐个亮起暖橙**（emissive），建筑保留剪影，水面暗下去

### 2.4.5 复现命令

```bash
M=TigerMessenger/docs/824177437-1-208.mp4
F=/usr/share/fonts/truetype/lato/Lato-Medium.ttf
# 全片概览（每 5s 一帧 → 4 张 4x3）
ffmpeg -i $M -vf "fps=1/5,scale=270:-1" -vsync 0 f_%03d.png
for i in 0 1 2 3; do ffmpeg -start_number $((i*12+1)) -i f_%03d.png -frames:v 12 \
  -vf "drawtext=fontfile=$F:text='%{eif\:(n+$((i*12)))*5\:d}s':x=6:y=6:fontsize=26:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=4x3" sheet_$i.jpg; done
# 建造机制（0-20s 每秒）与钢结构（112-123s 每 0.5s）
ffmpeg -ss 0   -t 21 -i $M -vf "fps=1,crop=1080:1500:0:250,scale=300:-1" -vsync 0 a_%03d.png
ffmpeg -ss 112 -t 12 -i $M -vf "fps=2,crop=1080:1500:0:250,scale=300:-1" -vsync 0 b_%03d.png
# 特写
ffmpeg -ss 155.5 -i $M -frames:v 1 -vf "crop=1000:1200:40:520,scale=760:-1" -update 1 z1.png
ffmpeg -ss 121.2 -i $M -frames:v 1 -vf "crop=760:1300:320:300,scale=560:-1" -update 1 z2.png
```

---

---

## 3. 三问的结论（v2）

| 问 | 答 |
| --- | --- |
| 1）建筑模型单元与 Oskar 拉齐？ | **否，差三级**：① 网格是抖动方格（4 价顶点），不是六边形细分再 relax 的不规则四边形；② 模块是整格 6 面，不是挂在角柱上的 corner segment；③ 模块几何没有按格笼形变形，只有 Box 角点跟着动，窗/栏杆/门仍正交摆放。 |
| 2）悬空支架与 Oskar 拉齐？ | **现象像，成因相反**。Oskar 的钢架是 WFC 域内模块，允许静默失败而悬空（S20④）；我们的支架是构造式、必然连通，「悬空」是回收漏（§2.3f）。**保持构造式**（N3）：Oskar 自己把悬空钢架称为失败，复刻失败没有意义。修复回收漏即可。 |
| 3）完善使用了 WFC？ | **生产路径完全没有**（哈希）。**仓库里有**两个求解器 + 图适配器，但 (i) 未接线（`v4Runtime = null`），(ii) socket 词汇表退化，47 模块/81 变体两两相容率实测 **74.9%**（水平 87.1% / 竖向 50.6%）。结论改为：**有引擎、弱约束、无接线**。 |

---

## 4. 目标与非目标（v2）

### 目标

- **G1** 层组内几何归属完备（无主 = 0），使合并块可按 `faceToCell` 区间局部替换。
- **G2** 增量编辑 P50 ≤ 150ms，且几何与全量重建偏差 ≤ 5%。
- **G3** 模块选型从哈希换成真 WFC：复用 V7 `procgen/wfc`，域 / 传播 / 最小熵 / 有限回溯 / 静默失败；**socket 词汇表有区分度**（门 H）。
- **G4** 装饰与生成分离，装饰可单独重跑，且滞后出现（S19 t=2.80）。
- **G5** 无孤儿构件：任何格被删后，其墙/窗/窗台/支架/栏杆全部消失。
- **G6（新）** 角落模块：模块挂在格角柱上，8-bit 邻域 mask → 角落分段，基座/墙体跨格无接缝（S19 t=1.05）。
- **G7（新）** 不规则四边形网格：六边形 → 随机配对 → 再细分 → relaxation；Half-Edge 拓扑；模块几何按格笼形变形；存档从 ASCII 方格迁移到 face id。
- **G8（新）** stencil 挖窗：窗洞由 stencil 事后挖除，与 `applyInkOutlines` BackSide 描边壳共存。

### 非目标（本期明确不做）

- **N3 支架进 WFC。** 见 §3 问 2。保留构造式规则，支架排除在域外。
- **N4 球面化。** 圣城是台地上的城，不放到球体上（S15 属于 Planet 线，不属于本项目）。
- **N5 战斗寻路图跟随不规则网格。** G7 阶段只保证 `citadelTacticalGraph` / `collision` 通过 face 重心继续采样；把寻路图改成 Half-Edge 是 Planet/Combat 线的事。

---

## 5. 分阶段设计（含分工）

阶段顺序：**0 → 1 → 2 → 3 → 4 → 5 → 6**。0/1 是地基；2 是算法核心；3 便宜；4/5 是「完整复刻」的两个大件；6 最后。每阶段独立可回滚。

### 阶段 0 · 归属声明（G1，前置）· [Grok 主做，Claude 验收]

所有后续阶段的地基。没有它，合并块无法局部替换，WFC 的增量传播也无处落地。

```js
// citadelTown.js —— 用带归属的收集器替换 52 处裸 levelGroups[iy].add(...)
function makeCellSink(levelGroups) {
  let current = null;
  return {
    enter(ix, iy, iz, char) { current = { ix, iy, iz, char }; },
    leave() { current = null; },
    add(iy, object) {
      if (!current) throw new Error("层组新增对象必须处于某个格的作用域内");
      object.traverse(o => { if (o.isMesh) o.userData.cell = current; });
      levelGroups[iy].add(object);
    },
    addSpanning(iy, object, cells) {   // 花园/庭院/连港步道/晾衣绳
      object.traverse(o => { if (o.isMesh) o.userData.cells = cells; });
      levelGroups[iy].add(object);
    },
  };
}
```

要点：`traverse` 而非只标根对象（直接修掉 §2.3f 支架）；`enter/leave` 作用域 + `throw`，让漏标在构建期就炸；跨格对象走 `addSpanning`。

**分工**：`makeCellSink` 本体、52 处替换、`tools/audit_cell_ownership.mjs`、`tools/test_cell_ownership.mjs` → **[Grok]**（输入输出完全由脚本判定）。哪些对象算跨格、格集怎么列 → **[Claude]** 先给清单，Grok 照单改。
**验收**：装配结束断言无主几何 `=== 0`。

### 阶段 1 · 合并块局部替换（G2）· [Claude 接线，Grok 回归]

代码已写好并通过单测，只差归属覆盖率：`mergedCellPatch.js`（`dropCellsFromMerged` / `mergedTriangleCount`）+ `tools/test_merged_cell_patch.mjs`（7 组，含「未被摘顶点逐位不变」）。

接线三步（都在 `odysseyCitadel.js` 增量路径里，跨 `geometryMerge.js`，**[Claude]**）：

1. `geometryMerge.js`：`onOutline` 补 `segments`；已合并描边块可被重新吸收。
2. `odysseyCitadel.js` 第 2 步：整块删 → `dropCellsFromMerged` 区间压缩。
3. 摘掉 `expandDirtyToWholeLevels`（`:2916`）。

**[Grok]**：`collectFaceToCell` 覆盖面与摘旧网格判据逐字一致的对照测试；门 B/D/E 回归脚本。

### 阶段 2 · 真 WFC（G3）· [Claude 设计约束，Grok 接适配器]

**不再手写求解器。** v1 的伪代码作废，改为复用 V7：

```
citadel grid ──(graph adapter)──▶ procgen/wfc/solver.js solveWfc({ graph, compiled, table, seed, pins, bans })
      │                                   ▲
      │ 8-bit 邻域 mask → bans（partialObservation）   │ compileVariants(prototypes) + compileCompatibilityTable
      ▼                                   │
 模块原型（ModulePrototype，faces 六向 socket，orientationGroup Y4/D4）
```

三件事，两种人：

| 子项 | 内容 | 归属 | 为什么 |
| --- | --- | --- | --- |
| 2a socket 词汇表 | 把现有 8 家族 + roof/bridge/gate/flowerTile 重新定义为**有区分度**的 face socket（例：`wall.solid` / `wall.window-slot` / `roof.gable-N` / `roof.gable-E` / `terrace.rail` / `plinth` / `air` / `support`），对称性用 `orientationGroup`（Y4 为主，D4 给对称件）；花园/庭院高权重 + 只在封闭区可解（S20⑥） | **[Claude]** | 这是「像不像 Townscaper」的全部判断，没有脚本能替 |
| 2b 适配器与接线 | `src/world/citadel/wfcGraphAdapter.js`：把 `citadelTown` 的 `grid`（`ix,iy,iz`）喂成 V7 `graph`（`cells()/neighborsOf()/cellId()`，方向 token N/E/S/W/U/D）；`openMask`/承重面/门格 → `pins`/`bans`；结果 `assignment` → `{family, variant, rot}` 与现有 `townscaperModuleSelection` 同形 | **[Grok]** | 接口两端都已存在且有测试，纯胶水 |
| 2c 等价 golden | 先只接**选型层**：输出仍是同一批模块 id，用 hash golden 证明与哈希路径等价（约束全开为 `any` 时）；再逐步放开 2a 的约束 | **[Grok]** 写脚本，**[Claude]** 判断哪些差异是「变好了」 | — |

设计约束：花园类高优先级；**支架排除在域外**（N3）；传播必须确定性（同 seed 同布局同 hash，供 golden）；静默失败 = `explainFailure` 返回的格标 `unresolved`，画面留空不塞默认模块，并在 devPanel 里可枚举（门 G）。

### 阶段 3 · 装饰与生成分离（G4）· [Grok]

S20③。装饰（窗台/花箱/晾衣绳/小鸟/盆栽）从 `buildCitadelTown` 的家族循环里拆成独立 `decoratePass(assignment, sink)`，输入是阶段 2 的 assignment，归属走阶段 0 的 `sink.add`。滞后出现（S19 t=2.80）用现成的 400ms 去抖合并：体块先合并，装饰下一帧再合并。
**[Grok]**：拆分、`tools/test_decor_pass.mjs`（装饰单独重跑体块 hash 不变）。**[Claude]**：只审「哪些属于装饰」的边界清单。

### 阶段 4 · 角落模块（G6）· [Claude 目录，Grok 求解与测试]

模块不再挂在「格」上，而是挂在「角柱」上（S20①，marching cubes）：

```js
for (const corner of gridCorners) {            // (gx, gz, iy)：格顶点 × 层
  const mask = cellsAround(corner)             // 周围 4 格 × 上下 2 层 = 8 bit
    .reduce((m, solid, i) => m | (solid << i), 0);
  // mask → 允许的角落分段家族（256 → 按 D4 归并**恰 55 类**，Y4 则 70 类；2026-09-03 已算）
  bans.push(...variantsNotMatching(mask));     // 交给 V7 partialObservation
}
// 然后在角柱图上跑 solveWfc：角柱之间的 socket 约束负责屋顶走向、栏杆连续、基座无缝
```

先做原型（`townscaper.html` 内 `?cornerModules=1`），不直接替换生产路径。评估点：模块数量、接缝质量、与 15 色调色板兼容。

**[Claude]**：角落分段目录（哪 20–30 件、每件 8-bit mask 与六向 socket）、笼形变形规则。**[Grok]**：mask 枚举与对称归并脚本（`tools/gen_corner_mask_table.mjs`，输出 256 → 基础件映射表 + 覆盖率断言）、角柱图适配器、接缝零间隙测试（相邻角柱共享边顶点逐位相等）。

### 阶段 5 · 不规则四边形网格（G7）· [Grok 生成器，Claude 迁移与形变]

S20⑤。分四步：

1. **网格生成（纯数学，[Grok]）**：`src/procgen/graph/irregularQuadGrid.js`：固定六边形网格 → 三角形随机配对成四边形（剩余三角形保留）→ 每个面再细分成四边形（Catmull–Clark 式一分四）→ 顶点 relaxation（每个四边形朝正方形收敛，N 轮，锁定边界与门/梯/运河顶点）→ 输出 `faces[]` + `positions[]` 喂 `createHalfEdgeGraph`。不变量：全部面是四边形；无自交；最小内角 ≥ 45°；边长比 ≤ 2；同 seed 同 hash。
2. **存档迁移（[Claude]）**：现有 ASCII `levels[]`（25×25 方格）→ face id 存档 v6：每个 ASCII 格映射到最近 face 重心；`citadelLevelsKey` 升 v6；旧档可回读（保留方格作为 fallback 布局）。编辑器拾取从 `(ix,iz)` 改为 face id。
3. **笼形变形（[Claude]）**：模块几何在单位格里建模，装配时按所在四边形四角 + 层高做双线性 × 线性插值（S21「按网格形状扭曲」）；`makeDistortedCellGeometry` 退役。角落模块（阶段 4）天然按角柱放置，只需把角柱位置换成 relax 后的顶点。
4. **下游最小适配（[Grok]，按 Claude 清单）**：`citadelTacticalGraph` / `collision` / `citadelBlueprint` 改为从 face 重心采样；不重写寻路（N5）。

### 阶段 6 · stencil 挖窗（G8）· [Claude]

S20②。窗不再是贴在墙上的 `town-window` 几何：窗框网格写 stencil（`stencilWrite` / `stencilRef` / `stencilZPass = ReplaceStencilOp`），墙体材质 `stencilFunc = NotEqualStencilFunc` 在窗位丢弃片元，再画窗内壁与玻璃。与 `applyInkOutlines`（`odysseyCitadel.js:1205`，BackSide 放大壳）的冲突：描边壳也必须做同一 stencil 测试，否则窗洞里露出黑壳。先在 `townscaper.html` 原型（`?stencilWindows=1`），量 draw call 与 renderOrder；确认后再进生产。
**[Grok]**：窗位不跨格角的几何断言（`tools/test_window_stencil_positions.mjs`）。

---

## 6. 验收门槛（v2）

未勾 = 未在生产路径上证明。禁止改 expected 迁就旧行为。

| 门 | 判据 | 当前 | 归属 |
| --- | --- | --- | --- |
| A · 归属完备 | 装配后无主几何 `=== 0` | ✅ 0（2026-09-03，`tools/test_cell_ownership.mjs`） | 阶段 0 |
| B · 几何守恒 | 增量 vs 全量三角形偏差 ≤ 5%，双向 | ✅ 单次逐格精确（`test_edit_exactness`）；20 次累积 3.5%，残余在查 | 保住 |
| C · 无孤儿 | 删格后墙/窗/窗台/支架/栏杆全消失 | ✅（`tools/test_support_orphan.mjs`） | 阶段 0 |
| D · 编辑延迟 | P50 ≤ 150ms | ✅ **90.9ms**（P90 112.9；WFC 路径待测） | 阶段 1 |
| E · 合并块局部替换 | 未被摘顶点逐位不变 | ✅ 已接线（`dropCellsFromMerged` 区间压缩；`expandDirtyToWholeLevels` → `citadelAffectedLevels`） | 阶段 1 |
| F · WFC 确定性 | 同 seed 同布局 → 同 hash；编辑后传播锥外 hash 不变 | 未开始 | 阶段 2 |
| G · WFC 可解释 | 矛盾格可枚举并定位，不靠整城重启 | 未开始（V7 `explainFailure` 已有，未接） | 阶段 2 |
| **H · 约束有区分度（新）** | 随机 100 对模块两两相容率 ≤ 40%；100 seed 中至少 1 个 seed 出现 ≥ 1 次域收缩到 1 的传播 | V6 目录相容率 **74.9%**（水平 87.1%） | 阶段 2 |
| **I · 传播可见（新）** | 复现 S19 t=0.70：孤立格加盖 → 该格模块从 `terrace.rail` 变为 `wall`；t=1.40：两格并排加盖 → 屋顶变为一个共享脊的 gable | 未开始 | 阶段 2/4 |
| **J · 角落无缝（新）** | 相邻角柱共享边上的顶点逐位相等；基座跨格零间隙 | ✅ 2026-09-05 `tools/test_corner_seams.mjs`：任选件 3546 对 / 两侧同件 1840 对，不对齐 **0** | 阶段 4 |
| **K · 不规则网格有效（新）** | 全四边形、无自交、最小内角 ≥ 45°、边长比 ≤ 2、同 seed 同 hash；ASCII→face 迁移双向可逆 | ✅ 上半（内角 50.49° / 边长比 1.977）+ ✅ 下半 `tools/test_grid_migration.mjs`（P95 0.790 / 0.778 · hash `0b70f22c`） | 阶段 5 |
| **L · stencil 窗（新）** | **（新增前置）renderer 必须显式申请模板缓冲**；窗洞里不露描边壳；窗位不跨格角；draw call 增量 ≤ +2/层 | ⚠️ 前置 ✅ 2026-09-05 已修（见 §6.1）· 窗位 ✅ 420 窗跨格角 0 · draw call ✅ +2/层 · **「不露描边壳」仍待目视** | 阶段 6 |


### 6.1 · 门 L 的前置：模板缓冲（2026-09-05 补）

门 L 原来只写了三条画面判据，漏了最底下那条**物理前提**：模板测试要生效，
renderer 得先申请模板缓冲。本仓库 vendor 的 three（r163+）里
`new THREE.WebGLRenderer({...})` 的 `stencil` 默认是 **false**（早年默认 true，r163 翻了过来），
而现网四处创建 renderer 的地方**一处都没传过它**。实测（云端 Chromium，真 GL 上下文）：

| renderer 写法 | `gl.getParameter(STENCIL_BITS)` | 结果 |
| --- | --- | --- |
| 修之前 | **0** | 模板测试恒真，`?stencilWindowsV1=1` 打开也不挖洞 |
| 传 `stencil: true` | 8 | 才谈得上挖 |

两个无头脚本（`probe_stencil_windows` / `test_window_stencil_positions`）只查材质状态
与网格计数，**拿不到真 GL**，所以两边都漏了。已修 `src/core/stage.js`（按
`P.stencilWindowsV1` 条件申请，关着时不为它付带宽）、`src/planet/main.js`、
`townscaper.html`，并在 `test_window_stencil_positions.mjs` 末尾加了一条**源码级**断言兜底。

### 6.2 · 按 §8 的完成定义，阶段 2 / 4 / 5 / 6 都还不算完成

§8 写死了：「生产代码路径消费该改动（不是死文件、**不是只在 `?flag=1` 下 import**）」。
现状是**四个开关默认全 false**：`P.wfcTownV1` / `P.cornerModulesV1` /
`P.irregularGridV1` / `P.stencilWindowsV1`。
也就是说这四个阶段正停在 §7 风险表点名的那个坑里——
「**Grok 交付停在 TESTED**（V4/V6/V7 三代先例）」，只不过这回停在 Claude 手上。
翻默认是它们唯一剩下的工作，且必须**一次一个**、每次带截图对照 + 全量回归。

---

## 7. 风险（v2）

| 风险 | 应对 |
| --- | --- |
| 阶段 0 漏标不会报错，只会悄悄丢几何/留重影 | `enter/leave` 作用域 + 构建期 `throw` + 无主断言，三重守门 |
| 跨格对象归属定义模糊（花园/庭院/步道） | `addSpanning` 显式列举格集，任一 dirty 即整体重建 |
| **再造一个求解器**（v1 伪代码的诱惑） | 阶段 2 只允许改 `procgen/wfc` 之外的适配器；求解器改动必须先过 `test_procgen_v7_all.mjs` |
| **有引擎弱约束**（V6 覆辙：相容率 74.9%） | 门 H 用数字守：相容率 ≤ 40%，且必须观察到域收缩 |
| WFC 对细长结构求解差（S20④） | 支架/晾衣绳/步道排除在域外，保留构造式规则 |
| 阶段 2 改坏了不易察觉 | 先接选型层（同一批模块 id），hash golden 对比；确认等价后再放开新规则 |
| 阶段 5 牵动编辑器/寻路/水系 | 存档双轨（方格 fallback）；下游只改采样点不改算法（N5）；`?irregularGrid=0` 一键回退 |
| stencil 与描边壳冲突 | 原型先行；壳材质同做 stencil 测试；量 draw call |
| **Grok 交付停在 TESTED**（V4/V6/V7 三代先例） | Grok 任务的完成定义强制包含「被生产路径 import 且开关可开」，否则不勾；接线一律 Claude |
| 中途回滚丢失已修正的几何正确性 | 每阶段独立可回滚；阶段 1 未证明前不摘 `expandDirtyToWholeLevels` |

---

## 8. 完成定义

一个阶段只能在同时满足时标完成：

- 有非零退出的脚本，命令写进 TODOS；
- 生产代码路径消费该改动（不是死文件、不是只在 `?flag=1` 下 import）；
- 门槛表对应行转绿，且其余行不倒退；
- 开关默认值没有被测试偷偷改掉；
- Grok 交付的项由 Claude 跑过脚本并核过接线后才勾。

---

## 9. 分工规则：什么给 Grok，什么必须 Claude

判据不是「难不难」，是**能不能被脚本判定 + 会不会跨文件动生产路径**。

**给 Grok 的任务必须同时满足**：
1. 输入输出可以写成一个 `tools/*.mjs` 断言（hash、计数、不变量）；
2. 改动集中在 ≤ 2 个文件，或是新建文件；
3. 不动 `odysseyCitadel.js` 的增量路径、不动 `loadCitadel.js` 的接线、不改任何开关默认值；
4. 规格由 Claude 先写清（接口签名、不变量、golden 值来源）。

符合的类型：审计/统计工具、纯数学生成器（六边形细分、relaxation、mask 枚举）、适配器胶水（两端接口都已存在）、机械替换（52 处 `add`）、回归脚本、对称归并表。

**必须 Claude 的任务**：
1. 任何「像不像 Townscaper」的判断：socket 词汇表、角落分段目录、装饰边界、笼形变形规则；
2. 跨 `citadelTown` / `odysseyCitadel` / `geometryMerge` 的接线与回滚点；
3. 存档格式迁移（v5 → v6 face id）；
4. 渲染管线（stencil / 描边壳 / renderOrder）；
5. 审核每一份 Grok 交付：跑脚本、核接线、决定勾不勾。

**先例**：V4-G0、V6-G2、V7-G3 都由 Grok 完成且测试全绿，但三代全部停在数据层，生产画面至今走哈希。这不是 Grok 写得不好，是**接线从来没分配给它、也不该分配给它**。v2 把这条写死。

---

## 10. 品质复刻说明（S23 实测 → 逐条可施工规格）

> 这一节回答的不是「用什么算法」（§5 已经回答了），而是**「同样的算法，为什么他的好看、我们的不好看」**。
> 每条都给：**画面证据 → 现状差距 → 怎么改 → 怎么验收**。数字全部来自 `z1.png` / `z2.png` / `sheetA` / `sheetB` 的读数。
>
> 施工顺序建议：**10.1 → 10.3 → 10.2 → 10.4 → 10.6 → 10.5 → 10.7**（先立面，因为它占画面 80%）。

### 10.1 石砌墙：碎色 + 错缝，是「有质感」的全部来源

**证据（z1）**：错缝砌法，砖宽高比 ≈ 2:1；每块砖颜色独立微扰（米黄/浅粉/浅紫/浅绿），**明度差 ≤ ±5%**；
墙面本身不描边；转角靠明暗分界；屋檐下沿与转角有 ~1px 白色高光线。

**差距**：我们的 `applyPatchyWallColors` 是按格给整面墙一个色，**没有砖级碎色**；描边靠 `applyInkOutlines` 全局黑描边，
所以转角是黑线而不是明暗分界，远看发脏。

**怎么改**（`citadelTown.js` 立面几何 + 材质）：
1. 墙面 UV 按**世界坐标**取模，砖尺寸固定（建议 `brick = cs/6 × ch/12`，即一层 12 皮砖），保证跨格连续、不随格缩放。
2. 砖色 = `baseColor * (1 + noise)`，`noise = (hash(brickX, brickY, brickZ) / 2^32 - 0.5) * 0.10`（即 ±5%），
   再叠一个**色相扰动 ±4°**——不要动饱和度，一动就脏。
3. 错缝：`brickX += (brickY % 2) * 0.5`。
4. **取消墙面的黑描边**，改为：受光面 `+6%` 明度、背光面 `-8%` 明度并偏冷（蓝移 3%）。
5. 檐下 / 转角的白高光线：用现有 `backlitHighlight.js` 的反向壳，但把宽度压到 1px 量级、只在**上边缘**显示。

**验收**：`tools/test_wall_brick_texture.mjs`——同一栋楼相邻两格的砖缝**必须对齐**（跨格 UV 连续，误差 <1e-4）；
砖色直方图的明度标准差落在 `[0.015, 0.035]`（太小=没质感，太大=发花）。

### 10.2 窗：三件套 + 竖列对齐 + 山墙专用件

**证据（z1）**：正方形 2×2 十字窗棂；玻璃中蓝；窗棂白；**白色厚外框（窗宽 12%）且微微外凸**，在墙上投细影；
同一面墙窗**上下严格对齐成竖列**、层高恒定；**山墙上是 45° 菱形单格窗**；窗**从不跨越转角**。

**差距**：我们的 `town-window` 是一块拱形几何贴在墙上，没有外框厚度、没有竖列对齐（`faceSeed` 每层重算导致窗位漂移）、
山墙没有专用件。

**怎么改**：
1. 窗做成**三件**：`window-frame`（白，外凸 0.02，比洞口大 12%）+ `window-glass`（中蓝，内凹 0.01）+ `window-mullion`（白十字，2×2）。
2. 竖列对齐：窗位只由 `(ix, iz, 面朝向)` 决定，**iy 不进哈希**——同一竖列所有层用同一个 `faceSeed`，
   层高 `ch` 恒定，窗中心固定在 `cy(iy) - ch*0.08`。这条和「竖向叠加共棱」是同一类 bug，改法也一样。
3. 山墙菱形窗：新增 `town-gable-diamond`，只在 `roof.gable` 分量的**山墙端**出，正方形旋转 45°，无棂。
4. 窗不跨转角：窗的 AABB 必须完整落在单格内（这正是门 L 的断言，见 C11）。

**验收**：`tools/test_window_alignment.mjs`——同一竖列（同 ix,iz,朝向）所有层的窗**世界 X/Z 完全相同**，
Y 间距恒等于 `ch`；每个窗的 AABB 落在单格内；山墙件只出现在 gable 分量端头。

### 10.3 女儿墙 / 护栏：它是**轮廓函数**，不是格属性

**证据（sheetA 2s/3s/13s/17s/**18s**）**：单格落地就有一圈红陶女儿墙；加格后护栏**沿合并后的新轮廓重新流动**；
删格后**立刻闭合**；轮廓内凹（17s V 形缺口）时护栏跟着凹进去；**平台中间挖洞（18s），洞口内轮廓也镶一圈护栏**。

**差距**：我们的 `town-fence` 按「该格某一面临空」逐面生成，所以
① 相邻两格的护栏段是两个独立对象，接缝处会顶牛；② **内部洞的轮廓完全没有护栏**。

**怎么改**：
1. 护栏改为**轮廓 pass**：先求顶格集合的**边界环**（外环 + 所有内环/洞环），再沿环生成**一条连续折线**，
   在每个环角处做斜接（miter），而不是逐面拼段。
2. 剖面固定两段：**红陶压顶**（上，宽 0.14cs）+ **深色栏杆**（下，露空）。
3. 归属：整条环是跨格构件 → `ownSpanning(环上所有格)`，与 §5 阶段 0 的口径一致。

**验收**：`tools/test_rail_outline.mjs`——① 护栏折线是**闭合环**且顶点数 = 边界边数；
② 挖一个内部洞后，洞的内环必须出现一条新的闭合护栏；③ 相邻段共享端点**逐位相等**（无接缝）。

### 10.4 屋顶：檐口三层色带，是「精致」的来源

**证据（z1）**：瓦垄沿坡向的平行细线；檐口出挑，剖面自上而下是 **瓦面橙 → 白色檐板 → 暗红封檐**；
屋脊暗红压顶；屋顶边缘有白色高光线；矮房屋顶**直接切进**高塔墙面且无缝。

**差距**：我们的 `makeGableRoofGeometry` 只有两片坡面 + 山墙三角，檐口是**一条硬边**，没有檐板/封檐，
所以屋顶看起来像纸片。

**怎么改**：在 `makeGableRoofGeometry` 的檐口位置加**两圈薄边框**——白色檐板（高 0.03ch，出挑 0.04cs）+
暗红封檐（高 0.02ch）；屋脊加一条暗红压顶棱柱；瓦垄用 UV 平铺的细线纹理（不要几何）。

**验收**：`tools/test_roof_eave_profile.mjs`——每片屋顶的檐口必须存在三个材质分组（瓦/檐板/封檐），
且封檐的 Y 低于檐板、檐板低于瓦面。

**2026-09-04 实现记录（C13-4 已完成）**：檐板/封檐**不做进 `makeGableRoofGeometry`**，而是
`addEaveBands(cells, iy, alongX)` 按**整条屋脊**挂两片薄板（±落水侧各 檐板 + 封檐 = 4 个网格）。
逐格版（4N 个网格）实测把 edit P50 从 112ms 顶到 187ms；run 级版 P50 112ms / P90 195ms，
反而比不加檐口的对照组还略快。真实檐口本来也是一条连续的线，逐格拼会在格缝露接头。
瓦垄按本节要求走 UV 而非几何：`makeTownPatternTexture("roof")` 每 8px 一垄（垄脊 +7/255、垄沟 −7/255），
**不加 stagger**——垄沿坡向直下，不随砖行错缝走。屋脊压顶改用与封檐同一档暗色。

### 10.5 平台与水：泡沫带 + 一次性涟漪

**证据（sheetA 2s / sheet_0）**：岸线一圈**浅色泡沫带**；每次加/删格有**扩散涟漪 + 白色水花**（一次性粒子）；
铺装是灰蓝石板、不规则块、缝隙略深。

**怎么改**：泡沫带复用 `highlandShoreWaves.js` 的烘焙器（S13），沿**城堡轮廓环**再生成一条窄带；
编辑涟漪 = 在编辑格世界坐标处发一个 1.2s 生命的扩散环 + 6 个白色小片，纯表现层、不进 dirty。

**验收**：`tools/test_edit_ripple_fx.mjs`——一次编辑恰好产生 1 个涟漪对象，1.2s 后自动回收，且**不进入合并块**。

**2026-09-04 实现记录（C13-5）**：涟漪落地在新模块 `src/world/citadelEditFx.js`；
「不进合并块」不是靠把 FX 放在城堡组外面碰运气，而是 `mergeStaticGroup` 明确跳过整棵
`userData.transientFx` 子树（靠 traverse 先序：父先入集合，子查父即可继承，不回溯父链），
测试把涟漪**故意挂进被合并的 root 里**来验证。
泡沫带的两个纯函数（`traceGridOutlineRings` / `bakeContourFoamBand`，与 S13 同一套属性 schema）
已经写好并有回归，但**默认没挂进场景**（`P.foamBandV1 = false`）：S13 的岸浪带早就因为
「近白色 foam shader 在当前海面构图里读成悬浮白条」被摘掉，轮廓带用同一个 shader，
同一个毛病会原样复现。这一条要等着色单独过一轮，不属于 §10.5 的几何/数据部分。

### 10.6 钢结构支架：改几何，不改「构造式」

**证据（z2）**：**两根扁方管竖柱**贴着建筑外侧（间隙约 0.3 格），顶部**水平横梁**连到被托体块，
中段**λ 形斜撑**跨过塔身的拱形凹龛，柱脚直接落在下方屋顶/平台，深蓝灰 + 极细高光边；
被托的是**悬挑出轮廓之外**的整块体块。

**差距**：我们是「四个环向节点 + 上下顶点」的八面体桁架，从格中心向下发散——拓扑和观感都不对。

**怎么改**（`citadelTown.js:2838` 一带，保持构造式、保持必然连通）：
1. 竖柱数从 4 → **2**，位置贴在**悬空格朝向最近承重面的那一侧**，间距 = 0.62cs，离墙 0.3cs。
2. 截面换**扁方管** `0.10 × 0.05`（长边朝外），材质深蓝灰 + 上缘高光。
3. 顶部加**水平横梁**（连两柱与体块底面）；高度 > 2 层时在中段加一道 **λ 斜撑**（两根斜杆交于柱中点）。
4. 归属仍用 §2.3f 的 `traverse` 打标，跨格时走 `ownSpanning`。

**验收**：`tools/test_support_shape.mjs`——每组支架恰有 2 根竖柱 + 1 道横梁（+ 高度>2 时 2 根斜撑）；
所有杆件端点连通到承重面（保持「必然连通」不变）；`test_support_orphan` 不倒退。

**2026-09-04 实现记录（C13-6 已完成）**：上面第 1 条的「离墙 0.3cs」落地成**柱轴离格心 0.30cs
（= 距墙面 0.20cs）**，柱子仍在格投影内。原因是承重面就在 (ix,iz) 正下方：真把柱子挪到墙外 0.3 格，
柱脚就踩空，本节反复强调的「构造式、必然连通」当场失效。z2 里的塔是圆的，管子才看着在轮廓外；
我们的格是方的，贴着立面已经是能做到的最像。这条约束写成了测试 ③（两根柱脚必须落在格投影内），
从此「必然连通」有机器化表述，不再只是一句注释。
另外每格支架的网格数从 8（4 组 × 2 根边）降到 3~5（2 柱 + 1 梁 + 可选 2 斜撑），
edit P50 顺带从 112ms 压到 98ms。

### 10.7 光与夜：窗自发光 + 太阳二维摇杆

**证据（sheet_2 150–165s / sheet_3 190–200s）**：太阳位置是**二维摇杆（方位 × 高度）**+ 一条滑条；
拖到夜侧后整场变冷蓝，**窗口逐个亮起暖橙**（emissive），建筑保留剪影，水面压暗。

**差距**：我们有 `highlandLightVolumes.js`（S18 落地）与 `windowDark/windowLit` 材质切换，但**没有把太阳方向做成可调**，
夜间是按 `P.timeOfDay` 曲线自动跑的。

**怎么改**：`devPanel` 加一个二维摇杆写 `P.sunAzimuth / P.sunElevation`，`dayNight.js` 优先读它；
窗 emissive 强度按「太阳高度 < 0」平滑上升，逐窗随机相位（不要整城同时亮）。

**验收**：`tools/test_sun_rig.mjs`——摇杆写入后 `lightingDirector` 的主光方向在 1 帧内跟随；
夜间窗 emissive 的逐窗相位差 > 0.3s（不同时亮）。

**2026-09-04 实现记录（C13-7 已完成）**：核心是新模块 `src/world/sunRig.js`，**纯函数**（不 import Three.js、
不读 DOM、不读 P），所以"光"和"窗"这两件事都能 headless 测。
「1 帧内跟随」不需要额外做什么——`lightingDirector` 的一阶平滑本来就只平滑 intensity，方向是直传。
窗这边的实际改动比本节写的更深一层：原来 `night` 是**布尔阶跃**（0.82 一到全城同时亮），
所以"逐窗相位"根本无处安放。改成**夜色浓度 nightFactor(高度角)** 之后，每扇窗按身份哈希出自己的阈值，
跨过才亮，错相就是浓度曲线的自然结果，不用额外计时器。实测 200 扇窗铺开 2.68s。
另外原来当晚重掷用的是 `Math.random()`——夜景不可复现、截图没法比对，一并换成确定性哈希。

### 10.8 一句话总结

Oskar 的「好看」不来自更强的算法，而来自**四件小事**：
**砖级碎色**（10.1）、**窗的三件套与竖列对齐**（10.2）、**檐口三层色带**（10.4）、**护栏是轮廓而不是格属性**（10.3）。
这四件都不依赖 WFC / 角落模块 / 不规则网格——**现在就能做，而且做完立刻能看见**。
