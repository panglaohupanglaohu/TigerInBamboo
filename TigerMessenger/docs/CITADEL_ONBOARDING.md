# 圣城构建管线 · 接手须知（2026-09-05）

> 给**新接手这条线的人或模型**看。不讲设计意图（那在 PLAN 里），只讲三件事：
> 上手先跑什么、有哪些坑不写下来一定会踩、哪些红是存量不该算你头上。
>
> 本文只记**已实测**的事实。没实测的一律标注「未实测」。

---

## 0 · 上手第一件事

```bash
cd <repo>
node tools/audit_cell_ownership.mjs --gate && node tools/test_edit_exactness.mjs
```

两条都绿 = 门 A / 门 D 完好，可以往下做新功能。
任一条红 = **先别加新功能**，先查为什么退化了。

干净 checkout 上第一次跑会挂在 `ERR_MODULE_NOT_FOUND`，见 §1.3。

---

## 1 · 不写下来一定会踩的坑

### 1.1 改了 `src/` 必须 bump import 上的 cache 标签

浏览器入口靠 URL 查询串破缓存，格式：

```js
from "./world/citadelTown.js?v=20260905-decor-pass-v2"
```

**改了文件不改标签，浏览器会静默跑旧代码。** 你会看到「改了没效果」，然后开始怀疑逻辑——实际上代码根本没加载。本会话犯过三次。

改完自检：`grep -rn "citadelTown.js?v=" TigerMessenger/src/` 看标签是不是都更新了。

### 1.2 macOS 没有 `timeout`

```bash
perl -e 'alarm 450; exec @ARGV' node tools/test_xxx.mjs
```

### 1.3 `three` 是测试自动建的桥，且被 gitignore

`TigerMessenger/node_modules/three/package.json` 指回 `vendor/three.module.js`。干净 checkout / 新 worktree 上不存在，要先补：

```bash
mkdir -p TigerMessenger/node_modules/three
printf '{"name":"three","version":"0.172.0-local-bridge","type":"module","main":"../../vendor/three.module.js"}' \
  > TigerMessenger/node_modules/three/package.json
```

浏览器侧不读它（走 importmap + vendor 兜底），只有 Node 测试读。

### 1.4 浏览器自动化里 fps 测不出来 —— 这条最容易产出假验收

自动化页面里 rAF 被节流（`bringToFront()` 也救不回来），`perfProbe.snapshot()` 恒为 `samples: 0` / `fps: null`。

**只有 `calls` / `triangles` / `geometries` / `programs` 可信。**

任何「优化后 fps 提升了 X」的结论，如果数据来自自动化页面，都是假的。本会话所有性能验收都只用上面四个量。真 fps 需要人在可见窗口里读 HUD。

### 1.5 审计脚本必须用 `debounceMs > 0`

模块在 build 之后会被吸收进合并块。用默认去抖跑审计，采到的是**合并后**状态，模块已经不见了，基线会是空的。

这条踩过三次。现在的审计脚本都带自检：**基线为空就非零退出**。你新写审计脚本时照抄这个自检。

### 1.6 `renderer.info` 在动画循环外读没有意义

要在循环内采样，或用已有的 `perfProbe`。

### 1.7 zsh 的坑

- `grep --include=*.js` 会报 `no matches found`（未匹配 glob 默认失败）。用编辑器的搜索工具，或给 glob 加引号。
- 裸 `==` / `===` 会触发 equals 展开，要引号包起来。
- `status` 是只读变量，别拿来命名。

### 1.8 可选调用 `?.()` 不防未声明标识符

`foo?.()` 只在 `foo` 是 `undefined` 时安全；`foo` **从未声明**照样 ReferenceError。

### 1.9 每个测量都要 A-B-A

改动前测、改动后测、**再把改动撤掉测第三次**。第三次对不回第一次，说明有漂移，这次测量作废。本会话十个关于悬空窗户的假设全是被自己的测量打掉的，靠的就是这条。

---

## 2 · 读什么，按这个顺序

### 第一层（决定能不能接手）

| 文件 | 只读什么 |
| --- | --- |
| `CITADEL_BUILD_PIPELINE_PLAN.md` | 门 A~L 的定义。这是验收标准 |
| `CITADEL_BUILD_PIPELINE_TODOS.md` | **只读 C5~C11 未完项 + 归属栏**。77KB，C1~C4 已完成别读 |
| `citadel-corner-eval.md` | 全文 3.3KB，C9 最新结论 |
| `CITADEL_DECOR_BOUNDARY.md` | 全文 4.5KB，动合并调度（C8）前必读 |

