# 目标城真实模型编辑接入：阶段性只读结论

本报告只读代码；实际通路修复被主线程提为更高优先级，因此先保存已核实的最小路径，未修改编辑运行代码。

- 现有 3D 右键链是 `src/ui/citadelSceneEdit.js:535` pointerdown/up → 6 px 点击判断 → `selectTargetAt` → junction / highland / legacy cell 分流。候选模型不带 `townscaperUnit`、`cell`、`faceToCell`，尚无可靠编辑拾取。`highlandUnitFromHits` 没有逐祖先过滤 invisible，也会跳过没有 unit 的近处物体继续找后方对象；新分支必须先验证最近可见真实表面，受保护地标要阻断点击，不能点穿到后方楼。
- `main.js:1135` 的 latest callbacks 固定连到 `highlandLatestDesignRoot.userData.castleUnits/editCastleUnit`。目标 detailCandidate 是独立的候选句柄，当前由 `tools/pipeline/citadel_four_hour_harness.js:199` 动态挂载；不能只替换显示后宣称主编辑器已接通。
- `highlandCitadelDesign.js:1124` 的 `editHighlandCastleUnit` 改颜色、visible、scale、屋顶可见性；没有邻接传播。其返回的 `algorithm:townscaper-wfc-v1` 不能作为本轮“真正 WFC 增删”的证据。整组隐藏/删除也不能称 WFC。
- 真正的生产角色 WFC：`citadelTown.js:1601` → `wfcTownSelection.solveTownSelection` → V7 compiler/compatibility/solveWfc。`wfcIncremental.resolveIncremental` 支持 dirtyKeys、上次 assignment、逐圈扩大和相关连通分量回退，未受影响分量 pin 旧解。它目前要求整数 `ix,iy,iz` 格和保持 legacy 邻接的图；不能直接把任意房屋 ID 填进去冒充 cell。`townModulePrototypes` 定义 body/roof/terrace/garden/tower/passage 真实角色，窗、栏杆、支架仍在几何装饰 pass。
- `canalJunctionEditable.js:37` 是最可复用的成功模板：按 region 构造候选 → 确认 WFC 成功 → 检查通道 → 全部成功才 publish → 旧组释放。API 有 pick/edit/undo/redo/snapshot/save，100 步历史和 schema 校验，失败不换旧场景。直接复用它会把目标图模型替换为旧格模型，因此应提取事务壳，接目标真实模型 builder。
- `blueprintStore.js` / `editSession.js` 可参考 preview、dirty、历史解缓存及 flush，但目前是纯数据，未被主运行入口引用；`surface/nav` hash 是数量摘要，不是真实通路认证。`replace` command 规范化只保留 `{type}`，redo 所需 blueprint payload 未保留，不能不修复就照搬它承诺完整恢复。

## 本轮可落地的最小适配

1. 给 15 栋旧城房和 6 栋沿坡房建稳定 registry，使用 `old-city:house-row-side-col`、`new-city:new-city-stair-house-row-side`。新城六房已有独立 Group，含细化后 batched 基座；旧城每栋墙、屋顶、窗是根下散件，须小幅重构为每栋 Group 或明确 member 列表，不能只按 getObjectByName 找墙盒。已有 houses/footprints/position/height/colour、supportedBy 和独立候选 transform 可作为元数据。
2. 新开 candidate editor provider；复用面板交互/按键，但独立 schema、storage key、targetId 与 revision。右键先映射可见 mesh→registry entityId，再提交事务；删除后保留有界空槽和 footprint 以支持原位恢复。只允许占用/恢复/改色，不开放目前没有真实分层 builder 的“增高”或任意缩放。
3. 默认保护主蓝穹顶/主门、旧城高塔/城门、桥/桥台/连接台、surveyed stairs、支撑挡墙/拱廊、瀑布与供水、雕塑木马、r17 山体和轨道。`preserveCitadelMaterials` 仅是材质标记，不是编辑权限。保护须在拾取层和提交校验层都执行；删房时不能连带删承托平台、共用 material、通路或地标。
4. 用声明式 occupied/color patch 保存，修改前构造候选并检查 footprint、高度、承托、路线；成功后再压 undo 栈与替换。undo/redo/save/load 应用整个 snapshot 原子事务。现 panel 的 applyLatestSnapshot 逐项修改，后项失败不会自动还原前项，不能直接借来作候选原子事务。
5. 现工厂资源集中在 closure 的 geometry/material Set；不得局部 traverse.dispose 共享材质。短期可对单体拆分 builder/handle 与共享材质所有权；在这之前可按整座“建筑资产”离屏重建后原子交换，但应明确这是局部实体编辑，尚非模块 WFC。
6. 提交成功同步 support/obstacle cache、window instances、shadow fit、voxel AO 与真实通行表；复用 main.js 当前成功后的失效钩子，并增加目标候选的碰撞/路线采样。保存字段含 schema、seed、factory revision、固定 r17/拓扑 hash、entity patches；不保存 Three 对象或函数，不把旧 latest-unit 存档混入新目标模型。

## 真正 WFC 的后续结构工作

目标 authored 建筑目前没有格层、边界 socket、共享墙/屋脊或稳定邻接图。要支持局部增删后邻楼自动重解，需先拆出楼层/屋顶/拱洞/承托的真实几何 builder，生成 graph cell 与边界 profile，再把 assignment 实际用于这些 builder；不可另起只输出标签的 WFC 壳。`faceLayerGraph.js` 与 `solveTownSelection` 可承载 face graph，但 production `wfcIncremental`/旧几何消费者仍限 legacy 邻接，需要一致升级。主门、穹顶和固定路线作为 hard pins/禁占域，失败必须保持原场景。

较小的真实 WFC 入口是局部立面：`castleFacadeWfc.solveCastleFacade` 已调用真正 simple-tiled solver，控制石墙/拱口/窄窗；但其 3 列图、底部强制拱和上下同类约束不直接适配本次斜坡上的局部可露拱口。需增加地面许可/pin/bans，并把解对应到实际挤出拱墙；不能只借算法名字。这一步仍需模型 builder 改造，不应与已可实现的实体 undo/save 混为一项“已完成 WFC”。

本轮建议先做 registry+受保护拾取+单体事务/撤销/保存；完整邻接驱动的目标几何 WFC 需要上述结构重构与真实几何/路线回归。验收至少覆盖：隐藏旧城不可拾取、保护物体不点穿、右键仅删除目标实体、失败不改变场景、删后原槽恢复、undo/redo/save重载一致、共享资源不误释放、桥/台阶/拱口净空不退化、邻接重解仅影响声明范围。
