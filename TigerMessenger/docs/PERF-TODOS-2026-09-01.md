# TigerMessenger 性能优化 TODO（2026-09-01）

> 执行模型：**DeepSeek**（理由见 [PERF-AUDIT-2026-09-01.md](PERF-AUDIT-2026-09-01.md) 第四节）
>
> **执行铁律**
> 1. **严格按 A → B → C → D 顺序**，每完成一条必须跑该条的「验收」再进下一条。
> 2. 每条 TODO 只改它写明的文件。**不要顺手改别的。**
> 3. 每个阶段结束跑一次 `A1` 的探针，把 7 个数字填进本文末尾的《测量记录表》。
> 4. **任何一条导致 draw call 上升或帧率下降 → 立即 `git revert` 该条，在表里记 ❌，继续下一条。**
> 5. 本仓库零构建、无 TypeScript。改完必须在浏览器实开一次确认无 console 报错。
> 6. 伪代码是**意图说明**，不是可直接粘贴的代码。落地时按周围既有代码风格写（中文注释、`?.`、模块级 scratch 向量）。

---

## 阶段 A · 建立测量（必须最先做，不做后面全是瞎猜）

### A1 · 常驻性能探针 HUD

**文件**：新建 `src/tools/perfProbe.js`；接入 `src/main.js`

**背景**：`src/main.js:1657` 已经把 `renderer` 挂到 `window.__tm`，
`shot-harness.html:719` 已有 `renderer.info.render.calls` 的读法。现在把它做成常驻。

```js
// src/tools/perfProbe.js
export function createPerfProbe(renderer, { bootStartMs }) {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:9999;font:11px/1.4 monospace;" +
                     "background:rgba(0,0,0,.62);color:#9fe;padding:6px 8px;white-space:pre;pointer-events:none";
  document.body.appendChild(el);

  let bootMs = null;            // 第一次 update 调用时刻 = 首帧完成
  const frames = [];            // 滚动 60 帧间隔
  let last = null;
  let acc = 0;

  return {
    update(dt) {
      const now = performance.now();
      if (bootMs === null) bootMs = Math.round(now - bootStartMs);
      if (last !== null) {
        const iv = now - last;
        if (iv > 0 && iv < 250) { frames.push(iv); if (frames.length > 60) frames.shift(); }
      }
      last = now;

      acc += dt;
      if (acc < 0.5) return;    // 0.5s 刷新一次，别每帧写 DOM
      acc = 0;
      const info = renderer.info;
      const avg = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0;
      el.textContent =
        `fps    ${avg ? (1000 / avg).toFixed(1) : "--"}  (${avg.toFixed(1)}ms)\n` +
        `calls  ${info.render.calls}\n` +
        `tris   ${(info.render.triangles / 1000).toFixed(0)}k\n` +
        `progs  ${info.programs?.length ?? "?"}\n` +
        `geoms  ${info.memory.geometries}\n` +
        `texs   ${info.memory.textures}\n` +
        `boot   ${bootMs}ms`;
    },
    snapshot() {   // 供 Node/e2e 读取
      const info = renderer.info;
      const avg = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0;
      return {
        fps: avg ? +(1000 / avg).toFixed(1) : null,
        frameMs: +avg.toFixed(2),
        calls: info.render.calls,
        triangles: info.render.triangles,
        programs: info.programs?.length ?? null,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        bootMs,
      };
    },
  };
}
```

接入 `src/main.js`：

```js
// 文件最顶部（所有 import 之后的第一行可执行语句）
const __bootStart = performance.now();

// import 区
import { createPerfProbe } from "./tools/perfProbe.js";

// createStage() 之后
const perfProbe = createPerfProbe(renderer, { bootStartMs: __bootStart });

// animate() 里，紧挨着 renderer.render / nightBloom.render 的【后面】
perfProbe.update(dt);

// window.__tm 里加一行
perfProbe,
```

**验收**
- 浏览器打开 `TigerMessenger/index.html`，左下角出现 7 行数字。
- console 输入 `__tm.perfProbe.snapshot()` 返回对象，字段全非 null。
- **把这次的数字填进末尾《测量记录表》第 0 行 = 基线。这是后面一切对比的锚点。**

---

### A2 · 确认当前实际生效的 worldVersion（诊断，不改代码）

**目的**：证实 9/1 确实切到了 v9。

浏览器 console：
```js
__tm.P;                                     // 参数
// 需要新暴露 FEATURES，若 __tm 里没有，临时在 main.js 加 FEATURES 到 __tm
```
若 `__tm` 未暴露 `FEATURES`，在 `src/main.js` 的 `window.__tm = {...}` 里加：
```js
FEATURES,   // 从 ./core/params.js 已经 import 过则直接用；没有则补 import
```

对照测量：
| URL | 期望 worldVersion | 记录 calls / fps |
|---|---|---|
| `index.html` | `v9`（若确实被季节切了） | |
| `index.html?worldVersion=custom` | `custom` | |
| `index.html?seasonWorldV1=0` | `custom` | |

**验收**：三行数字都记进《测量记录表》。
若 `?worldVersion=custom` 的 fps 明显高于裸 URL → 季节切换确认是导火索，进入阶段 B。

---

## 阶段 B · 止血：锁 custom，删季节切换与死 flag

> ⚠️ 本阶段全是删除。**每删一处先全仓 grep 确认无其他引用。**
> 命令：`rg -n "符号名" TigerMessenger/src TigerMessenger/tools TigerMessenger/*.html`

### B1 · 删除季节自动切换

**文件**：`src/core/params.js`

> 📌 **这里删掉的「季节」概念不是废弃，是搬家。** 日历驱动的季节在本条彻底删除，
> 地理驱动的季节在**阶段 E** 重建。B1 只负责拆，不负责建 —— 不要在这一条里顺手写新季节。

**删除 1**：`seasonWorldVersion()` 整个函数（约 `L189-L199`，含它上面的 JSDoc 注释块）。

**删除 2**：`FEATURES` 里的 `seasonWorldV1: true,`（`L119`）及其上方 4 行注释（`L115-L118`）。

**改写 3**：`applyUrlOverrides()` 开头的季节分支（`L203-L219`）。

```js
// —— 改之前（L203-L219 摘要）——
export function applyUrlOverrides(search, { month } = {}) {
  const seasonQ = ...;
  const seasonFlag = readFlag(seasonQ, "seasonWorldV1");
  if (seasonFlag !== null) FEATURES.seasonWorldV1 = seasonFlag;
  if (FEATURES.seasonWorldV1 !== false && !seasonQ.get("worldVersion")) {
    const seasonVersion = seasonWorldVersion(month ?? new Date().getMonth());
    if (seasonVersion === "v9" || seasonVersion === "v8") applyWorldVersionPreset(seasonVersion);
    else { FEATURES.worldVersion = "custom"; FEATURES.planetPresentationVersion = "legacy"; }
  }
  if (typeof search !== "string" || !search) return;
  ...
}

// —— 改之后 ——
// 世界档不再随日历漂移（2026-09-01 卡顿事故）：默认永远 custom，
// 只有显式 ?worldVersion=v8|v9 才切实验管线。
export function applyUrlOverrides(search) {          // ← 去掉 { month } 形参
  FEATURES.worldVersion = "custom";
  FEATURES.planetPresentationVersion = "legacy";
  if (typeof search !== "string" || !search) return;
  ...                                                // 后面所有逐项 flag 解析原样保留
}
```

**注意**：`month` 形参被删了，全仓 grep `applyUrlOverrides(` 确认没有传第二参的调用点
（`tools/test_*.mjs` 里可能有，一并处理）。

**验收**
```bash
cd TigerMessenger
rg -n "seasonWorldVersion|seasonWorldV1" src tools *.html *.md
# 期望：只剩 docs/ 和 TODO.md 里的历史记述，src/ 与 tools/ 零命中
```
浏览器裸 URL 打开 → `__tm.FEATURES.worldVersion === "custom"`。
**记一行《测量记录表》。这一行应该已经明显好转。**

---

### B2 · 删除 V7 预设与三个死 flag

> 🚨 **不要误读这一条。** 主人已确认 **WFC / 波函数塌缩是项目选定的长期技术方向**
> （古堡建模、风系统、地形地貌都走 Oskar 方式）。
> 本条删的是**三个从未生效的 flag 名字**，`src/procgen/wfc/`、`sphericalWfc.js`、
> `constraints/`、`citadel/constraintSolver.js` 这些**真正的 WFC 能力一行都不动**。
> 删 flag ≠ 放弃 WFC。

`[已核实]` `procgenEngineV1` / `wfcCastleV1` / `marchingTerrainV1` 在 `src/` 里
**没有任何运行时条件分支**，只被 `src/procgen/migration/rolloutPlan.js` 当字符串描述符读。
（也就是说：这三个 flag 打开与关闭，画面和逻辑**完全一样** —— 它们是名字，不是能力。）

**执行前必须重新验证这一点**（代码可能已变）：
```bash
rg -n "isProcgenEngineV1|isWfcCastleV1|isMarchingTerrainV1|procgenEngineV1|wfcCastleV1|marchingTerrainV1" src
```
若命中里出现 `if (...)` / `? :` / `&&` 这类真实分支 → **停止本条，标记为「假设失效」并跳到 B3。**

若确认只是描述符：

**文件**：`src/core/params.js`
- 删 `FEATURES` 里 3 行：`procgenEngineV1` / `wfcCastleV1` / `marchingTerrainV1`（`L103-L105`）
- 删 `WORLD_VERSION_PRESETS.v7` 整个块（`L138-L150`）
- 删 `applyUrlOverrides` 里对应的 3 段 URL 解析（`L261-L266`）
- 删 3 个访问器 `isProcgenEngineV1()` / `isWfcCastleV1()` / `isMarchingTerrainV1()`
- `resolveActiveWorldVersion()` 里那句
  `if (features.procgenEngineV1 || features.wfcCastleV1 || features.marchingTerrainV1) return "v7";`
  → 直接删掉（下面已有 `return "custom"` 兜底）
- `WORLD_VERSION_PRESETS.v8` / `.v9` 里的这 3 个 key 一并删

**文件**：`src/procgen/migration/rolloutPlan.js`
- 删 stage 定义里引用这 3 个 key 的条目。若删完某个 stage 变空，删掉该 stage。

**验收**
```bash
rg -n "procgenEngineV1|wfcCastleV1|marchingTerrainV1|worldVersion=v7|\"v7\"|'v7'" src tools
node tools/test_builders.mjs        # 若存在
```
浏览器无 console 报错。`?worldVersion=v7` 现在应该被 `applyWorldVersionPreset` 拒绝（返回 false），回落 custom。

---

### ~~B3 · 给 v8/v9 预设补上 custom 独有的岛屿抬升~~ 【已作废 · 跳过】

> ⛔ **本条已被 G2 取代，不要执行。**
> G2 会把 `WORLD_VERSION_PRESETS` 整个删掉，往一个即将删除的结构里补三行是白做工。
> 岛屿抬升三个值的正确归宿是 **G2-a 的 `WORLD.islandLift`**。
>
> 保留本条正文仅为记录问题来源 —— **执行模型请直接跳到 B4。**

**问题**（`[已核实]`）：`officialPagePlanetFeatures()`（`src/scenes/messengerIsland.js:34-53`）
只在 **非** v7/v8/v9 时才设 `highlandIslandLift / saihojiIslandLift / bookshopIslandLift`。
显式切到 v8/v9 会丢这三个值 → 苔庭和书店掉 3.2。

**文件**：`src/core/params.js`，`WORLD_VERSION_PRESETS.v8` 与 `.v9` 各加三行：

```js
v8: Object.freeze({
  planetGraphV1: true,
  planetTerrainV1: true,
  curvedWaterV1: true,
  terrainSemanticShaderV1: true,
  cloudImpostorV1: true,
  oceanWorldRoutesV1: true,
  planetSurfaceRidersV1: false,
  legacyCanalWorld: false,
  planetPresentationVersion: "v8",
  // 与 custom 对齐，避免显式切档时苔庭/书店沉底（2026-09-01）
  highlandIslandLift: 0,
  saihojiIslandLift: 3.2,
  bookshopIslandLift: 3.2,
}),
// v9 同样三行
```

**验收**：`?worldVersion=v8` 打开，苔庭与书店的高度与 `?worldVersion=custom` 目视一致（截图对比）。
> 这条是**正确性修复不是性能修复**，允许 draw call 不变。

---

### B4 · 运河交汇古堡改为条件构建

`[已核实]` `src/scenes/messenger/loadTraffic.js:75-131` 是一个**裸块**，
`buildOdysseyCitadel`（`odysseyCitadel.js` = 3400 行）无条件执行。

**改法**：加门控，但**默认仍然建**（custom 档主人可能要它），
先把它变成可关的，然后用 A1 探针**实测它值多少 draw call**，再决定去留。

**文件**：`src/scenes/messenger/loadTraffic.js`

