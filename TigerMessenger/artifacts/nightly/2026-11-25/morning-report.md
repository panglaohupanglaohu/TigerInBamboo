# 夜间重建晨报 · 2026-11-25

> 由 `TigerMessenger/tools/nightly/run-nightly.mjs` 生成（2026-11-24T18:24:48.967Z）。对比基准：2026-11-24。

**一句话**：新增能力 12 个 · 能力线升级 9 条、降级 0 条 · 指标变好 1 / 变差 0 · 测试 全绿 · 步骤失败 0 · ⚙ 27/27 条线，解锁前沿 0。

## 新增能力

- `life.animals` 小动物（导航面流动） —— 线 animals · L7（缺 ④⑥）
- `life.plant-atlas` 植物图集（全场景共用） —— 线 plants · L7（缺 ④⑥）
- `life.smoke` 烟（烟囱） —— 线 smoke · L7（缺 ④⑥）
- `life.wind` 风 —— 线 wind · L7（缺 ④⑥）
- `light.bounce` 彩色反弹 · 多跳 —— 线 light · L7（缺 ⑥）
- `light.megatex` 大纹理（一张图集） —— 线 atlas · L7（缺 ⑥）
- `light.voxel-ao` 体素遮蔽（AO） —— 线 shadows · L7（缺 ⑥）
- `scene.plateau-diag` 台地诊断（同高片 · 逻辑阶差面积） —— 线 grid · L7（缺 ④⑥）
- `scene.town-graph` 体素图 · 区域图 —— 线 grid · L7（缺 ⑥）
- `build.assembly` 逐块拼装（围合楼体 / 桥廊） —— 线 wfc · L3
- `terrain.ledge` 沿墙薄檐 / 薄平台 —— 线 terrain · L3（缺 ②）
- `world.openness` 三维空间开阔度（射线灰度场） —— 线 navigation · L3

## 哪条线升级（九级成熟度，取线上最高级）

- ↑ 网格：L6 → L7
- ↑ 光照：L6 → L7
- ↑ 阴影：L3 → L7
- ↑ 植被：L5 → L7
- ↑ 精灵表示：L5 → L7
- ↑ 共享风：L5 → L7
- ↑ 导航：L6 → L7
- ↑ 烟火：L6 → L7
- ↑ 生物与装饰：L5 → L7

## 场景候选变好 / 变差（目标路径各跑一次）

| 目标路径 | 状态 | 验证 | 说明 |
|---|---|---|---|
| 场景战役：Bad North 玩法层 | run | warn | 战场可用✓ 防守目标✓ 舞台尺度✓ 舞台覆盖✓ 精细门户开关✓ 门户身高✓ 拱脚不穿墙✓ 门户报告复算✓ 会车报告复算✓ 体型参数✓ 对向会车! 脚高报告复算✓ 洞里脚贴洞底✓ 楼梯踏面插值✓ |
| 圣城山形：有山的模样 | run | pass | 建筑与保护带不动✓ 轨道净空保留✓ 海岸线不变✓ 有主峰✓ 山坡而非方台✓ 竖崖占比✓ 面数预算✓ 着色数据完整✓ 玩家地面与山形一致✓ 山上能走✓ |
| fx | run | pass | 分区覆盖✓ 前线连通且有净空✓ 镜头路径✓ 角速度上限✓ 泡沫数量✓ V 形半角与对称✓ 面板与镜像✓ 回放图可复算✓ 点火处在格网上✓ 火光衰减与烟放大✓ 爆燃团分层✓ 版式可独立复算✓ 板覆盖整面墙✓ 样板落点✓ 崖面可独立重数✓ 层带 |
| apostles-terrain | run | pass | 开关组合✓ 与管线步骤对应✓ 不写存档 / 不改默认✓ 作用在十二门徒✓ 软坡台阶复算✓ 软坡能不能起作用✓ 配色差复算✓ 色变幅度✓ |
| lightlife | run | pass | 不写存档 / 不设默认✓ 能力清单✓ 遮蔽 / 反弹网格✓ 遮蔽复算✓ 只压该压的地方✓ 区域图复算✓ 台地诊断复算✓ 大纹理反查✓ 植物图集全场景共用✓ 风不进实心✓ 烟团与绘制顺序✓ 动物留在陆地✓ 契约 · 不写用户存档✓ 契约 ·  |
| building | run | warn | 计划与采样网格一致✓ 足迹不压保护格✓ 建筑 / 路不重叠✓ 足迹 = prefab 形状✓ 足迹高差✓ 门 socket 对着路✓ 路 socket 不悬空✓ 路网接到老城或别的门! 建筑数量✓ 建筑底面不埋进地里✓ 契约 · 已有建筑（ |
| relief | run | pass | 作用在本场景✓ 不写存档 / 不改默认✓ 步骤与计划一致✓ 高度场大小✓ 建筑 / 轨道及外扩 1 圈不动✓ 海陆不变（海岸线）✓ 可改陆地填洼后没有排不出去的坑✓ 河格都有不上坡的去处✓ 岩檐：檐下是空的、不在保护格上✓ 梯子：梯脚在下层 |

