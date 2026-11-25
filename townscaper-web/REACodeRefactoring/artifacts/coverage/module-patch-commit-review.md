# 指定模块 patch 事务层（周围补网/WFC + 形变碰撞 + 整体回滚）

沿用 1751932427272909032 已看 552 帧，不计新增帧。原文：「先生成特定模块所需的那一小块网格」再强制它出现。
前几批已各有落点（本文件不重复认领）：几何接缝 spliceModulePatch、World 迁移 migrateWorldToPatch、
原子体量 placeModuleVolume/undoModuleVolume、3D prefab/socket 强制出现 solveWithPrefab（prefab-splice.mjs 验收过）、
工坊侧 prefab 库 + 联合 WFC（prefab-socket.js）。本批补的是把它们合成**一次事务**的那一层，及「形变碰撞」读数。

## src/build/module-patch-commit.js

`commitModulePatch(world, spec)` 六步，任一步失败 `{ok:false, reason, world}` 且原 World 原样：

1. 几何：splice 模式 pattern/patch → spliceModulePatch 缝进网格 → migrateWorldToPatch 出新 World（原对象不动）；
   fit 模式复用调用方给的现有足迹 mapping（同网格，写入先暂存列验完才落盘）。
2. 边缘 socket 约束收集：模块部件每条朝外边逐条登记 {part, cell, edge, neighbor, socket}。
3. 周围补网：solveWithPrefab 把周围格按 socket 解到一致，再独立 findWFCConflicts 复核，不一致判失败。
4. 体量：可选 placeModuleVolume（splice 用原 patch 网格做几何复核；fit 用足迹格本身恒等拟合）。
5. 形变碰撞：新旧列按 cell 对应（sourceCellOf，新格取最近被切格）逐格对比，输出
   gainedWalkable/lostWalkable/gainedBlocker/lostBlocker + resampled/topChanged/riverChanged 计数。
   可走面 = 顶面岩石的陆地格（无建筑压顶、非河道）；阻挡 = 顶面是建筑。
6. 回滚：splice 天然丢弃新网格/新 World；fit 只在全部校验后 copy 回。
   `withdrawModulePatch`：fit 就地 restore 快照；splice 返回补丁前 World 对象（priorVersion 核验，改过即 stale-prior）。

可选 `tileColumn(tileId, cell)` 钩子把 WFC 指派落成体素列（只作用非模块格，整数列先验后写）。

## 验收（tests/module-patch-commit.mjs，Node 单测，本轮红线未跑浏览器）

- splice 模式 × 两种网格（buildMixedGrid / buildQuadGrid）：补丁打入、半边闭合、模块诱导邻接 = 模式、
  边界清单 socket 正确（部件 0 = 门 2，其余 = 墙 0）、门对面那格孪生边真是 2、findWFCConflicts 为空、
  7 个模块格 gainedBlocker=7 / lostWalkable=7、撤回返回同一个原 World 对象。
- fit 模式（2×2 quad 足迹）：同 World 写入、撤回 restore 后快照逐字节复原；他 World 持回执拒用。
- 失败全保留原 World：stale-version / wfc-contradiction（socket 不在目录）/ support（掀地表）/
  occupied（上层占用）/ adjacency（足迹冒充模式）/ splice（洞够到边界）；快照逐字节相等、version 只增自测试自身写入。
- 确定性：同种子两次提交，补网指派 / 边界清单 / 碰撞清单完全一致。
- 回归：module-patch、module-volume、prefab-splice、module-fit、module-search、module-audit、multicell、
  multicell-edit、multicell-identity、wfc、wfc-bitset、wfc-repair、wfc-diagnose、wfc-weighted-3d、
  gridpatch-multi、gridpatch-templates、multitile-wfc、joint-subtiles、splice-save-undo 全 PASS。

## 消费者核对（如实）

TigerMessenger building 层（src/system-workshop/building/capabilities.js）消费的是 prefab-socket.js 的
高度场联合 WFC（building.joint-wfc），不是共享网格的模块 patch；meta.ideas 里只有 multicell/module-fit
的线索链接。共享 World 上这条 patch 事务链目前只被 REACodeRefactoring 自身演示页可接
（patch.html / prefab.html 尚未改），TigerMessenger 游戏运行时与 vendor 副本都没有调用方。
未声称游戏接入；浏览器验收本轮红线未跑。

## 边界

socket 语义由调用方目录决定；本层不做原版 prefab 美术/房型、不做竖向多层堆叠（stories 只是体量高度）、
WFC 指派不写体素（除显式 tileColumn 钩子）；形变碰撞是列级语义清单，不是逐面片 navmesh。