```js
export function loadCanalNetwork({
  ...,
  legacyCanalWorld = FEATURES.legacyCanalWorld,
  canalScope = null,
  oceanWorldRoutes = null,
  buildCanalJunction = true,        // ← 新增形参
}) {
  const scope = canalScope || (legacyCanalWorld === true ? "world" : "none");
  ...
  let canalJunctionCitadel = null;
  let canalJunctionStorage = null;
  let canalJunctionBox = null;
  if (buildCanalJunction) {         // ← 原来是裸 `{`，改成 if
    ... 原样不动 ...
  }
```

下游 `canalPush(canalJunctionCitadel?.position, ...)` 已经用了 `?.`，
`canalPush` 内部有 `dir?.isVector3` 判空，**null 安全，无需改**。
但要检查第 274 行 `return { ..., canalJunctionCitadel, ... }` 的消费者：

```bash
rg -n "canalJunctionCitadel|canalJunctionBox|canalJunctionStorage" src
```
每个消费点确认能吃 `null`（加 `?.` 或提前 return）。

**验收（这条是测量条目，不是优化条目）**
1. 临时加 URL 开关：`?canalJunction=0` → `buildCanalJunction: false`。
2. 分别测 `?canalJunction=1` / `?canalJunction=0` 的 calls / tris / bootMs。
3. **把差值记进《测量记录表》**，写进注释：
   ```js
   // 运河交汇古堡实测成本：draw calls +NNN，triangles +NNNk，boot +NNNms（2026-09-01）
   ```
4. 差值 >300 calls → 报给主人问「这座城在 custom 主页里还要不要」，**不要自己删**。

---

### B5 · 排查真正的死模块

**只做调查，不删。** 产出一份清单交主人拍板。

```bash
cd TigerMessenger
# 1. 列出 src 下所有 js
fd -e js . src > /tmp/all.txt
# 2. 从 main.js 出发做可达性分析（写个一次性脚本）
node tools/dead_module_scan.mjs   # ← 需新建，见下
```

`tools/dead_module_scan.mjs` 伪代码：
```js
// 从 src/main.js 出发，正则抓 import 路径，BFS 求可达集合，
// 再对 src/**/*.js 求差集。
import fs from "node:fs";
import path from "node:path";

const ROOT = "src";
const seen = new Set();
const queue = ["src/main.js"];
const IMPORT_RE = /(?:^|\s)(?:import|export)[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']/gm;

while (queue.length) {
  const file = path.normalize(queue.shift());
  if (seen.has(file) || !fs.existsSync(file)) continue;
  seen.add(file);
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(IMPORT_RE)) {
    let spec = m[1] || m[2];
    if (!spec || !spec.startsWith(".")) continue;   // 跳过 three 等裸包
    spec = spec.split("?")[0];                      // 去掉 ?v=20260827 缓存串
    queue.push(path.join(path.dirname(file), spec));
  }
}

const all = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".js")) all.push(path.normalize(p));
  }
})(ROOT);

const dead = all.filter((f) => !seen.has(f));
console.log(`reachable ${seen.size} / total ${all.length} / dead ${dead.length}`);
for (const f of dead) {
  const loc = fs.readFileSync(f, "utf8").split("\n").length;
  console.log(`${String(loc).padStart(6)}  ${f}`);
}
```

**注意**：`src/` 里存在 `?v=20260827-terrain-v11` 这类缓存串 import
（如 `runtime.js:16`、`loadTraffic.js:17`），**必须先 `.split("?")[0]`**，否则会误判为死代码。
另外 `.html` 里可能直接 `<script type="module">` 引 `src/planet/main.js`，
所以要额外把 `*.html` 里的 module src 也加进 BFS 种子。

**验收**：产出 `docs/dead-modules-2026-09-01.md`，列出「文件 / 行数 / 建议」三列。
**任何删除都要主人确认后另开 TODO。**

---

### B6 · 掐掉「算完就丢」的三处白建 ⭐ boot 时间收益最大

`[已核实]` custom 档 `planetTerrainV1 = false`，但 `compilePlanetV8()` 照样把
`prepareCharts` / `buildGlobalSphericalTerrain` / `compileVegetationV9` 全算完，
而这三样的产物在 [runtime.js#L139](../src/world/planetV8/runtime.js#L139) 的
`if (enabledTerrain)` 之外**没有任何消费者**。

> 📌 **主人已选定「方案 2」**（2026-09-01）：编译器代码**全部保留**（它是 WFC/Oskar
> 方向的载体，且有 Node 测试守着），只是生产运行时永远不调用地形路径。
> **本条加的两个形参就是方案 2 的落地机制**，G3 会把它固化成常量。

**注意**：这不是删代码，是加两个形参按需跳过。V8/V9 opt-in 时行为必须**逐字节不变**。

**文件 1**：`src/procgen/planet/planetCompilerV8.js`

```js
// 签名加两个形参，默认 true = 旧行为
export function compilePlanetV8({
  seed = 1, radius = 160, subdivision = 1, chartLimit = 6, resolution = 24,
  landmarks = DEFAULT_LANDMARK_MANIFEST, seaLevel = 0, landformChain = false, stopAfter = null,
  needTerrain = true,        // ← 新增：false 时跳过地形网格产出
  needVegetation = true,     // ← 新增：false 时跳过植被布点
} = {}) {
```

```js
// (1) prepareCharts —— chartLimit=0 时它跑完 10 地标 × 全 cells 最近邻再全丢
const charts = (!needTerrain || chartLimit <= 0)
  ? []
  : prepareCharts(grid, assignment, manifest, chartLimit).map((chart) => { ...原样... });

// (2) 全球地形网格
const globalTerrain = (landformChain && needTerrain)
  ? buildGlobalSphericalTerrain({ grid, surfaceGrid: globalSurfaceGrid, field, ecology: ecologyV10, climate: climateV10 })
  : null;

// (3) 植被布点
const vegetationCharts = globalTerrain ? [globalTerrain] : charts;
const vegetationByChart = needVegetation
  ? vegetationCharts.map((chart) => { ...原样... })
  : [];
```

**⚠️ 下游依赖排查（必做，否则会静默出 null）**：
```bash
rg -n "\.globalTerrain|\.charts\b|vegetation" src/world/planetV8 src/procgen/planet src/render/vegetation
```
逐个确认能吃 `null` / `[]`。重点检查：
- `snapshot.land.globalMeshHash`（`planetCompilerV8.js:484`）—— `if (globalTerrain)` 已判空 ✓
- `validatePlanetSnapshot()` —— **确认它不要求 `globalMeshHash` 必填**，
  要求则跳过本条第 (2) 项并标 `⚠️ 假设失效`
- `chartSeamValidator` / `validateChartSeams` —— 空 charts 时是否返回 ok

**文件 2**：`src/world/planetV8/runtime.js`，把开关传下去

```js
const compiled = compilePlanetV8({
  seed, radius,
  landformChain: isV9,
  chartLimit: enabledTerrain ? (features.planetChartLimit ?? lod.chartLimit) : (features.planetChartLimit ?? 0),
  resolution: enabledTerrain ? (features.planetResolution ?? lod.resolution) : (features.planetResolution ?? 3),
  needTerrain: enabledTerrain,                                        // ← 新增
  needVegetation: planetRendererOwnership(features).vegetation,       // ← 新增
});
```

**验收**
1. `node tools/test_planet_v8_*.mjs` 全部保持绿（这些测试直接调 `compilePlanetV8`，
   默认 `needTerrain/needVegetation = true` → 行为不变）。
2. **`?worldVersion=v8` 与 `?worldVersion=v9` 的截图必须与改动前逐像素一致**
   —— 证明 opt-in 路径零影响。
3. 裸 URL（custom）的 `bootMs` **应显著下降**。**记一行《测量记录表》。**
4. `__tm.perfProbe.snapshot()` 的 `calls` / `tris` 不变（本条只省 boot，不改渲染）。

---

### B7 · A 类死码清除（在 B2 基础上补齐）

B2 已删 v7 三 flag。本条补掉剩下两处。

**B7-a · `planetGraphV1`（纯死 flag）**

`[已核实]` 全仓只出现在 `params.js`，**零消费者**：
```bash
rg -n "planetGraphV1" src        # 期望：只有 params.js 的 7 行
```
删除：`FEATURES` 定义（`L107`）、v8/v9 preset 里各一行（`L155` `L169`）、
`planetOskarV1` 里的赋值（`L271`）、逐项解析数组里的字符串（`L282`）、
访问器 `isPlanetGraphV1()`（`L362-L364`）。

**⚠️ 执行前重跑上面那条 rg**。若 `src/` 之外（`tools/`、`*.html`）有命中，一并处理。

**B7-b · `useWorldCanal` 死分支**

`[已核实]` 删掉 v7 后 `scope === "world"` 不可达：
custom → `"crystal-city"`、v8/v9 → `"none"`（`legacyCanalWorld: false`）。

**文件**：`src/scenes/messenger/loadTraffic.js`

```js
// L66 删除
const useWorldCanal = scope === "world";

// L149 的 else-if 整块删除
} else if (useWorldCanal) {
  canalPush(bookshop?.position, "书店镇");
  ... 8 行 canalPush ...
}

// L203 条件简化
if (canalAnchors.length >= 3 && useCrystalCanal) {     // 去掉 || useWorldCanal

// L208 / L214 / L228 / L256 四处 useWorldCanal 分支：
//   取 useWorldCanal === false 的那一支，把三元/if 塌缩掉
```

> 🚨 **最容易删错的一处**：`buildWorldCanal` **函数本身不能删**。
> `useCrystalCanal`（custom 的默认）也调用它（`L204`）。
> 只删 `useWorldCanal` 变量和它的分支，**不要删 `canalSystem.js:286` 的函数**。

**验收**
```bash
rg -n "useWorldCanal" src                  # 零命中
rg -n "buildWorldCanal" src                # 必须仍有 loadTraffic.js:7 与 :204 两处
```
- 裸 URL 打开，**水晶城运河必须仍在**（截图对比 B1 完成时）。
- `?worldVersion=v8` 打开，无 console 报错。

---

### B8 · 命名转正（可选但强烈建议，纯重命名零逻辑改动）

**动机**：`planetCompilerV8` / `planetV8/` 这套命名让每个接手的人都误判
「V8 = 实验代码 = 可以关掉」—— 9/1 事故的一半原因就是这个误解。
**不改名，下一个 agent 还会再犯一次同样的错。**

| 现名 | 新名 |
|---|---|
| `src/procgen/planet/planetCompilerV8.js` | `planetCompiler.js` |
| `src/world/planetV8/` | `src/world/planet/`（注意已有 `src/world/planet.js`，先确认不冲突） |
| `src/world/waterV8/` | `src/world/water/` |
| `compilePlanetV8()` | `compilePlanet()` |
| `createPlanetV8Runtime()` | `createPlanetRuntime()` |

**执行纪律**
1. **一次只改一个符号/一个目录，改完立刻跑全套 `tools/test_*.mjs` + 浏览器开一次。**
2. import 路径里的 `?v=20260827-terrain-v11` 缓存串**必须同步更新日期**，
   否则浏览器读旧缓存，你会以为改动没生效。
3. 在文件头注释里写明：
   ```js
   // 这是【生产】星球编译器，不是实验代码。custom 主页无条件调用它编译海洋与云。
   // 曾用名 planetCompilerV8（2026-09-01 更名，因该命名导致误判为可关闭的实验档）。
   ```
4. **本条如果时间紧可以跳过**，但要在 `README.md` 顶部加一行警告替代。

**验收**：全套 Node 测试绿 + 浏览器无报错 + 截图逐像素一致（纯重命名不应有任何视觉差）。

---

### B9 · 同步清理菜单控件 ⚠️ 删 flag 必须同时删 button

**原则：删一个 flag，就要删掉所有指向它的 UI。** 留着孤儿 button 会点出 `undefined`。

> 📌 **OskSta 面板整体移除见阶段 G（G1）** —— 主人 2026-09-01 决定：
> 不保留该面板，其中有价值的两项能力（renderer 统计、截图）融进主代码。
> 本条只处理开发者菜单里的硬件分档控件。

#### B9-b · 开发者菜单的硬件分档控件（配合 F1）

**文件**：`src/core/devPanel.js`。这四个控件全部挂在 `lightingV5`（= `oskLightingV1`，
默认 `false`）之下，**生产里本来就看不见**，但 flag 删掉后必须同步删控件：

| 控件 id | 行 | 对应 flag |
|---|---|---|
| `#dev-v5-quality` | `L127-L133` | `lightingQuality` |
| `#dev-v5-ao` | `L144` | `voxelAoV1` |
| `#dev-v5-bounce` | `L147` | `voxelBounceV1` |
| `#dev-v5-light-budget` | `L159-L162` | `localLightBudgetV1` |

每个控件要删**三处**（漏一处就报错）：
1. `html +=` 里的模板字符串
2. `bindSelect(...)` / `bindCheck(...)` / `bindRange(...)` 的绑定
3. 顶部 `import { LIGHTING_QUALITY_TIERS } from "..."`（`L7`）

**验收**
```bash
rg -n "dev-v5-quality|dev-v5-ao|dev-v5-bounce|dev-v5-light-budget" src   # 零命中
rg -n "\"v7\"|'v7'|A · V7" src *.html                                    # 零命中
```
- 打开开发者菜单，**逐个点一遍所有剩余 button**，console 零报错。
- 打开 `shot-harness.html`，点 B/C 两个按钮，均能正常切换。

---

## 🚦 检查点 CP-1（B 阶段结束，必须由复核模型签字）

**见文末《检查点制度》。B 阶段全部完成后停下，不要直接进 C。**

---

## 阶段 C · 主刀：影子与剔除（收益最大）

### C1 · 影子按需重烘

`[已核实]` 生产管线的投影灯在 `src/world/environment.js:17-27`：
```js
const dir = new THREE.DirectionalLight(0xffffff, P.sunIntensity ?? 1.6);
dir.position.set(20, 28, 16);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
dir.shadow.camera.far = 90;
dir.shadow.camera.left = -25; right = 25; top = 25; bottom = -25;
```
`renderer.shadowMap.autoUpdate` 从未设置 → 默认 `true` → **每帧重烘**。
`castShadow = true` 在 55 个文件 293 处。

#### C1-a 先测成本（不改逻辑）

console 里直接开关，记两组数：
```js
__tm.renderer.shadowMap.enabled = false;   // 等 3 秒读探针
__tm.renderer.shadowMap.enabled = true;
```
**把 Δcalls / Δfps 记进《测量记录表》。**
- Δ < 10% → **跳过 C1，直接做 C2**（说明影子不是瓶颈，别浪费时间）。
- Δ ≥ 10% → 做 C1-b。

#### C1-b 按需重烘

**文件**：`src/core/stage.js` + `src/main.js`

```js
// stage.js —— 关掉自动重烘
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.shadowMap.autoUpdate = false;      // ← 新增：改为手动
renderer.shadowMap.needsUpdate = true;      // ← 首帧烘一次
```

```js
// main.js，animate() 内、renderer.render 之前
// 影子按需重烘（2026-09-01）：昼夜相位跨过 1/64 才重烘一次；
// 静态建筑为主的场景不需要每帧重算 2048² 投影。
{
  const phase = dayNight.getPhase?.() ?? P.timeOfDay;
  const bucket = Math.floor(phase * 64);
  if (bucket !== lastShadowBucket) {
    lastShadowBucket = bucket;
    renderer.shadowMap.needsUpdate = true;
  }
}
```
`lastShadowBucket` 声明在 `animate` 外层：`let lastShadowBucket = -1;`

**还要处理的失效点**（不处理会出现「影子留在原地」的 bug）：
- 天气切换（雨/雪改光照）
- 地图编辑器提交（`mapEditor` / `citadelSceneEdit`）
- 场景切换 / 远区加载
- `lightingDirector.invalidateShadowFit()` 被调用时

统一暴露一个函数：
```js
// main.js
function invalidateShadows() { renderer.shadowMap.needsUpdate = true; }
// 挂到 window.__tm.invalidateShadows，并在上述 4 个点调用
```

**验收**
- 站着不动 30 秒，影子随昼夜平滑变化（不跳、不糊）。
- 玩家跑动时**自身影子**必须跟随 → 若 `BasicShadowMap` 下角色影子卡住，
  说明角色必须每帧烘：把角色改用 blob shadow
  （参考已有 `tools/test_blob_shadow.mjs`），或把 `needsUpdate` 频率提到每 4 帧。
- **记一行《测量记录表》。**

---

### C2 · 修复并默认开启距离剔除

`[已核实]` `src/core/sceneDistanceCulling.js` 已写好但默认关（`params.js:38 distanceCullV1: false`），
关的原因是「会把合并城体/港口/送信人误隐藏」。

**根因**（`[已核实]` `sceneDistanceCulling.js:56-62`）：
```js
object.getWorldPosition(_center);
entries.push({
  mesh: object,
  center: _center.clone(),      // ← 世界坐标在 collect() 时被快照，之后永不更新
  radius: Math.max(0.5, worldRadius),
});
```
送信人 / 船 / 电车会移动，它们的 `center` 永远停在出生点 → 走远后被误剔。

**修法**：静态 / 动态分流。

```js
// sceneDistanceCulling.js

// 1) collect() 里区分静态与动态
const DYNAMIC_RE = /messenger|agent|soldier|npc|fox|tiger|boat|ship|tram|pod|whale|bird|aircraft|airship/i;

const collect = () => {
  entries = [];
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!object.isMesh || object.visible === false) return;
    if (isExcluded(object)) return;
    const geometry = object.geometry;
    if (!geometry?.attributes?.position) return;
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere;
    if (!sphere || !Number.isFinite(sphere.radius)) return;
    if (sphere.radius > maxObjectRadius) return;

    const dynamic = matchesUpChain(object, DYNAMIC_RE);   // 与 isExcluded 同样向上找 4 层
    object.getWorldPosition(_center);
    const worldRadius = sphere.radius * object.getWorldScale(_scale).x;   // ← 复用 scratch，别 new
    entries.push({
      mesh: object,
      dynamic,
      center: dynamic ? null : _center.clone(),   // 静态才快照
      radius: Math.max(0.5, worldRadius),
    });
  });
  return entries;
};

// 2) apply() 里动态物现算
const apply = (camera) => {
  const camPos = camera.position;
  const altitude = Math.max(0, camPos.length() - planetRadius);
  const cullDist = cullDistance + altitude * altitudeFactor;
  let visibleCount = 0;
  for (const entry of entries) {
    // 动态物每次现算世界位置，避免出生点快照导致误剔
    const c = entry.dynamic ? entry.mesh.getWorldPosition(_center) : entry.center;
    const dist = c.distanceTo(camPos) - entry.radius;
    const show = dist < cullDist;
    if (entry.mesh.visible !== show) entry.mesh.visible = show;
    if (show) visibleCount += 1;
  }
  lastVisibleCount = visibleCount;
};

// 3) 被外部主动改过 visible 的物体不能被本模块抢回来
//    dispose() 现在会把所有 entry.mesh.visible = true —— 这会把本来就该隐藏的东西点亮。
//    改为记录 collect 时的原值：
//    entries.push({ ..., wasVisible: object.visible });
//    dispose(): entry.mesh.visible = entry.wasVisible;
```

**关于「合并城体被误剔」**：`maxObjectRadius = 25` 已经把大网格排除在剔除之外了，
所以真正被误剔的应该只有动态物。上面的修复覆盖了它。
若实测仍有大件消失 → **把 `maxObjectRadius` 降到 12**，宁可少剔也不要视觉 bug。

**开启**：`params.js` 改 `distanceCullV1: true`，并把注释改成新的说明。
保留 `?distanceCullV1=0` 作为一键回滚。

**验收**
1. 沿电车全线跑一圈 + 飞行器绕星球一圈，**逐帧录屏**，确认无物体凭空消失/闪现。
2. 特别检查：送信人、船、电车、旧港、书店镇。
3. `__tm.perfProbe.snapshot()` 的 calls 应显著下降。**记一行《测量记录表》。**
4. 若发现闪烁 → 加迟滞：`show = entry.mesh.visible ? dist < cullDist * 1.1 : dist < cullDist;`

---

### C3 · 材质去重缓存

`[已核实]` `TODO.md:173` 自记基线「材质 ~2977 个」；`PLAN.md:430` 主人定过规矩
「不得为每名士兵、每块墙创建独立材质」。材质数 ≈ draw call 数说明这条规矩没落实。

**先定位**：
```bash
rg -c "new THREE\.(Mesh(Standard|Lambert|Phong|Basic|Toon)Material|ShaderMaterial)" src | sort -t: -k2 -rn | head -20
```
按命中数从多到少处理前 5 个文件。

**新建** `src/render/materialCache.js`：
```js
// 材质去重（2026-09-01 卡顿治理）：同参数材质全局共享一个实例。
// 共享后禁止逐实例改 material.color —— 需要改色的走 InstancedMesh 的 instanceColor
// 或单独 clone 并标记 userData.uncached = true。
import * as THREE from "three";

const cache = new Map();

const CTORS = {
  standard: THREE.MeshStandardMaterial,
  lambert: THREE.MeshLambertMaterial,
  basic: THREE.MeshBasicMaterial,
  toon: THREE.MeshToonMaterial,
  phong: THREE.MeshPhongMaterial,
};

/** 稳定 key：按字段名排序序列化，保证 {a,b} 与 {b,a} 同 key */
function keyOf(kind, params) {
  const parts = Object.keys(params).sort().map((k) => {
    const v = params[k];
    if (v && v.isColor) return `${k}=#${v.getHexString()}`;
    if (v && v.isTexture) return `${k}=tex:${v.uuid}`;     // 贴图按 uuid，不同贴图不合并
    return `${k}=${v}`;
  });
  return `${kind}|${parts.join(",")}`;
}

