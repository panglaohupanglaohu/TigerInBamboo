# 夜间重建晨报 · 2026-11-24

> 由 `TigerMessenger/tools/nightly/run-nightly.mjs` 生成（2026-11-23T16:23:18.694Z）。对比基准：没有昨天的快照，本次是首次。

**一句话**：新增能力 0 个 · 能力线升级 0 条、降级 0 条 · 指标变好 0 / 变差 0 · 测试 13 红 · 步骤失败 3 · ⚙ 27/27 条线，解锁前沿 0。

## 新增能力

首次运行，没有昨天可比；今天共 72 个可执行能力（脚本口径，按 ID 去重）。

## 哪条线升级（九级成熟度，取线上最高级）

首次运行，没有可比的级别。

## 场景候选变好 / 变差（目标路径各跑一次）

| 目标路径 | 状态 | 验证 | 说明 |
|---|---|---|---|
| 场景战役：Bad North 玩法层 | error | — | 没有导航采样（site.nav）：先在实景里扫描战斗舞台 |
| 圣城山形：有山的模样 | run | pass | 建筑与保护带不动✓ 轨道净空保留✓ 海岸线不变✓ 有主峰✓ 山坡而非方台✓ 竖崖占比✓ 面数预算✓ 着色数据完整✓ 玩家地面与山形一致✓ 山上能走✓ |
| fx | run | warn | 分区覆盖✓ 前线连通且有净空✓ 镜头路径✓ 角速度上限✓ 泡沫数量✓ V 形半角与对称✓ 面板与镜像✓ 回放图可复算✓ 点火处在格网上✓ 火光衰减与烟放大✓ 爆燃团分层✓ 版式可独立复算✓ 板覆盖整面墙✓ 样板落点✓ 崖面可独立重数✓ 层带 |
| apostles-terrain | NOT_RUN | — | 这一层的输入要浏览器实景采样，只能在端到端里跑 |
| lightlife | NOT_RUN | — | 这一层的输入要浏览器实景采样，只能在端到端里跑 |
| building | NOT_RUN | — | 这一层的输入要浏览器实景采样，只能在端到端里跑 |
| relief | NOT_RUN | — | 这一层的输入要浏览器实景采样，只能在端到端里跑 |

首次运行，指标没有昨天可比。

离阈值近或已越线（已换算成补学队列加分）：走廊板覆盖率 1（阈值 0.98，+0.8）；层带宽度变异系数 0.293（阈值 0.3，+2.23）

> 目标路径在 Node 里用合成场地跑（固定输入，看「还跑得通、数没变坏」）；要实景的层记 NOT_RUN，实景证据看端到端 report.json。

## 测试红绿

- 漂移检查（§5.1）：21/23 通过，2 红；新红：every partial has a current priority and explicit work, but newer evidence cannot inherit stale annotations、whole directory has exactly one reviewed row per actual code file, including HTML and tools
- 单元测试：398/409 通过，11 红；新红：接线：能力树 / 左栏 / 管线页 / 桥接命令都登记了、building layer: registered in worker-host, adapters, studio, lineage, bridge (§7.2 \#4 \#5)、every partial has a current priority and explicit work, but newer evidence cannot inherit stale annotations、通过：新山形的地面与画面一致、没有洞，轨道 / 保护区地面 = 原高、楼梯：一架，踏面一级 L/3，比不插值的一整层小、逐帧：穿洞那段脚贴洞底，上楼梯那段脚高的最大跳变小于不插值、窄道 / 弯道 / 岔口：考场上逐格数对、完整山体：一条管线跑完，四类特征都在（软坡粗糙度降、有台面、河谷后没坑、有岩檐、有梯子）、游戏侧只是候选：不写 localStorage / 存档，persist ≠ false 拒绝预览，能拆回，原地形只隐藏不删、执行 + 独立验证：完整山体（软坡 + 硬崖 + 河谷 + 悬垂 + 梯子 + 等高线），不写存档，复算通过
- 现在红的：接线：能力树 / 左栏 / 管线页 / 桥接命令都登记了、building layer: registered in worker-host, adapters, studio, lineage, bridge (§7.2 \#4 \#5)、every partial has a current priority and explicit work, but newer evidence cannot inherit stale annotations、通过：新山形的地面与画面一致、没有洞，轨道 / 保护区地面 = 原高、楼梯：一架，踏面一级 L/3，比不插值的一整层小、逐帧：穿洞那段脚贴洞底，上楼梯那段脚高的最大跳变小于不插值、窄道 / 弯道 / 岔口：考场上逐格数对、完整山体：一条管线跑完，四类特征都在（软坡粗糙度降、有台面、河谷后没坑、有岩檐、有梯子）、游戏侧只是候选：不写 localStorage / 存档，persist ≠ false 拒绝预览，能拆回，原地形只隐藏不删、执行 + 独立验证：完整山体（软坡 + 硬崖 + 河谷 + 悬垂 + 梯子 + 等高线），不写存档，复算通过
- 浏览器端到端：夜间不跑（要 8931 服务和真实浏览器），最近一次结果：apostles-compare-e2e ✗ · apostles-surface-e2e ✗ · apostles-terrain-pipeline-e2e ✗ · auto-assemble-e2e ✗ · auto-preload-e2e ✗ · battle-apostles-e2e ✓ · building-citadel-e2e ✗ · building-joint-wfc-e2e ✗ · building-layer-e2e ✗ · building-prefab-e2e ✓

## 步骤

| 步骤 | 状态 | 用时 | 备注 |
|---|---|---|---|
| §5.1 漂移检查（4 个测试） | fail | 0.9s | 21/23 通过，2 红 |
| ① 原版逐文件状态 | pass | 0.3s | {"total": 317, "extensions": {".html": 116, ".js": 189, ".mjs": 12}, "states": {"待页面核验": 127, "待运行验收 |
| ② 系统目录 | pass | 0.4s | } |
| ③ 重构库扫描 | pass | 0.4s | {"sourceModules":388,"sourceFiles":396,"rootHtml":141,"testCode":690,"originalFiles":317,"missingTar |
| ④ 场景依赖扫描 | pass | 0.2s | [["莫西斯湖",{"modules":240,"direct":22,"identical":216,"different":24,"absent":0}],["战斗场",{"modules":42 |
| JEV 归线（§5.4） | skipped | — | --no-jev |
| ⑤ 能力谱系 | pass | 0.5s | {"sources":285,"lines":27,"generations":104,"gaps":72,"gapRows":75,"highGaps":9,"adapt":0,"modules": |
| 目标路径各跑一次（Node，进程内） | fail | 0.7s | 2/7 条在 Node 里跑了，4 条 NOT_RUN，出错：battle；指标 30 条 |
| ⑥ 补学队列（含指标差距分） | pass | 0.5s | 写入 /Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/src/scene-authoring/catalog/learn-queue.j |
| ⑦ 九级成熟度 | pass | 0.4s | 已写 TigerMessenger/src/scene-authoring/catalog/capability-maturity.json：72 个能力 |
| 单元测试（test_workshops.py 清单） | fail | 3.4s | 398/409 通过，11 红 |

## 补学队列队首

- #1 59 导航·A
- #2 50 导航·A+++
- #3 48 网格·A+5
- #4 42 导航·A++
- #5 42 导航·A+++
- #6 42 模块约束·A+9

证据：本目录 `snapshot.json`（今天的全量快照）、`morning-report.json`（本页的数据）、`logs/`（每步的输出尾部）。昨天 → 今天的对比按 `artifacts/nightly/<日期>/snapshot.json`。