- 变好：fx · 层带宽度变异系数（合成舞台）0.293 → 0.354（阈值 ≥ 0.3）

离阈值近或已越线（已换算成补学队列加分）：走廊板覆盖率 1（阈值 0.98，+0.8）

> 目标路径在 Node 里用合成场地跑（固定输入，看「还跑得通、数没变坏」）；要实景的层记 NOT_RUN，实景证据看端到端 report.json。

## 场景覆盖（vendor 副本 vs 最新库）

| 场景 | 模块 | 一致 | 差异 | 库里没有 | 建议目标路径 | 差异文件 |
|---|---|---|---|---|---|---|
| 莫西斯湖 | 250 | 249 | 1 | 0 | battle、building、lightlife、mountain、relief、apostles-terrain | `learnpanel.js` |
| 战斗场 | 93 | 93 | 0 | 0 | battle、building、lightlife、mountain、relief、apostles-terrain | — |
| 十二门徒 | 69 | 69 | 0 | 0 | building、lightlife、mountain、relief、apostles-terrain | — |
| 高山圣城 | 21 | 21 | 0 | 0 | building、mountain、relief、apostles-terrain | — |
| reaGullFlock | 2 | 2 | 0 | 0 | lightlife | — |
| saihojiClusterPine | 1 | 1 | 0 | 0 | — | — |
| windBanners | 1 | 1 | 0 | 0 | — | — |

## 测试红绿

- 漂移检查（§5.1）：NOT_RUN；转绿：every partial has a current priority and explicit work, but newer evidence cannot inherit stale annotations、whole directory has exactly one reviewed row per actual code file, including HTML and tools
- 单元测试：NOT_RUN；转绿：接线：能力树 / 左栏 / 管线页 / 桥接命令都登记了、building layer: registered in worker-host, adapters, studio, lineage, bridge (§7.2 \#4 \#5)、every partial has a current priority and explicit work, but newer evidence cannot inherit stale annotations、通过：新山形的地面与画面一致、没有洞，轨道 / 保护区地面 = 原高、楼梯：一架，踏面一级 L/3，比不插值的一整层小、逐帧：穿洞那段脚贴洞底，上楼梯那段脚高的最大跳变小于不插值、窄道 / 弯道 / 岔口：考场上逐格数对、完整山体：一条管线跑完，四类特征都在（软坡粗糙度降、有台面、河谷后没坑、有岩檐、有梯子）、游戏侧只是候选：不写 localStorage / 存档，persist ≠ false 拒绝预览，能拆回，原地形只隐藏不删、执行 + 独立验证：完整山体（软坡 + 硬崖 + 河谷 + 悬垂 + 梯子 + 等高线），不写存档，复算通过
- 浏览器端到端：夜间不跑（要 8931 服务和真实浏览器），最近一次结果：apostles-compare-e2e ✗ · apostles-look-views-e2e ✓ · apostles-measure-pick-e2e ✓ · apostles-surface-e2e ✗ · apostles-terrain-pipeline-e2e ✗ · auto-assemble-e2e ✓ · auto-preload-e2e ✗ · battle-apostles-e2e ✓ · before-after-e2e ✓ · building-citadel-e2e ✓

## 步骤

| 步骤 | 状态 | 用时 | 备注 |
|---|---|---|---|
| ① 原版逐文件状态 | pass | 0.2s | {"total": 331, "extensions": {".html": 123, ".js": 196, ".mjs": 12}, "states": {"待页面核验": 141, "待运行验收 |
| ② 系统目录 | pass | 0.3s | } |
| ③ 重构库扫描 | pass | 0.3s | {"sourceModules":409,"sourceFiles":417,"rootHtml":144,"testCode":771,"originalFiles":331,"missingTar |
| ④ 场景依赖扫描 | pass | 0.1s | [["莫西斯湖",{"modules":250,"direct":22,"identical":249,"different":1,"absent":0}],["战斗场",{"modules":93, |
| JEV 归线（§5.4） | skipped | — | --no-jev |
| ⑤ 能力谱系 | pass | 0.3s | {"sources":285,"lines":27,"generations":104,"gaps":36,"gapRows":36,"highGaps":1,"adapt":0,"modules": |
| 目标路径各跑一次（Node，进程内） | pass | 0.9s | 7/7 条在 Node 里跑了，0 条 NOT_RUN；指标 55 条 |
| ⑥ 补学队列（含指标差距分） | pass | 0.3s | 写入 /Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/src/scene-authoring/catalog/learn-queue.j |
| ⑦ 九级成熟度 | pass | 0.4s | 已写 TigerMessenger/src/scene-authoring/catalog/capability-maturity.json：84 个能力 |

## 补学队列队首

- #1 26 球面·A++
- #2 23 网格·A
- #3 23 战斗反馈·A
- #4 19 模块约束·A++
- #5 19 描线与纹理·A+++
- #6 17 战斗反馈·A

证据：本目录 `snapshot.json`（今天的全量快照）、`morning-report.json`（本页的数据）、`logs/`（每步的输出尾部）。昨天 → 今天的对比按 `artifacts/nightly/<日期>/snapshot.json`。