export function getMaterial(kind, params = {}) {
  const Ctor = CTORS[kind];
  if (!Ctor) throw new Error(`unknown material kind: ${kind}`);
  const key = keyOf(kind, params);
  let m = cache.get(key);
  if (!m) {
    m = new Ctor(params);
    m.userData.cacheKey = key;
    cache.set(key, m);
  }
  return m;
}

export function materialCacheSize() { return cache.size; }
```

**改造模式**（逐文件，一次一个）：
```js
// 改前
const wallMat = new THREE.MeshStandardMaterial({ color: 0xd8cdbb, roughness: 0.9, flatShading: true });
// 改后
import { getMaterial } from "../render/materialCache.js";
const wallMat = getMaterial("standard", { color: 0xd8cdbb, roughness: 0.9, flatShading: true });
```

**⚠️ 高风险点，必须逐个检查**：
- 改造后**任何**对该材质的写操作（`mat.color.set(...)`、`mat.opacity =`、`mat.map =`、
  `mat.needsUpdate =`）都会**污染所有共享者**。
- 全仓 grep 每个被改造的材质变量，确认它是只读的。
  有写操作 → **跳过该处，保持 `new`**，并加注释 `// 逐实例改色，不可共享`。
- 昼夜循环 / 夜窗点灯 / 麻醉变色 这几类逻辑一定有写操作，重点排查
  `updateCitadelNightWindows`、`applyPlanetNightGrade`、`tickBirdSedation`。

**验收**
- 每改完一个文件：`__tm.perfProbe.snapshot().textures/geometries` 不变，
  `__tm.renderer.info.programs.length` 下降或持平。
- **目视截图对比改造前后必须像素级接近**（用 `tools/e2e/` 里已有的截图工具）。
- 材质总数：console 里 `import("/src/render/materialCache.js").then(m => console.log(m.materialCacheSize()))`。
- **每 3 个文件记一行《测量记录表》。**

---

### C4 · 静态几何合并补齐

`[已核实]` 已有 `src/world/geometryMerge.js` 的 `mergeStaticGroup`，
在 `messengerIsland.js:21` 被 import。覆盖不全。

**先定位没合并的热点**：加一个一次性诊断脚本。
```js
// console 里跑：按父节点统计 Mesh 数量，找出「同一个 group 下几百个独立 Mesh」的地方
(() => {
  const stat = new Map();
  __tm.scene.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.parent;
    if (!p) return;
    const k = p.name || p.type + ":" + p.uuid.slice(0, 6);
    stat.set(k, (stat.get(k) || 0) + 1);
  });
  console.table([...stat].sort((a, b) => b[1] - a[1]).slice(0, 30));
})();
```

对排名前 10 的 group：
- 全静态、材质少 → 调 `mergeStaticGroup(group)`。
- 同几何重复多 → 改 `THREE.InstancedMesh`（参考已有实现
  `src/world/moebiusCity.js`、`src/world/odysseyCitadel.js:871`、`src/world/birdVortex.js`）。

InstancedMesh 改造伪代码：
```js
// 改前：N 个独立 Mesh
for (const spot of spots) {
  const m = new THREE.Mesh(treeGeo, treeMat);
  m.position.copy(spot.pos); m.quaternion.copy(spot.q); m.scale.setScalar(spot.s);
  group.add(m);
}

// 改后：1 个 InstancedMesh
const inst = new THREE.InstancedMesh(treeGeo, treeMat, spots.length);
inst.name = group.name + "-inst";
const _m4 = new THREE.Matrix4();
spots.forEach((spot, i) => {
  _m4.compose(spot.pos, spot.q, _scale.setScalar(spot.s));
  inst.setMatrixAt(i, _m4);
});
inst.instanceMatrix.needsUpdate = true;
inst.castShadow = true;             // 与原 Mesh 保持一致
inst.receiveShadow = true;
inst.frustumCulled = true;          // 注意：整体剔除，包围球要够大
inst.computeBoundingSphere?.();     // r172 有；没有则手动设 inst.boundingSphere
group.add(inst);
```

**⚠️ 陷阱**：
- InstancedMesh 的 frustum culling 是**整体**的。包围球算错会整片消失。
  改完必须绕场景一圈确认不消失。
- 合并后**丢失逐件 `visible` 控制**。若该 group 里有需要单独隐藏的件
  （夜窗、可破坏物），把它们排除在合并之外。
- 合并会**破坏 C2 的距离剔除**（合并后半径 >25 就被 `maxObjectRadius` 排除了）。
  这是符合预期的：合并后本来就不需要逐件剔除。

**验收**：每合并一个 group 记一行《测量记录表》，calls 必须下降。

---

## 阶段 D · 收尾（只在 C 做完且 fps ≥ 40 后才做）

### D1 · 远区整树摘除

参考已有范式 `src/core/officialOceanOcclusionPruning.js:139`：
> 从场景树摘除才能稳定节省遍历和 draw call。

```js
// 新建 src/core/regionStreaming.js
// 把主岛切成 N 个大区（书店镇/苔庭/旧港/水晶城/圣城/交汇古堡），
// 每区记 { name, centerDir: Vector3, radius, root: Group, attached: bool }
// 玩家（或相机）离区中心 > radius + hysteresis → root.removeFromParent()
// 回到范围内 → scene.add(root)
// 节流 0.5s 一次；用迟滞避免边界抖动（进 R*0.9，出 R*1.15）
export function createRegionStreaming({ scene, getCamera, regions, interval = 0.5 }) { ... }
```
**风险**：摘除时该区内的 update 回调仍在跑 → 需要同时挂起
`updateScenes` 里对应的 handle。**这条改动大、风险高，务必最后做。**

### D2 · flock 空间哈希

`[已核实]` `src/world/flock.js:542` 与 `:645` 双重 O(n²)。n 只有十几只，**收益很小**。
只在 D1 做完还差帧率时才做。

```js
// 用一个简单的均匀网格（cell = NEIGHBOR_RADIUS）
// 每帧重建 Map<cellKey, birdIndex[]>，只遍历 3×3×3 邻域
const cell = NEIGHBOR_RADIUS;
const key = (x, y, z) => `${Math.floor(x/cell)},${Math.floor(y/cell)},${Math.floor(z/cell)}`;
// build → 查询时遍历 27 个邻格
```

### D3 · lightingDirector state 就地更新

`[已核实]` `src/render/lighting/lightingDirector.js` `update()` 用对象展开每帧构造 smoothed state。
**注意**：`oskLightingV1` 默认 `false`，这段代码在生产里根本不跑。
**只有当主人打开 V5 光照时才有意义 → 优先级最低，可以不做。**

---

## 阶段 E · 地理季相（主人 2026-09-01 提案）

> **前置门槛：阶段 C 完成且 fps ≥ 40 才允许开始。**
> 在 10fps 的场景上调色板，分不清是色板错了还是掉帧掉的。
>
> 设计说明见 [PERF-AUDIT-2026-09-01.md](PERF-AUDIT-2026-09-01.md) 第「一·补」节。
> **核心原则：季相按「物体自己的纬度」决定，不是按「玩家的纬度」全局调色。**

### E1 · 季相核心模块（纯函数，可单测，零依赖）

**新建** `src/world/seasonBands.js`