`CITADEL_HANDOFF.md` 是 2026-09-04 的**跨模型分工判断**，不是上手文档。里面「C9/C10 规格欠着」的状态**已过期**（Grok 已交付 G-13/G-14），照它做会重复劳动。

### 第二层（动手前的源码，共 ~7500 行，别全读）

| 文件 | 行数 | 指路 |
| --- | --- | --- |
| `src/world/citadelTown.js` | 3485 | `levelGroups` 创建处的**归属 sink**（拦 `group.add`，不是改 52 个调用点）；主装饰循环的 `ownCell` / `ownNone` 配对；屋顶 `shape.kind === "strip"` 分支的 `want()` 闸门；支架的 `traverse` 打标 |
| `src/world/odysseyCitadel.js` | 3578 | `citadelAffectedLevels`、`collectFaceToCell`、`citadelSegmentIsDirty`、步骤 2 的 `dropCellsFromMerged` 遍历 |
| `src/world/citadel/mergedCellPatch.js` | 96 | **全读**，C4 局部替换的本体 |
| `src/world/geometryMerge.js` | 260 | **全读**，`onOutline` 五参与预合并轮廓的再吸收 |

### 第三层（按需查）

`PERF-TODOS-2026-09-01.md`（100KB）、`CITADEL_GROK_TASKS.md`（59KB）、`PERF-AUDIT-2026-09-01.md`（29KB）——**不要通读**，用关键词检索。

---

## 3 · 门测试

```bash
node tools/audit_cell_ownership.mjs --gate      # 也支持 --by-level / --all
node tools/test_cell_ownership.mjs              # 门 A：孤儿必须为 0
node tools/test_support_orphan.mjs
node tools/test_edit_exactness.mjs              # 单次编辑逐格等于全量重建
node tools/test_edit_soak.mjs                   # 20 次编辑，天花板 ≤5%（现 3.5%）
node tools/test_corner_graph.mjs                # C9 前置
node tools/test_corner_seams.mjs
```

仓库里**没有**跑全量的脚本。要全跑（约 15 分钟，并发高时会有超时 flake）：

```bash
for f in tools/test_*.mjs; do
  printf "%-46s " "$(basename "$f")"
  perl -e 'alarm 450; exec @ARGV' node "$f" >/tmp/o.txt 2>&1 && echo PASS || echo FAIL
done
```

### 已知数字（2026-09-05）

- 归属孤儿：**0**（91,448 owned tris / 1,018 spanning components）
- 编辑 P50 **90.9ms** / P90 112.9 / max 116.9（C4 之前是 558ms）
- soak 残留 **3.5%**：单次编辑是精确的，漂移只在编辑重叠时出现（曲线 0.00 / 0.00 / 0.26 / −0.05 / 0.82 / 3.46%）

---

## 4 · 存量红测试 —— 接手前先确认就是这 10 条

别把存量红算到自己头上。

| 测试 | 性质 |
| --- | --- |
| `test_flock_boids` | **并发 flake**，单跑绿 |
| `test_procgen_profiles_hard_routes` | 第 56 行 expected 里写着字面量 `"PLACEHOLDER"`，**从来没绿过，是故意不填的，别去填** |
| `test_townscaper_support` | 见下方说明，**别自己决定怎么修** |
| `test_grok_acceptance_matrix` | 未定位 |
| `test_planet_v8_all` | 未定位 |
| `test_planet_v9_all` | 未定位 |
| `test_planet_v9_forest_grass` | 未定位 |
| `test_planet_v9_runtime_wiring` | 未定位 |
| `test_procgen_v7_all` | 未定位 |
| `test_terrace_trim` | 未定位 |
| `test_v6_g5_combat` | **2026-09-05 补：第 11 条**。断言全过（4 个 ✓，含 `replay=e57a661e`）但**进程不退出**——挂在开放句柄上，套件的 `alarm 450` 杀掉它才记成 FAIL。单跑也挂，不是并发 flake。要么清掉残留 timer/handle，要么在脚本末尾显式 `process.exit(0)` |

**2026-09-05 全量复跑结果（216 条，12 红）**：上表 10 条里 **9 条如期红**；`test_flock_boids`
这次**绿**（并发 flake 的说法成立）；新增 `test_v6_g5_combat`（见上）。
另外 `test_castle_building_experience`（P50 184.2 → 复跑 220.8ms）与 `test_edit_soak` 两条计时门
**在当前窗口判不了**：实测 load average **15.26**，同机另有 Kiro Helper 46.6% CPU 与一个
openclaw 会话 36.5% CPU。按 §1.4 / §5.2 的口径，这两个数字既不能算绿也不能归因到代码，
更不能为了转绿放宽门槛——要判就得先拿到真正的安静窗口。

