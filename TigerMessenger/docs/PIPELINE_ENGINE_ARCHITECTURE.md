# PipeLineEngine、能力库与双工坊

2026-11-13。本系统的代码能力库是整个 `townscaper-web/REACodeRefactoring`。`src/capabilities/registry.js` 只是其中一组体素/显示执行适配，不能代表全部代码能力；旧游戏 vendor 副本也不是最新源库。

```mermaid
flowchart TD
  Original[REACode 原始代码与视频来源] --> Learning[学习工坊：来源、观察、差异与验收需求]
  Learning --> Refactor[阅读来源并重构代码]
  Refactor --> Library[REACodeRefactoring 实际代码能力库]
  Library --> Scanner[只读物理扫描：导出、依赖、SHA256、原版迁移落点]
  Scanner --> CodeView[首页与双工坊共享代码目录]
  Scanner --> Graph[源码依赖组合]
  Graph --> Adapter[已实现的目标/参数/上下文适配]
  CodeView --> Adapter
  Adapter --> Plan[系统工坊：选择能力、顺序、参数和目标]
  Plan --> Agent[tier-agent / orchestrator：目标快照、作用域、Watchdog]
  Agent --> Worker[改造 Worker 内的 PipeLineEngine]
  Worker --> Check[预检：真实实现、参数、依赖和冲突]
  Check --> Call[调用能力库代码，在私有副本上顺序执行]
  Library --> Call
  Call --> Receipt[输入/计划/输出指纹与执行报告]
  Receipt --> Verify[独立验证 Worker]
  Verify --> Bridge[场景适配桥：预览、对照、放弃]
  Bridge --> View[真实编辑视窗]
  View --> Adopt[作用域与验证再检查后采纳]
  Verify --> Evidence[本地测试与证据文件]
  Evidence --> Learning
```

## 实际落点

- `src/pipeline-engine/PipeLineEngine.js`：组合预检、规范化参数、顺序调用、私有输入副本、执行与候选指纹、采纳门槛。
- `worker-adapters.js` / `worker-host.js`：四类改造 Worker 使用同一引擎；体素调用源库 registry/runPlan，物件和通用材质适配直接引用源库 path-samples / OKLab；球系统沿原有配方编译接口。
- `src/system-workshop/tier-agent.js`、`src/scene-authoring/agent/orchestrator.js`：新输入扫描、sceneId/层级检查、独立验证、真实预览成功标记、对照/放弃/采纳。跨场景或失效候选不能采纳。
- `tools/refactor/scan-code-library.mjs`：使用 esbuild 解析实际源码导出/依赖，不执行模块。读取原版290文件、当前coverage与历史范围证据，核对迁移候选和命名接口；字节或成员在读取中变化时拒绝此次扫描。
- `backend/code_library.py`、`/api/workshop/code-library`：固定仓库、固定只读扫描脚本；没有任意路径或代码输入。前端失败保留上次成功目录。
- `code-library-catalog.js`：实际源码节点与七组依赖组合。执行接口只按已有适配元数据关联，不把依赖图自动冒充可执行管线。
- `REACodeRefactoring/index.html`：能力库窗口、源码搜索、七组依赖图、三种当前View显示组合试用/恢复。View显示组合在主线程调用现有API，不是体素Worker重建。

## 学习与实现如何联动

学习记录继续提供原片、观察和剩余缺口；能力库目录改以物理源码为主。已有模块显示“已有代码”，不再因为缺少Worker包装被称为“原版占位”。历史视频卡仍用于追溯，和实际模块数量分开统计。

源码组合能找到已实现适配时，学习页可将“已适配部分”加入对应管线，例如 OKLab 色板归并→明暗层次。组合的其他模块仍需各自上下文和验证。通用材质目标写入通用场景管线的目标，不再错误修改莫西斯湖主配方。

扫描不执行未知源码，不自动新建任意函数调用器；算法名或文件名相近也不构成行为等价。当前10个未关联文件和已有落点的行为差距列在 `REACODE_LIBRARY_ALIGNMENT.md`。学习完成、代码存在、执行适配、运行验收分别记录。

## 已验证范围与边界

四类真实改造Worker及独立验证/预览生命周期此前有实测；此次增加实际源码扫描、双工坊目录、源库首页三组View试用、测量工具Worker与CLI。证据目录：`artifacts/code-library-rebuild-20261113`；引擎此前证据在 `artifacts/workshop-tests/pipeline-engine-20261113`。