```js
// =====================================================================
// 地理季相（2026-09-01）：季节是星球上的「地方」，不是日历上的「时候」。
// 从北极到南极单调走完一年 —— 玩家纵穿一次星球 = 走过一个轮回。
//
// 铁律：
//   1. 本文件绝对不允许出现 new Date() / Date.now()。
//      日历驱动季节正是 2026-09-01 卡顿事故的成因。
//   2. 季相只允许影响【颜色 / 天气偏置 / 粒子】。
//      绝对不允许影响 FEATURES、worldVersion、几何生成。
// =====================================================================

export const SEASON_BANDS_SCHEMA_VERSION = 1;

/**
 * 季相带表 —— 【这是美术决策，主人改这一张表就够了，不用碰下面任何逻辑】。
 * minLat 从高到低排列，第一条命中即返回。blendDeg = 与下一带的过渡宽度。
 */
export const SEASON_BANDS = Object.freeze([
  Object.freeze({ name: "winter", minLat:  45, blendDeg: 12 }), // 三重门 +62、苔庭 +56
  Object.freeze({ name: "autumn", minLat:   5, blendDeg: 12 }), // 高山圣城 +24.1
  Object.freeze({ name: "summer", minLat: -35, blendDeg: 12 }), // 水晶城 / 白鲸海湖 −24
  Object.freeze({ name: "spring", minLat: -Infinity, blendDeg: 12 }), // 叹息之门峡谷 −50
]);

/** 世界坐标 → 纬度（度）。与半径无关，只看方向。 */
export function latitudeOf(pos) {
  const len = Math.hypot(pos.x, pos.y, pos.z);
  if (len < 1e-6) return 90;
  const s = Math.max(-1, Math.min(1, pos.y / len)); // clamp 防浮点越界让 asin 出 NaN
  return (Math.asin(s) * 180) / Math.PI;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 || 1e-6)));
  return t * t * (3 - 2 * t);
}

/**
 * 纬度 → 季相。
 * @returns {{ name, next, blend, index }}
 *   blend = 0 完全是 name；blend → 1 正在过渡到 next（更低纬那一带）。
 */
export function seasonAtLatitude(latDeg) {
  const lat = Number.isFinite(latDeg) ? latDeg : 90;
  let index = SEASON_BANDS.findIndex((b) => lat >= b.minLat);
  if (index < 0) index = SEASON_BANDS.length - 1;
  const band = SEASON_BANDS[index];
  const nextBand = SEASON_BANDS[Math.min(index + 1, SEASON_BANDS.length - 1)];
  const lower = band.minLat;
  const blend = Number.isFinite(lower) ? 1 - smoothstep(lower, lower + band.blendDeg, lat) : 0;
  return { name: band.name, next: nextBand.name, blend, index };
}

/** 便捷：世界坐标 → 季相 */
export function seasonAt(pos) {
  return seasonAtLatitude(latitudeOf(pos));
}
```

**新建单测** `tools/test_season_bands.mjs`

```js
import assert from "node:assert";
import fs from "node:fs";
import { seasonAtLatitude, latitudeOf, SEASON_BANDS } from "../src/world/seasonBands.js";

// 1. 无日历依赖 —— 源码里不许出现 Date
const src = fs.readFileSync(new URL("../src/world/seasonBands.js", import.meta.url), "utf8");
assert.ok(!/new Date|Date\.now|getMonth\(/.test(src), "季相不得依赖时钟");

// 2. 地标落带（数值来自 saihoji.js / citadelRange.js / citySeaLake.js / canyon.js）
assert.equal(seasonAtLatitude(56).name,   "winter", "苔庭 +56");
assert.equal(seasonAtLatitude(24.1).name, "autumn", "高山圣城 +24.1");
assert.equal(seasonAtLatitude(-24).name,  "summer", "水晶城 −24");
assert.equal(seasonAtLatitude(-50).name,  "spring", "峡谷 −50");

// 3. 纯函数：同输入同输出
assert.deepEqual(seasonAtLatitude(30), seasonAtLatitude(30));

// 4. 全纬度无 NaN、blend 恒在 [0,1]
for (let lat = -90; lat <= 90; lat += 0.5) {
  const s = seasonAtLatitude(lat);
  assert.ok(SEASON_BANDS.some((b) => b.name === s.name), `未知季相 @${lat}`);
  assert.ok(s.blend >= 0 && s.blend <= 1, `blend 越界 @${lat}: ${s.blend}`);
}

// 5. 单调性：纬度下降 index 不回头（纵穿 = 一个轮回，不来回跳）
let prev = -1;
for (let lat = 90; lat >= -90; lat -= 0.5) {
  const i = seasonAtLatitude(lat).index;
  assert.ok(i >= prev, `季相带回头 @${lat}`);
  prev = i;
}

// 6. 边界安全
assert.ok(Number.isFinite(latitudeOf({ x: 0, y: 0, z: 0 })), "零向量不得 NaN");
assert.equal(latitudeOf({ x: 0, y: 5, z: 0 }), 90);

console.log("test_season_bands: ok");
```

**验收**：`node tools/test_season_bands.mjs` 全绿。**本条不改任何现有文件，零风险。**

---

### E2 · 季相色板表

**新建** `src/world/seasonPalette.js`

```js
// 季相色板：构建期使用，运行时不改 —— 逐帧成本为 0。
import * as THREE from "three";
import { seasonAtLatitude, latitudeOf } from "./seasonBands.js";

export const SEASON_PALETTE = Object.freeze({
  winter: Object.freeze({ foliage: 0xb9c7c9, ground: 0x8fa39b, tintStrength: 0.72 }),
  autumn: Object.freeze({ foliage: 0xd08a3c, ground: 0x9a8552, tintStrength: 0.62 }),
  summer: Object.freeze({ foliage: 0x5f9e5c, ground: 0x6d8f65, tintStrength: 0.30 }),
  spring: Object.freeze({ foliage: 0x8fc46a, ground: 0x7fa86a, tintStrength: 0.45 }),
});

const _a = new THREE.Color();
const _b = new THREE.Color();

/**
 * 把基色按该位置的季相染色。构建期调用一次，结果烘进材质。
 * @param {{x,y,z}} pos 物体【自己的】世界坐标 —— 不是玩家的
 */
export function seasonTint(baseHex, pos, channel = "foliage") {
  if (!pos) return baseHex;                       // 拿不到坐标 → 保持旧行为
  const { name, next, blend } = seasonAtLatitude(latitudeOf(pos));
  const cur = SEASON_PALETTE[name];
  const nxt = SEASON_PALETTE[next];
  _a.setHex(cur[channel]);
  if (blend > 0.001) _a.lerp(_b.setHex(nxt[channel]), blend);
  const strength = cur.tintStrength * (1 - blend) + nxt.tintStrength * blend;
  return _b.setHex(baseHex).lerp(_a, strength).getHex();
}
```

**验收**：新建 `tools/test_season_palette.mjs`，断言
- 同一 `pos` 反复调用返回同一 hex（确定性）
- `pos = null` 时原样返回 `baseHex`
- 带边界两侧 ±0.1° 的返回色差 < 4/255（连续无硬边）

**本条仍不改现有文件。**

---

### E3 · 接入地被色（风险最低的第一个真实接入）