### 1.10 `citadel/*.js` 子模块没有 cache 标签 —— §1.1 的机制对它们不生效

`citadelTown.js` 被 8 处以 `?v=20260905-wfc-wire-v1` 引入，但它自己 import 的
`./citadel/*.js` **全部不带标签**（`decoratePass` / `wfcTownWiring` / `cornerAssembly` /
`cageDeform` / `gridMigration` 都是）。浏览器按 URL 缓存，所以**bump 父文件的标签
并不会让这些子模块失效**——改了子模块，浏览器照样可能跑旧代码，正是 §1.1 那个坑，
只是 §1.1 给的解法在这里没用。

Node 测试不读缓存，所以脚本验收不受影响；踩坑只会发生在看画面的时候。
要根治得给这批子模块也上标签（或让 dev server 对 `src/` 发 no-cache），
**别只给一个模块加标签**——只加一个比都不加更难排查。

### `test_townscaper_support` 要特别小心

它断言三件事：`pillars === 4`（四个八面体环向支柱）、`edges === 8`（每柱上下两条边）、
以及 `invalidShape === 0`，失败信息写着 **「支架不退化为棱锥中央柱」**。

也就是说，**当初写这条测试的人专门加了一条断言来防止支架退化成中央单柱**。
而现在生产代码里的支架已经被改成了单根斜柱（`citadelTown.js` 的 `bearing` 逻辑）。

所以这不是「测试过时了」，而是**一个被刻意防住的退化，后来还是发生了**。
修法只有两种，且**都不该由接手方独自决定**：

1. 四柱设计是对的 → 把支架改回去
2. 单斜柱是有意的新设计 → 改测试，并说明为什么当初防的那条退化现在可以接受

没有第三种。别直接把 `4` 改成 `1` 收工。

---

## 5 · 规矩

### 5.1 禁止改 expected 迁就现状

测试红了，默认是**代码错**，不是期望错。

**唯一一次例外**在 `tools/test_citadel_topology.mjs`（2026-09-05 蓝图 hash）。做法值得照抄：

1. 现网算一次 → `6e816c28`
2. 剥掉本轮新增字段再算 → `6e6245cc`
3. **开 committed HEAD 的干净 worktree 重算** → 也是 `6e6245cc`

第 3 步证明了这条断言**在任何未提交改动之前就已经红了**，原锚点 `07c43660` 对应的状态在仓库里不存在、任何提交都复现不出来。只有到这一步才允许重新锚定，而且三行证据要写进注释。

反面教材：`test_shot_harness_runtime` 曾经把 cache 标签字面量写进断言，于是每次合法 bump 都变红，红久了就被当噪声。**别写会因合法变更而红的断言。**

### 5.2 一个看起来说得通的解释，不等于对

上面 §5.1 那件事，最初的解释是「新增了 `grid.kind` / `grid.gridHash` 两个字段，所以 hash 变了」——代码 diff 完全支持它，改掉 expected 就能收工。多做的那步（开 worktree 重算）只是一条命令，但它推翻了这个解释。

**归因便宜，验证也便宜，别省。**

### 5.3 归属标签打在 mesh 上，不是 Group 上

陈旧清理只看 `o.isMesh`。把标签打在 `THREE.Group` 上，清理时看不见，几何会悬空。要 `traverse` 下去打。

---

## 6 · 当前未完项

- **C5** 模块邻接规则表与对称
- **C6 / C7** WFC 求解器与增量传播 —— 注意已有**负结果**：变体层 WFC 是空操作（相邻密度全部**低于**随机基线）。但那次审计的是 `TOWNSCAPER_MODULE_FAMILIES`（装饰变体），**不是** V6 `moduleCatalog.js` 的 socket。两者别混
- **C8** 装饰与生成分离（滞后合并：体块先合并、装饰下一帧合并，复用 400ms 去抖）
- **C9** 角落模块 —— 图/bans/接缝三项已绿、空域 0，建议按 `?cornerModules=1` 默认 false 接线。注意 `citadel-corner-eval.md` §4 的「+2/层 draw call」是**估算不是实测**
- **C10** 不规则网格 / 笼形变形 / 编辑器拾取改 face id
- **C11** stencil 挖窗（门 L：窗洞里不露描边壳、draw call 增量 ≤ +2/层）
- **C0** Oskar 三场演讲取证 —— **阻塞**，当前工具取不到 YouTube 正文，等字幕

---

## 7 · 本地服务

```bash
./start.sh          # 8931 主后端（前端静态页同服）/ 7862 图生3D / 7863 识别
```

页面：`http://127.0.0.1:8931/TigerMessenger/index.html`
调试句柄：`window.__tm`（含 `distanceCulling`、`perfProbe` 等）