引擎 catalogHash 是适配描述的签名，并非全部源文件内容的SHA。物理库扫描有独立源码SHA，尚未将所有依赖字节绑定到Worker执行回执。扫描不热替换正在运行的Worker。十二门徒多World适配、共享渲染扩展、各模块完整行为和跨GPU矩阵仍未全部验收。不得以新增目录或菜单声称两库已完全等价。

## 2026-11-14 作者时间线接入能力库

```mermaid
flowchart LR
  A[作者帖子/原视频\n发布时间与原文] --> B[REACodeRefactoring learn/data.js]
  B --> C[learn/pipeline.js.evolution\n前身/改进/分支/复用/局部替代]
  C --> D[同一 capability-evolution 模型\n证据变化失效/来源时间/优先级]
  D --> E[8769 学习管线\nBad North → Townscaper → next → sphere]
  D --> F[8931 学习工坊\n相同资料指纹与补全批注]
  D --> G[实际源码扫描\nmodule.evolution/组合来源]
  C --> H[部分实现补全队列\n高/中/低 + 缺口 + 验收门槛]
  H --> I[重构代码与独立验证]
  I --> G
  G --> J[已适配能力目录]
  J --> K[PipeLineEngine / Worker\n目标快照与独立验证]
  K --> L[实景预览/对照/采用]
  L --> B
```

阶段顺序是本地学习导航，不声称作者只有这一条思考路线；next 正式名称未确认，2016 早期球面另列。时间较新的记录不自动升级执行权限。源码没有关联来源时日期为 null，不再把扫描当天当能力诞生日。当前 285 来源、28 主题、85 关系，177 partial 批注（高31/中119/低27）；原审核与现有 Worker 适配状态保持独立。详见 CAPABILITY_EVOLUTION.md。

## 2026-11-14 学习工坊 ⇄ 能力库闭环（能力谱系）

规划与规则见 `WORKSHOP_LOOP_PLAN.md`；每条能力线的代际、到达位置、补学队列见生成文件 `CAPABILITY_LINEAGE.md`。

```mermaid
flowchart TD
  SRC[来源材料] --> EVO[capability-evolution\n时间线 · 关系 · partial 批注]
  EVO --> LIN[capability-lineage\n能力线 → 代际 A/A+ → 到达位置 → 下一步\n模块归线 · 组合前置 · 补学队列 · 适配队列]
  SCAN[物理源码扫描\n模块 import · 原版对齐表] --> LIN
  LIB[能力库 可执行能力\nregistry + 球系统/物件/通用场景适配] -->|来源帖子ID / 模块| LIN
  EXP[本机执行经验\ntm.*.experience.v1] -->|失败 · 采用| LIN
  PIPE[场景管线里不能执行的节点] -->|系统需要| LIN
  LIN --> LW[学习工坊「能力成长与闭环」\n8769 学习管线同一组件]
  LIN --> SIDE[系统工坊左栏「能力线 · 时间」]
  LW -->|⚙ 加入管线| PIPE2[管线 → 调度 → Worker → 验证 → 预览 → 采用]
  SIDE -->|下一步 → 学习工坊| LW
  SIDE -->|拖入| PIPE2
  PIPE2 --> EXP
  LIN --> DOC[CAPABILITY_LINEAGE.md\nbuild-capability-lineage.mjs]
```

落点：
- `REACodeRefactoring/src/core/capability-lineage.js`：纯计算，Node / 浏览器共用。`src/ui/capability-lineage.js/.css`：两页共用界面。
- `src/scene-authoring/learning-workshop.js`：默认页签 `lineage`；`studio.js` 提供 `getExecutables / getExperience / getDemand / onUseExecutable`。
- `src/system-workshop/capability-sidebar.js`：`能力线 · 时间`（默认）与 `工坊分区` 两种视图，事件 `tm.learning.lineage` 打开学习工坊对应能力线。
- `tools/refactor/build-capability-lineage.mjs`：生成文档；不含本机经验与管线需求。

边界：只做归类与排序，不改 done / partial，不新增可执行能力；PipeLineEngine、Worker、验证与采纳流程本轮未改。经验只读取、未统一回写；球系统 / 物件管线的待完成节点尚未进入需求。