`[已核实]` [mossyGround.js#L140](../src/world/mossyGround.js#L140) **已经有 `palette` 形参**，
`L236-L237` 有 `groundPalette` 组装 —— 白捡的接入点，不用改函数签名。

```js
// mossyGround.js，groundPalette 组装处
import { seasonTint } from "./seasonPalette.js";

const groundPalette = {
  low:     seasonTint(palette?.low     ?? TERRAIN_LOW,     worldPos, "ground"),
  ink:     seasonTint(palette?.ink     ?? TERRAIN_INK,     worldPos, "ground"),
  emerald: seasonTint(palette?.emerald ?? TERRAIN_EMERALD, worldPos, "ground"),
  fresh:   seasonTint(palette?.fresh   ?? TERRAIN_FRESH,   worldPos, "ground"),
  edge:    seasonTint(palette?.edge    ?? TERRAIN_EDGE,    worldPos, "ground"),
};
```

`worldPos` 是该块地被中心的世界坐标，从调用方传入。
**拿不到就传 `null`** —— `seasonTint` 会原样返回，保持旧行为。

回滚开关：`params.js` 加 `seasonBandsV1: true` + URL 解析，
关闭时 `seasonTint` 直接 `return baseHex`。
（这是**纯外观开关**，不碰管线，允许存在。）

**验收**
1. `?seasonBandsV1=0` 与 B1 完成后的截图**逐像素一致**（证明回滚路径干净）。
2. `?seasonBandsV1=1` 下，苔庭（+56）与水晶城（−24）的地被色**肉眼可辨不同**。
3. `__tm.perfProbe.snapshot()` 的 fps / calls **与开关关闭时一致**（证明零运行时成本）。
   ⚠️ 若 calls 上升 → 说明染色破坏了 C3 的材质共享（每块地被生成了独立材质）。
   修法：把 `seasonTint` 结果**量化到 16 级**再进 `getMaterial`，让邻近区块共享材质。

---

### E4 · 接入植被色板

同 E3 模式，接入 [highlandCitadelDesign.js#L56-L58](../src/world/highlandCitadelDesign.js#L56-L58)
的 `foliageDeep / foliageMid / foliageLight`，以及树木生成处（`src/assets/lowPoly.js`）。

**⚠️ 与 C4 InstancedMesh 的冲突**：合并成一个 InstancedMesh 的树群共享同一材质，
无法逐株按纬度染色。两个解法二选一：
- **(a) 按季相带分桶**：一个季相带一个 InstancedMesh（最多 4 个），带内共享色板。
  **推荐** —— 4 个 draw call 换四季，代价可接受。
- **(b) `instanceColor`**：`inst.setColorAt(i, color)` 逐株上色，仍是 1 个 draw call，
  但需要材质 `vertexColors` 兼容，改动更大。C4 已完成的地方优先用 (a)。

**验收**：站在 lat +45° 分界带上，**同一屏内同时看到冬色和秋色的树**。
这是本阶段的最终验收画面，**截图存档**。

---

### E5 · 天气与粒子跟随玩家季相

这两项是**唯二**跟随玩家的，因为天气和落叶本来就是「玩家周围的空气」。

```js
// main.js，animate() 内
{
  const { name } = seasonAt(player.position);
  if (!P.weatherLocked) {
    seasonWeatherBias.update(dt, name);   // 冬 → 提高 weather=2(雪)
  }                                       // 春 → 提高 weather=1(雨)
}                                         // 夏/秋 → 偏晴
```

粒子：参考 [saihojiGarden.js#L197](../src/scenes/saihojiGarden.js#L197) 已有的
`LEAF_COUNT = 110` 落叶实现，按玩家季相切换 落叶(秋) / 花瓣(春) / 雪(冬) / 无(夏)。

**⚠️ 必须加迟滞**，否则玩家在带边界左右挪一步天气就抽风：
```js
// 进入新季相带需持续 3 秒才真正切换
if (name !== pendingSeason) { pendingSeason = name; pendingT = 0; }
else if ((pendingT += dt) > 3 && name !== activeSeason) { activeSeason = name; }
```

**验收**
1. 在 lat +45° 边界来回走 10 次，天气**不抽风**。
2. `P.weather` 手动设定后不被季相覆盖。
3. fps 相对 E4 无下降。

---

### E6 · 守卫测试，防止事故重演

**新建** `tools/test_no_calendar_coupling.mjs`

```js
// 守卫：禁止日历驱动的行为差异，禁止季相触碰管线开关。
import fs from "node:fs";
import path from "node:path";

const offenders = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!e.name.endsWith(".js")) continue;
    const src = fs.readFileSync(p, "utf8");

    // 1. params.js 与季相文件里禁止出现时钟
    if (/params\.js$|season\w*\.js$/.test(p) && /new Date\(|Date\.now\(|getMonth\(/.test(src)) {
      offenders.push(`${p}: 出现日历调用`);
    }
    // 2. 季相文件里禁止碰管线开关
    if (/season\w*\.js$/.test(p) && /FEATURES|worldVersion|planetPresentationVersion/.test(src)) {
      offenders.push(`${p}: 季相不得触碰管线开关`);
    }
  }
})("src");

if (offenders.length) {
  console.error("❌ 日历/管线耦合守卫失败：");
  for (const o of offenders) console.error("  " + o);
  process.exit(1);
}
console.log("test_no_calendar_coupling: ok");
```

**验收**：退出码 0。
**这条必须加进每次提交前必跑的清单 —— 它是防止 9/1 事故重演的最后一道闸。**

---

## 阶段 F · 整洁架构：靠 low-poly 便宜，不靠硬件分档

> 设计说明见 [PERF-AUDIT-2026-09-01.md](PERF-AUDIT-2026-09-01.md) 第「二·补二」节。
> **F1/F3 可与 B 阶段并行；F2 必须等 C 阶段做完（它会大面积移动文件，冲突代价高）。**

### F1 · 删除硬件探测 / 质量分档 / 自动降级子系统（~2350 行）

`[已核实]` 这些代码挂在 `oskLightingV1`（默认 `false`）之下，**生产里根本不跑**。
删掉不提升帧率，但**移除了继续偷懒的退路** —— 有自动降级兜底，就没人会去真把几何做便宜。

**删除顺序（依赖从上到下，反过来删会断）**

| 步 | 删除 | 行数 |
|---|---|---|
| 1 | `src/render/ao/voxelBounce.js` | 408 |
| 2 | `src/render/ao/voxelAoRenderer.js` | 823 |
| 3 | `src/render/ao/voxelVolume.js` | 426 |
| 4 | `src/render/lighting/qualityGovernor.js` | 133 |
| 5 | `src/render/lighting/lightingQuality.js` | 44 |
| 6 | `src/render/lighting/localLightBridge.js` | 192 |
| 7 | `src/render/lighting/localLightRegistry.js` | 265 |
| 8 | `src/procgen/migration/migrationGate.js` | 22 |

**每删一个文件前必跑**：
```bash
rg -n "文件名去掉 .js" src tools *.html
```
命中处一并清理。**若发现 `oskLightingV1 === false` 之外的调用点 → 停止，标 `⚠️ 假设失效`。**

**连带清理**

`src/core/params.js`：
```js
// 删除
lightingQuality: "medium",
localLightBudgetV1: null,
voxelAoV1: false,
voxelBounceV1: false,
// 删除访问器 isVoxelAoV1 / isVoxelBounceV1 / getLightingQuality / isLocalLightBudgetV1
// 删除 L240-L241 / L259-L260 的 URL 解析
// 删除 L8 的 import { isLightingQualityName }
```

`src/main.js`：
```js
// 删除 L135-L146 governBloomByFps 整个函数 + L1622 的调用
// 删除 L654 的 if (lightingV5 && isVoxelAoV1() && ...) 整块
// 删除 L681-L697 的 K4 局部灯预算整块
// 删除 voxelAo?.update(dt) 这一行
// import 行同步清理
```

`src/render/postprocessing/miniBloom.js`：
```js
// 删除 degraded / frameIntervals / recordFrame（L160-L180）
// render() 里 `if (disposed || degraded)` → `if (disposed)`
```
> **理由**：bloom 只在夜间起作用且已有 `nightWeight <= 0.001` 白天直出短路，
> 不需要再叠一层按帧率降级。**若删完夜景明显掉帧 → 不要恢复降级，
> 而是直接把 `P.nightBloomV1` 默认改 `false`** —— 单一管线，要么有要么没有。

`src/core/devPanel.js`：见 **B9-b**。

**验收**
```bash
rg -n "lightingQuality|voxelAo|voxelBounce|localLightBudget|qualityGovernor|migrationGate|governBloomByFps" src tools *.html
# 期望：零命中（docs/ 与 TODO.md 的历史记述不算）
node --experimental-vm-modules -e "import('./src/main.js')" 2>&1 | head   # 或直接开浏览器
```
- 浏览器裸 URL 打开，**console 零报错**，画面与 B 阶段结束时**逐像素一致**
  （这些代码本来就不跑，所以必须一致；有差异说明删错了）。
- `?oskLightingV1=1` 现在应该只剩基础 V5 光照，不再有 AO/bounce/分档。
  **若报错 → 说明 V5 光照对已删模块有硬依赖，回滚并标 `⚠️ 假设失效`。**

---

### F2 · 消除 `procgen/ → world/` 反向依赖（纯文件移动，零逻辑改动）

`[已核实]` `planetCompilerV8.js` 有 8 处反向 import；根因是
`world/planetV8/` + `world/waterV8/` 的 **28 个文件里有 24 个不 import three**，
它们是纯数据编译器，被错放在几何层。

**只有这 4 个真的碰 THREE，留在 `world/`**：
```
world/planetV8/runtime.js
world/planetV8/cloudTerrainRemap.js
world/planetV8/tripleGateScout.js
world/waterV8/officialOcean.js
```

**其余 24 个移进 `procgen/`**：
```
world/planetV8/*.js   →  procgen/planet/          （20 个）
world/waterV8/*.js    →  procgen/water/           （ 8 个中的 7 个）
render/clouds/heroCloudCompiler.js → procgen/clouds/heroCloudCompiler.js
```

**执行纪律（这条最容易搞砸）**
1. **一次只移一个文件**，移完立刻 `rg` 修所有 import 路径，跑测试，再移下一个。
   > 批量移动 24 个文件必然出错。Flash 类模型尤其不要一次多移。
2. 用 `git mv` 保留历史，**不要**删了重建。
3. import 路径里的 `?v=20260827-terrain-v11` 缓存串**同步更新日期**。
4. 每移完一个：
   ```bash
   rg -n "旧路径片段" src tools *.html    # 必须零命中
   node tools/test_season_bands.mjs && ls tools/test_planet*.mjs | xargs -n1 node
   ```

**验收**：全套 Node 测试绿；浏览器截图**逐像素一致**（纯移动不该有任何视觉差）。

---

### F3 · 架构守卫测试（把规则固化，防止倒退）

**新建** `tools/test_architecture.mjs`

```js
// 架构守卫：单向依赖 + procgen 纯数据 + 性能硬预算。
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";

const LAYER = ["core", "procgen", "world", "render", "scenes", "ui"];
const rank = new Map(LAYER.map((n, i) => [n, i]));
const errors = [];

function layerOf(p) {
  const m = /^src\/([^/]+)\//.exec(p.replace(/\\/g, "/"));
  return m ? m[1] : null;
}

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".js")) files.push(p.replace(/\\/g, "/"));
  }
})("src");

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const from = layerOf(file);

  // 1. procgen 必须是纯数据 —— 不许 import three
  if (from === "procgen" && /from\s+["']three["']/.test(src)) {
    errors.push(`${file}: procgen 不得 import three（纯数据层，必须可在 Worker 跑）`);
  }

  // 2. 单向依赖：不许 import 比自己更靠后的层
  for (const m of src.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    const target = path.normalize(path.join(path.dirname(file), m[1].split("?")[0]))
      .replace(/\\/g, "/");
    const to = layerOf(target);
    if (!from || !to || from === to) continue;
    if (rank.get(to) > rank.get(from)) {
      errors.push(`${file} → ${target}: ${from} 不得依赖更上层的 ${to}`);
    }
  }

  // 3. 禁止硬件探测 / 自动降级复活
  if (/qualityGovernor|lightingQuality|voxelAo|voxelBounce|localLightBudget|getExtension\(/.test(src)) {
    errors.push(`${file}: 硬件分档/自动降级已废弃（单一管线原则）`);
  }
}

if (errors.length) {
  console.error("❌ 架构守卫失败：");
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log(`test_architecture: ok (${files.length} files)`);
```

**新建** `tools/test_perf_budget.mjs` —— 读 `__tm.perfProbe.snapshot()` 的导出 JSON，断言硬预算：

| 预算项 | 上限 |
|---|---|
| `calls` | **≤ 1200** |
| `triangles` | **≤ 1_500_000** |
| `programs` | **≤ 120** |
| `bootMs` | **≤ 2000** |

> 材质数上限 300 需要 C3 的 `materialCacheSize()` 导出后才能测，一并加进去。

**⚠️ 上线节奏**：F3 的两条测试在 A–E 全部完成前**必然是红的**。
先让它们**只打印不 exit(1)**（`process.exitCode = 0`），
等 D 阶段门槛达标后再改成硬失败并加进提交前必跑清单。

**验收**：`node tools/test_architecture.mjs` 与 `node tools/test_perf_budget.mjs` 均可运行且输出清晰。

---

## 阶段 G · 单一管线塌缩：系统里不再有 V7/V8/V9/custom

> 主人 2026-09-01 决定：**系统里不区分版本，全部融入 custom。**
> 这是「单一管线」原则的彻底落地 —— 前面 B1 只是把 `worldVersion` **锁死**，
> 本阶段是把这个概念**彻底删掉**。
>
> **前置**：B、C、F1 完成。

### ✅ G0 · 已决策：方案 2 —— 代码全留，只断运行时接线

**主人 2026-09-01 已选定「方案 2」。本条无需再等签字，直接按下面执行。**

`[已核实]` custom 档 `planetTerrainV1 = false`，下面这些能力**从未在生产画面里出现过**：

| 模块 | 行数 | 能力 |
|---|---|---|
| `procgen/field/marchingCubes.js` | 196 | Marching Cubes 地形 |
| `procgen/planet/vegetationCompilerV9.js` | 321 | 植被布点 |
| `render/vegetation/vegetationRuntime.js` | 247 | 植被 InstancedMesh |
| `render/terrain/semanticTerrainMaterial.js` | 117 | 地形语义着色 |
| `procgen/planet/terrainSemanticBake.js` | 111 | 语义烘焙 |
| `procgen/planet/chartSeamValidator.js` | 57 | 分片接缝校验 |
| `world/planetV8/riderProjection.js` | 48 | 地表投影骑乘 |
| **合计** | **1097** | |

#### 决策内容

**这 1097 行一个字都不删，也不注释掉。** 只把运行时接线断开。

理由（三条，缺一不可）：

1. **WFC / Marching Cubes 是主人选定的长期方向**（Oskar 方式）。
   这些不是废弃实验，是**还没接通的目标架构**。
2. **注释掉比不调用更糟**：注释掉的代码没有语法检查、没有测试覆盖、IDE 不认，
   半年后会跟周围代码对不上。而 `procgen/` **有 Node 测试守着** ——
   保持它「活着但没人调用」，测试就继续帮你保证它是对的。
3. 1097 行跨 7 文件的注释操作本身易错，diff 巨大，review 不动。

#### 落地机制：一行常量代替 1097 行注释

**新建**（或并入 G2-a 的 `src/core/worldConfig.js`）：

```js
// ---------------------------------------------------------------
// WFC / Marching Cubes 地形 = 主人选定的长期技术方向（Oskar 方式）。
// 代码全部保留在 procgen/ 与 render/ 下，由 Node 测试守护正确性，
// 但【不接运行时】—— 在 Oskar 管线补完之前接上必然回到 10fps。
//
// 重新启用的前置条件（缺一不可，逐条打勾后再改这里）：
//   [ ] 1. 主岛 draw calls ≤ 1200（Oskar 第三段「合并成单一网格」做完，见 C3/C4）
//   [ ] 2. compilePlanet 移进 Web Worker，首帧不再被 WFC 求解阻塞（见 H3）
//   [ ] 3. 地形网格自身走 mergeStaticGroup / InstancedMesh，不是逐分片提交
// ---------------------------------------------------------------
export const TERRAIN_WFC_WIRED = false;
```

> **如果主人后来仍想改成「注释掉源码」**：本条可回退 ——
> 把上面常量删掉，改为在 7 个文件顶部加 `/* eslint-disable */` + 整体注释。
> **但请先重读上面理由 2。**

**验收**：`TERRAIN_WFC_WIRED` 存在且为 `false`；7 个模块文件**未被改动**
（`git diff --stat` 里不出现它们）。
>
> **执行模型：本条未获主人明确答复前，禁止开始 G3。**

---

### G1 · 移除 OskSta 面板，两项有用能力融进主代码

**主人明确要求：不要出现此菜单。**

`[已核实]` 面板（[shotHarnessPanel.js](../src/ui/shotHarnessPanel.js)，460 行）做 7 件事：

| # | 功能 | 处置 |
|---|---|---|
| 1 | A/B/C worldVersion 切换 | **删** —— G2 之后概念本身不存在 |
| 2 | 验收对象 / 绑定阴影焦点 | **删** —— 能力在 `lightingDirector`，面板只是 UI |
| 3 | 光照 A/B（旧光照 / 实验·正午·黄昏·深夜） | **删** —— 挂 `oskLightingV1`，F1 已废 |
| 4 | 恢复昼夜 | **删** —— 配套 3 |
| 5 | **下载当前截图** | ✅ **融入** `window.__tm.capture()` + 快捷键 |
| 6 | 光照参数包 preset | **删** —— 挂 V5 光照 |
| 7 | **renderer 统计（calls/triangles）** | ✅ **已融入** A1 的 `perfProbe` HUD |

> 第 7 项正是 A1 在做的事 —— [shotHarnessPanel.js#L160-L175](../src/ui/shotHarnessPanel.js#L160-L175)
> 的 `summarizeState()` 读的就是 `renderer.info.render.calls/triangles`。
> **A1 完成后这个面板的统计功能已经重复了。**

#### G1-a · 融入截图能力

**文件**：`src/tools/perfProbe.js`（A1 已建，在这里加一个方法）

```js
// perfProbe 返回对象里加：
capture(filename) {
  // 必须在渲染同一帧内取，否则 preserveDrawingBuffer=false 时拿到空白
  const canvas = renderer.domElement;
  const name = filename || `tm-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
  canvas.toBlob((blob) => {
    if (!blob) { console.warn("[capture] 画布为空，改用 requestAnimationFrame 内调用"); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
},
```

**⚠️ 已知陷阱**：`WebGLRenderer` 默认 `preserveDrawingBuffer: false`，
在 rAF 之外调 `toBlob` 会拿到空白图。
**照抄面板原有做法**（[shotHarnessPanel.js#L382](../src/ui/shotHarnessPanel.js#L382) 的 `capture`）：
先 `renderer.render(scene, camera)` 再立刻 `toBlob`，或用 `requestAnimationFrame` 包一层。
**不要**去改 `preserveDrawingBuffer: true`（会显著掉帧）。

**文件**：`src/main.js`
```js
// window.__tm 里加
capture: (name) => perfProbe.capture(name),

// 快捷键（放在已有的 keydown 处理旁边）
if (e.key === "F9") perfProbe.capture();   // F9 = 下载当前截图
```

#### G1-b · 删除面板及其独占依赖

| 文件 | 行数 | 说明 |
|---|---|---|
| `src/ui/shotHarnessPanel.js` | 460 | 整个删除 |
| `src/render/lighting/oskLightingPrototype.js` | 248 | `[已核实]` 头注释自述「shot-harness 专用」，**删前必 grep** |
| `src/render/lighting/presetLoader.js` | 203 | `[已核实]` 唯一消费者是面板 `L12` |
| `src/render/visualV8/*.json` + `validateVisualPackageV8.js` | — | `[已核实]` 只被面板的 `VISUAL_DATA_PACKS` 读 —— **删前必 grep** |

> 🚨 **`lightingState.js` 不能删！** `[已核实]` [lightingDirector.js#L14](../src/render/lighting/lightingDirector.js#L14)
> 也 import 它（`composeLightingState`），而且 [main.js#L42](../src/main.js#L42) 直接用了
> `setLightingPresetOverrides`。**这是本条最容易删错的一处。**
>
> 🚨 **`ui/dragPanel.js` 不能删！** `[已核实]` 还有 5 个消费者：
> `crystalCityEditorPanel` / `citadelEditorPanel` / `minimap` / `devPanel` / `storyboardPanel`。

**连带清理**：
```js
// src/main.js
// L68  删 import { createShotHarnessPanel }
// L489-L490, L504, L588-L628  删整块 shot-harness 接线
// L1112 删 t.closest("#shot-harness-panel") 这一项
// L1681 删 __tm.shotHarness
// L42 / L701-L711 的 setLightingPresetOverrides —— 确认是否还需要，不需要则一并删

// src/core/devPanel.js
// L169  删 "📸 打开 OskSta A/B 工作台" button
// L220  删 shotBtn 绑定
// 连带删 onOpenShotHarness 形参
```

**`shot-harness.html`**：主人未要求保留独立 QA 页 → **建议整页删除**（先问主人）。
若保留，它是独立页面、不影响主游戏，可以原样不动。

**验收**
```bash
rg -n "shotHarness|shot-harness|oskLightingPrototype|presetLoader|visualV8" src *.html   # 零命中
rg -n "makePanelDraggable" src        # 必须仍有 5 处（不含已删的面板）
rg -n "lightingState" src             # 必须仍有 lightingDirector.js 的引用
```
- 打开开发者菜单，**逐个点一遍所有 button**，console 零报错，无「📸 打开 OskSta」。
- 按 F9 能下载到**非空白**的 PNG（打开看一眼，别只看文件存在）。
- 画面与 F1 结束时**逐像素一致**。

---

### G2 · 删除 `worldVersion` / `planetPresentationVersion` 概念本身

`[已核实]` 这两个概念共 **57 处**，分布在 6 个文件：
`params.js` / `messengerIsland.js` / `planetV8/runtime.js` / `main.js` / `shotHarnessPanel.js`（G1 已删）/ `shot-harness.html`

#### G2-a · 新建唯一世界配置（**常量，不是 flag**）

**新建** `src/core/worldConfig.js`

```js
// =====================================================================
// 世界配置（2026-09-01 单一管线塌缩）。
//
// 这里【没有版本概念】。曾经的 V7/V8/V9/custom 四档已全部塌缩成这一套
// 常量 —— 取值就是 custom 档（2026 年 3–8 月主人验收过的那套）的实际值。
//
// 铁律：本文件只放【常量】，不放开关。需要 A/B 对比请改代码后重新加载，
// 不要在这里加 flag —— 加 flag 就是四档管线复活的第一步。
// =====================================================================

export const WORLD = Object.freeze({
  // 只有水晶城区域保留运河；交汇古堡保留（曾用名 canalScope）
  canalScope: "crystal-city",
  // 岛屿抬升：苔庭与书店浮岛离地高度（曾是 custom 独有、V8/V9 会丢失的三个值）
  islandLift: Object.freeze({ highland: 0, saihoji: 3.2, bookshop: 3.2 }),
});
```

> 曾经的 `curvedWaterV1` / `cloudImpostorV1` / `oceanWorldRoutesV1` **不进这个文件** ——
> 它们恒为 `true`，正确做法是**把 `if` 直接删掉**，而不是留一个永远为真的常量。

#### G2-b · `src/core/params.js` 删除清单

```js
// FEATURES 里删除：
planetGraphV1, planetTerrainV1, curvedWaterV1, terrainSemanticShaderV1,
cloudImpostorV1, oceanWorldRoutesV1, planetSurfaceRidersV1, legacyCanalWorld,
planetPresentationVersion, worldVersion

// 删除整个 WORLD_VERSION_PRESETS
// 删除 applyWorldVersionPreset()
// 删除 resolveActiveWorldVersion()
// 删除 planetOskarV1 的 URL 分支（L268-L278）
// 删除逐项 flag 解析数组（L280-L285）
// 删除 worldVersion / planetPresentationVersion 的 URL 解析（L296-L302）
// 删除访问器：isPlanetGraphV1 isPlanetTerrainV1 isCurvedWaterV1
//            isTerrainSemanticShaderV1 isCloudImpostorV1 isOceanWorldRoutesV1
//            isPlanetSurfaceRidersV1 getWorldVersion getPlanetPresentationVersion
```

**B1 改过的 `applyUrlOverrides` 开头两行也一并删**：
```js
FEATURES.worldVersion = "custom";              // ← 删
FEATURES.planetPresentationVersion = "legacy"; // ← 删
```

#### G2-c · `src/scenes/messengerIsland.js`

**删除整个 `officialPagePlanetFeatures()`**（`L34-L53`）。
调用点改为直接用 `WORLD` 常量。

```js
// 改前
const features = officialPagePlanetFeatures(FEATURES);
loadCanalNetwork({ ..., canalScope: features.canalScope, ... });

// 改后
import { WORLD } from "../core/worldConfig.js";
loadCanalNetwork({ ..., canalScope: WORLD.canalScope, ... });
```
`highlandIslandLift` / `saihojiIslandLift` / `bookshopIslandLift`
的消费点同样改读 `WORLD.islandLift.*`。**逐个 grep 确认无遗漏。**

#### G2-d · `src/world/planetV8/runtime.js` 塌缩

```js
// 改前
const enabledTerrain = features.planetTerrainV1 ?? isPlanetTerrainV1();
const enabledWater   = features.curvedWaterV1 ?? isCurvedWaterV1();
const enabledClouds  = features.cloudImpostorV1 ?? isCloudImpostorV1();
const enabledSemanticShader = features.terrainSemanticShaderV1 ?? isTerrainSemanticShaderV1();
const presentationVersion = [...];
const isV9 = presentationVersion === "v9";

// 改后 —— 全部塌缩成常量，然后把死分支删掉
// enabledTerrain          = false → 删除整个 if (enabledTerrain) 块（G3）
// enabledWater            = true  → 删除 if，代码直接执行
// enabledClouds           = true  → 删除 if，代码直接执行
// enabledSemanticShader   = false → 删除三元，直接用 MeshStandardMaterial
// isV9                    = true  → 删除，landformChain 恒 true
```

**同时删除** `planetRendererOwnership()`（`L39-L44`）—— 塌缩后三个字段全是常量。

**验收**
```bash
rg -n "worldVersion|planetPresentationVersion|planetTerrainV1|curvedWaterV1|cloudImpostorV1|oceanWorldRoutesV1|terrainSemanticShaderV1|planetSurfaceRidersV1|planetGraphV1|legacyCanalWorld|officialPagePlanetFeatures" src *.html
# 期望：零命中
```
- **画面必须与 G1 结束时逐像素一致。** 这是纯塌缩，取值没变，**有任何差异都说明塌错了**。
- **重点复查岛屿抬升**：苔庭与书店的高度必须没变（这是 V8 会丢、custom 才有的三个值）。

---

### G3 · 删除地形路径（**等 G0 主人签字后再做**）

按 **方案 2** 执行：**不删任何模块文件**，只把 B6 的形参固化成常量。

```js
// src/world/planetV8/runtime.js
import { TERRAIN_WFC_WIRED } from "../../core/worldConfig.js";

// 改前（B6 之后的状态）
needTerrain: enabledTerrain,
needVegetation: planetRendererOwnership(features).vegetation,

// 改后 —— enabledTerrain 已在 G2-d 塌缩掉，这里直接读常量
needTerrain: TERRAIN_WFC_WIRED,
needVegetation: TERRAIN_WFC_WIRED,

// if (enabledTerrain) { ... } 整块（L139-L169）改成 if (TERRAIN_WFC_WIRED) { ... }
// 块内代码【原样保留】，import 也【原样保留】——
// 这样重新启用时只需要把常量改成 true，不需要重新接线。
```

**⚠️ 必查**：`validatePlanetSnapshot()` 是否要求 `land.globalMeshHash` 或 `charts` 必填？
```bash
rg -n "globalMeshHash|charts" src/procgen/planet/schema.js
```
要求则同步放宽 schema（改成可选），**否则 `needTerrain: false` 时 boot 直接失败白屏**。
这是本条唯一的真实风险点。

**不要做的事**（写下来是因为很容易顺手做了）：
- ❌ 不要删 `procgen/field/marchingCubes.js` 等 7 个模块
- ❌ 不要注释掉它们的源码
- ❌ 不要删 `tools/test_planet_*.mjs` —— 这些测试直接调 `compilePlanetV8()`
  并默认 `needTerrain: true`，**必须保持全绿**，它们是地形能力的守护者

**验收**
- `node tools/test_planet_*.mjs` **全部保持绿**（默认形参 = 旧行为）。
  → 有变红的说明 B6 的默认值写错了，回去修 B6。
- `git diff --stat` 里**不出现** G0 表格里的 7 个文件。
- 画面与 G2 结束时**逐像素一致**。
- `bootMs` 应有明显下降（不再编译 globalTerrain 与植被）。**记《测量记录表》。**
- console 输入 `__tm.TERRAIN_WFC_WIRED`（需在 `__tm` 暴露）应为 `false`。

---

## 🚦 检查点 CP-6（G 阶段结束）

见文末《检查点制度》。

---

## 阶段 H · Oskar 管线补完（云 / 风 / Worker）

> **这是主人 2026-09-01 确认的技术方向落地。**
> 认识前提：**Oskar 方式和性能优化不是两件事，是同一件事。**
> Townscaper 能在手机上跑，靠的是「求解 → 小 tile 复用 → **合并成单一网格**」三段。
> 本项目做了第一段，漏了第三段 —— 这正是 4700 draw calls 的来源。
> C3/C4 就是第三段，**不是 GPU 技巧**。
>
> **前置**：C 阶段完成（fps ≥ 40）。

### H1 · 云系统统一：生命周期做模型，impostor 做渲染

`[已核实]` 现状是**四套并存、3579 行**，且渲染方式割裂：

| 系统 | 行数 | 渲染方式 | draw call | 状态 |
|---|---|---|---|---|
| `world/equatorialClouds.js` | 1105 | **逐云球 Mesh + `addOutline` 描边壳** | 每云球 **×2** | ✅ 在跑（[main.js#L185](../src/main.js#L185)） |
| `world/highlandHeroClouds.js` | 687 | `createCloudImpostorSystem` | **1** | ✅ 在跑 |
| `planetV8/runtime.js` 全球云带 | — | `createCloudImpostorSystem` | **1** | ✅ 在跑 |
| `world/lifecycleClouds.js` | 461 | 逐云球 Mesh + 描边壳 | 每云球 ×2 | ⚠️ **零消费者，当前是死代码** |

#### 🚨 执行模型必读：不要直接「用 lifecycleClouds 替换另外两个」

**行为模型 ≠ 渲染方式，这两件事正交。**

- `lifecycleClouds` 的价值是**行为语义**：3 小云 → 合并大云 → 龙卷风收走 → 甩出 3 小云、数量守恒
- 但它的**渲染实现**是逐云球 Mesh + 描边壳 —— 全场景最贵的一种

**直接替换会把已经是 impostor（1 draw call）的 `highlandHeroClouds` 降级成逐 Mesh，
性能反而倒退。** 必须分两层做。

#### 目标架构

```
行为层  LifecycleCloudModel（采用 lifecycleClouds 的生命周期语义）
          ├── 赤道云带    = 特例：spawn 在赤道环、长周期、纯白
          └── 圣城英雄云  = 特例：locked = true（主人 2026-09-01 选 A）
                ↓ 每帧只输出 { position, scale, tint, phase }[] —— 不碰 THREE
渲染层  cloudImpostorSystem（1 draw call，共用 atlas）
```

**主人 2026-09-01 决定（选项 A）**：圣城 `locked: true` 的雪线造型云
（[highlandHeroClouds.js#L459](../src/world/highlandHeroClouds.js#L459)）
**不参与生命周期** —— 它们是圣城剪影的一部分，必须钉死。
只借用渲染层，不进合并/龙卷风循环。

#### 执行步骤（一步一测，每步记《测量记录表》）

**H1-a · 抽出行为层**（新建 `src/world/clouds/lifecycleModel.js`）

```js
// 从 lifecycleClouds.js 抽出【纯逻辑】，不 import three。
// 输入：dt、风向量、spawn 配置；输出：实例数组。
export function createLifecycleCloudModel({ spawn, wind, locked = false, seed = 1 }) {
  const clouds = [];   // { pos:[3], vel:[3], volume, phase, tint, cooldown, locked }
  return {
    update(dt, windVec) {
      // 1. locked 云：只更新 phase，跳过漂移/合并/龙卷风
      // 2. 非 locked：漂移 → 邻近判定 MERGE_DIST → 合并 → BIG_HOLD_SEC → 龙卷风 → 甩出 3 朵
      // 3. 数量守恒断言：总 volume 不变
    },
    instances() { return clouds; },   // 供渲染层消费
  };
}
```
> 迁移 `lifecycleClouds.js` 里的常量（`BASE_VOLUME`/`MERGE_GROUP`/`MERGE_DIST`/
> `BIG_HOLD_SEC`/`TOR_*`）**原值不动**，保证行为一致。

**验收**：新建 `tools/test_lifecycle_cloud_model.mjs` —— 断言数量守恒、
locked 云位置恒定、同 seed 确定性。**本步不改任何现有文件，零风险。**

**H1-b · 赤道云带切到 impostor**（收益最大的一步）

把 `main.js:185` 的 `createDynamicMoebiusClouds` 换成
`LifecycleCloudModel` + `createCloudImpostorSystem`。

**⚠️ `equatorialClouds.js` 不能整个删** —— 它导出的
`weldIcosahedron` / `deformBlob` / `getCloudGradient` / `rollBlob`
是**图元函数**，impostor atlas 烘焙时还要用它们生成云的形状。
只删 `createDynamicMoebiusClouds` / `updateDynamicMoebiusClouds` 这条逐 Mesh 路径。

连带清理 `main.js`：`CLOUD_WALL_KEY`、`isCloudWallEnabled`、`relocate`、
`isFacingCloudWall`、`devPanel` 的 `#dev-cloud-wall` 控件（**删 flag 必删 button**）。

**验收**：赤道云带外观**肉眼接近**（impostor 是 billboard，不会逐像素一致 ——
这是本清单里**唯一允许有视觉差**的一条，需主人过目）；
`calls` **应显著下降**（描边壳整批消失）。

**H1-c · 圣城英雄云接进模型**（低风险，因为渲染层已经是 impostor）

`highlandHeroClouds` 保留其 spec/catalog，只把驱动换成 `LifecycleCloudModel({ locked: true })`。
渲染层不动。**验收：圣城剪影逐像素一致。**

**H1-d · 删除 `lifecycleClouds.js` 的渲染部分**

行为层已抽走后，该文件只剩逐 Mesh 渲染代码 → 整个删除。

---

### H2 · 风系统统一：`climateV10` 做唯一真相源

`[已核实]` 现在有**两套风，彼此不连通**：

| | 来源 | 消费者 | 性质 |
|---|---|---|---|
| **A** | `P.windSpeed` / `P.windDir`（标量，菜单可调） | `updateClouds`（[updateIsland.js#L21](../src/scenes/messenger/updateIsland.js#L21)）、`weather.update`（[main.js#L1486](../src/main.js#L1486)）、`lowPoly` 植被摆动 | 运行时 |
| **B** | `climateV10.wind` / `windTangent`（逐 cell 风场，含 `orographicLift`/`rainShadow`/`cloudPotential`/`upwindOceanFetch`） | 只有 [cloudClusterCompiler.js#L241](../src/render/clouds/cloudClusterCompiler.js#L241) 与 `heroCloudCompiler` | 构建期 |

**B 才是真气象场**，但它的输入风在
[planetCompilerV8.js#L397](../src/procgen/planet/planetCompilerV8.js#L397) 是**硬编码**：

```js
wind: [1, 0, 0],     // ← 写死的东半球方向，菜单调风向对它无效
```

#### 目标：A 降级为 B 的输入，而不是平行系统

**H2-a · 打通硬编码**

```js
// planetCompilerV8.js —— solveClimateV10 的输入风改为参数
export function compilePlanetV8({ ..., windDirDeg = 45 } = {}) {
  const rad = (windDirDeg * Math.PI) / 180;
  const climateV10 = solveClimateV10({
    ...,
    wind: [Math.cos(rad), 0, Math.sin(rad)],   // 原来是硬编码 [1, 0, 0]
  });
```
调用方 `runtime.js` 传 `windDirDeg: P.windDir`。

**⚠️ 这会改变云的构建期布局** → **允许有视觉差，需主人过目**。
若主人不接受，回退成 `windDirDeg = 45`（当前 `P.windDir` 默认值），
则视觉零差异，但保留了参数通路，以后随时能开。

**H2-b · 运行时风统一读同一处**

新建 `src/world/windField.js`：
```js
// 唯一风入口。运行时任何要用风的地方都从这里取，禁止再直接读 P.windDir。
export function windVectorAt(pos, out) { /* 先返回全局风；接通 climateV10 后改为逐 cell 查表 */ }
export function globalWind(out) { /* cos/sin(P.windDir) * P.windSpeed */ }
```
把 `updateIsland.js:21/42`、`main.js:1486`、`lowPoly.js:794` 全部改读这里。

**⚠️ 视觉必须零差异** —— 本步只是把散落的 `P.windDir` 收拢到一个函数，取值不变。

**H2-c**（可选，H2-a 通过后再做）：`windVectorAt` 接通 `climateV10.windTangent`
逐 cell 查表 → 山脊背风面真的会有风影。**这是新功能，不是优化，最后做。**

---

### H3 · `compilePlanet` 移进 Web Worker

`[已核实]` `src/procgen/worker/` 有 4 个文件
（`planetWorker.js` 16 行 / `procgenWorker.js` 45 / `jobProtocol.js` 52 / `cooperativeFallback.js` 33），
但全仓 `grep 'new Worker'` **零命中** —— **基建建好了却从没接线**。

后果：`compilePlanetV8()` 在主线程同步跑，WFC 求解 + 8 道验证全程**阻塞首帧**。
Oskar 的做法是求解不在关键路径上。

**执行**
1. 先读 `jobProtocol.js` 确认既有消息协议，**照它实现，不要另发明一套**。
2. `runtime.js` 改为：先用**占位球体**（现有 `planet` 对象）立刻出画面，
   Worker 回传 snapshot 后再 commit —— 项目已有
   [snapshotCommitV8.js](../src/world/planetV8/snapshotCommitV8.js) 的
   `commitAtFrameBoundary()`，**正是为这个设计的**。
3. Worker 不可用时走 `cooperativeFallback.js`（分片让出主线程）。

**⚠️ 关键约束**：`procgen/` 必须**不 import three** 才能进 Worker。
F2 已经在做这件事 → **H3 必须排在 F2 之后**。

**验收**
- `bootMs` **大幅下降**，且首帧不再有白屏/卡顿。**记《测量记录表》。**
- 断网/Worker 构造失败时能回落，画面仍正确。
- 画面与 H2 结束时**逐像素一致**（只是把同样的计算换个线程）。

---

## 🚦 检查点 CP-7（H 阶段结束）

见文末《检查点制度》。

---

## 测量记录表

> 每完成一条 TODO 填一行。`calls` 不降反升 → 该条 revert。

| # | 时间 | TODO | URL / 配置 | fps | frameMs | calls | tris | progs | geoms | texs | bootMs | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | | A1 基线 | `index.html` | | | | | | | | | 基线 |
| 1 | | A2 | `?worldVersion=custom` | | | | | | | | | |
| 2 | | A2 | `?worldVersion=v8` | | | | | | | | | |
| 3 | | B1 锁 custom | `index.html` | | | | | | | | | |
| 4 | | B2 删 v7 | `index.html` | | | | | | | | | |
| 5 | | B4 交汇古堡 ON | `?canalJunction=1` | | | | | | | | | |
| 6 | | B4 交汇古堡 OFF | `?canalJunction=0` | | | | | | | | | |
| 6b | | **B6 跳过白建** | `index.html` | | | | | | | | | **看 bootMs** |
| 6c | | B6 回归 | `?worldVersion=v8` | | | | | | | | | 须与改前一致 |
| 6d | | B7 死码清除 | `index.html` | | | | | | | | | |
| 7 | | C1-a 影子 OFF | console 开关 | | | | | | | | | |
| 8 | | C1-b 按需重烘 | `index.html` | | | | | | | | | |
| 9 | | C2 距离剔除 | `index.html` | | | | | | | | | |
| 10+ | | C3 / C4 逐项 | | | | | | | | | | |

### 2026-09-04 · C2 距离剔除转默认开启（Claude）

**根因不是误剔，是它一直在空转。** `sceneDistanceCulling` 内部 2.5s 后才首次
`collect()`，而 boot 要 5~8s —— 那次快照拍在半空场景上，之后再不重收集。
`main.js` 在场景装配完毕处（`lightPool?.recollect()` 旁）补一次
`distanceCulling?.recollect()` 后才真正生效。

| 指标 | `?distanceCullV1=0` | `?distanceCullV1=1` | 变化 |
|---|---|---|---|
| 管理条目 entryCount | — | **10,753** | 补 recollect 前为 0（模块空转） |
| 场景内隐藏网格 | 444 | **4,763** | **+4,319** |
| draw calls | 2,711 | **2,112** | **−599（−22%）** |
| triangles | 548,982 | 531,928 | −17,054（−3.1%） |

**目验**：同机位两张截图 `/tmp/cull_off.png` vs `/tmp/cull_on.png` 画面一致
（风车 / 人物 / 地形 / 海岸线全在），无误剔。

**注意**：`fps` 未记录 —— 自动化页面不可见时 rAF 被节流，`perfProbe` 采样数为 0。
帧时间需主人在真实可见窗口里读 HUD 补录。

**顺带发现**：`DEFAULT_EXCLUDED` 与 `DYNAMIC_RE` 几乎完全重叠
（`agent|boat|ship|soldier|bird|whale|pod|tram` 都已在豁免名单里，根本不进管理列表），
所以 C2 原方案的「静态/动态分流」对它们是死代码，真正走动态分支的只有
`messenger|npc|fox|tiger|aircraft|airship` 六个名字。已在
`tools/test_distance_culling.mjs` 用 `npc-` 前缀验证动态分支确实可用。

### 2026-09-04 · C1 按需重烘：**按文档规则跳过**（Claude）

C1-a 的判据是「Δ < 10% → 跳过 C1」。可用的唯一实测是 9/02 那次 A-B-A：
关阴影 64.3ms → 58.1ms，省 **6.1ms / 64.3ms = 9.5% < 10%** → 跳过。

另有一条现实约束：本环境无法测帧时间。自动化浏览器页面不可见时 rAF 被节流，
`perfProbe.snapshot()` 的 `samples` 恒为 0、`fps` 为 null（`bringToFront()` 也无效）。
`calls / triangles / geometries / programs` 仍可靠，本轮验收全部基于这几项。

C1-b 若将来要做，还需先回答一个本文档没提的风险：**玩家与 NPC 的投影会冻结**
（按 1/64 昼夜相位重烘，人走动时影子留在原地）。做之前应先确认角色用的是
`buildBlobShadow` 贴地暗斑还是真实 castShadow。

### 2026-09-04 · C3 材质去重（Claude，第一刀：箭矢/投枪池）

**先量后改**：`TODO.md` 记的「材质 ~2977」确有其事，实测 **2,645 个材质实例 /
仅 721 种参数签名 → 1,924 个可去重（73%）**。但 `programs` 只有 36，
说明着色器编译早已不是瓶颈；材质实例多的真实代价是
`mergeStaticGroup` 按**材质实例**分组——150 个同参数材质会合并出 150 个网格。

最大重复组是 `saihojiPhalanx.js` 的箭矢池：150 支箭 × 5 材质 + 5 几何，
投枪池 44 支 × 4 + 4。箭之间除变换外完全一致。

**共享边界**（不是全共享）：`update()` 里逐箭按各自飞行进度改
`trail.material.opacity` 与 `trailCore.material.opacity`，这两件**必须保持逐箭独立**，
否则全体拖尾会跟着最后更新的那支一起闪。其余 3 件材质 + 全部 5 件几何可共享。

| 指标 | 改前 | 改后 | 变化 |
|---|---|---|---|
| 材质实例总数 | 2,645 | **2,069** | −576 |
| 可去重余量 | 1,924 | 1,361 | −563 |
| 箭矢+投枪材质实例 | 926 | **350** | −576（剩下的全是逐箭拖尾） |
| GPU 几何 `memory.geometries` | ~1,683 | **1,378** | −305 |
| draw calls | 2,122 | 2,122 | 不变（出生点看不到战场，收益在交战时） |

**剩余可做**（按重复量排序，收益递减）：沼泽 `moebius-swamp-zone` 80 个、
运河倒影 `canal-town-reflection` 68 个、`vanguard-trooper` 20 个。
箭矢/投枪剩下的 344 个重复是**故意保留**的逐箭拖尾，不要"顺手优化"掉。

**沼泽那 80 个我看过但没动**：`moebiusSwamp.js` 有统一的 `toonMat()` 工厂，
看上去在那里加缓存能一次性去重整片沼泽——但同文件有 **11 处逐实例改材质**
（涟漪 `rp.material.opacity`、萤火 `core.material.color.setRGB`、气泡/水滴/花蕊…）。
加全局缓存会让这些动画互相串。要做得先像箭矢那样**先划边界**：
静态的走共享工厂，带动画的保持独立。80 个实例、还在远景，收益不抵这份风险。

**守门**：`tools/test_projectile_shared_assets.mjs` 把边界钉死了——
`makeArrow` / `makeJavelin` 体内不得再出现 `new THREE.*Geometry`；
`makeArrow` 内必须恰好保留 2 个 `MeshBasicMaterial`（trail + trailCore）、
`makeJavelin` 恰好 1 个；共享缓存必须按 `isCitadelPaletteV3()` 分桶，否则切调色板串色。
少了 = 拖尾被误共享（全体一起闪），多了 = 本可共享的没共享。

### 2026-09-02 实测（A-B-A 对照，只收录漂移 ≤ 30% 的行）

协议：同一次加载、站着不动、`perfProbe.reset()` + `settle()` 各测一次，
顺序 A→B→A。两次 A 的漂移超过 30% 即判该行作废。

| 杠杆 | 基线 | 关掉后 | 省下 | 漂移 | calls 变化 | tris 变化 |
|---|---|---|---|---|---|---|
| 灯池（关 → 78 盏灯回来） | 61.6ms | 65.2ms | **−3.6ms** | 2.7% | — | — |
| 半分辨率（pixelRatio ÷2） | 68.7ms | 64.9ms | 3.8ms | 10.2% | 0 | 0 |
| 关阴影 | 64.3ms | 58.1ms | 6.1ms | 3.1% | 0 | **0** |
| 隐藏 12 个顶层对象 | 96.1ms | 74.5ms | **21.6ms** | 3.0% | 4462→979 | 50.0M→11.0M |
| └ 其中海面战船 ×8 + 渔船 | 91.1ms | 85.7ms | 5.4ms | 2.6% | −367 | −17.3M |

### 由此推翻的假设（全部是我自己先提出、再被自己的测量否掉）

| # | 假设 | 否证 |
|---|---|---|
| 1 | 4700+ draw call = CPU 提交瓶颈 | 来自旧代码注释而非实测；关掉全部渲染只剩 16ms |
| 2 | 描边壳 / 透明物 overdraw | 隐藏 9602 个壳省 4.5ms，1358 个透明物省 5.7ms |
| 3 | 阴影占 76.7ms | A-B-A 对照下是 −0.8ms，后续复测 6.1ms |
| 4 | 78 盏点光不是原因 | 该次测量被着色器编译污染（progs 173→202） |
| 5 | 78 盏点光 = 140ms = 62% | 干净 A-B-A 只值 3.6ms；那 140ms 是机位/时刻差异 |
| 6 | 几何不是瓶颈（全场仅 440k 三角形） | 440k 是循环外手动 render 的假象，真实帧是 50M |
| 7 | 战船贵在桨手 draw call | 只少 367 call，却少 1730 万三角形——贵在船体几何 |

**教训**：这个场景的帧时间强依赖机位、时刻、是否开着编辑器。同一台机器
同一场景，一轮会话里 224 → 79 → 61 → 68 → 83 → 96ms 反复漂移。不锁定这些
变量，任何跨时间的读数对比都没有意义。

### 待坐实：疑似泄漏

一轮会话内单调增长，且与帧时间恶化同步：

| 时刻 | geometries | programs | frameMs |
|---|---|---|---|
| 会话初 | 9,953 | 170 | — |
| 中段 | 11,865 | 190 | 65 |
| 后段 | 12,287 | 295 | 96 |
| 末段 | 12,471 | 295 | 92 |

`__tm.census.watchGrowth()` 用于坐实。若属实，这比任何静态瓶颈都更值得先修——
因为它意味着「玩得越久越卡」。

**但这份数据本身也可能是被污染的**，别急着当结论：
- `programs` 增长有一部分是**测量自己造成的**——`shadowMap.enabled` 开关会让
  全部材质换签名重编译，旧 program 仍留在缓存里被计数；
- `geometries` 增长期间主人正在用城堡编辑器反复重建城镇。

坐实的唯一方法：**全新加载、不开编辑器、不做任何切换，纯站着跑
`watchGrowth()` 10 分钟**。只有这样得到的增长才算数。

### 2026-09-02 古堡窗户「悬空方块」排查（已证实的部分）

主人现象：编辑器里右键删建筑单元后，空中留下一片深蓝方块。

**已用控制台读数证实：**

| 事实 | 读数 |
|---|---|
| 方块来自窗户 InstancedMesh | 隐藏 `citadel-window-instances-*` 后方块全部消失 |
| 烘焙坐标**没有**过期 | 实例[0] `133.9,44.6,85.3` = 真实窗[1] 同值（错位一位是过滤后紧凑重排） |
| 场上有**两座**城堡各带一套实例表 | `dark count=387`（高山）/ `dark count=332`（交汇古堡） |
| 高山的过滤已生效 | 387 → 116（271 扇宿主已隐藏的被剔除） |
| 交汇古堡**从未被驱动** | 332 → 332，一扇没剔 |

**已修**：
1. `syncCitadelWindowInstances` 按宿主祖先链可见性过滤（`windowRecordVisible`）
2. `onHighlandUnitEdit` 成功后触发重算
3. `main.js` 逐帧同时驱动 `canalJunctionCitadel`（此前只驱动 `odysseyCitadel`）

**仍未解释**：高山剩余 116 扇中仍有悬空者。宿主链是可见的，所以不是可见性问题。
下一步应打印这 116 扇的宿主链名字，定位它们挂在哪个节点上。

**已排除的两条歧路**（都是我提出后被证据否掉的）：
- ~~窗光与建筑用两套坐标系~~ → 窗光公式与 `citadelGridCellCenter` 逐位一致
- ~~高山同时建了两套城镇~~ → `highlandCitadelDesign.js:2058` 表明
  `externalTownscaperCity` 为真时参数化的 85 栋楼根本不建

**架构隐患**（记录，未修）：新增一座城堡需要手工在 `main.js` 的 animate 里
补一行驱动，漏了没有任何报错。现在有两座，再加还会漏。正确做法是让城堡
自行注册进更新列表，而不是逐个点名。

### 测试套件现状（2026-09-02 全量）

`177 个测试 · 165 通过 · 12 失败`。**12 个全部在干净 HEAD worktree
（`git worktree add /tmp/tm-baseline HEAD`）上同样失败，本轮改动零回归。**

⚠️ **超时阈值必须 ≥ 450 秒**，否则会产生假失败。实测耗时：

| 测试 | 耗时 |
|---|---|
| `test_v6_g5_combat` | **401s** |
| `test_planet_v10_coupled_systems` | 111s |
| `test_planet_v8_chain_routes` | 109s |
| `test_planet_v9_seed_gates` | 107s |

2026-09-02 用 `alarm 100` 跑全量时，这四个被截断报成 FAIL，一度看起来像
「多了 4 个回归」。

```
test_citadel_topology          test_planet_v9_all
test_citadel_v4_all            test_planet_v9_forest_grass
test_citadel_visual_theme      test_planet_v9_runtime_wiring
test_grok_acceptance_matrix    test_procgen_profiles_hard_routes
test_hydrology_field_v10 ⚠️     test_procgen_v7_all
test_planet_v8_all             test_terrace_trim
```

⚠️ `test_hydrology_field_v10` 不是断言失败，是**挂死**（基线上也 >90s 不返回）。
跑全量时会卡住整个循环。macOS 没有 `timeout`，用 perl 代替：

```sh
for f in tools/test_*.mjs; do
  perl -e 'alarm 450; exec @ARGV' node "$f" >/dev/null 2>&1 \
    && echo "PASS $(basename $f .mjs)" || echo "FAIL $(basename $f .mjs)"
done
```


---

## 阶段门槛（不达标不许进下一阶段）

| 阶段 | 门槛 |
|---|---|
| A 完成 | 探针出数，基线 7 项全部记录 |
| B 完成 | `rg "seasonWorldVersion" src` 零命中；裸 URL `worldVersion === "custom"`；画面与 8/31 截图一致 |
| C 完成 | **calls ≤ 1500 且 fps ≥ 40**；全线跑图无物体消失/闪烁 |
| D 完成 | **calls ≤ 1200 且 fps ≥ 50**；boot ≤ 2000ms |
| E 完成 | `?seasonBandsV1=0` 与 B 完成时逐像素一致；开启后 fps/calls 不变；**站在 lat +45° 一屏看到两季**；`test_no_calendar_coupling` 绿 |
| F 完成 | `test_architecture` 绿；删 F1 前后**逐像素一致**；`test_perf_budget` 改为硬失败并加进提交前必跑清单 |
| G 完成 | `rg "worldVersion|planetPresentationVersion|shotHarness"` 零命中；G1/G2 前后**逐像素一致**；F9 能存出非空白截图 |

---

## 给执行模型的额外提醒

1. **这个仓库零构建、直接 `<script type="module">` 加载。** 不要引入任何需要打包的语法或依赖。
2. **import 路径里带 `?v=20260827-terrain-v11` 这类缓存串是有意为之**，
   改动对应文件时要把日期串一起更新，否则浏览器读旧缓存，会让你以为改动没生效。
3. **`vendor/three.module.js` 是 vendored 的，绝对不要改。**
4. 每条 TODO 单独一个 commit，message 写清 `[perf] <TODO编号> <一句话> (calls NNNN→NNNN)`。
5. 遇到任何「假设与代码不符」→ **停下来在本文件对应条目下写一行 `⚠️ 假设失效：<实际情况>`，
   跳过该条，继续下一条。不要自己发挥。**

---

# 检查点制度（Gemini Flash 执行时必读）

## Flash 类模型的能力边界

这份清单**不是**每条都适合 Flash 干。按风险分三级：

### 🟢 绿区 · Flash 可独立完成（约 60%）

条目已给出完整伪代码 + 可机械验证的断言，判断空间接近零。

`A1` `A2` `B1` `B2` `B3` `B7` `B9` `C2` `C3` `C4` `E1` `E2` `E6` `F1` `F3` `G2-a`

### 🟡 黄区 · Flash 可动手，但**必须**过检查点复核（约 25%）

需要跨文件推理或对 `null` 传播做分析，Flash 容易漏。

| 条目 | 风险点 |
|---|---|
| `B4` | `canalJunctionCitadel` 变 `null` 后的下游消费点，漏一个就白屏 |
| `B6` | `globalTerrain`/`charts` 变 `null`/`[]` 后 validator 是否仍通过 |
| `C1-b` | 影子失效点（天气/编辑器/场景切换）漏一个就「影子留在原地」 |
| `E3` `E4` | 材质共享冲突：染色可能悄悄让 draw call 反弹 |
| `F2` | 24 个文件移动 + import 重写，**必须一次一个** |
| `G1` | 易误删 `lightingState.js` 与 `dragPanel.js`（**都还有其他消费者**）；截图 `preserveDrawingBuffer` 陷阱 |
| `G2` | 57 处塌缩跨 6 文件；**岛屿抬升三个值最易丢** |

### 🔴 红区 · Flash **不要独立做**，需人或强模型主导

| 条目 | 原因 |
|---|---|
| `B5` | 「哪些模块能删」是判断题，删错不可逆 |
| `B8` | 跨 365 文件重命名，Flash 长上下文会丢引用 |
| `D1` | 分区摘除，改动大、易白屏 |
| `E4` 的美术表 | 季相配色是美术决策，模型不该替主人定 |
| `G0` | **主人的美术决策**：地形能力是否永久删除。未签字禁止开始 `G3` |
| `G3` | 删 1097 行 + 改 schema，错了直接白屏 |
| **任何 `rm` / `git rm`** | 一律先列清单交主人确认 |

> **一句话**：Flash 能干「照着伪代码改」，不能干「决定该不该改」。
> 这份清单我已经刻意把判断压缩到最低，但红区那 5 条压不掉。

---

## 五道检查点

**每道检查点：执行模型停止工作 → 输出《检查点报告》→ 复核模型签字 → 才能继续。**

复核模型建议用 **GLM-5.3 或 DeepSeek**（比 Flash 强一档即可，不需要最贵的）。

### CP-1（B 阶段结束）· 删除正确性

复核模型必须逐条回答：

1. `rg -n "seasonWorldVersion|seasonWorldV1|procgenEngineV1|wfcCastleV1|marchingTerrainV1|planetGraphV1|useWorldCanal" src tools *.html`
   是否**零命中**？贴出实际输出。
2. `rg -n "buildWorldCanal" src` 是否**仍有 2 处**（`loadTraffic.js:7` 与 `:204`）？
   → **这是最容易删错的一处**，删掉了就没有水晶城运河。
3. `B6` 改完后，`?worldVersion=v8` 与 `?worldVersion=v9` 的截图是否与改动前**逐像素一致**？
4. 开发者菜单与 `shot-harness.html` 里**每一个** button 是否都点过一遍、零 console 报错？
5. 裸 URL 的画面是否与 8/31 截图一致？`__tm.FEATURES.worldVersion === "custom"`？

**任何一条答不上来或为否 → 打回，不许进 C。**

### CP-2（C1/C2 之后）· 视觉回归

1. 沿电车全线 + 飞行器绕星球一圈的**录屏**，确认无物体凭空消失/闪现。
   重点：送信人、船、电车、旧港、书店镇、合并城体。
2. 昼夜跑完整一轮，影子无「卡在原地」「跳变」「糊掉」。
3. 《测量记录表》第 7–9 行是否填了真实数字（不是估算）？
4. calls 是否**确实下降**？上升的条目是否已 revert？

### CP-3（C 阶段结束）· 硬门槛

1. **calls ≤ 1500 且 fps ≥ 40** —— 贴 `__tm.perfProbe.snapshot()` 原始输出。
2. C3 材质共享：是否有任何被共享的材质存在**写操作**
   （`mat.color.set` / `.opacity =` / `.map =`）？逐个列出并说明为何安全。
   → 重点查 `updateCitadelNightWindows`、`applyPlanetNightGrade`、`tickBirdSedation`。
3. C4 InstancedMesh：包围球是否算对？绕场景一圈是否有整片消失？

**未达门槛 → 不许进 D 和 E。**

### CP-4（E 阶段结束）· 季相正确性

1. `node tools/test_season_bands.mjs` 与 `test_no_calendar_coupling.mjs` 是否绿？
2. `?seasonBandsV1=0` 与 B 阶段结束时是否**逐像素一致**？
3. **站在 lat +45° 分界带的截图** —— 一屏内是否真的同时有两个季相？
   → 这是本阶段唯一不可替代的验收画面。
4. 开启季相后 `calls` 是否**未上升**？上升 = 染色破坏了材质共享，必须修。

### CP-5（F 阶段结束）· 架构

1. `node tools/test_architecture.mjs` 是否绿？贴输出。
2. `F2` 的 24 个文件是否**一次一个**移动？贴 `git log --oneline` 证明。
3. 删掉 F1 那 2350 行后，画面是否与 F1 之前**逐像素一致**？
   → 这些代码本来就不跑，**有差异就说明删错了**。

### CP-6（G 阶段结束）· 单一管线塌缩

1. `rg -n "worldVersion|planetPresentationVersion|officialPagePlanetFeatures|shotHarness|shot-harness" src *.html`
   是否**零命中**？贴实际输出。
2. `rg -n "lightingState" src` 是否**仍有** `lightingDirector.js` 的引用？
   `rg -n "makePanelDraggable" src` 是否**仍有 5 处**？
   → **这两个是 G1 最容易误删的模块**，删了会连带打挂小地图和三个编辑器面板。
3. **岛屿抬升三个值**（`highland: 0` / `saihoji: 3.2` / `bookshop: 3.2`）
   是否都迁进了 `WORLD.islandLift` 且消费点全部改完？
   苔庭与书店的高度截图是否与 G1 之前一致？
4. G1/G2 前后画面是否**逐像素一致**？（纯塌缩 + 删死码，有差异即塌错）
5. 按 F9 存出的 PNG 打开看过了吗？是**非空白**的吗？
6. `G3` 是否已获主人对 `G0` 的明确签字？未签字而做了 → **立即 revert**。

---

## 《检查点报告》模板

执行模型在每道检查点必须输出下面这份，**不许省略、不许写「应该没问题」**：

```markdown
# 检查点报告 CP-<N>
## 1. 本阶段完成的条目
- [x] B1  commit abc1234  calls 4723 → 4610
- [ ] B5  ⚠️ 假设失效：<实际情况>，已跳过

## 2. 命令原始输出（不许摘要，贴全）
$ rg -n "seasonWorldVersion" src tools *.html
<原样粘贴>

## 3. 测量记录表本阶段新增行
<粘贴表格行>

## 4. 我不确定的地方（必须至少写一条，写"没有"视为未认真检查）
- <具体到文件行号的疑问>

## 5. 我改动但清单里没写的东西
- <如果有，逐条列出并说明原因；没有则写"无">
```

> 第 4 项是刻意设计的：**逼模型暴露不确定性**。
> Flash 倾向于报告「一切正常」，这一项能把问题逼出来。

---

## 推荐分工

| 角色 | 模型 | 负责 |
|---|---|---|
| 执行 | **Gemini Flash** | 绿区 15 条 + 黄区 5 条（黄区改完必须进检查点） |
| 复核 | **GLM-5.3 / DeepSeek** | 五道检查点签字 |
| 决策 | **主人** | 红区 5 条 + 所有 `rm` + 季相配色表 |

**如果只能用 Flash 一个模型**：把五道检查点改成「Flash 自己开新对话、只带《检查点报告》模板和当前 diff 去复核」。
换新对话能避免它为自己的改动辩护 —— 效果比同一对话里自查好得多，但仍**明显弱于**换个更强的模型。
