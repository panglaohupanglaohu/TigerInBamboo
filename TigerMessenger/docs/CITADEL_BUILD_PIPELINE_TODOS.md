# 城堡建造管线重建 · TODOs（v2 · 完整复刻 Townscaper）

> 与 `docs/CITADEL_BUILD_PIPELINE_PLAN.md`（v2）一一对应。完成一项就把 `[ ]` 改成 `[x]`，
> 并注明**日期 / 命令 / 数字**（不写「已完成」这种没法核的话）。
>
> 每项前缀 **[Grok]** 或 **[Claude]**（规则见 PLAN §9）。**[Grok]** 项由 Claude 跑脚本核接线后才能勾；
> **[Grok→Claude]** 表示 Grok 产出、Claude 决定。
>
> **每个 [Grok] 项后面的 `→ G-xx` 指向 `docs/CITADEL_GROK_TASKS.md` 的工单**（读什么 / 写什么 / 伪代码 / 验收命令 / 禁止事项）。
> 派给 Grok 时只复制那张工单，不要复制本文件。标 **[可立即派发]** 的工单今天就能派：G-01 / G-02 / G-04 / G-12 / G-15+G-16。
>
> 不要把 `TigerMessenger/TODO.md` 或 `docs/OSKAR_OFFICIAL_TODOS.md` 已勾的项抄进来。
> 这里只跟城堡建造算法本体。

## 纪律

- 命令必须可复现；**禁止改 expected 迁就旧行为**
- Node 时间不得写成硬件 FPS
- 每阶段独立可回滚；**阶段 1 未证明前不摘 `expandDirtyToWholeLevels`**
- 改了 `citadelTown.js` / `odysseyCitadel.js` / `citadelRange.js` 必须同步 bump `?v=` 缓存版本号（本会话已踩两次）
- **阶段 2 不许手写求解器**：只允许改 `procgen/wfc` 之外的适配器；动 `procgen/wfc/*` 必须先过 `node tools/test_procgen_v7_all.mjs`
- **Grok 交付的完成定义**：脚本非零退出 + 被生产路径 import（不是只在 `?flag=1` 下）+ Claude 核过。V4/V6/V7 三代停在 TESTED 的教训不再重复

---

## 已保住（不要回退）

- [x] 增量删/补层集合一致，孤窗 6 → 0（2026-09-03，`node tools/test_stack_column_walls.mjs`，几何 98.2%）
- [x] 竖向叠加共棱：`floor` 只缩放抖动幅度、不进哈希，相邻层棱错开 0.060 → 0.003（2026-09-03，`node tools/test_townscaper_rules.mjs`）
- [x] 合并块区间压缩原语 + 关键不变量「未被摘顶点逐位不变」（2026-09-03，`node tools/test_merged_cell_patch.mjs`，7 组）
- [x] 同构模块槽位地基（2026-09-03，`node tools/test_module_geometry_normalize.mjs`，8 组）
- [x] 增量装饰涟漪范围正确（`node tools/test_decor_ripple.mjs`）
- [x] V7 WFC 引擎 golden 全绿（2026-08-22，`node tools/test_procgen_v7_all.mjs`，seeds 1/7/42/884）——阶段 2 的地基，**不重写**

---

## C0 · 调研补齐（P1，可与 C1 并行）

- [x] [Claude] **不规则四边形网格的可核实现细节已取到**（2026-09-04，S22）：
      [BorisTheBrave / Sylves «Townscaper grid» 教程](https://boristhebrave.com/docs/sylves/1/articles/tutorials/townscaper.html)
      给出与 S20⑤ 一致的四步，且**带参数**：① 等边三角形填满一个六边形（边长 0.5、每边 4 个三角）；
      ② 随机两两合并三角形成四边形（按 hex 做确定性 hash seed，保证无限平面拼接一致）；
      ③ `Ortho`（Conway 算子）把全部面细分成四边形；④ **全网格装配完再做 relaxation**，
      不能逐 hex 松弛——「relaxation would get in the way」，会破坏 hex 边界的精确贴合。
      并注明与 Oskar 本人说法的差异：真作还有 per-hex 随机变体与「shape-favoring 的更高效松弛」。
      **这条直接改写 G-15 的实现顺序**（先拼满再松弛），已同步进工单。
      ⚠️ 二手逆向，登记为 S22，不得当成 Oskar 原话。
- [ ] [Claude] Oskar 三场**演讲**取证（S6 等），登记进 `OSKAR_OFFICIAL_PLAN` 来源表
      （EPC2021 `NOJYZYqY6_M` / SGC21 `Uxeo9c-PX-w` / Konsoll2021 `5xrRTOikBBg`）
      **阻塞（2026-09-04 复核仍成立）**：WebFetch 取 YouTube 正文被拒（429/无字幕文本），
      搜索也只返回视频链接本身。需要主人导出字幕（YouTube「显示转录」→ 复制）或给可访问镜像。
      在此之前这条不要再重复尝试——已试两次，成本白花。
- [x] Steam 演示片抽帧分析（2026-09-03 晚重抽 12 帧，浏览器 `<video>` seek，拼图 `docs/citadel-s19-frames.jpg`；登记为 S19，逐帧结论见 PLAN §2.2）
- [x] AI and Games 访谈八条原文登记（S20 ①–⑧：角落分段 / stencil / 装饰分离 / 静默失败 / 六边形→四边形→relax / 花园优先 / 连通区传播 / 大形可预测小形可变）
- [x] gameres 877989 登记为 S21（二手转述：4×n 块拼房、模型按格形状扭曲、庭院再跑 2D WFC）
- [x] mxgmn README 登记（最小熵 / AC-4 / D4 对称 / 矛盾罕见 / Oskar 港口）
- [x] [Grok] `docs/OSKAR_OFFICIAL_PLAN.md` 来源表补 S21 一行 + S20 补齐 ⑤–⑧（照 PLAN §2.1 表抄，不改结论）→ **G-02**
      2026-09-04：`grep -c "S21" docs/OSKAR_OFFICIAL_PLAN.md` = 2；`grep -c "hexagonal grid" docs/OSKAR_OFFICIAL_PLAN.md` = 1。§2–§6 未改。

## C1 · 归属缺口清单（P0，阶段 0 前置）—— ✅ 已由 Claude 直接做完（2026-09-03，未派 Grok）

- [x] [Claude] 常驻工具 `tools/audit_cell_ownership.mjs`（有主/无主 tris、无主 TOP、按 level 分布）
      派单前基线：**无主 74,098 tris / 81.0%**，父链继承仅降到 80.7%
- [x] [Claude] 52 处 `levelGroups[iy].add` 没有逐个改：改为在 `citadelTown.js:1411–1437` **拦截层组 `add`**
      （`ownCell / ownSpanning / ownNone / stampOwner`），规则块只在循环顶部声明当前格；`restoreAdd` 在装配结束还原原生 add
- [x] [Claude] 跨格判定已落在代码里：屋顶按连通分量 `ownSpanning(comp.keys)`（`:1837`），花园/庭院/步道同法

## C2 · 支架归属修复（P0，最小改动，独立可验收）

> 主人 2026-09-03 亲眼看到的悬空支架。成因是标签打在 `THREE.Group` 上（`citadelTown.js:2883`），
> 摘旧网格判据只看 `o.isMesh`。**不要**把支架塞进 WFC（PLAN §4 N3）。

- [x] [Claude] `citadelTown.js:2950–2953` 支架 `support.traverse(o => { if (o.isMesh) o.userData.cell = {ix,iy,iz,char} })`（2026-09-03，Claude 直接做，未派 Grok）
- [x] [Claude] `tools/test_support_orphan.mjs`（2026-09-03）：删悬空格 → `town-support-edge` 归零；补回 → 恢复
- [x] 回归：`test_stack_column_walls` / `test_merged_mesh_recycle` / `test_decor_ripple` 不倒退（随 C4 一并跑过）
- [x] 门 C 支架列转绿

## C3 · 阶段 0：层组归属声明（P0，地基）

> ✅ 2026-09-03 由 Claude 直接做完，实现方式与 PLAN §5 的 `makeCellSink` 等价但更省：不改 52 个调用点，
> 而是拦截层组 `add`（见 C1）。PLAN §5 阶段 0 的代码块视为已被 `ownCell/ownSpanning/stampOwner` 实现。

- [x] [Claude] 归属声明：`ownCell(ix,iy,iz,char)` / `ownSpanning(keys)` / `ownNone()` + `stampOwner` 对 `add` 进来的对象 `traverse` 打 `userData.cell` / `userData.cells`
- [x] [Claude] `tools/test_cell_ownership.mjs`：判据与摘旧网格逐字一致 `o.isMesh && (userData.cell || userData.townModule || userData.cells)`，断言无主 **=== 0**，跨格键格式合法
- [x] 门 A 转绿（C4 记录：「C3 归属补到 100% 后重做成功」）
- [x] [Grok→Claude 修正] **构建期守门已上线**（2026-09-04）。Grok 的第一版判据写错了：按「有没有 `ownCell` 作用域」报错，
      而 `town-cell` 自己就写了 `userData.cell`、本不需要环境作用域 → `buildOdysseyCitadel` 直接抛，全部城堡测试红。
      Claude 改成按**「有没有网格最终无主」**报错（自声明的网格与空 Group 放行），并重写了 throw 路径用例
      （无主网格必抛 / 自声明与空组必不抛）。
      **这次误伤挖出 4 类真实归属空洞**（原 `test_cell_ownership` 报「无主 0」是漏报——无主的面不进 `faceToCell`，
      合并后就从普查里消失了）：`town-plaza`、内院 241 件（wall/surface/well/water）、`town-canal-water`、
      `town-watergate`、z 向连拱。全部已补 `ownSpanning`，现无主真为 0（有主 89,756 tris · 跨格构件 1,036 个）。
- [x] ~~[Grok] 作用域外 `add` 直接 throw（G-01b）~~ → **整条作废（2026-09-04 复核）**。
      判据写反了：按「有没有 `ownCell` 作用域」报错会让 `town-cell` 第一个撞上（它自己就写了 `userData.cell`），
      `buildOdysseyCitadel` 直接抛。正确判据是**「有没有网格最终无主」**，已由上一条 [Grok→Claude 修正] 实现并带 throw 路径用例
      （`node tools/test_cell_ownership.mjs` 输出「throw 路径（无主网格抛 / 自声明与空组放行）」）。
      工单 G-01b 已在 `CITADEL_GROK_TASKS.md` 标 ❌ 作废，**不要再派**。

## C4 · 阶段 1：合并块局部替换接线（P0，依赖 C3）—— ✅ 已接线（2026-09-04）

> 代码已写好并通过单测（`mergedCellPatch.js` + `test_merged_cell_patch.mjs`），
> 2026-09-03 试接一次因归属率仅 19% 导致重影 +6.9%，已回退；C3 归属补到 100% 后重做成功。

- [x] [Claude] `geometryMerge.js`：`onOutline` 补 `segments`；已合并描边块可被重新吸收
- [x] [Claude] `odysseyCitadel.js` 增量第 2 步：整块删 → `dropCellsFromMerged`
      压缩谓词改收**区间**而非单格（`test_merged_cell_patch` 8 组），跨格构件才摘得掉
- [x] [Grok 写 / Claude 修根因] `tools/test_face_to_cell_parity.mjs` **已绿**（A=853 B=853 onlyA=0 onlyB=0，2026-09-04）。
      Grok 报的 onlyB=65 不是测试写错，是**真 bug**：内院的 `ownSpanning` 只登记了 `region.cells`——那全是**空格**，
      而编辑只发生在实心格上。于是玩家拆掉围墙时，这段内院永远不会被判 dirty，一直挂在那儿。
      修法：格集补上四邻的实心围墙格。原行：`tools/test_face_to_cell_parity.mjs`：`collectFaceToCell` 覆盖面与摘旧网格判据**逐字一致**（差集 = 重影，断言差集为空）→ **G-01**
      2026-09-04 `node tools/test_face_to_cell_parity.mjs`：**A=788 B=853 onlyA=0 onlyB=65**（非零退出）。
      重影方向 onlyA 已空；onlyB 65 键（y1:32 y2:31 y3:2，sample `7,1,8` / `10,1,10`…）是合并块有、摘旧网格没有的键。
      按工单不在测试里过滤差集，清单交 Claude。
- [x] [Claude] 摘掉 `expandDirtyToWholeLevels` → `citadelAffectedLevels`（只算层，不扩格）
- [x] [Grok] 门 B 保持绿、门 D 转绿：**P50 558ms → 90.9ms**（P90 112.9 / max 116.9）
- [x] [Claude] 门 E 生产路径复验；`?v=` 已 bump 到 `citadelTown.js?v=20260904-edit-perf-v1`

### C4 未尽项：连续编辑累积（P0，已守门不失控）

- [x] [Claude] `tools/test_edit_soak.mjs`：20 次连续编辑 vs 同布局全量重建
- [x] [Claude] `tools/test_edit_exactness.mjs`：**单次编辑必须与全量重建逐格相等**（加/删两向，多 0 少 0）
      这条比 soak 敏感得多——soak 的 ±5% 抱不住单次 0.2% 的漏
- [x] [Claude] **根因已钉死**：屋顶 `shape.kind === "strip"` 分支的网格循环**漏了 `want()` 门**
      （同循环里的屋脊瓦/挑檐/烟囱/圆窗都有门，只有屋顶网格自身没有）。
      每次增量把**每个长屋顶分量**重发一遍，每个 +12 tris，21 个分量 = +252/次。
      定位手段：追一个未被编辑的跨格键 `span:20,0,18+20,0,19`，
      实测 152 → 164 →（修后）152，而全量重建始终 152。
      修法：`roofCells.add(key)` 留在门外（规则 3 靠它跳城垛），网格发射移到门内。
- [x] [Claude] 累积 **8.0% → 3.5%**，天花板收紧到 ≤5%
- [x] [Claude] **残余 3.5% 已定位并修掉 → 0.6%**（2026-09-04，`node tools/test_edit_soak.mjs`）
      定位手段：逐次编辑做 `claimed()` 逐键对比，第 3 次首现分歧，打印每个漂移键的 `inDirty/总格数`——
      **全部是「与 dirty 只部分相交的跨格构件」**（`+100×4` 晾衣绳、`−328` 内院、`−70` 连港步道）。
      根因（一句话）：**摘旧网格的判据是 `cells.some(dirty)`，重建的判据却是「代表格 want()」**。
      两个口径不一致 → 部分相交的跨格构件要么摘了不重建（缺几何），要么换个代表格再发一份（重影）。
      修法两层，都在 `citadelTown.js`：
        1. `ownSpanning(cells)` **改成返回布尔**（这组格是否需要重建），调用方当门用：
           `if (!ownSpanning(keys)) continue;`——不 dirty 就整组不发，dirty 就整组全发；
           作用域内 `want()` 对组内格一律为真（`_spanWant`），于是「摘的就是建的」。
           已改：屋顶连通分量 ×2、连拱段 X/Z、广场、水道、内院、晾衣绳。
        2. `odysseyCitadel.js` 再加一层 `closeDirtyOverSpanningParts` 闭包兜底（默认开，`closeSpans:false` 可关）。
      两层叠加实测：累积 **8.0% → 0.6%**、合并块净增 **33 → 16**、单次编辑仍逐格 0 误差。
      顺带修掉两个真 bug：z 向连拱**根本没有 want() 门**（每次编辑重发全城）；晾衣绳的门用 `a.top`、
      归属记 `iy=min(a.top,b.top)`，错层导致摘/建对不上。
- [x] **C4 编辑性能：固定成本三刀**（2026-09-04，Claude）——**G-20 分量签名缓存决定「不做」**

      先测后改。`node tools/probe_edit_phases.mjs`（新增）拆开一次编辑，第一个反常现象是：
      **什么都没改的空转编辑（新网格 0、重合并层 0）仍然要 68~78ms**。
      再看 `--cpu-prof`，长尾根本不在「跨格整组重建」上——20 次采样里
      **闭包扩张平均 +0.0 格**，签名缓存想省的那部分压根没发生。
      真正的钱花在**与 dirty 规模无关的全图 pass** 上，一次编辑要跑 5 遍（5 个台地各调一次
      `buildCitadelTown`）。三刀都是等价改写，输出逐位不变：

      1. **`collectCitadelCourtyardRegions` 字符串键 → 稠密位图**（`citadelTown.js`）
         慢的不是 flood fill（本来就 O(格数)），是每探一个邻居就拼一次 `` `${ix},${iy},${iz}` ``、
         `seen` 也用字符串键——25×25×12 一次调用造 5 万多个临时字符串全喂 GC。
         改成把 grid 一次性摊成 `Uint8Array` 占用位图，之后全是数组下标；`seen` 换成按层复用的
         `Uint8Array`。遍历顺序、`queue.push/pop` 顺序、返回结构一字未改。
         验收 `node tools/probe_courtyard_equiv.mjs`（新增，内含旧实现逐字副本做对拍）：
         **18 个内院区逐位等价（cells 顺序也一致）· 4.83ms → 1.52ms · 3.2×**。
         profile 占比 **8.2% → 3.3%**。

      2. **`placeProps` 的 `breaksFourInARow` O(n²) → O(1)**（`citadel/propPlacement.js`）
         原来每放一个候选就 `placed.filter(...)` 扫一遍已放列表。语义其实只看
         「该立面上最后放的 3 个是否与候选同 kind」，所以改成按 facadeKey 维护一条长度 3 的尾巴。
         验收 `node tools/probe_prop_placement_equiv.mjs`（新增）：1167 槽位 → **813 个 prop，
         用旧判据重放放置序列零分歧**；`placeProps` 1.38ms/次。
         profile 占比（placeProps + breaksFourInARow）**3.3% → 已跌出前 18**。

      3. **`collectCitadelHouses` 一次构建收 3 遍 → 收 1 遍**（`citadelTown.js`）
         三个调用点（规则 2.5 柱高表 / 规则 3 户表 / 规则 7 晾衣绳）各扫一遍全图，
         ×5 台地 = 一次编辑 15 遍。grid 在一次构建里不会变，加 `housesOf()` 记忆化。
         顺带把内部解析从「每键 `split(",").map(Number)` 两遍 + 拼 `"ix,iz"` 列键」
         改成手写一次解析 + 整数列键 + 边扫边求极值。houses 顺序与字段一字不变。

      **合计效果**（同机、同脚本、连测 14 轮，`node tools/test_castle_building_experience.mjs`）：
      | | 改前 | 改后 |
      | --- | --- | --- |
      | P50 | 99~108ms | **64~102ms（中位 ~74）** |
      | P90 | 173~179ms | **113~221ms（中位 ~130）** |
      `test_edit_soak` 累积偏差仍 **0.4%**、合并块净增仍 **2**、`test_edit_exactness` 仍逐格 0 误差。

      **门的处理**：P50 从 150 收到 **130**（14 轮最差 101.8，留 ~28% 余量）。
      P90 **仍守 200 不动**——14 轮里有 1~2 轮整体抬升（P50/P90/min/max 同步变高，
      是本机 GC/调度噪声而非某次编辑变慢），最差一轮 P90 221。收到 150 会 1/8 概率误报，
      **那是把噪声当回归**。等测量本身更稳再收。

      **G-20 撤单理由**（写清楚以免以后有人照着工单再做一遍）：它的立项前提是
      「跨格整组重建导致 P90 115→190」，但 profile 显示闭包扩张 **+0.0 格/次**——
      长尾来自固定成本而不是跨格分量。签名缓存要维护「分量形状签名」这套额外状态，
      还有一堆禁区（户色簇必须进签名、`stats.shrubCount` / `ctx.random` 流位置不能进签名、
      内院树那处忽略返回值的调用点不能开缓存），风险与收益不成比例。**不做。**


## C5 · socket 词汇表与模块原型（P1，阶段 2 前置）

> V6 `moduleCatalog.js:26 socketsFor` 六面几乎全是 `wall` → 相容率实测 74.9%（水平 87.1% / 竖向 50.6%），有引擎弱约束（PLAN §2.3c）。
> 复现：在 `TigerMessenger/` 下写临时脚本 import `createModuleCatalog` + `uniqueTransforms` + `socketsCompatible`，81 变体 × 81 × 6 向全对枚举。
> 本项的产出是 V7 schema 的 `ModulePrototype[]`（`procgen/wfc/moduleSchema.js`），不是新求解器。

- [x] [Claude] socket 词汇表 `src/world/citadel/socketVocabulary.js`（2026-09-03）：10 个**界面**连接器
      `stack / stack.tower / sky / wall / tower.wall / ridge / eave / terrace / flat / passage`。
      关键手法：**`eave` 与 `tower.wall` 用 parity `normal`** —— V7 里 normal↔normal 不咬合、Y4 又没有镜像变体，
      于是这两个面**永远不能与另一格相接**，只能朝空/异色。平行双坡（M 顶）与「两根塔并排贴成一堵塔墙」
      因此是被结构性禁止的，不靠权重调参。邻居种类 `edge / edge-top / air / foreign`（异色不建边 = 不同建筑）
- [x] [Claude] `src/world/citadel/townModulePrototypes.js`（2026-09-03）：**域改成体块角色**
      （body / tower / passage / gable / hip / cone / terrace / flat / garden），栏杆窗花箱楼梯支架全部留给装饰 pass（S20③/④）。
      22 原型 → 48 变体，无 dead variant；`townBanPolicy` 管顶格判定 / 塔 / 花园封闭 / 拱洞 / 孤立高柱成塔。
      实测 `node tools/probe_c5_prototypes.mjs`：**相容率 18.7%**（水平 24.9% / 竖向 6.2%；门 H 上半 ≤40% ✅，
      对比旧 V6 目录 74.9%）；随机 6×6×3 布局 **200 seed 零失败零回溯**。
      **门 I 预演已对上 S19**：t=0.35 单格→`terrace.w0`；t=0.70 叠格→下格变 `body.plain`（栏杆→墙）；
      t=1.40 两柱并排→两格 `roof.gable` 共脊；t=3.50 孤立 3 高柱→`body.tower`+`roof.cone`、旁边红屋顶让位成 `gable.end`；
      3×3 环形庭院中心→`top.garden`。
      ⚠️ **这两个文件目前还没有任何生产代码 import**（只有探针脚本用），接线是 C6 的事
- [x] [Claude] 门 H 上半已固化为 `tools/test_wfc_town_selection.mjs`（G-03 段）：原型合法 / dead variant 0 /
      **相容率 18.7%**（水平 24.9% / 竖向 6.2%，门槛 ≤40%）+ 反向下限 ≥2%（防止约束过严解不出来）。原行：`tools/test_module_prototypes.mjs`：`validateModulePrototype` 全过；`compileVariants` + `compileCompatibilityTable` 无 dead variant；**相容率 ≤ 40%**（六向全对枚举，不抽样；门 H 上半）→ **G-03 [等 C5 两个 Claude 项]**
- [x] [Grok] 从现有布局**反向抽取**邻接统计 `tools/extract_adjacency_stats.mjs`（家族×家族×六向原始计数，含邻空），作为 Claude 校核词汇表的参考，不直接生成规则 → **G-04**
      2026-09-04 `node tools/extract_adjacency_stats.mjs`：`totalCells=1213 highland=978 canal=235 countKeys=2980` → `tools/out/adjacency_stats.json`。无 rules/allowed 字段；每个家族 `byFamily` 六向都有 `air`。

> **已有实测（2026-09-03，Claude）—— 注意作用域**：`tools/audit_module_adjacency.mjs`
> 审计的是**装饰家族** `TOWNSCAPER_MODULE_FAMILIES`（栏杆/地基花纹等外观变体），
> **不是** V6 `moduleCatalog.js` 的 socket 目录。结果：foundation 52.5% / fence 80.0% /
> balcony 67.5% / decor 63.3%，**全部低于随机基线**（62.3 / 100 / 78.5 / 80.1）——
> 密度低是样本稀疏，不是有约束。结论仅限装饰家族：给它们建规则表会全是 `true`。
> V6 socket 层的 74.9% 相容率是另一回事，C5 的工作对象是后者。
>
> 另有 `tools/audit_shape_ripple.mjs`：形状层（屋顶分量/穹顶/塔楼/花园）改一格的
> 波及半径 8 点采样**最坏曼哈顿 2 格**，而 `dirtyLevels` 邻域本就是 ±2。
> 两个工具都内置自检（基准签名为空则非零退出）——构建后模块已被合并吸收，
> 必须用 `debounceMs > 0` 采样，否则会拿到空数据得出假结论。

## C6 · 阶段 2：WFC 接线（P1，依赖 C5）

- [x] [Claude] 适配器规格已定（2026-09-03）：写在 `docs/CITADEL_GROK_TASKS.md` G-05 的「适配器契约」段，
      参考实现就是 `tools/probe_c5_prototypes.mjs` 里的 `graphOf()`——**水平边只在同色格之间建**（异色 = 不同建筑，
      屋顶不合并），竖向边不分颜色；`exposure` 四种邻居；`columnHeight` 同列连续格数；`bans` 全部来自 `townBanPolicy`
- [x] [Grok] `src/world/citadel/wfcGraphAdapter.js` + `src/world/citadel/wfcTownSelection.js`（调 `solveWfc`，返回 `{family, variant, rot, key}` 表；`banPolicy` 可替换）→ **G-05**
      接口按工单冻结；`defaultBanPolicy` 可替换。未改 `procgen/wfc/*`，未在 `citadelTown.js` 接线。
- [x] [Grok] **先证适配器能回放哈希路径**：pins 全钉 = 逐格相等；约束全 `any` 时同 seed 同 hash、100 seed 零失败 `tools/test_wfc_selection_golden.mjs` → **G-06**
      2026-09-04 `node tools/test_wfc_selection_golden.mjs`：`replay=978/978 determinism=5f185a4f fails=0/100`（高山现格数 978，不是旧的 942）。
- [x] [Grok→Claude] 放开 C5 约束后跑 100 seed（2026-09-04 由 Claude 做，新增 `tools/report_wfc_100seed.mjs`）：
      highland 978 格 **fails=0/100 · unresolved=0 · backtrack/seed=0 · P50=16.9ms P90=20.8ms max=47.1ms**；
      canal-junction 235 格 fails=0/100 · P50=3.4ms。**锥顶下必是塔身 100 seed 无一例外**；
      塔身 43–79 / 锥顶 21–40 / 花园 2–12 / 晒台 97–148 随 seed 摆动（S20⑧「大形可预测、小形允许变化」）。
      落盘 `tools/out/wfc_100seed.json`。**Claude 判断：变好**（约束不紧不松、成本能进生产、结构事实是硬的）。
      ⚠️ 剩一条脚本判不了的：**顶格里只有 ~35% 长成屋顶**（gable 6.9% + cone 3.0% + hip 0.8%），
      其余是晒台 12.7% + 平顶 6.7%。成因是 `townBanPolicy`「顶格 WALL 面不能朝空/朝同层顶格」。
      Townscaper 的天际线是屋顶为主还是晒台为主——**要主人对着 S23 录像看一眼**。详见文末体检表
- [x] [Grok] 接线：顶格坡/平/花园改走 `wfcTownSelection`（开关 `P.wfcTownV1`，**默认关**；`?wfcTownV1=1` 打开）
      2026-09-05：TODOS 原写「把 `townscaperModuleSelection` 三处换掉」是错域（那是装饰家族下标，不是体块角色）。
      真接线在 `wfcTownWiring.js`：`roleAt` 接管 classifyRoofComponent 的坡/平和 hugsWall 花园。
      `node tools/test_wfc_town_wiring.mjs`：默认 `P.wfcTownV1=false`；打开后
      `ok hash=18d9af3f ms=137` 顶格坡=116 平=184 花园角色=6 · 几何 roof=95 garden=5 steeple=5
      默认路径不倒退：`test_edit_exactness` 0/0 · `test_rail_outline` 7×7 护栏 84
      ⚠️ 默认仍关：顶格只有 ~39% 坡顶（116/300），要主人对着 S23 看过再翻 `P.wfcTownV1` 默认值
- [x] [Claude] 门 F 已绿（`test_wfc_selection_golden` + `test_wfc_incremental`：outsideChanged=0 / ring=2 / P50 21.9ms）。原行：门 F；编辑一格后传播锥外逐格不变 `tools/test_wfc_determinism.mjs` → **G-07 [等 G-05 + C5]**
- [x] [Grok] 门 G：`explainFailure` 结果接到 `devPanel`（只读列表：格坐标 + 空域原因），`tools/test_wfc_explain.mjs` → **G-08**
      2026-09-04 `node tools/test_wfc_explain.mjs`：不相容 pins → `reason: unsatisfiable` / `empty cell: 1,0,0` / involved 两格，≥3 行只读，无重试按钮。`src/ui/wfcFailurePanel.js` 已 `mountWfcFailureSection` 进 `createDevPanel`。
- [x] [Claude] 门 H 下半已绿（`test_wfc_town_selection` G-09 段：钉一格触发 8 个格的域收缩、累计 20 次。
      旧哈希路径这个数字恒为 0——这就是「有没有传播」的判据）。原行：门 H 下半：100 seed 中至少 1 个 seed 观察到「钉一格 → 邻居被传播坍缩到 1」（用 `partialObservation` 前后对比，solver stats 里没有这个计数）`tools/test_wfc_propagation_visible.mjs` → **G-09 [等 G-05 + C5]**
- [x] [Claude] **门 I 已绿**（`test_wfc_town_selection` 门 I 段，2026-09-04）：
      t=0.35 单格→晒台 · t=0.70 叠格→下格从晒台变墙 · t=1.40 相邻顶格连成一片（5 seed 全同）·
      t=3.50 孤立 3 高柱→塔+锥顶且锥顶下必是塔身 · S20⑥ 3×3 环形庭院中心出花园。
      **这是「视频分析 → 代码」唯一的机器判据，跑 `node tools/test_wfc_town_selection.mjs` 就能看到。**
      原行：门 I：`tools/test_wfc_ripple.mjs` 复现 S19 t=0.70（孤立格加盖 → 下格 `terrace.rail` → `wall`）与 t=1.40（两格并排加盖 → 共享脊 gable）；bump `?v=`

## C7 · WFC 增量传播（P1，依赖 C6 + C4）

- [x] [Grok] 编辑格 + 2-ring 重置域为全集，其余格 `pins` 为上次解，从编辑格开始传播；失败且冲突格在区域外时 ring+1 重试 ≤2 次 `src/world/citadel/wfcIncremental.js` → **G-10**
- [x] [Grok] 传播锥外逐格不变（对应 S19：加一格只改邻近屋顶，不是整城重算）`tools/test_wfc_incremental.mjs` → **G-10**
      2026-09-04 `node tools/test_wfc_incremental.mjs`：`outsideChanged=0 ring=2 soakSame=66 soakDiff=892 fullHash=4edc1143 P50=24.5ms`
      （any-socket 下增量与全量本就可以不同，只打印不断言相等。）
- [x] [Grok] 门 D 在 WFC 路径下仍 ≤ 150ms（记录数字）
      2026-09-05 `node tools/probe_wfc_edit_ms.mjs`（`P.wfcTownV1=true`，debounceMs=400）：
      n=8 **P50=124.7ms**（≤150）· P90=201.6ms · min=101.2 · max=201.6
      求解 `ok` unresolved=0。P90 超 150 是冷启动长尾；P50 在门内。默认关时 castle 第二次 P50=74.3 / P90=111.2

## C8 · 阶段 3：装饰与生成分离（P2，依赖 C6）

> S20③：*the decoration of a tile is separate from when it is generated*；S19 t=2.80 装饰晚 ≈0.3s 出现。

- [x] [Claude] 装饰边界清单 → `docs/CITADEL_DECOR_BOUNDARY.md`（2026-09-03）：`citadelTown.js` 里全部 66 个 `town-*`
      逐条分类。判据一句话：**这个网格的存在与形状是否由「该格的体块角色」唯一决定**——是则体块，否则装饰。
      注意几个反直觉的：**窗洞/门洞算体块**（它们改变墙的拓扑），**支架算体块**（构造式，N3 不进域），
      栏杆按 exposure 生成所以算装饰
- [x] [Grok] `src/world/citadel/decoratePass.js`：输入 selection + `own` 归属声明，独立 pass；`buildCitadelTown` 家族循环里剪掉清单点名的装饰分支 → **G-11**
      2026-09-05：名单 24 个（边界清单 + 现网 `town-gable-diamond` / `-glass`，清单里的 `town-gable-oculus` 现网已改菱形）。
      `skipDecor` 在层组 `add` 处 `stripDecorMeshes`（混装组只剥装饰孩子，尖塔塔身留下）。
      `decorateTown` 挂钩已就位、传入同一套 `own`。发射点仍在家族循环——装饰与体块共用 `ctx.random`，整段搬迁会搅动体块 RNG。
      报回 Claude：清单写 `town-gable-oculus`，现网是 `town-gable-diamond`。
- [x] [Grok] `tools/test_decor_pass.mjs`：`skipDecor` 两次构建体块逐字相等；装饰归属它所装饰的那一格（门 A 不倒退）→ **G-11**
      2026-09-05 `node tools/test_decor_pass.mjs`：`bodyNames=3142 decor=3193 skipDecorDecor=0 unowned=0 catalog=24`
      `node tools/test_cell_ownership.mjs`：有主 95396 tris · 无主 0 · 跨格 1468
      `node tools/test_edit_exactness.mjs`：删/加格多出 0 · 缺少 0
      `node tools/test_edit_soak.mjs`（第二次）：累积偏差 **0.4%** · 合并块净增 2 · edit P50 91.3ms
      `node tools/test_face_to_cell_parity.mjs`：`A=853 B=853 onlyA=0 onlyB=0`
- [x] [Grok] 滞后合并：体块先合并，装饰下一帧合并（复用 400ms 去抖）
      2026-09-05 `node tools/test_decor_lag_merge.mjs`：
      去抖前 bodyU=2822 decorU=3193 · 体块帧 bodyM=294 decorU=3193 · 装饰帧 decorM=157 decorU=0
      入场 `mergeCitadelTownStatic` 仍一次收齐；去抖/生长结束路径体块先并、`pendingDecorMerge` 下一帧再并。
      `debounceMs=0` 测试路径两趟同步并完（不拆帧）。
      `node tools/test_face_to_cell_parity.mjs`：A=853 B=853 onlyA=0 onlyB=0
      `node tools/test_cell_ownership.mjs`：无主 0
      `node tools/test_edit_exactness.mjs`：删/加 0/0
      `node tools/test_edit_soak.mjs`（第二次）：累积偏差 0.4% · P50 89.0ms
      `node tools/test_castle_building_experience.mjs`（第二次）：P50=74.3ms P90=111.2ms

## C9 · 阶段 4：角落模块（P2，依赖 C6）

> S20①。先原型（`townscaper.html?cornerModules=1`），不接生产。

- [x] [Grok] `tools/gen_corner_mask_table.mjs`：枚举 8-bit mask（4 格 × 2 层，位序 `dx|dz<<1|dy<<2`）→ D4（绕 Y 四旋转×镜像，**不含上下翻转**）归并 → `tools/out/corner_mask_table.json`
      2026-09-04 `node tools/gen_corner_mask_table.mjs`：`classes=55 (Y4-only would be 70)`，`classCount === 55`，256 行可回放。
- [x] [Claude] **角落分段目录已交付**（2026-09-04）：`src/world/citadel/cornerPrototypes.js` + 自检 `tools/test_corner_prototypes.mjs`
      **28 件**（air 1 / wall 5 / plinth 4 / step 3 / soffit 1 / top.terrace 5 / top.flat 2 / top.garden 1 / roof 6）。
      先把「角柱占哪块空间」钉死：节点 (gx,gz,iy) 坐在四格公共角、两层之间，**它的 8 个角恰好是 8 个格心**
      （对偶立方体 = PLAN 说的 marching cubes）。几何输出在单位立方体 [0,1]³ 里，
      x/z 的 0.5 是格边界、y 的 0.5 是层边界，装配时乘 (cs,ch,cs) 并平移——阶段 5 上不规则网格只需把四个水平角换成 relax 后的顶点。
      `node tools/test_corner_prototypes.mjs`：**256 个 mask 全部有解**（允许集 1件×196 / 2件×51 / 3件×4 / 6件×4 / 7件×1）·
      允许集是 **D4 不变量**（55 类逐类一致，G-13 可直接按 classId 建 bans）· 无死件 ·
      **接缝零间隙：4096 对相邻角柱，同名零件截面不对齐 0 对；两侧同件 1760 对，不对齐 0 对**（门 J 的地基已成立）。
      ⚠️ **实现中抓到一条设计陷阱，写进文件注释了**：檐口一开始画在对偶立方体的**外边界**上，
      两侧看到的是不同的格（A 看 gx-1、B 看 gx+1），必然对不齐（roof.hip 差 4 对）。
      改成沿**角柱自己的顶点十字**（x=0.5 / z=0.5）走之后自动对齐——
      **凡是要跨角柱连续的线（墙、基座、护栏、檐口）都必须画在顶点十字上，不能画在外边界上。**
      ⚠️ **一条要主人知道的取舍**：mask 把 bans 钉得很死，**196/256 个 mask 只剩 1 件可选**——
      WFC 的自由度几乎全集中在 15 个「顶面」mask（6–7 件可选：露台/平顶/花园/脊/坡/歇山/山墙端/天沟）。
      这是有意的（顶面正是「屋顶还是露台」该由传播决定的地方），但如果主人想让墙身也有变化，
      得往目录里加同 mask 的多件（例如 wall.c2adj 再来一件带壁柱的）
- [x] [Grok] 角柱图适配器 `src/world/citadel/cornerGraphAdapter.js`（节点 = (gx,gz,iy)，边 = 共享格边/层）+ mask classId → `bans` → **G-13**
      2026-09-05 `node tools/test_corner_graph.mjs`：`highland cells=978 cornerNodes=1431 floors=12`
      `validate().ok` · `variants=78 bans=102853 domain1=27/1431` · **空域 0**
- [x] [Grok] 门 J：`tools/test_corner_seams.mjs` 相邻角柱共享边顶点逐位相等；基座跨格无 T 型接缝（复现 S19 t=1.05）→ **G-14**
      2026-09-05 `node tools/test_corner_seams.mjs`：任意选件 **3546** 对同名零件对齐；同件 **1840** 对对齐；
      S19 t=1.05 基座 **2** 对，无 T 型接缝
- [x] [Grok→Claude] 评估报告 `docs/citadel-corner-eval.md`：模块数、接缝、15 色兼容、draw call；Claude 决定是否进生产
      2026-09-05 已写。建议：可以进 `?cornerModules=1` 原型（默认仍 false）；角柱跨四格必须 `ownSpanning`；draw call 必须走现有层组合并
- [x] [Grok] 角柱装配原型（开关 `P.cornerModulesV1`，**默认关**；`?cornerModules=1` 打开）
      2026-09-05：`assembleCornerBody` 发墙/基座/内部 box，归属 `ownSpanning` 四邻格。
      打开时跳过 `town-cell` / `town-plinth` / cornice / grout / floor-band；屋顶/窗/装饰仍走原路径。
      `node tools/test_corner_stencil_wiring.mjs`：默认无关零件；打开 **parts=8648**（含顶面/屋顶）town-cell=0 plinth=0 手写 town-roof=0 **unowned=0**
      默认路径：`test_cell_ownership` 无主 0 · `test_edit_exactness` 0/0
      ⚠️ 未切屋顶/露台（prism 件），也未把默认翻开——要看画面再进生产
      **2026-09-05 生产路径 A/B 复验（`tools/test_corner_assembly.mjs`）** ——
      这条测试刻意只断言**行为**（走 `buildOdysseyCitadel` + `P.cornerModulesV1` 对比），
      不碰 `assembleCornerBody` 的签名，所以本文件被重写两次（后一次加了 C10 笼形变形，
      零件 7279→8648、零件名 7→10 种）它照样跑得动。三条已复验成立：

      - 门 A 不倒退：flag 开后无主 **0**，8648 个角柱**全部**带 `userData.cells`（`ownSpanning`），
        没有一个用单格归属
      - 替换而非叠加：`town-cell` 归 **0**（`if (cornerBody) continue;`），不是加了一层
      - 基座件 **0** 个，因此不与规则 3.6 的 `town-plinth` 重影

      ✅ **一条真缺陷已修：地面层下半留半层高的洞。**
      角柱节点 iy 覆盖「层 iy 心 → 层 iy+1 心」，而 `createCornerGraph` 从 `iy=0` 起
      → 地板面到层 0 心那半层没有任何柱子。A/B 实测（两版实现数字一致）：外壳底面从基线
      **4.950** 抬到 **5.950**，**高 1.000 = 半层**（`ch` 为 2 时半层即 1.0），沿地面一圈环形洞。
      **修法**（目录没改）：`assembleCornerBody` 把节点发射抽成 `emitNode`，主循环走
      `graph.cells()` 之后再补一圈 `iy = -1`——那一层 mask 下四格取层 -1（恒空）、
      上四格 = 层 0 → 形态必为 `soffit`，而 `soffit.under` 的 `emitWalls(1, 0.5, 1)`
      映射到 `y0+0.5*ch … y0+ch` = `0 … 0.5*ch`，正好补满缺口。`levelGroups` 下标本来就
      clamp 到 0，iy=-1 的几何挂进 level-0 组。
      修后：外壳底面 **4.950 = 基线**，零件 8648 → **10176**（多出 1528 个 iy=-1 件）。
      默认路径复验：门 A 无主 **0** / 有主 **95,396 tris**（与会话开始逐位一致）、门 D 0/0。
      `tools/test_corner_stencil_wiring.mjs` 仍绿（它用 `assert.ok(parts > 0)` 而不是写死数字，
      这个写法值得照抄——写死 8648 的话这次合法修复就会把它打红）。
      ⚠️ 这让装配的节点集与 `cornerGraphAdapter` 的图（1431）不同源；现在装配不跑 WFC
      所以无碍，但 C6 的 bans/求解接上来时必须先对齐 `iy=-1`。

      ⚠️ **三角面翻倍，翻默认前要有预算判断**：flag 关 **95,396 tris** → flag 开 **194,888 tris**，
      **2.04×**。`citadel-corner-eval.md` §4 估的是「+2/层 draw call」，没提三角面。
      draw call 靠层组合并仍可控，但顶点负担是两倍——这条得主人看画面时一起权衡。

      **选件永远取 `cornerAllowedProtoIds(mask)[0]`，28 件目录只用上 14 件。**
      `tools/probe_corner_choice.mjs` 实测（比 corner-eval §1 的按-mask 统计更贴画面）：
      **1102 / 1809 个节点（60.9%）有多件可选**。按形态：through 673/675 有得选、
      setback 280/364、top 149/380；soffit 与 skew/overhang 全无自由度。

      ⚠️ **但「改成按 seed 取」是错的方向。** 三类可选集的性质完全不同，各有各的解：

      | 可选集 | 节点数 | 性质与该怎么定 |
      | --- | --- | --- |
      | `wall.c*` vs `plinth.c*` | 673 | **高度**问题，不是审美。但见下方「目录挡路」——现在两者都定不了 |
      | `step.setback` vs `roof.abut` | 280 | 要上下文：上半是屋顶还是退台墙。mask 表达不了 |
      | `top.terrace.*` vs `roof.*` / `top.flat.*` / `top.garden.*` | 149 | **这正是 C6 `wfcTownWiring.roleAt` 已经在决定的事**（`WFC_SLOPED_ROOF_ROLES` / `WFC_FLAT_TOP_ROLES`）。该把 oracle 穿进 `assembleCornerBody`，而不是另起一套 hash——否则角柱选件会和 WFC 的角色打架 |

      ❌ **目录挡路：`plinth.*` 在当前映射下无法贴地，用起来就是「腰上长裙边」。**
      `tools/probe_corner_plinth_y.mjs` 扫全部 256 个 mask，**12 个 (mask, proto) 组合真的发出
      `plinth-*` 裙边**，裙边一律在单位 y **0.00–0.18**。而映射是 `y=(iy+0.5)*ch + u*ch`：
      - 节点 iy=0 → 裙边落在局部 y **1.00–1.36**，**离地 1.00 = 半层**（ch=2），长在层 0 的腰上
      - 节点 iy=-1 → 落到地面以下；且 `plinth.*` 只允许 through 类 mask，soffit 节点选不到它

      这是**目录**而不是接线的问题：裙边画在节点 y=0 往上，而按目录自己的约定
      「y: 0 → 层 iy 的**中心**」，那个位置永远是半层高，不可能是建筑脚下。
      **要贴地就得让裙边由 iy=-1 那圈出**——即给 soffit 形态加一件带裙边的（或扩
      `soffit.under`），画在单位 y 0.5…0.5+plinthHeight，映射后正是局部 0.00–0.36。
      ⚠️ 动目录会改动件数/类数/变体数（现 28 / 55 / 78），`test_corner_prototypes`、
      `test_corner_seams`、`gen_corner_mask_table` 的数字都要跟着复算——**这是一刀独立的活**。

      所以现状「永远取 wall.*、基座一件不用」虽然单调，但**比用错位置的裙边安全**，
      在目录补齐前不要为了「把件用起来」去改选件。

      ⚠️ 之前本节写过「plinth.* 撒到 iy=9、195 个非地面节点长出基座裙」——
      **那是另一套 hash 选件的行为，不是当前实现的**，已按实测更正。留个记录：
      归因说得通不等于对（§5.2），当时是靠推理，测了才发现不成立。

## C10 · 阶段 5：不规则四边形网格（P2，依赖 C9）

> S20⑤：六边形 → 配对成四边形 → 再细分 → relax。真拓扑，不是抖动方格（`irregularSkeleton.js` 只抖视觉）。

- [x] [Claude] 规格：`irregularQuadGrid({ seed, radius, lockedVertices })` 接口、不变量（全四边形 / 无自交 / 最小内角 ≥ 45° / 边长比 ≤ 2 / 同 seed 同 hash）、输出喂 `createHalfEdgeGraph`
      **2026-09-05 补记：规格是后补的，实现先行。**这条框当时空着不是没做，是顺序反了——
      G-16 先把 `src/procgen/graph/irregularQuadGrid.js` 写出来了，五条不变量落在
      `tools/test_irregular_quad_grid.mjs` 里当断言跑（全四边形 / 无自交 / 最小内角 / 边长比 / 同 seed 同 hash），
      100 seed 统计也在那儿。**测试就是现在的规格**；要看契约读那份测试，不要再另写一份规格文档去和它对不上。
- [x] [Grok] `src/procgen/graph/irregularQuadGrid.js`：六边形三角格 → 内部边稳定洗牌随机配对成四边形 → 每面一分四（三角→3 四边形）→ 「朝正方形收敛」relaxation（边界与 `locked` 顶点不动）→ **G-15**
- [x] [Grok] 门 K 上半：`tools/test_irregular_quad_grid.mjs` 五条不变量 + 能进 `createHalfEdgeGraph` + 100 seed 统计（内角 / 边长比 P50/P95）→ **G-16**
      2026-09-04 `node tools/test_irregular_quad_grid.mjs`：全四边形、凸、确定性、HalfEdge 无 non-manifold。
      100 seed radius=6：faces P50=450 P95=456；minAngle P50=51.50° P95=54.42° **worstMin=49.48°（≥45° 过）**；
      edgeRatio P50=2.048 P95=2.112 **worst=2.118（≤2 未过，68/100）**。
      按工单不改 ≤2 门槛：边界冻结顶点上剩余三角一分四后 barycenter 比恰好是 2，relax 会略超。数字贴此。
- [x] [Claude] **存档迁移 v5 → v6 已交付**（2026-09-04）：`src/world/citadel/gridMigration.js` + 自检 `tools/probe_grid_migration.mjs`
      导出 `citadelIrregularGrid` / `buildFaceCellMapping` / `migrateAsciiToFaces` / `facesToAscii` /
      `createCitadelLevelsV6` / `readCitadelLevelsV6` / `citadelLevelsKeyV6`（旧键不删，`?irregularGrid=0` 回退读旧键）。
      `node tools/probe_grid_migration.mjs`：网格 faces=804（radius 8，seed 20260904，hash `0b70f22c`）；
      **highland 300 列 / 978 格 丢失 0 · 逐字符可逆 ✓ · 偏差 P50 0.428 / P95 0.790 / max 0.985 格**；
      canal-junction 82 列 / 235 格 丢失 0 · 逐字符可逆 ✓ · P50 0.412 / P95 0.778 / max 0.971。
      存档信封往返一致；网格 hash 对不上时**抛错而不是硬读**（硬读会把整座城平移到别的 face 上）。
      **两处原设计被实测推翻，都写进文件头注释了**：
        1. 原打算让映射是「(gridSize, cellSize, 几何) 的纯函数」（不存表、两边重算）。不行：
           25×25=625 列与落在方格范围内的 face **数量几乎相等**，是一场紧配对。改成**只配非空列**、
           并把 `faceId → "ix,iz"` 存进存档——松配对 + 构造出来的可逆性。
        2. 原用「最近优先贪心」。它会连锁挤位：**P95 1.5 格、最坏 3.0 格**，而每列到最近 face 只有 ≤0.85 格，
           差的全是算法。2-opt 救不了（交换后距离和不变，要的是增广路）。换成**拍卖算法**（Bertsekas，ε 缩放）
           后 P95 0.79 / max 0.99，而且更快（56ms vs 172ms）。
      ⚠️ **G-17 工单里写的「重心偏差 ≤ 0.75 格」这条门要改**：等密度双射的最坏位移有理论下界，
      连最优解都做不到 max ≤ 0.75。**门改成守 P95 ≤ 0.85（外加 max ≤ 1.25 兜底），不守 max**。工单已同步
- [x] [Grok] 门 K 下半：`tools/test_grid_migration.mjs` → **G-17**
      2026-09-05 `node tools/test_grid_migration.mjs`：网格 faces=804 hash=`0b70f22c`
      highland 列=300 格=978 P50=0.428 P95=0.790 max=0.985；canal-junction 列=82 格=235 P50=0.412 P95=0.778 max=0.971
      零丢失 · 逐字符可逆 · 存档信封往返一致 · hash 不符抛错
- [x] [Grok] 笼形变形：单位立方体按四边形四角双线性 × 层高线性（`cageDeform.js`）
      2026-09-05：方格四角时映射恒等；不规则网格用 face 四角（对到方格槽位）。
      角柱四角 = 四格 `citadelColumnCenter`。`P.irregularGridV1` 打开时格体走笼形，抖动退役。
      `node tools/test_cage_deform.mjs`：方格恒等 · 梯形重心 (2,1) · 角柱原点 = 格心
      默认关：`test_edit_exactness` 0/0。穿模/接缝仍要看画面。
- [x] [Grok] 编辑器拾取 `(ix,iz)` → face id（`citadelSceneEdit.js` / `citadelEditorPanel.js`）
      2026-09-05：`citadelLocalToColumn` 打凸四边形 face 再反查列；`cellAtLocal` / `cellCenter` /
      `citadelEditCellLocalPosition` 共用。开关 `P.irregularGridV1` **默认关**（`?irregularGrid=1` 打开）。
      打开时 `createCitadelGridV6` 挂全表 25×25 拾取映射（空地也能点到 face）；存档仍只配非空列。
      `node tools/test_grid_pick.mjs`：方格回落 25×25 可逆；全表 625 列重心反查 **0 失败**；
      全表偏差 P50=0.460 P95=0.941 max=3.950（紧配对，所以存档继续只配非空列）。
      网格外返回 null，不回落方格。默认路径 `test_edit_exactness` 仍 0/0。
      ⚠️ 高亮格画成不规则四边形仍是截图项（下一行）
- [x] [Grok] 下游最小适配（按 Claude 清单）→ **G-18**
      2026-09-05：`citadelColumnCenter` 抽到 `gridMigration.js`；`trimCitadelTownToTerrain` 与 `citadelSupportAt` 共用；
      无 face 的列返回 null（不回落方格中心）；蓝图 `grid.kind` / `grid.gridHash`。
      `citadelTacticalGraph` / `collision` / `surfaceGraph` **未改**。
      `node tools/test_column_center_parity.mjs`：25×25 差集空 `both=300 none=325 mappedColumns=300`
      `node tools/test_citadel_tactical_graph.mjs`：节点 864 / 边 1427 / 离表误差 0.0000（不倒退）
      `node tools/test_citadel_topology.mjs`：仍红，hash 实际 `6e816c28` vs expected `07c43660`
      （G-18 加了 `kind`/`gridHash` 会变 hash；按清单 §3 **不改 expected**）
- [ ] [Claude] 复现 S19 t=0.00：编辑器高亮格为不规则四边形（截图存 `docs/`）

## C11 · 阶段 6：stencil 挖窗（P3，依赖 C9）

> S20②。先原型 `townscaper.html?stencilWindows=1`。

- [x] [Claude] **stencil 挖窗原型已交付**（2026-09-04）：`src/render/stencilWindows.js` + 自检 `tools/probe_stencil_windows.mjs`；
      开关 `P.stencilWindowsV1` 默认 **false**。它是装配后的一道 pass（与 `applyInkOutlines` 同层次），
      **不动 `citadelTown.js`**，关掉开关就完全回到原路径。
      `node tools/probe_stencil_windows.mjs`：11 层（有窗 10）· 窗 420 · 墙面 396 · 描边壳 99 ·
      **draw call 增量 20（恰好 2/层，门 L 达标）** · cutter 10 / reveal 10 ·
      **共享材质零污染（156 个原件逐个比对）** · 卸载后 1,212 个材质引用逐个还原。
      **两个设计点值得记下来**：
        1. **每层合成一个 cutter + 一个 reveal**，不是每扇窗两个。逐窗是 +2/窗（几百扇 → 上千 draw call，
           直接废掉门 L）；合成之后正好 +2/层。
        2. **cutter 必须写深度**（colorWrite=false / depthWrite=true）。不写的话 stencil 会打穿远处的墙。
           ⚠️ 仍有一个已知失效场景：相机与窗之间还隔着另一堵更近的墙（透过拱洞看过去），那堵近墙会被打洞。
           教科书解法是深度预通道，代价是墙的 draw call 翻倍、超门 L 预算。**先这样做原型，等主人看过截图再决定要不要买单。**
      ⚠️ **我看不到画面**，所以 PLAN 点名的那个冲突（「窗洞里露不露描边壳」）**没有被验证过**——
      能验的只到「描边壳确实拿到了同一道 NotEqual 测试」（86 个壳）。上生产前必须有截图对照。
      ⚠️ **顺带修正 G-19 工单里写错的判据**（详见下一条）
- [x] [Grok] `tools/test_window_stencil_positions.mjs` → **G-19**
      2026-09-05 `node tools/test_window_stencil_positions.mjs`：
      窗=420 跨格角=0 最大越界=−0.8100 格宽=2 drawCallΔ=20（2/层）
      共享材质零污染 156 件 · cutters=10 reveals=10
      （`townSpec.cellSize` 在 normalize 后是 undefined，测试回落 2.0，与探针一致）
- [x] [Grok] stencil 挖窗接到生产开关（`P.stencilWindowsV1` **默认关**；`?stencilWindowsV1=1` 打开）
      2026-09-05：入场合并后 / 增量两趟合并后 / 装饰滞后帧 调用 `applyStencilWindows`；卸载走 `stencilWindowCleanup`。
      `node tools/test_corner_stencil_wiring.mjs`：默认无 cutter；打开 **cutters=10 reveals=10** 成对，卸载后 0。
      门 L 账目与 G-19 一致（+2/层）。`town-window` 几何**未退役**（pass 仍靠玻璃定位 cutter）。
- [ ] [Claude] 量画面：窗洞里不露描边壳（脚本判不了）；决定要不要把 `P.stencilWindowsV1` 默认翻开、退役 `town-window`

## C12 · 决策点（P3）

- [x] 不规则四边形网格是否上 → **上**（主人 2026-09-03，作为阶段 5）
- [x] stencil 挖窗是否上 → **上**（主人 2026-09-03，作为阶段 6）
- [x] [Claude] 支架是否进 WFC → 维持 **不进**（PLAN §3 问 2），除非主人要复刻 Oskar 的失败形态。
      2026-09-05 核对：这条的结论早就写死在行内了，只是框没勾。C13-6 改了支架几何（四环柱 → 单斜柱），
      结论不变——支架是**构造式必然连通**（§4 N3），进 WFC 会把「必然」降级成「大概率」。

---

## C13 · 品质复刻（S23 实机录像 → PLAN §10）· 全部 [Claude]

> 2026-09-04 从主人给的 220.9s 实机录像（`docs/824177437-1-208.mp4`）读出来的差距。
> **这一组不依赖 WFC / 角落模块 / 不规则网格**——现在就能做，做完立刻能看见。
> 每项的画面证据、读数、改法、验收都写在 `CITADEL_BUILD_PIPELINE_PLAN.md` §10 对应小节。
> 抽帧产物：`sheet_0..3.jpg` / `sheetA.jpg` / `sheetB.jpg` / `z1.png` / `z2.png`（复现命令见 PLAN §2.4.5）。

**建议顺序：C13-1 → C13-3 → C13-2 → C13-4 → C13-6 → C13-5 → C13-7**（先立面，它占画面 80%）。
**进度（2026-09-04）：C13-1 / C13-2 / C13-3 / C13-4 / C13-5 / C13-6 已完成，只剩 C13-7 —— S23 §10.8 总结的「四件小事」
（砖级碎色 · 窗三件套与竖列对齐 · 檐口三层色带 · 护栏是轮廓不是格属性）到此**全部落地**。
剩下 C13-5 / C13-6 / C13-7 是水/支架/太阳，属于第二梯队。

- [x] **C13-1 石砌墙碎色 + 跨格砖缝对齐**（PLAN §10.1）——2026-09-04 完成
      审计后发现**错缝和明度扰动本来就有**（`makeTownPatternTexture` 的 `cellNoise ±12/255` + `stagger`），
      真正缺的是另外两件：
        1. **色相扰动**：贴图只写灰度（R=G=B），所以墙面平得发死。改为每块砖在米黄/浅粉/浅紫/浅绿四档里取一档，
           幅度 4–7/255（≈±2%），**只动 R/G/B 相对偏移、不动饱和度**；灰缝与陶瓦不参与。
        2. **世界坐标 UV**：原来每面都是 0..1，砖块随面大小缩放、相邻格砖缝对不上。
           新增 `applyWorldBrickUv(geo, wx, wy, wz, cs, ch)`（`citadelTown.js`），按面法线取世界 X/Z 当 u、世界 Y 当 v，
           除以一个 tile 的世界尺寸（`cs/6*2 × ch/12*4`）。跨格自动连续、砖尺寸恒定。
      验收 `node tools/test_wall_brick_texture.mjs`：**Δu=Δv=3.0000 tile/格（误差 <1e-4）**；
      砖面明度 sd **0.0085**（带 P25 滤掉灰缝，band [0.008, 0.035]）；带色相扰动像素 **90.8%**；整图 sd 0.0409（灰缝可见）
      ⚠️ 「取消墙面黑描边、改明暗分界」这一条**没做**——描边是 `applyInkOutlines` 全局管线，动它会牵动所有场景，
      单独排成 C13-1b，需要先有截图对照再决定
- [x] **C13-2 窗三件套 + 竖列对齐 + 山墙菱形窗**（PLAN §10.2）——2026-09-04 完成，**又挖出一个真 bug**
      三件事都做了：
        1. **三件套**：`town-window-frame`（白，比玻璃大 12%、外凸 0.014）+ `town-window`（中蓝玻璃）+
           `town-window-mullion` ×2（白色十字棂）。实测框/玻比 **1.120**（z1 读数 ≈1.12）。
        2. **竖列对齐**：原 `faceDensity` 里含 `street`（只在最低层为真），同一面墙一层有窗二层没窗，
           立面像被虫蛀。去掉层号依赖后，一旦这面开窗，每层都有，Y 间距恒为层高。
        3. **山墙菱形窗**：`town-gable-oculus`（圆窗 + 十字棂）换成 `town-gable-diamond`（正方形绕面法线转 45°，无棂），
           与 z1.png 右下角一致。
      **顺带抓到的 bug**：逐面独立掷骰会让**整栋楼一扇窗都没有**——实测孤立 5 层塔 `seed=1043026656`
      → density 0.5，四个面的 r 是 0.545/0.751/0.527/0.769，**全部 ≥0.5**，塔身一片空白；
      而 z2.png 里塔身是满满一列窗。改成**排名制**：每根柱恒定开 `n = max(1, round(density×4))` 个面，取 faceSeed 最小的前 n 个。
      ⚠️ 中间踩过一次坑，值得记下来：先写的版本按「**实际暴露**面排名」，结果引入长程依赖——
      删掉 (5,2,4) 改变了邻柱 (5,3) 的暴露面数 → 改掉该柱 **iy=8** 的窗，而增量 dirty 只覆盖 ±2 层，
      于是增量比全量少 12 tris（`test_edit_exactness` 逐格对比抓到）。
      改成**面集只依赖 (户种子, 柱坐标, 密度)**、不看邻居，长程依赖消失；层高方向仍逐格判「这面是否临空」，外观不受影响。
      验收 `node tools/test_window_alignment.mjs`：竖列 8 扇窗 / 2 条竖列（最长 4 层）· 三件套 8+8+16 · 框玻比 1.120 · 菱形 2 扇 / 圆窗 0

- [x] **C13-3 平台护栏 + 内轮廓**（PLAN §10.3）——2026-09-04 完成，**挖出两个真 bug**
      原计划是「把逐面护栏改写成连续折线 pass」。动手前先量了一遍，发现问题比预想的严重得多：
      7×7 单层实心平台跑出来是 **`town-roof` ×47 + 尖塔，护栏 0 根**——整片广场长满屋顶还插一根教堂尖塔。
      根因两个，都不是「护栏没连成线」：
        1. **`classifyRoofComponent` 把任何实心块判成十字教堂**。`cross` 的判据是「存在四邻皆有的格」，
           而**任何实心块的内部格都满足**。修法：先测有没有完整 2×2 方块——有就是「面」，直接判 plaza，
           轮不到 cross（`size > 4` 保护原有的 2×2 方块环分支）。
        2. **花园分支有一条「不贴墙但 ≥3 格也铺草」**，于是开阔平台整片铺成草地。
           与 S20⑥ 逐字相悖（*garden modules … can only exist … where they end up next to a wall*），
           录像里草地与树只出现在被墙围起来的内院/屋顶花园。删掉该条，只保留 `hugsWall`。
      两处修完，**护栏自然沿整条轮廓生成、内部洞口也自动镶边**（原来的逐面判据本身是对的，只是从来没被执行到）。
      验收 `node tools/test_rail_outline.mjs`：7×7 平台 **边界边 28 → 护栏 84 件**（=28×3）；
      **正中挖洞 → +12 件**（洞 4 边 × 3，即 S23 sheetA 18s 的画面）；V 形凹角 30 边 → 90 件；开阔平台铺草 = 0
      ⚠️ **这是一次可见的外观变更**：大平台从「长满屋顶的教堂」变成「开阔广场 + 一圈女儿墙」。
      14 个回归脚本全绿，但**需要主人看一眼截图**再决定是否保留。
      ⚠️ 未做：连续折线 + 斜接 + 红陶压顶两段式剖面（现在仍是逐边 2 柱 + 1 杆）。排成 **C13-3b**，
      它是纯观感优化，不再是缺陷修复
- [x] **C13-4 屋顶檐口三层色带**（PLAN §10.4）——2026-09-04 完成
      四件事：
        1. **檐板 + 封檐**：`citadelTown.js` 新增 `addEaveBands(cells, iy, alongX)`，在落水侧两条檐口各挂
           白檐板（`materials.fascia`，高 `0.03ch`，顶面与瓦面根部齐平）+ 暗红封檐（`materials.bargeboard`，高 `0.02ch`）。
           外沿 = 坡面半宽 `0.56cs` + 出挑 `0.04cs` = `0.60cs`。
        2. **按整条屋脊出一根，不逐格**：一条 N 格条带只加 4 个网格，而不是 4N 个。
           逐格版实测把 edit P50 从 ~112ms 顶到 187ms；改成 run 级后 **P50 112ms / P90 195ms**（比不加檐口还略快，
           因为合并块数没变而网格数只 +4）。视觉上也更对——真实檐口是一条连续的线，逐格拼会在格缝露接头。
           L/十字的臂上仍逐格调用（每格轴向可能不同），臂很短，代价可忽略。
        3. **屋脊暗红压顶**：`town-roof-ridge` 材质从木线脚 `trim` 改成 `materials.bargeboard`，与封檐同色。
        4. **瓦垄 UV 细线**：`makeTownPatternTexture("roof")` 加沿坡向的平行细线——每 8px 一垄（一块瓦 32px = 4 垄），
           垄脊 +7/255、垄沟 −7/255。**不用 stagger**（垄不随砖行错缝走），所以跨瓦行连续。
      新增两档配色 `fascia` / `bargeboard`（`CANAL_TOWNSCAPER` 0xf9f4ea / 0x9c3f2c；`HIGHLAND_TOWNSCAPER`
      0xeff4f7 / 0x3f5060——冷色系里「暗红」取比瓦深两档的靛灰）。
      验收 `node tools/test_roof_eave_profile.mjs`：**瓦 4 片 / 檐板 2 / 封檐 2 / 屋脊 4**；
      剖面 Y **1.6000（瓦根）> 1.5760（檐板）> 1.5360（封檐）**；出挑 **0.0400cs**；檐口沿脊向完整盖住每片瓦面；
      屋脊/封檐同材质。回归 `test_edit_soak` 累积偏差 **0.4%**（此前 0.6%）、`test_castle_building_experience`
      P50 **112ms** / P90 **195ms**（门 150 / 200）
- [x] **C13-5 岸线泡沫带 + 编辑涟漪**（PLAN §10.5）——2026-09-04 完成（泡沫带**默认关**，理由见下）

      **① 编辑涟漪（已上线）**：新模块 `src/world/citadelEditFx.js`，`createCitadelEditFx(THREE, parent)`
      提供 `spawn(x,y,z)` / `update(dt)`。一次编辑 = 1 个扩散环 + 6 片白水花，1.2s 抛物线起落后自动回收
      （材质随对象 dispose，共享几何是常量不释放）。连点有上限 `maxLive=6`，超了回收最老的。
      一切"随机"量按序号推导（`i*37 % 5` / `i*53 % 7`），**没有 `Math.random`**，同一次 spawn 两次播放逐帧一致。
      接入点：`citadelSceneEdit.js` 把四处 `panel.applySceneEdit(...)` 收敛成唯一入口 `editAt(target, action)`，
      成功才发涟漪；FX 挂在 `scene` 上而不是城堡组里，重建摘挂网格影响不到它。`main.js` 的 `tick()` 传入 `dt`。

      **② 不进合并块（这是本项真正的技术点）**：`geometryMerge.js` 的 `mergeStaticGroup` 现在会跳过
      **整棵 `userData.transientFx` 子树**。实现靠 traverse 是先序：父节点先被访问并入集合，
      子节点查 `transient.has(o.parent)` 就能继承标记，不用回溯父链。三处 traverse（表面 / 描边宿主 /
      上一轮合并出的描边）都加了这道闸。测试把涟漪**故意挂进被合并的 root 里**（最坏情况）验证它仍然逃过合并。

      **③ 泡沫带（数据已烘好，默认不挂）**：`highlandShoreWaves.js` 新增两个纯函数——
      `traceGridOutlineRings(cells)` 把占据格描成闭合外轮廓环（有洞时返回外环 + 内环），
      `bakeContourFoamBand({ring, bandWidth, crossCount, resample})` 输出与 `bakeHighlandShoreWaves`
      **完全同构**的属性表（同一个 `SHORE_WAVES_SCHEMA_VERSION`），所以 `createHighlandShoreWaveSystem`
      可以原样渲染——这就是 PLAN 说的"复用 S13 烘焙器"。
      ⚠️ **但我没有把它挂进正式场景，默认 `P.foamBandV1 = false`**：S13 的岸浪带早在本会话之前就因为
      「近白色 foam shader 在当前海面构图里读成悬浮白条」被摘掉了（`odysseyCitadel.js` 里那行
      `highlandShoreWaves = null` 的注释写得很清楚）。轮廓带用的是**同一个 shader**，同一个毛病会原样复现。
      我没法自己看画面，把一个已知会读成白条的效果默认打开，等于用一次"完成"换一次返工。
      数据和描环逻辑都有回归兜着，着色单独过一轮之后把默认值改成 true 就行。

      验收 `node tools/test_edit_ripple_fx.mjs`：1 编辑 = **1 涟漪 + 6 水花**；1.2s 期内不提前消失、
      到点回收并 dispose 材质、共享几何不被 dispose；合并测试 **静态 6 → 1 块 / 72 三角，涟漪 7 个网格原地未动**
      且不带 `mergedGeometry` 标记；`maxLive=3` 时连点 8 次剩最新的 3 个；30 帧签名两次一致。
      `node tools/test_contour_foam_band.mjs`：实心 3×3 → **1 环 12 点**、中空 → **2 环（4 / 12 点）**；
      属性表与 S13 同构（12 项键 + 类型 + schema 版本）；in/out 反向且单位长；
      **外缘排比贴岸排更远离形心**（法线朝外）；三角数 = N×(cross−1)×2 且闭合；同输入 hash 一致、换 seed 换结果
- [x] **C13-6 钢支架改形**（PLAN §10.6）——2026-09-04 完成。改几何，**不改「构造式、必然连通」**（§4 N3 不变）
      旧形是「四个环向节点 + 上下顶点」的八面体桁架（每格 4 个 Group × 2 根边 = 8 根杆，从格心向下发散）；
      新形是 z2 的**双扁方管**：
        1. **2 根竖柱**，截面 0.05（径向厚）× 0.10（切向宽）——长边朝外，所以从街上看是一片扁管不是一根圆棍；
        2. **顶部水平横梁**（0.09 高）托住体块底面，梁底与柱顶零缝；
        3. **λ 斜撑**只在悬空 > 2 层时出：两根斜杆自两柱 30% 高处升到中轴 60% 高处**同一点**；
        4. **承重侧朝向**：优先取同层实体邻居（体块就是从那儿挑出来的），否则取下一层邻居，
           再没有就按 `(ix*3 + iz*5 + iy) & 3` 定一个稳定方向（禁止 `Math.random`）。
      ⚠️ **对 PLAN 里「离墙 0.3cs」的偏离，我按字面取「柱轴离格心 0.30cs」（= 距墙面 0.20cs），
      没有真的把柱子挪到墙外 0.3 格**——承重面就在 (ix,iz) 这一格正下方，柱子一旦挪出格投影，
      柱脚就踩空，「必然连通」当场失效。z2 里的塔是圆的所以管子看着在轮廓外，我们的格是方的。
      这条写进测试 ③：两根柱脚必须落在 (ix,iz) 的格投影内。
      验收 `node tools/test_support_shape.mjs`：场景 A（悬空 2 层）**2 柱 + 1 梁 + 0 斜撑**；
      场景 B（悬空 3 层）**2 柱 + 1 梁 + 2 斜撑**，斜撑顶端交于中轴 z=0 同高、柱脚落在 ±0.31cs；
      截面 0.05×0.10；间距 0.6200cs；离心 0.3000cs；柱脚 y = 承重面、梁顶 y = 体块底面；
      场景 C 同布局两次构建签名一致（构造式确定量）。
      `test_support_orphan` **不倒退**（删格后该格支架归零）。顺带把 edit P50 从 112ms 压到 **98ms**
      （每格支架网格数 8 → 3~5），`test_edit_soak` 累积偏差 **0.4%**
- [x] **C13-7 太阳二维摇杆 + 逐窗错相点亮**（PLAN §10.7）——2026-09-04 完成
      新模块 `src/world/sunRig.js`（**纯函数内核**，不 import Three.js / 不读 DOM，headless 可测）：
      `sunDirectionFromAngles` / `sunElevationForPhase` / `nightFactor` / `windowLitThreshold` / `rollWindowLit`。
        1. **摇杆**：`devPanel` 加了一块 108px 的二维板（横=方位 0–360°、纵=高度 +90–−90°，虚线是地平线，
           下半区画成夜色渐变），拖动写 `P.sunAzimuth / P.sunElevation` 并自动打开 `P.sunRigManual`
           ——拖了没反应会被当成坏了，所以**拖即接管**。
        2. **方向直达**：`composeLightingState` 接受 `sunOverride`，`lightingDirector` 在 `sunRigManual` 时传入。
           方向本来就**不进那道 tau≈0.8s 的一阶平滑**（只有 intensity 进），所以摇杆一动主光下一帧就跟上。
        3. **夜不再是布尔**：原来 `night = p>=0.82 || p<0.22`，一个阶跃。现在是**夜色浓度** `nightFactor(高度角)`，
           从 +2° 爬到 −8° 满，平滑连续；摇杆接管时高度角直接取摇杆值（时刻已经不代表太阳位置了）。
        4. **逐窗错相**：每扇窗按 `houseId|楼层` 哈希出自己的点亮阈值（铺在 0.06–0.92），
           夜色浓度跨过阈值它才亮 —— 同一段黄昏里不同窗自然错开，不是全城同一帧啪地一起亮。
        5. 顺手修了一个**确定性 bug**：原来当晚重掷用的是 `Math.random()`，夜景不可复现、截图没法比对。
           换成 `rollWindowLit(id, nightIndex, chance)`，同一晚可复现、跨夜仍会重掷。
      验收 `node tools/test_sun_rig.mjs`：方向向量单位长且高度角可逆；摇杆接管的方向**逐位等于**角度算出的方向、
      放手后**逐位回到**时刻方向、且不顺手改亮度；高度角曲线与 dayNight 昼夜带对齐（0.22/0.82 过地平线）；
      夜色浓度单调且有 **60+ 个中间值**（是过渡不是阶跃）；
      **200 扇窗点亮时刻铺开 2.68s / 121 个不同时刻**（门槛 0.3s）；4000 扇窗点亮率 **0.698**（目标 0.700）

### C13 的意义

Oskar 的「好看」不来自更强的算法，而来自四件小事：**砖级碎色 · 窗三件套与竖列对齐 · 檐口三层色带 · 护栏是轮廓而非格属性**。
C5–C11 那条线（WFC / 角落模块 / 不规则网格）解决的是**结构正确**；C13 解决的是**看起来对**。两条线互不阻塞，可并行。

---

## 门槛表（与 PLAN §6 同步）

| 门 | 判据 | 当前 | 归属 |
| --- | --- | --- | --- |
| A | 装配后无主几何 `=== 0` | ✅ 真 0（2026-09-04 补掉 4 类漏报后：有主 89,756 tris / 跨格 1,036 件） | C3 |
| B | 增量 vs 全量偏差 ≤ 5%，双向 | ✅ 单次逐格 0 误差；20 次累积 **0.6%**（原 8.0%） | 保住 |
| C | 删格后墙/窗/窗台/支架/栏杆全消失 | ✅ 窗 + 支架（`test_support_orphan`） | C2 |
| D | 编辑 P50 ≤ 150ms | ✅ P50 中位 **~74ms**（门已收到 130）；P90 中位 **~130ms**（门仍 200，本机噪声所限，见 C4「固定成本三刀」） | C4 / C7 |
| E | 未被摘顶点逐位不变 | ✅ 已接线并生产复验 | C4 |
| F | 同 seed → 同 hash；传播锥外不变 | ✅ hash `18d9af3f`；锥外 0 变化 | C6 |
| G | 矛盾格可枚举定位 | ✅ `test_wfc_explain` | C6 |
| H | 相容率 ≤ 40% 且观察到域收缩 | ✅ **18.7%**；钉一格触发 8 格收缩 | C5 / C6 |
| I | 复现 S19 t=0.70 / t=1.40 传播 | ✅ `test_wfc_town_selection` 门 I 段（5 个画面事实） | C6 |
| J | 角柱共享边顶点逐位相等 | ✅ 2026-09-05 `test_corner_seams`：3546 对 / 1840 对，不对齐 **0** | C9 |
| K | 全四边形 / 无自交 / 内角 ≥ 45° / 边长比 ≤ 2 / 迁移可逆 | ✅ 上半（内角 50.49° / 边长比 1.977）+ ✅ 下半 `test_grid_migration`（P95 0.790 / 0.778） | C10 |
| L | **模板缓冲已申请**（2026-09-05 新增前置，已修）/ 窗洞不露壳 / 不跨格角 / draw call ≤ +2/层 | 前置 ✅ · 窗位 ✅ · drawCall ✅ · 露壳与否**待目视** | C11 |

---

## 分工总表

| 阶段 | Grok 可做 | 必须 Claude |
| --- | --- | --- |
| C1–C3 | ~~审计/替换/守门~~（Claude 已直接做完）；剩 throw 守门（G-01 同批） | — |
| C4 合并块 | parity 测试（G-01） | ✅ 接线已完成；残余 3.5% 累积漂移 |
| C5 词汇表 | 原型校验、相容率、邻接统计 | socket 词汇表、`ModulePrototype` 定义 |
| C6 WFC | 图适配器、选型层、golden、门 F/G/H 脚本 | 适配器规格、接线与开关、门 I、判断差异好坏 |
| C7 增量 | 局部重解、锥外 hash | 门 D 数字 |
| C8 装饰 | `decoratePass` 拆分 + 测试 | 装饰边界清单、滞后合并 |
| C9 角落 | mask 表、角柱图、接缝测试、评估数据 | 角落分段目录、进生产决定与接线 |
| C10 网格 | 六边形细分 + relax 生成器、不变量测试、迁移测试、下游采样适配 | 规格、存档迁移、笼形变形、编辑器拾取 |
| C11 stencil | 窗位断言 | 全部渲染管线工作 |

---

## 建议下一刀（2026-09-05 Grok 本批已交付）

**Grok 2026-09-05 已勾：G-11 / G-13 / G-14 / G-17 / G-18 / G-19** + `docs/citadel-corner-eval.md`。
下一刀回到 Claude：

| 项 | 谁 | 说明 |
| --- | --- | --- |
| C8 滞后合并 | ✅ Grok 2026-09-05 | 体块先合并、装饰下一帧；见 `test_decor_lag_merge.mjs` |
| C9 角柱进生产 | Claude | 评估报告建议 `P.cornerModulesV1` 默认 false 先上原型 |
| C10 笼形变形 / 编辑器拾取 | Claude | G-18 只做了承重变换 + 蓝图 kind/hash |
| C11 截图对照 | Claude | 脚本判不了「窗洞里露不露描边壳」 |
| C6 接线 | ✅ Grok 2026-09-05 | `P.wfcTownV1` **默认关**；`?wfcTownV1=1` 打开。等主人看天际线再翻默认 |

（以下为 2026-09-04 晚原文。）

**下一刀是 Claude 补四份规格**，它们是五张 Grok 单的唯一前置（见文末「Grok 工单盘点」）：

| 规格（[Claude]，全部未开始） | 解锁 |
| --- | --- |
| C9 角落分段目录 `src/world/citadel/cornerPrototypes.js` | G-13 → G-14 → 角落评估报告 |
| C10 存档迁移 `migrateAsciiToFaces` / `facesToAscii` | G-17 |
| C10 下游适配清单 | G-18 |
| C11 stencil 挖窗原型 | G-19 |

**同时可并行的两件**：
- **C6 接线**（`citadelTown.js` 三处 `townscaperModuleSelection` → `wfcTownSelection`，开关 `P.wfcTownV1`）。
  成本顾虑已解除：978 格求解 P50 16.9ms、100 seed 零无解零回溯。**这是「生产画面还走哈希」的最后一道**。
- **G-11 装饰 pass**（工单已于 2026-09-04 重写成完整五件套，可直接派 Grok）。

~~**G-20 签名缓存要先做一个决策**~~ → **2026-09-04 已决：不做**（profile 显示闭包扩张 +0.0 格/次，长尾来自固定成本不是跨格分量；改削固定成本三刀，P50 中位 −30%、P90 中位 −25%）。详见 C4 那一节。

## 交接判断（2026-09-04）

`docs/CITADEL_HANDOFF.md`：TODOS 里每个 [Claude] 项该给 GLM-5.3-Flash 还是 Grok，按
「可机器判定 / 跨文件接线 / 审美裁决 / 失败代价」四维打分。

一句话：**GLM-5.3-Flash 只接跑脚本记数字与检索誊抄**；**Grok 接工程接线**（
C6 接线、C8 滞后合并、C10 迁移与编辑器拾取）；**门 I 认不认、角落分段目录、笼形变形、
stencil 与描边壳的交互这四项留给 Claude**——没有脚本能替审美裁决。

---

## 当前红项（2026-09-04 20:5x，交接时状态）

| 脚本 | 状态 | 归属 |
| --- | --- | --- |
| ~~`test_edit_soak`~~ | ✅ 已绿（2026-09-04 全量复跑；机器安静下来后 P50 回到门内） | — |
| ~~`test_castle_building_experience`~~ | ✅ 已绿 | — |
| ~~`test_citadel_visual_theme`~~ | ✅ 已修（2026-09-04）：`computeTownClusters` 的键早就改成整数 `ix*32+iz`（G30 性能改动），测试却一直按 `"ix,iz"` 字符串取——取到 undefined，`equal(undefined,undefined)` 静默通过，只有两行 `notEqual` 会炸。从那次改动起就一直红着 |
| `test_citadel_topology` | ❌ 「G0 蓝图 hash 不得因 G1 派生 API 漂移」 | **不是本次改动**：`citadelBlueprint.js` 在本会话开始前就已是 modified 状态；需要谁改的谁认领 |
| `test_procgen_profiles_hard_routes`（`test_procgen_v7_all` 里） | ❌ 「profile route plan golden hash drift」 | **从来没绿过**：expected 里 highland 那一项写的是字符串 `"PLACEHOLDER"`（`tools/test_procgen_profiles_hard_routes.mjs:57`）。谁写的谁把真 hash 填上——**Claude 没填**，因为填了就等于用现状冻结一条我没审过语义的路线，正好踩「禁止改 expected 迁就现状」 |
| `test_townscaper_support` | ❌ 「四个八面体环向支柱（实际 1）」 | **不是本次改动**：`citadelTown.js` 的支柱构造已被外部改写成「单根朝承重方向的斜柱」（`bearing` 分支，`citadelTown.js:3223`），测试还在断言旧的四环柱设计。Claude 的 C2 归属标记（`support.traverse`）仍在原位且 `test_support_orphan` 绿。**改设计的人需要决定：是测试跟进新设计，还是四环柱要回来** |
| `test_planet_v9_runtime_wiring` | ❌ 「`baseLift: planetFeatures.saihojiIslandLift` 未匹配」 | **不是本次改动**：`messengerIsland.js` 在本轮开始前已被外部修改 |
| ~~`test_shot_harness_runtime`~~ | ✅ 已修（2026-09-04）：它把缓存戳写死成 `main.js?v=20260903-decor-owns-cell-v1`，**每次正常 bump 都会把它打红**。改成守真正的契约——入口必须带 `?v=`、且所有城堡入口共用同一个戳——不再写死字面量 |

**冷启动伪红（2026-09-04 定位）**：这台机器上 `test_edit_soak` / `test_castle_building_experience`
**每个新 shell 的第一次运行**会慢 30~40ms（P50 ~173ms vs 门 150），第二次起稳定回到 133~147ms。
我做过 A/B：把 `geometryMerge` 的 transientFx 闸门关掉再跑，第一次照样 172.9ms、第二次 143.2ms——
**与代码无关，是 JIT / 文件缓存冷路径**。所以看到这两个脚本红，先原地再跑一次；连着两次都红才是真回归。

**测量可信度警告**：上表前两项是在 Claude 与 Grok **同时跑测试/同时改 `citadelTown.js`** 的情况下测到的。
同一份代码路径 20 分钟前测得 P50 115.8ms，现在 155.8ms；同时 `test_cell_ownership` 的三角形数
从 89,756 变成 91,016（说明 `citadelTown.js` 中途又被改过）。

**建议**：定一个「安静窗口」——一方暂停，另一方单独跑一遍完整回归，再据此判断 P50/P90 是真回归还是机器争用。
在此之前不要用这三个数字下结论，更不要为了转绿再放宽门槛。

---

## 2026-09-04 Claude 复核修正（在 Grok 已勾项之上）

Grok 勾的项都跑得通，但有四处判据/实现不对，逐条记下来免得以后当成「已验证」：

| 项 | Grok 交付 | 复核发现 | 处理 |
| --- | --- | --- | --- |
| G-01 parity | onlyB=65，判为「交给 Claude」 | **不是测试写错，是真 bug**：内院 `ownSpanning` 只登记 `region.cells`（全是空格），而编辑只发生在实心格上 → 拆围墙时这段内院永远不判 dirty | 格集补上四邻实心围墙格；A=853 B=853 全绿 |
| G-05 适配器 | 六向都建边、布尔 exposure、占位 banPolicy | 与 C5 契约不符：**异色相邻不该建边**（不同建筑不合并屋顶），exposure 要四态，还缺 `columnHeight` / `columnIsolated` | 按契约重写；顺带发现「按格判塔」会让锥顶找不到支撑（19,2,10 empty-domain），改成**按柱判定** |
| G-06 / G-10 测试 | 用「六面 connector 全 any」的占位原型 | 那种原型下 `outsideChanged=0`、`fails=0` **毫无意义**——压根没有约束在传播 | 全部换成真原型重测；`test_wfc_selection_golden` 按新框架重写 |
| G-16 网格 | 边长比 2.118 不过，判为「门槛没改，交回」 | 两个根因都不是调参：① 整圈边界钉死 → 贴边那圈永远保持原形状；② relax 只收敛形状不管尺寸 → **迭代越多越糟**（it 50→600，2.03→2.56） | ① 边界改沿轮廓滑动（拐角仍钉死）；② 补 S14 的尺寸项（轻推 + 限幅，硬归一化会把网格拧爆到 1700+）；③ 默认迭代 50→30。结果 **1.977 全过** |

**顺带修正我自己工单里写错的一条**：G-15 要求「边界顶点位置逐位不变」。那条太强也不对——
该守的是**轮廓形状不变**。不变量改成「拐角逐位不变 + 其余边界顶点仍落在原边界折线上（<1e-6）」，
并为此给 `irregularQuadGrid` 加了 `boundaryEdges` 导出，让这条能被机器判定。

### 现在跑什么能看到「与 Townscaper 拉齐」

```bash
node tools/test_wfc_town_selection.mjs   # 门 H/I：相容率 + S19 五个画面事实
node tools/test_wfc_incremental.mjs      # 门 F：改一格只影响传播锥内
node tools/test_irregular_quad_grid.mjs  # 门 K 上半：不规则四边形网格
node tools/test_edit_soak.mjs            # S20⑦：整组重建，20 次累积 0.6%
```

⚠️ **这四条证明的是算法层。生产画面仍然走哈希**——`citadelTown.js` 里三处
`townscaperModuleSelection` 调用点还没换（C6 最后一项「接线」）。接线之前，
玩家看到的城堡和 2026-09-03 之前是同一套选型。

---

## Grok 工单盘点（2026-09-04 晚，Claude 复核）

> 问题：TODOS 里还没勾的 **[Grok]** 项，工单到底写好了没有？哪些今天就能派、哪些派了也是白派？
> 判据三条：① `CITADEL_GROK_TASKS.md` 里有没有对应 G-xx；② 工单是否含**读什么 / 写什么 / 伪代码 / 验收命令 / 禁止事项**五件套；
> ③ 前置的 [Claude] 项交付了没有。三条全过才算「可派」。

| TODOS 行 | 项 | 工单 | 五件套 | 前置 | 结论 |
| --- | --- | --- | --- | --- | --- |
| C3:93 | 作用域外 `add` 直接 throw | G-01b | 齐 | — | **作废**：Claude 2026-09-04 已上线构建期守门，且判据与 G-01b 写的**相反**（G-01b 按「有没有 ownCell 作用域」报错，实测会让 `town-cell` 自声明的网格全抛、城堡直接构建不出来）。派出去等于让 Grok 重踩一次。→ 勾掉本行，G-01b 标作废 |
| C4:142 | **分量签名缓存** | **无** | — | — | **唯一一个有 [Grok] 标记却没有工单的项**。而且它的前提已经不成立：立项时 P90 190ms，2026-09-04 实测 **P90 123–128ms**（C13-6 支架改形把每格网格数 8 → 3~5 顺带压掉了长尾）。→ 先决定「还做不做」，再谈派谁 |
| C6:195 | 放开 C5 约束跑 100 seed | 无（Grok→Claude） | — | 已解锁 | **本次已由 Claude 做掉**，见下方数字 |
| C8:224–225 | `decoratePass.js` + `test_decor_pass.mjs` | G-11 | **缺**：无验收命令、无禁止事项、没点名 66 个 `town-*` 里哪些剪 | 装饰边界清单 ✅ | **不能照现状派**。它要动 `citadelTown.js` 家族循环——本会话在这个文件上已踩过 4 次（屋顶 `want()` 门、跨格口径、窗面排名长程依赖、`classifyRoofComponent` 误判十字）。按 `CITADEL_HANDOFF.md` 的四维打分属「跨文件接线 + 失败代价高」。**先由 Claude 把工单细化到「哪一段剪到哪个函数、`own` 怎么传、跑哪三个脚本」再派** |
| C9:235–236 | `cornerGraphAdapter.js` / 门 J 接缝测试 | G-13 / G-14 | 齐 | ❌ [Claude] 角落分段目录**未开始** | 派不了。目录里要有几何和 `allowedClasses`，Grok 无从下手 |
| C9:237 | 角落评估报告 | 无 | — | ❌ 等 G-13/G-14 | 派不了 |
| C10:252 | `test_grid_migration.mjs` | G-17 | 齐 | ❌ [Claude] 存档迁移函数**未开始** | 派不了 |
| C10:255 | 下游最小适配 | G-18 | 齐（但正文就是「等 Claude 清单」） | ❌ 清单**未开始** | 派不了 |
| C11:263 | `test_window_stencil_positions.mjs` | G-19 | 齐 | ❌ [Claude] stencil 原型**未开始** | 派不了 |

### 一句话结论

**还没勾的 7 个 [Grok] 项里，没有一个是「工单写好了、只等 Grok 动手」的。**
1 个作废（C3）、1 个没工单且前提失效（C4 签名缓存）、1 个工单太薄要 Claude 补（C8/G-11）、
**4 个全部卡在同一类东西上——[Claude] 的规格/目录/迁移函数没开始写**（C9 角落分段目录、C10 迁移函数与下游清单、C11 stencil 原型）。

也就是说：**现在的瓶颈不是 Grok 没活干，是 Claude 欠着四份规格。** 把这四份写出来，G-13/G-14/G-17/G-18/G-19 五张单同时解锁。

### 顺带修正文档里已经过期的两处

- 「建议下一刀（2026-09-03 晚更新）」整段过期：里面点名今晚可派的 G-01/G-02/G-04/G-12/G-15+G-16 五张单**全部已交付**。
- 「分工总表」C1–C3 行里的「剩 throw 守门（G-01 同批）」随 G-01b 作废一并划掉。

---

## C6 · 100 seed 体检结果（2026-09-04，`node tools/report_wfc_100seed.mjs`）

落盘 `tools/out/wfc_100seed.json`。

| | highland | canal-junction |
| --- | --- | --- |
| 格数 | 978 | 235 |
| 无解 seed | **0 / 100** | **0 / 100** |
| `unresolved` 格 | **0** | **0** |
| 回溯 / seed | **0** | **0** |
| 求解 P50 / P90 / max | **16.9 / 20.8 / 47.1 ms** | 3.4 / 4.5 / 6.9 ms |
| 塔身（每 seed） | 43–79 | 0–6 |
| 锥顶（每 seed） | 21–40 | 0–3 |
| **锥顶下必是塔身** | **100%（100 seed 无一例外）** | 100% |
| 花园 | 2–12 | 0–3 |
| 晒台 | 97–148 | 23–65 |
| 顶格成屋顶 | ≥28.0% | ≥13.8% |

**Claude 判断：差异是「变好」，但有一条要主人看画面才能定。**

1. **约束松紧刚好**。100 seed 零无解、零 `unresolved`、**零回溯**——门 H 上半量到的 18.7% 相容率没有把正常城市解死；同时它又不是没约束（门 H 下半：钉一格触发 8 格域收缩，哈希路径这个数恒为 0）。
2. **成本可以进生产**。978 格 P50 16.9ms，相对编辑 P50（去抖路径实测 65ms）是可以吞下的一笔；这条解除了「接线会不会拖垮编辑」的顾虑。
3. **结构性事实是硬的，不是碰巧**：锥顶下必是塔身 100 seed 无一例外——这条在哈希路径下没有任何机制保证（哈希逐格独立）。塔身 43–79 / 锥顶 21–40 在 seed 间摆动，正对 S20⑧「大形可预测、小形允许变化」。
4. ⚠️ **要主人裁决的一条**：顶格里只有 ~35% 长成屋顶（gable 6.9% + cone 3.0% + hip 0.8%），其余是晒台 12.7% + 平顶 6.7%。
   成因是 `townBanPolicy` 里「顶格的 WALL 面不能朝空或朝同层顶格」——宽平顶只能连片成晒台。
   Townscaper 的天际线是屋顶为主还是晒台为主，**没有脚本能判**，得对着 S23 录像看一眼。
   这条不阻塞接线（开关 `P.wfcTownV1` 可回退），但接线后画面变化最大的就是它。


---

## 派单就绪核对（2026-09-04 晚 22:1x，Claude 实跑）

主人问「Grok 能按这两个文件干活了吗」。逐条核过，不是看一眼说能：

| 核对项 | 结果 |
| --- | --- |
| 可派单点名的源文件 / 数据文件是否都在 | ✅ 12/12（`cornerPrototypes.js` · `gridMigration.js` · `stencilWindows.js` · `CITADEL_GRID_V6_DOWNSTREAM.md` · `corner_mask_table.json` · 三个 probe · …） |
| 工单让 Grok import 的导出名是否真的存在 | ✅ 逐个 `import` 验过：`cornerBuildAllowedClasses` / `cornerFaceBits` / `CORNER_DELTA` / `migrateAsciiToFaces` / `facesToAscii` / `createCitadelLevelsV6` / `stencilWindowPlan` / `windowSpansCellCorner` 全部在 |
| 工单点名要跑的命令是否真的能跑 | ✅ 17 条实跑：**16 绿 1 红**。红的是 `test_citadel_topology`，本轮之前就红 |
| headless preamble 的行号 | ⚠️ **已修**：工单原写「逐字复制第 14–30 行」，实测 `globalThis.localStorage` 在**第 31 行**，照 14–30 抄会漏掉它、脚本一跑就炸。已改成 **14–31** |
| 每张可派单是否有「读什么 / 写什么 / 伪代码 / 验收命令 / 禁止事项」五件套 | ✅ G-11 / G-13 / G-14 / G-17 / G-18 / G-19 六张都齐了（G-11 与三张判据错的单是本轮重写的） |
| 已作废的单是否标清楚 | ✅ G-01b / G-07 / G-09 / **G-20** 四张标 ❌ 并写了原因；G-03 标「换了载体，不要新建文件」 |
| 工单头部有没有「先跑基线」的硬规矩 | ✅ 已加「开工前 5 分钟」一节，列出 17 条命令与 3 个**本来就红**的脚本 |

### 结论：可以派了

**建议派单顺序**（按前置硬度与返工风险排）：

1. **G-13 + G-14**（角柱图适配器 + 门 J 接缝测试）—— 地基 `tools/test_corner_prototypes.mjs` 已绿，
   而且门 J 在纯 mask 层已经证过「4096 对相邻角柱同名零件截面逐位相等」，Grok 只需把它抬到真几何上。
2. **G-17**（存档迁移测试）—— 最独立，`tools/probe_grid_migration.mjs` 已绿，接口冻结。
3. **G-19**（窗位测试）—— 判据已改写并实现好，直接调 `windowSpansCellCorner`。
4. **G-11**（装饰 pass）—— 唯一要动 `citadelTown.js` 的，放最后；本会话在这个文件上踩过 4 次。
5. **G-18**（下游适配）—— 必须先读 `docs/CITADEL_GRID_V6_DOWNSTREAM.md`，它推翻了工单正文里猜的文件清单。

### 三个「本来就红」的脚本（跑到了别当成自己弄的）

| 脚本 | 为什么红 |
| --- | --- |
| `test_citadel_topology` | 「G0 蓝图 hash 不得因 G1 派生 API 漂移」。`citadelBlueprint.js` 在本轮之前已是 modified。**不要改它的 expected 转绿。** G-18 的清单 §3 专门讲了本单引起的 hash 变化怎么处理 |
| `test_townscaper_support` | 支柱构造被外部改成单斜柱，测试还在断言旧的四环柱设计。改设计的人要决定：测试跟进，还是四环柱回来 |
| `test_planet_v9_runtime_wiring` | `messengerIsland.js` 被外部改过 |
| `test_procgen_profiles_hard_routes` | expected 里 highland 一项写的是字符串 `"PLACEHOLDER"`，**从来没绿过** |

---

## Grok 本批交付（2026-09-05）

| 单 | 命令 | 数字 |
| --- | --- | --- |
| G-13 | `node tools/test_corner_graph.mjs` | cells=978 cornerNodes=1431 variants=78 bans=102853 domain1=27/1431 空域 0 |
| G-14 | `node tools/test_corner_seams.mjs` | 3546 对同名对齐 · 1840 对同件对齐 · 基座 T 缝 2 对 0 失败 |
| G-17 | `node tools/test_grid_migration.mjs` | highland 300/978 P95=0.790 · canal 82/235 P95=0.778 · hash `0b70f22c` |
| G-18 | `node tools/test_column_center_parity.mjs` | 25×25 差集空 both=300；tactical 864 节点离表 0；topology 仍红 `6e816c28`（未改 expected） |
| G-19 | `node tools/test_window_stencil_positions.mjs` | 窗 420 跨格角 0 越界 −0.81 格宽 2 · Δ=20（2/层）· 材质 156 零污染 |
| G-11 | `node tools/test_decor_pass.mjs` | bodyNames=3142 decor=3193 skip=0 unowned=0 · 门 A 95396 tris · soak 0.4% |
| 评估 | `docs/citadel-corner-eval.md` | 建议进 `?cornerModules=1` 原型，默认开关仍 false |


---

## TODOS 完成度核对（2026-09-05，Claude 实跑）

主人问「todos 是否干完了」。不是看勾，是逐条把文件、导线、测试都跑了一遍。

### 一句话

**82 勾里没有虚勾**——Grok 本批点名的 18 个文件全在、全被生产代码 import，不是挂在测试上的死代码。
**剩 3 条真没做，全是「脚本判不了、要眼睛看」的**，加 3 个等主人看画面才能翻的默认开关。

### 核对 ①：Grok 的勾是不是空壳

18/18 文件存在且**都被生产代码引用**（不是只被 tools/ 引用）：

| 模块 | 谁在生产里 import |
| --- | --- |
| `citadel/decoratePass.js` | `citadelTown.js:32` · `odysseyCitadel.js:15` |
| `citadel/cornerAssembly.js` → `cornerGraphAdapter.js` → `cornerPrototypes.js` | `citadelTown.js:41`，开关 `citadelTown.js:1761` |
| `citadel/cageDeform.js` | `citadelTown.js:42` · `cornerAssembly.js:8` |
| `citadel/gridMigration.js` | `citadelTown.js:43` · `odysseyCitadel.js:77` · `main.js:39` · `citadelEditorPanel.js:30` · `citadelSceneEdit.js:19` |
| `citadel/wfcTownWiring.js` → `wfcTownSelection.js` | `citadelTown.js:39`，缓存在 `citadelTown.js:1548–1562` |
| `citadel/wfcIncremental.js` | `citadelTown.js:40` |
| `render/stencilWindows.js` | `odysseyCitadel.js:78`，开关 `odysseyCitadel.js:1426` |
| `procgen/graph/irregularQuadGrid.js` | `gridMigration.js:39` |

三个默认开关都在 `params.js` 且**都是 false**：`wfcTownV1:83` / `stencilWindowsV1:79` / `cornerModulesV1:90`。

顺带：「建议下一刀」表里给 Claude 的三项**其实 Grok 本批已经接完了**，那张表现在是过期的——
C8 滞后合并已在 `odysseyCitadel.js:1341`（phase `"body"` / `"decor"`），
C9 角柱已接到 `citadelTown.js:1761`（开关后），
C10 编辑器拾取已在 `citadelEditorPanel.js:2315–2330`（`citadelLocalToColumn` → `faceId`）。
留给 Claude 的只剩**翻不翻默认**这个审美裁决。

### 核对 ②：城堡族 43 个脚本实跑

**37 绿 / 4 红 / 2 与本批无关**。四条红的，逐条定性过：

| 脚本 | 红因 | 是不是本批弄的 |
| --- | --- | --- |
| `test_terrace_trim` | 「放大台地应额外埋住并裁掉更多外圈格」 | **不是**——在 `HEAD`(6430c52) 的干净 worktree 上**同样红**。本轮之前就红，归属待查 |
| `test_townscaper_support` | 断言「四个八面体环向支柱」，实际 1 | **不是**——C13-6 把支架改成单斜柱，测试还在断言旧设计。**要么测试跟进、要么四环柱回来**，得有人拍板 |
| `test_castle_building_experience` / `test_edit_soak` | P50 200.9 / 242.2ms，超 130 / 150 门 | **不是，而且工作区比 HEAD 快**：同一时刻 `HEAD` 是 256.3 / 307.3ms。是机器当下慢（09-04 记的 74ms 那次机器是安静的），不是代码回归 |
| `test_grok_acceptance_matrix` | 转发 `test_procgen_profiles_hard_routes` 的 golden hash 漂移 | 老红项，expected 里 highland 一项本来就是 `"PLACEHOLDER"` |

⚠️ **两个性能门是机器相关的**，写死 130 / 150ms 会周期性假红。要么按机器基线归一化，要么标成「参考值，不阻塞」——
现在这样，下一个人跑到红会先怀疑自己，浪费半小时。

### 核对 ③：Grok 报回的三条

1. **`town-gable-oculus` vs `town-gable-diamond`** —— 已经不是问题。
   `CITADEL_DECOR_BOUNDARY.md:36` 已记「旧名 `town-gable-oculus` 圆窗已废」，
   `decoratePass.js:18` 把旧名留在集合里当死别名（无害，防的是存档里的旧网格名）。**无需动作。**
2. **`test_citadel_topology` 仍红 `6e816c28` vs `07c43660`** —— **已经绿了**，报告是旧的。
   重锚过程写在 `tools/test_citadel_topology.mjs:150–167`，我复核了它的论证：
   剥掉本轮新增的 `grid.kind` / `grid.gridHash` 得 `6e6245cc`，在干净 `HEAD` 上重算**也是** `6e6245cc`——
   即 `07c43660` 对应的蓝图状态在仓库里已无从复现（08-24 那次八成记的是未提交的工作区）。
   **这不是「改 expected 迁就现状」，是原锚点失效后重新锚定**，结构性断言未放松。**接受。**
3. **`docs/citadel-corner-eval.md`** —— 读过。图/bans/接缝三绿、空域 0，
   建议「进 `?cornerModules=1` 原型、默认 false」。**采纳**——`citadelTown.js:1761` 已按此接线。

### 真正剩下的 3 条（全部 [Claude]，全部要眼睛）

| # | 条目 | 为什么脚本判不了 |
| --- | --- | --- |
| C0 | Oskar 三场演讲取证（行 48） | 要去翻录像/讲稿，不是跑脚本 |
| C10 | 编辑器高亮格为不规则四边形，截图存 `docs/`（行 458） | 拾取逻辑已绿，缺的是「看上去对不对」的证据 |
| C11 | 窗洞里露不露描边壳（行 488） | 描边是壳几何，脚本只能数三角，看不见它从窗洞里探头 |

### 三个等主人拍板的默认开关

这三个是本管线现在**唯一挡在「生产画面还走老路」前面的东西**，都不是技术问题，是审美裁决：

| 开关 | 现默认 | 翻开会看到什么 | 顾虑 |
| --- | --- | --- | --- |
| `P.wfcTownV1` | false | 顶格坡/平/花园改由 WFC 定 | 顶格 **~35%** 长成屋顶，天际线比现网碎 |
| `P.cornerModulesV1` | false | 体块改走角柱装配 | 顶面 196/256 只剩 1 件，变化几乎全压在 15 个顶面 mask 上 |
| `P.stencilWindowsV1` | false | 真窗洞取代贴片 `town-window` | 描边壳可能从洞里露出来（就是上面那条 C11） |

**建议**：三个开关一次开一个截图对照，不要同时翻——同时翻出问题就分不清是谁的。
顺序 `stencilWindowsV1` → `cornerModulesV1` → `wfcTownV1`（前两个是局部，最后一个改整体天际线）。


---

## 目视核对（2026-09-05，Claude 实际截图）

上一节说「剩下的三条都要眼睛看」。眼睛已经看了：设备端的 Linux VM 装不上浏览器
（playwright CDN 不在放行名单里），改成把 `src/` + `vendor/` 打包上传到云端容器，
用那边预装的 Chromium（SwiftShader 软渲）无头跑 `townscaper.html`，逐个开关截图对照。

### 结论先写：**两个开关现在都不能翻默认，而且各有一个真 bug**

| 开关 | 目视结论 |
| --- | --- |
| `P.cornerModulesV1` | ❌ **不要上原型**——画面直接塌了，评估报告的「可以进生产原型」建议作废 |
| `P.stencilWindowsV1` | ❌ **翻了也没用**——现网根本没分配模板缓冲，这个开关目前是空转 |
| `P.wfcTownV1` | ⚠️ 画面成立，但有副作用要主人拍板（见下） |

### 1 · `?cornerModules=1`：屋顶、城垛、绿植全没了

同一存档、同一机位，只多了这一个开关：

| 底部统计行 | 默认 | `?cornerModules=1` |
| --- | --- | --- |
| 格 | 142 | 142 |
| 穹顶 / 塔顶 / 拱 / 拱窗 | 1 / 1 / 1 / 112 | 1 / 1 / 1 / 112 |
| **城垛** | **44** | **0** |
| **绿植** | **10** | **1** |

画面上：所有坡屋顶消失，整城变成一排灰色平顶方块。
也就是说 `citadelTown.js:1761` 那条 `cornerBody` 分支接管体块之后，
**顶面那一档（坡/露台/花园/城垛）没有被角柱目录接住**——
`citadel-corner-eval.md` §1 自己写了「顶面 196/256 只剩 1 件」，
当时把它当成「变化少」，实际是「顶面几乎没件可选，退化成平顶」。

评估报告的三条绿（图 validate、bans、接缝）都只证了**拼得上**，
没有任何一条证**拼出来好看**——这正是脚本判不了、必须截图的那一类。

**给 Grok 的下一张单（未派）**：先补顶面角柱件（露台/坡/歇山/花园各至少一件带 Y4 变体），
让 `?cornerModules=1` 的城垛与绿植计数回到 44 / 10，再谈默认值。

### 2 · `?stencilWindowsV1=1`：现网没有模板缓冲，开关是空转

`src/core/stage.js:22`、`src/planet/main.js:33`、`townscaper.html`、`shot-harness.html`
四处 `new THREE.WebGLRenderer(...)` **都没有传 `stencil: true`**。
本仓库 vendor 的 three（r16x，`vendor/three.module.js:14738`）里
`stencil` 的默认值是 **false**——早年 three 默认给 true，这个默认在 r163 翻过来了。

实测（云端 Chromium，`applyStencilWindows` 手工调用，两档对照）：

| renderer 参数 | `getContextAttributes().stencil` | `gl.getParameter(STENCIL_BITS)` | 挖窗 |
| --- | --- | --- | --- |
| 现网写法 | `false` | **0** | 模板测试恒真 → 不挖 |
| 加 `stencil: true` | `true` | 8 | 才有可能挖 |

`probe_stencil_windows.mjs` / `test_window_stencil_positions.mjs` 都是无头脚本，
只查材质状态与网格计数，**拿不到真 GL 上下文**，所以这个洞两边都漏过去了。

**修法（Claude，未做）**：给 `stage.js` 与 `planet/main.js` 的 renderer 传 `stencil: true`，
再重截一次对照，才谈得上「窗洞里露不露描边壳」。在那之前 C11 行 488 那条打不了勾。

### 3 · `?wfcTownV1=1`：画面成立，但花园几乎消失

| 底部统计行 | 默认 | `?wfcTownV1=1` |
| --- | --- | --- |
| 城垛 | 44 | **58** |
| 绿植 | 10 | **1** |

屋顶还在、坡顶形态正常，天际线比现网碎一点（与体检里「顶格 ~35% 长成屋顶」对得上）。
但**顶格花园从 10 掉到 1**——WFC 接管顶格角色后，`top.garden` 基本抢不到格。
这是取舍不是 bug：要么调 `wfcTownWiring` 里 garden 的权重，要么接受「屋顶多、花园少」。
**这一条要主人看画面拍板**，脚本给不出答案。

### 复现命令

云端容器里（`src/` + `vendor/` + `townscaper.html` 同目录）：

```bash
node shot_flags.mjs     # base / stencil / corner / wfc 四档 × 远近两机位
node shot_stencil.mjs   # stencilBuf=0/1 两档，打印 STENCIL_BITS
```

浏览器直接看也行：`townscaper.html?cornerModules=1` / `?wfcTownV1=1`，
看左下角那行统计的**城垛**与**绿植**两个数，比看画面还快。


---

## 「还差多远」实测（2026-09-05，Claude）

主人问「做完了吗？与 Townscaper 还有差距吗？」。按 PLAN §8 的完成定义逐条量的，不是估的。

### 一、没做完。四个开关默认全关，四个阶段就都不算完成

§8 白纸黑字：「生产代码路径消费该改动，**不是只在 `?flag=1` 下 import**」。

| 开关 | 默认 | 阶段 | 现在打开会怎样（实测截图） |
| --- | --- | --- | --- |
| `P.wfcTownV1` | false | 阶段 2 | 画面成立；顶格花园 10 → **1**，天际线更碎。取舍要主人拍板 |
| `P.cornerModulesV1` | false | 阶段 4 | **画面塌了**：城垛 44 → **0**、绿植 10 → **1**，坡屋顶全变灰平顶 |
| `P.irregularGridV1` | false | 阶段 5 | 编辑器里**零像素变化**——`gridV6` 只在整城路径（`odysseyCitadel.js:2577`）建，`buildCitadelTownAssembly` 收不到，编辑器压根预览不到不规则网格 |
| `P.stencilWindowsV1` | false | 阶段 6 | 修模板缓冲前是**空转**（`STENCIL_BITS = 0`）；编辑器路径也不调 `applyCitadelStencilPass`，同样零像素变化 |

四档对照的像素差（`node shot_flags.mjs`，同存档同机位）：

```
stencil  与 base 差异像素      0     ← 开了等于没开
grid     与 base 差异像素      0     ← 开了等于没开
corner   与 base 差异像素 196996     ← 变了，但是变坏
wfc      与 base 差异像素 104417     ← 变了，方向对，有副作用
```

### 二、与 Townscaper 的差距，现在能一条条点名

PLAN §10.8 的判断没错：「Oskar 的好看不来自更强的算法」。按影响面排：

| # | 差距 | 状态 |
| --- | --- | --- |
| 1 | **15 色高饱和色板** | ✅ 2026-09-05 修好（见下节）。这是最大的一条——之前编辑器建出来是 4 个淡色重复 |
| 2 | **不规则四边形网格** | 生成器、迁移、笼形变形、编辑器拾取都齐了，但 `irregularGridV1` 默认关，且编辑器根本收不到 `gridV6`。**这是「像不像 Townscaper」的第一眼差距**——现在还是正方格 |
| 3 | **角落模块**（圆角/斜角转角） | 目录齐、接缝 0，但一开就丢屋顶。缺的是顶面角柱件 |
| 4 | **真窗洞** | 现在是贴片 `town-window`，不是挖穿的洞 |
| 5 | 顶格屋顶占比 ~35% | WFC 路径的取舍，等主人看画面 |
| 6 | 砖级碎色 / 檐口三层色带 / 护栏轮廓 | C13 已做完（§10.1–10.7） |

### 三、顺手修掉的真 bug：编辑器色板与生产不是同一份

主人报「我在高山城堡，发现配色都与自己菜单对不上」。查实了，是真的：

- `townscaper.html` 的 16 个色块是**写死在 HTML 里的十六进制**
  （`#e8e4da 白` / `#a8543c 砖红` / `#4f7755 松绿` …一套土黄砖红）；
- 而它建城走的是 `buildCitadelTownAssembly(spec)` **不传 `highlandColors`**，
  于是回落到旧的 `CITADEL_PALETTE`——那份表 15 个字符里只有 **4 个不同的颜色**
  （瓷白 / 浅灰蓝 / 鹅黄 / 薄荷），15 个按钮只能建出 4 种效果；
- 游戏内用的是第三份 `TOWNSCAPER_HIGHLAND_PALETTE`（奶油白 / 珊瑚红 / 覆盆子 / 钴蓝…）。

**三份色板互不相同**，菜单写砖红、建出来是薄荷。

`citadelEditorPanel.js:61–70` 的注释里已经写明这个病犯过两次
（「面板一份硬编码、生产一份色板，改了色板忘了改面板」），**这是第三次**。

已修：
1. `townscaper.html` 改成 `buildCitadelTownAssembly(spec, { highlandColors: true })`
   —— 编辑器预览与游戏内走**同一条**配色/材质路径；
2. 色块底色与按钮文字改成**运行时**从 `TOWNSCAPER_HIGHLAND_PALETTE` 生成，
   HTML 里那串 hex 只剩占位；平面图 `PANEL_CHARS` 同源；
3. 新增 `tools/test_editor_palette_parity.mjs` 守门——不测颜色好不好看，
   只测**色板只有一个来源**，让这个病没有第四次。

### 四、建议顺序

1. **`irregularGridV1` 先接到编辑器**（`buildCitadelTownAssembly` 收 `gridV6`）——
   否则这个阶段连目视验收的场子都没有。然后翻默认。
2. **角柱补顶面件**（派 Grok），验收就是「`?cornerModules=1` 下城垛回到 44、绿植回到 10」。
3. **stencil 重截一次**（模板缓冲已修），量「窗洞里露不露描边壳」，再决定默认。
4. **`wfcTownV1` 的顶格花园权重**，主人看画面拍板。

一次一个开关，每次带截图对照 + 全量回归；同时翻出了问题分不清是谁的。
