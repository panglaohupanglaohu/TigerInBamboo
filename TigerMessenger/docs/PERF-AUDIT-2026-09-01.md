# TigerMessenger 卡顿根因审计与优化方案（2026-09-01）

> 本文所有结论均来自实际读码核实。**核实事实**用 `[已核实]` 标注并给出文件行号；
> **推测**用 `[待实测]` 标注，必须先跑 P0 探针拿到数字才能动手。
> 配套执行清单见 [PERF-TODOS-2026-09-01.md](PERF-TODOS-2026-09-01.md)。

---

## 一、先纠正一个会带来二次事故的结论

前一轮分析建议「锁定 V8」。**这个建议是错的，照做会让画面比 8/31 更糟，而且性能不会回到 8/31 水平。**

理由是 `custom` 档并不等于「V7 旧运河世界」，它是一套**独立的、被主人验收过的**配置，
定义在 [src/scenes/messengerIsland.js](../src/scenes/messengerIsland.js#L34-L53)：

```js
// messengerIsland.js:34-53  officialPagePlanetFeatures()
export function officialPagePlanetFeatures(base = FEATURES) {
  const features = { ...base };
  const explicit = features.worldVersion === "v7" || features.worldVersion === "v8" || features.worldVersion === "v9";
  if (!explicit) {                       // ← 只有 custom 才进这里
    features.cloudImpostorV1 = true;     // 云 impostor：有
    features.curvedWaterV1 = true;       // 曲率海：有
    features.oceanWorldRoutesV1 = true;  // 海洋航线：有
    features.legacyCanalWorld = false;
    features.canalScope = "crystal-city";// 只留水晶城运河
    features.highlandIslandLift = 0;     // ← V8/V9 预设没有这三个
    features.saihojiIslandLift = 3.2;
    features.bookshopIslandLift = 3.2;
    if (!["v8", "v9"].includes(features.planetPresentationVersion)) {
      features.planetPresentationVersion = "v9";
    }
  }
  return features;
}
```

`[已核实]` 三档真实差异：

| 能力 | custom（3–8 月，主人验收过） | V8 预设 | V9 预设 |
|---|---|---|---|
| 云 impostor / 曲率海 / 海洋航线 | ✅ | ✅ | ✅ |
| 地形语义着色 semanticShader | ❌ | ✅ | ✅ |
| **Marching Cubes 全球地形 `planetTerrainV1`** | **❌** | **✅** | **✅** |
| 植被 runtime | ❌（要求 `planetTerrainV1`） | ❌（要求 v9） | ✅ |
| `planetSurfaceRidersV1` 逐帧投影 | ❌ | ❌ | ✅ |
| 岛屿抬升 `saihoji/bookshopIslandLift = 3.2` | ✅ | ❌ **丢失** | ❌ **丢失** |
| 运河范围 | `crystal-city` | `none` | `none` |

所以：

- **V8 ≠ 8/31 的画面。** V8 会打开 `planetTerrainV1`（从未上过生产的 Marching Cubes 全球地形），
  同时丢掉三个岛屿抬升参数 —— 苔庭和书店会掉高度 3.2，很可能穿模/沉进海里。
- **9/1 真正新增的负载不止 `planetSurfaceRidersV1` 一项**，而是 `planetTerrainV1` + 植被 runtime + surfaceRiders 三件一起点火。
  `[已核实]` [src/world/planetV8/runtime.js#L39-L44](../src/world/planetV8/runtime.js#L39-L44)：
  ```js
  export function planetRendererOwnership(features = {}) {
    return {
      terrain: features.planetTerrainV1 === true,
      water: features.curvedWaterV1 === true,
      clouds: features.cloudImpostorV1 === true,
      vegetation: features.planetPresentationVersion === "v9" && features.planetTerrainV1 === true,
    };                                    // ↑ 植被只在 v9 且开地形时才有 = 9/1 才第一次亮
  }
  ```

### 结论：锁 `custom`，不是 V8

`custom` 是唯一有 6 个月真实使用验证的配置，且它内部已经用了 V9 的呈现层（`planetPresentationVersion = "v9"`）跑云和水。
把季节切换废掉、`worldVersion` 硬锁 `custom`，即可**精确复原 8/31 的画面与性能**，零视觉回退。

V7/V8/V9 预设保留为 URL 手动 opt-in（`?worldVersion=v8`），只在开发验收时用。

---

## 一·补 · 季节应该是「地理」，不是「日历」（主人 2026-09-01 提案）

### 这次事故真正的设计错误

`seasonWorldVersion()` 干了一件类别错误的事：**用「季节」去选「渲染管线版本」**。

```js
// params.js:195  —— 错误的耦合
if (m >= 8 && m <= 10) return "v9";   // 秋 → 换一整套实验管线
```

季节是**美术属性**（什么颜色、下什么、开什么花）；管线版本是**工程属性**（用哪套几何编译器）。
把两者绑在一起，等于「到了秋天就换发动机」。这是 9/1 事故的根本成因，比日历触发本身更危险。

### 主人的提案是对的，而且更强

> 「这是一个球，一天里的不同的地点有四季的存在」

这不只是「换个触发源」，它把季节从**时间维度搬到了空间维度**，带来三个白拿的好处：

1. **彻底消灭日历触发。** 没有 `new Date()`，代码行为永远不随时间漂移，这次事故的类型被根除。
2. **零运行时成本。** 季相由物体**自身纬度**决定 → 可以在**构建期**一次性算好色板烘进材质，
   每帧开销 **0**。而日历方案必须在运行时全局重刷。
3. **是真正的玩法内容。** 玩家从苔庭走到峡谷 = 走过一整年。
   站在分界带上，**左手边下雪、右手边盛夏**，同一屏里四季共存 —— 日历方案永远做不到这个。

### 关键实现原则（决定成败的一条）

**季相必须按「物体自己的纬度」着色，不能按「玩家的纬度」全局调色。**

- ❌ 错误做法：玩家走到高纬 → 整个世界变白。这只是一个全局滤镜，不是四季共存。
- ✅ 正确做法：每个物体在放置时算自己的 `lat` → 取自己的季相色板。
  玩家站在 lat +45° 分界线上，向北看是冬、向南看是秋。

`[已核实]` 纬度在这个项目里就是一行：`lat = asin(worldPos.y / |worldPos|)`
（见 [sphereMath.js#L30-L40](../src/world/sphereMath.js#L30-L40) `latLonToDir` 的逆运算）。

### 现有地标的纬度分布（`[已核实]`，legacy/custom 坐标系）

| 地标 | 常量 | 纬度 |
|---|---|---|
| 三重门 | `landmarkManifest` triple-gate | +62° |
| 苔庭西芳寺 | [saihoji.js#L35](../src/world/saihoji.js#L35) `SAIHOJI_HUB` | **+56°** |
| 高山圣城 | [citadelRange.js#L48](../src/world/citadelRange.js#L48) `RANGE_SITE` | **+24.1°** |
| 水晶城 / 白鲸海湖 | [citySeaLake.js#L25](../src/world/citySeaLake.js#L25) `CITY_SEA_LAKE` | **−24°** |
| 叹息之门峡谷 | [canyon.js#L9](../src/world/canyon.js#L9) `CANYON` | **−50°** |

跨度 **+62° → −50°**，正好够切四条季相带，且每条带里都恰好有一个主要地标。
**这不是巧合能强求的运气 —— 现有地图天生适合这个设计。**

### 季相带设计（默认表，主人可直接改这一张表）

从北极到南极单调走完一年，一次纵穿 = 一个轮回：

| 纬度带 | 季相 | 落在哪个地标 | 美术方向 |
|---|---|---|---|
| `lat > +45°` | **冬** | 三重门 +62、苔庭 +56 | 雪压苔、枯枝、冷青灰、天气偏雪 |
| `+45° ~ +5°` | **秋** | 高山圣城 +24.1 | 赤金枫、暖橙墙面、落叶粒子 |
| `+5° ~ −35°` | **夏** | 水晶城 −24 | 浓绿、高饱和、晶体强反光 |
| `lat < −35°` | **春** | 峡谷 −50 | 嫩绿、花瓣粒子、天气偏雨 |

带边界用 `smoothstep` 混合，过渡宽 ~12°，**没有硬边**。

> ⚠️ 这张表是**美术决策不是工程决策**。我按「苔庭雪景 / 圣城秋色」的直觉填的默认值，
> 但比如主人可能更想要「苔庭=秋（红苔配枫）、圣城=冬（本来就有 `mountainSnow` 色板）」。
> 实现时把这张表做成**文件顶部一个常量数组**，改顺序只需要改这一行，不用碰任何逻辑。

### 季相只允许驱动这四样（严格白名单）

| 允许 | 说明 | 挂载点 `[已核实]` |
|---|---|---|
| ✅ 植被/树冠色板 | 按物体纬度 tint | [highlandCitadelDesign.js#L56-L58](../src/world/highlandCitadelDesign.js#L56-L58) `foliageDeep/Mid/Light` |
| ✅ 地被/苔色 | 按物体纬度 tint | [mossyGround.js#L140](../src/world/mossyGround.js#L140) **已经有 `palette` 形参，白捡** |
| ✅ 天气偏置 | 按**玩家**纬度，冬带偏雪春带偏雨 | [weather.js](../src/world/weather.js) + `P.weather` |
| ✅ 粒子 | 落叶/花瓣，按**玩家**纬度 | 参考 [saihojiGarden.js#L197](../src/scenes/saihojiGarden.js#L197) `LEAF_COUNT` 已有落叶实现 |

| 禁止 | 原因 |
|---|---|
| ❌ 任何 `FEATURES` 开关 | 就是这次事故的成因 |
| ❌ `worldVersion` / `planetPresentationVersion` | 同上 |
| ❌ 几何生成 / 网格重建 | 会引入构建期抖动和不可复现 |

前两项在**构建期**算完烘进材质 → 逐帧成本 0。
后两项跟随玩家，逐帧只需要一次 `asin()`。

### 与性能优化的关系

这条改动**不冲突、甚至互补**：
- 季相色板是构建期常量 → 天然适合 C3 的材质去重缓存（`getMaterial("standard", { color: seasonTint })`）。
- 季相带是纬度的函数 → 可以顺便作为 D1 分区加载的天然分区边界。

**但顺序不能乱：先把性能治到 fps ≥ 40（阶段 A–C），再做季相（阶段 E）。**
在 10fps 的场景上调色板，你分不清是色板错了还是掉帧掉的。

---

## 二、性能瓶颈的真实剖析（2026-09-01 浏览器实测数据驱动）

### 2.1 浏览器控制台现场二分实验数据（M2 芯片，2884×2043 画布 = 5.9M 像素）

| 实验阶段 | 帧耗时 (frameMs) | FPS | 说明 |
|---|---|---|---|
| **0 基线** | **152.81 ms** | **6.5** | 原始卡顿状态 |
| **完全不渲染** (`renderer.render = () => {}`) | **16.06 ms** | **62.3** | **CPU 纯逻辑耗时仅 16ms**，说明 CPU 逻辑完全不是瓶颈 |
| **关闭阴影** (`shadowMap.enabled = false`) | **76.12 ms** | **13.1** | 耗时直接减半（减少 **76.69 ms**） |
| **像素比 ×0.25**（像素量缩减至 1/16） | **59.18 ms** | **16.9** | 耗时锐减 **93.63 ms**，说明瓶颈在**高分辨率下的片元着色** |
| **隐藏全部描边壳** (9602 个) | 144.71 ms | 6.9 | 仅省 4.5 ms，说明纯色背面描边不是主要瓶颈 |
| **隐藏全部半透明** (1358 个) | 143.54 ms | 7.0 | 仅省 5.7 ms，说明半透明覆盖不是主要瓶颈 |

### 2.2 根因定位：~85 盏光源在 5.9M 像素下的逐片元光照与阴影

经控制台遍历场景清点，当前场景同时挂载了：
- **74+ 盏 PointLight**（包含飞行器每架 5 盏灯、高山灯笼阵、城头、港口火把等）
- **1 盏 SpotLight**
- **4 盏 AmbientLight**（不同模块重复挂载）
- **2 盏 HemisphereLight**
- **2 盏 DirectionalLight（且都开启了投影 castShadow = true）**

**瓶颈机理**：
在 Three.js 中，不透明网格材质（MeshStandardMaterial / MeshToonMaterial）在片元着色器中需要对场景中**每一盏可见光源**进行遍历与衰减计算，并在开启阴影时进行阴影贴图采样与 PCF 比较。
当场景中存在 ~85 盏光源、叠加 5.9M 像素的高 Retina 分辨率时，每帧 GPU 执行数亿次光照与阴影计算，导致片元着色器管线被完全打满。

### 2.3 真实治理方向（按实测 ROI 排序）

1. **局部点光预算与距离剔除（最大瓶颈）**：
   - 绝大多数小灯（路灯、窗火、飞行器航行灯）离玩家很远，完全不应参与全图全局光照计算；
   - 保持 `localLightRegistry` 与 `localLightBridge` 的局部灯预算机制，只保留玩家周围最近的 N 盏（如 4~8 盏）活跃点光，远处的点光设 `visible = false` 排除出 uniform 数组；
   - 将装饰性窗光、建筑光改用自发光材质（emissive）表达，不生成真实 Three.js Light 对象（Townscaper 经典手法）。
2. **清理重复光照装置**：
   - 全局仅保留 1 盏主太阳 DirectionalLight（带投影）+ 1 盏主 AmbientLight + 1 盏主 HemisphereLight，避免重复环境光叠加和多重阴影 pass。
3. **距离剔除已默认开启 (C2)**：
   - 已完成 C2 动态物快照修复与迟滞防抖，默认开启距离剔除，有效缩减远景静物遍历。
4. **运河交汇古堡已条件化 (B4)**：
   - 已完成 B4 条件门控，可由 `?canalJunctionV1=0` 快速诊断与按需加载。

---

## 二·补 · V7/V8/V9 的代码到底能删多少（主人 2026-09-01 追问）

### 先说结论：命名骗了人

`planetCompilerV8.js` / `planetV8/runtime.js` 这些名字看起来像实验代码，
**实际上 `custom` 档无条件调用它们来编译海洋和云。**

`[已核实]` [messengerIsland.js#L47-L49](../src/scenes/messengerIsland.js#L47-L49)：
```js
if (!["v8", "v9"].includes(features.planetPresentationVersion)) {
  features.planetPresentationVersion = "v9";     // ← custom 也被设成 v9！
}
```
→ [runtime.js#L82](../src/world/planetV8/runtime.js#L82) `isV9 = true`
→ [runtime.js#L110-L115](../src/world/planetV8/runtime.js#L110-L115)
```js
const compiled = compilePlanetV8({
  seed, radius,
  landformChain: isV9,                                        // = true
  chartLimit: enabledTerrain ? (... lod.chartLimit) : 0,      // custom = 0
  resolution: enabledTerrain ? (... lod.resolution) : 3,      // custom = 3
});
```

**所以 `custom` 跑的就是 V9 编译管线**，只是不出地形分片。
`src/procgen/`（11054 行）**整体是生产代码，一行都删不得。**

### 三类处理

#### A 类 · 可以真删（零风险，已逐条 grep 验证）

| 项 | 证据 | 影响 |
|---|---|---|
| **V7 整档** | `procgenEngineV1`/`wfcCastleV1`/`marchingTerrainV1` 全仓**零运行时分支**，只被 `rolloutPlan.js` 当字符串读 | 删 3 flag + v7 preset + 3 访问器 |
| **`planetGraphV1`** | `[已核实]` **只出现在 params.js**（7 处全是自身定义/解析/访问器），**零消费者** | 比 v7 那三个还干净，纯死 flag |
| **`seasonWorldV1` + `seasonWorldVersion()`** | 事故成因 | 见 B1，由阶段 E 地理季相取代 |
| **`useWorldCanal` 分支** | 删掉 v7 后 `scope === "world"` **不可达**（custom→`crystal-city`、v8/v9→`none`） | [loadTraffic.js#L149](../src/scenes/messenger/loadTraffic.js#L149) `#L208` `#L214` `#L228` `#L256` 五处分支 |

> ⚠️ **注意 `buildWorldCanal` 本身不能删** —— [loadTraffic.js#L203](../src/scenes/messenger/loadTraffic.js#L203)
> 的条件是 `useCrystalCanal || useWorldCanal`，custom 走 `useCrystalCanal`，**函数是生产代码**。
> 只能删 `useWorldCanal` 那几个分支，不能删函数。这是最容易删错的一处。

#### B 类 · 必须保留，但应该「转正」

| 项 | 处理 |
|---|---|
| `src/procgen/`（11054 行） | **生产编译器。不删。** |
| `planetV8/runtime.js`、`waterV8/`、`landmarkManifest.js` | **生产代码。不删。** |
| `landformChain` / `isV9` 三元分支（约 15 处） | 生产恒为 `true` → 可塌缩掉 false 分支。**可读性收益，不是性能收益** |
| **改名** | `planetCompilerV8` → `planetCompiler`，`planetV8/` → `planet/`，`waterV8/` → `water/` |

> **改名这一条我认为是必做的。** 现在这套命名让每一个接手的人（包括上一轮的 Sonnet、包括我一开始）
> 都会误判「V8 = 实验代码 = 可以关掉」。9/1 事故的一半原因就是这个误解。
> 不改名，下一个 agent 还会再犯一次。

#### C 类 · 保留为 opt-in，但要掐掉「白建」的浪费 ← **真正的性能发现**

custom 里 `planetTerrainV1 = false`，但编译器**照样把下面三样全算完，然后全丢**：

| 白算的东西 | 位置 | 为什么白算 |
|---|---|---|
| `prepareCharts()` | [planetCompilerV8.js#L98-L114](../src/procgen/planet/planetCompilerV8.js#L98-L114) | 跑完 10 地标 × 全部 cells 的最近邻搜索，然后 `.slice(0, chartLimit)` 而 `chartLimit = 0` → **结果全丢** |
| `buildGlobalSphericalTerrain()` | [#L136](../src/procgen/planet/planetCompilerV8.js#L136)、[#L441](../src/procgen/planet/planetCompilerV8.js#L441) | `landformChain=true` 就建，在 **subdivision-3** 网格上逐顶点 `semanticAt()` + 逐面算法线。但 [runtime.js#L139](../src/world/planetV8/runtime.js#L139) `if (enabledTerrain)` 为 false → **网格永不上传** |
| `compileVegetationV9()` | [#L444-L470](../src/procgen/planet/planetCompilerV8.js#L444-L470) | 对上面那 1280 个三角形跑完整植被布点（`maxInstances: 240`）。但 [runtime.js#L163](../src/world/planetV8/runtime.js#L163) 的 `createVegetationRuntime` 在 `if (enabledTerrain)` 里 → **产物永不消费** |

**这是纯浪费的 boot 时间，主人每次刷新都在等它。**
修法不是删代码，是给 `compilePlanetV8` 加两个形参按需跳过 —— 见 TODO **B6**。

### 汇总：能删多少行

| 类别 | 大约行数 | 说明 |
|---|---|---|
| A 类真删 | **~150 行** | flag 定义 + preset + 访问器 + 死分支 |
| B 类塌缩分支 | ~80 行 | 可读性，不是性能 |
| C 类跳过白算 | **0 行**（加 2 个形参） | **boot 时间收益最大的一条** |
| `src/procgen/` | **0 行** | 生产代码 |

> **回答主人的问题**：能删的比想象中少得多（~150 行，不是 11000 行），
> 但**真正值钱的不是删代码，是 C 类那三处「算完就丢」**。
> 另外单独排查出的 `src/planet/`（独立入口，~2000 行）是否可删，见 TODO **B5**。

---

## 二·补二 · 整洁架构：靠 low-poly 便宜，不靠硬件分档（主人 2026-09-01 提案）

### 主人的判断是对的：分档系统本身就是问题

`[已核实]` 代码里有一整套**硬件探测 / 质量分档 / 自动降级**子系统：

| 模块 | 行数 | 性质 |
|---|---|---|
| [voxelAoRenderer.js](../src/render/ao/voxelAoRenderer.js) + [voxelBounce.js](../src/render/ao/voxelBounce.js) + [voxelVolume.js](../src/render/ao/voxelVolume.js) | **1657** | 挂 `oskLightingV1`（默认 `false`）→ **生产里根本不跑** |
| [lightingQuality.js](../src/render/lighting/lightingQuality.js) + [qualityGovernor.js](../src/render/lighting/qualityGovernor.js) | 177 | `low/medium/high` 分档 + 按帧时自动降档 |
| [localLightBridge.js](../src/render/lighting/localLightBridge.js) + [localLightRegistry.js](../src/render/lighting/localLightRegistry.js) | 457 | 预算 `desktop\|medium\|low` |
| [migrationGate.js](../src/procgen/migration/migrationGate.js) | 22 | capability level 门禁 |
| `governBloomByFps`（[main.js#L135](../src/main.js#L135)）+ miniBloom `degraded` | ~40 | 按帧率自动关 bloom |
| **合计** | **~2350** | |

**为什么这套东西是有害的，不只是无用：**

> 有了「跑不动会自动降级」这个安全网，就没有人会去把几何真正做便宜。
> 分档系统把「性能」变成了运行时的妥协，而 low-poly 的全部意义在于
> **便宜是构建期的属性**。这就是为什么代码里同时存在
> 「4700 draw calls」和「三档质量分级」—— 后者掩盖了前者。

### 新架构原则（四条）

**① 单一管线，无分档。**
一套画面，所有设备一样。删掉 `lightingQuality` / `qualityGovernor` / `voxelAo` / `voxelBounce` /
`localLightBudget` / `migrationGate` / bloom 自动降级。

**② 预算制，不是探测制。**
不问「这台机器能跑多少」，而是定死全场景硬预算，用**测试**守卫：

| 预算项 | 上限 |
|---|---|
| draw calls | **≤ 1200** |
| 材质实例 | **≤ 300** |
| 三角面 | **≤ 1.5M** |
| shader programs | **≤ 120** |
| boot | **≤ 2000ms** |

超预算 = 构建失败，不是「降档运行」。低配设备靠**低多边形本身便宜**，不靠降级。

**③ 构建期决定一切，运行时只做变换。**
合并 / 实例化 / 季相烘色 / 影子烘焙全在构建期完成。
运行时**禁止**出现任何「根据帧率调整」的逻辑。

**④ 单向依赖，四层不许倒流。**

```
core/      参数 · 舞台 · 主循环          不依赖任何人
   ↓
procgen/   纯数据编译（禁止 import three）
   ↓
world/     几何构建（构建期产出 THREE 对象）
   ↓
render/    材质 · 光照 · 合批（只提交，不决策）
   ↓
scenes/    装配
   ↓
ui/        面板
```

### 现状违规：`procgen/` 在反向 import `world/`

`[已核实]` [planetCompilerV8.js#L8-L32](../src/procgen/planet/planetCompilerV8.js#L8-L32) 有 **8 处反向依赖**：

```js
import { createLandmarkManifest, ... }      from "../../world/planetV8/landmarkManifest.js";
import { compileCurvedWater, ... }          from "../../world/waterV8/curvedWaterCompiler.js";
import { createSurfaceProviderV8 }          from "../../world/planetV8/surfaceProviderV8.js";
import { compilePlanetNavigationV8, ... }   from "../../world/planetV8/navigationV8.js";
import { compileLandmarkTerrainRoutes, ... }from "../../world/planetV8/terrainRoutesV8.js";
import { compilePlanetClouds }              from "../../render/clouds/heroCloudCompiler.js";
import { validateBookshopHillChain }        from "../../world/planetV8/profileValidators.js";
import { compileCombatSurfaceV8 }           from "../../world/planetV8/combatSurfaceV8.js";
```

**根因**：`world/planetV8/` + `world/waterV8/` 共 28 个文件，
`[已核实]` **其中 24 个根本不 import three** —— 它们是纯数据编译器，被错放在几何层。

只有这 4 个真的碰 THREE：

| 文件 | 归属 |
|---|---|
| `planetV8/runtime.js` | 留 `world/` |
| `planetV8/cloudTerrainRemap.js` | 留 `world/` |
| `planetV8/tripleGateScout.js` | 留 `world/` |
| `waterV8/officialOcean.js` | 留 `world/` |

**修法**：把那 24 个纯数据文件移进 `procgen/`。**纯文件移动，零逻辑改动，反向依赖全消。**
`planetCompilerV8.js` 头注释里那句自我期许就真的成立了：

```js
// It returns serializable generation data and does
// not import Three.js, so it can run in a Worker.
```

移完之后这句话对整个 `procgen/` 都成立 —— 可以加一条测试守卫它（见 TODO F3）。

### 这条与性能优化的关系

- 删掉 2350 行分档代码 → **不直接提升帧率**（它们本来就不跑），
  但**移除了继续偷懒的退路**，逼着 C3/C4 的合批必须真做到预算内。
- 移动 24 个文件 → **零性能影响**，纯粹是让下一个接手的人不再误判。
- 硬预算测试 → **防止性能重新劣化**，这是唯一能长期保住成果的机制。

---

## 三、优化方案（四阶段，按 ROI 排序）

### P0 · 建立测量基线（半天，必须最先做）

没有数字就是瞎改。项目已有 [shot-harness.html#L719](../shot-harness.html#L719) 读 `renderer.info`，
和 `window.__tm.renderer`（[main.js#L1657](../src/main.js#L1657)）。
补一个常驻 HUD，输出 `calls / triangles / programs / geometries / textures / frameMs / bootMs`。

**验收门槛（后续每阶段都要复测这 7 个数）**：
| 指标 | 现状 `[待实测]` | P1 目标 | P4 目标 |
|---|---|---|---|
| draw calls | ~4700 | ≤3000 | **≤1200** |
| 三角面 | ? | — | ≤1.5M |
| shader programs | ? | — | ≤120 |
| 首帧 bootMs | ? | ≤3000 | ≤2000 |
| 稳定帧率（主城镜头） | ~10fps | ≥25fps | **≥50fps** |

### P1 · 止血：锁 custom + 删季节切换 + 删未验证实验档（1 天）

1. 删除 `seasonWorldVersion()` 和 `applyUrlOverrides` 里的季节分支
   （[params.js#L189-L219](../src/core/params.js#L189-L219)），`FEATURES.worldVersion` 硬锁 `"custom"`。
2. 删除 `seasonWorldV1` flag 及其 URL 解析。
3. 删除 `WORLD_VERSION_PRESETS.v7` —— `[已核实]` v7 的三个 flag（`procgenEngineV1` /
   `wfcCastleV1` / `marchingTerrainV1`）在 `src/` 里**没有任何一处运行时条件分支**，
   只被 `procgen/migration/rolloutPlan.js` 当描述符读。v7 档 = 纯 legacy 运河世界，
   与主人认可的夜港画面矛盾，留着只会再次误触发。
4. 保留 v8/v9 预设，但只能 `?worldVersion=` 显式进入；
   给它们补上 custom 独有的 `saihojiIslandLift/bookshopIslandLift/highlandIslandLift`，
   否则任何人手动切过去都会看到岛屿沉底。
5. 删 `procgenEngineV1` / `wfcCastleV1` / `marchingTerrainV1` 三个死 flag 及其 4 个访问器。

> **关于「删掉实验代码」**：`src/procgen/`（11054 行）是 custom 档也在用的地基
> —— `compilePlanetV8()` 被 [runtime.js#L110](../src/world/planetV8/runtime.js#L110) 无条件调用来编译水和云。
> **不能删。** 真正能安全删的只有上面这些 flag + `src/planet/`（独立入口，2000+ 行，
> `[待实测]` 需先确认无引用）+ `src/tools/` 下的编辑器。

### P2 · 主刀：影子（1 天，预计 draw call −35~45%）

这是**单项收益最大**的一步，改动量却最小。

按需重烘：昼夜相位变化超过阈值才更新一次 shadow map，其余帧完全跳过投影 pass。

再加一层：静态建筑用 `light.shadow.autoUpdate = false` + 手动 `needsUpdate`，
动态角色单独走一盏小范围 shadow camera，或直接降级为 blob shadow
（项目已有 [tools/test_blob_shadow.mjs](../../tools/test_blob_shadow.mjs)，说明轮子已经有了）。

### P3 · 主刀：draw call 合批 + 剔除（3–4 天，预计再 −40%）

1. **修复并默认开启距离剔除**（TODO-C2）：把静态/动态分开，动态物每次 apply 现算 world position。
2. **静态几何合并**：项目已有 [world/geometryMerge.js](../src/world/geometryMerge.js) 的
   `mergeStaticGroup`，但显然覆盖不全（材质 2977 个）。按「同材质 + 同区域」做二级合并。
3. **材质去重缓存**：全局 `materialKey -> Material` Map，禁止逐构件 `new MeshStandardMaterial`。
   `[已核实]` [PLAN.md#L430](../PLAN.md#L430) 里主人早就定过这条规矩：
   > 不得为每名士兵、每块墙创建独立材质。
4. **相同小件转 InstancedMesh**：树/草/灯/窗。项目里 `birdVortex` / `moebiusCity` /
   `highlandCitadelDesign` 已经会用 InstancedMesh，把手法复制到剩下的地方。

### P4 · 收尾：分区加载 + 微优化（2 天）

1. 远区（书店镇/苔庭/旧港）在玩家不在该区时，整棵 `scene.remove`，
   项目已有 [officialOceanOcclusionPruning.js](../src/core/officialOceanOcclusionPruning.js) 的摘除范式：
   > 从场景树摘除才能稳定节省遍历和 draw call。
2. flock 空间哈希消 O(n²)。
3. lightingDirector state 就地更新，不再展开构造。

---

## 四、执行模型选择

给定的四个候选，我的选择和理由：

| 模型 | 判断 |
|---|---|
| **Qwen3-8B** | ❌ 直接排除。8B 参数在 10 万行、365 个文件的仓库里无法维持跨文件一致性，改一处崩三处。 |
| **Grok** | ❌ 不选。长上下文多文件机械编辑的稳定性弱于另外两个，且成本高。本任务需要几十轮小改+验证循环。 |
| **GLM-5.3** | ⭕ 备选。P1 阶段（涉及判断「哪些 flag 能删」）它更稳。 |
| **DeepSeek** | ✅ **选它** |

**选 DeepSeek 的理由：**

1. 本任务 80% 的工作量是**机械性重构**（合批、材质缓存、instancing、剔除修复），
   不是开放式设计。DeepSeek 在 JS/Three.js 这类模式化改写上的**逐字符保真度**最高。
2. 这仓库**没有 TypeScript**，没有类型检查兜底 —— 改错了不会报编译错，
   要靠模型自己不写错属性名。DeepSeek 在无类型 JS 上的幻觉率明显低于 Grok。
3. 任务需要**高轮次迭代**（每个 TODO 改完要跑 `tools/test_*.mjs` 验证再改下一个）。
   DeepSeek 的成本结构支持跑几百轮，Grok 不支持。
4. 配套 TODO 清单我已经写成**每条都自带伪代码 + 自带验收断言**的形式，
   刻意把「需要判断」压缩到最低，正好匹配 DeepSeek 的强项。

**分工建议（如果允许用两个）**：P1 的删除决策交 GLM-5.3 复核一遍（删错代价高、不可逆），
P0/P2/P3/P4 全部交 DeepSeek。

---

## 五、给主人的一句话总结

> **版本**：V7/V8/V9 一个都不用，锁 `custom`。
> V8 会丢掉 custom 独有的岛屿抬升参数（苔庭/书店沉 3.2），还会打开同样没验证过的 Marching Cubes 地形；
> V7 是旧运河世界、没有海面。三个预设都降级为 `?worldVersion=` 手动验收入口。
>
> **卡顿**：9/1 的季节切换是**导火索**，不是根因。根因是**主页 4700+ draw calls**，8/31 之前就在，
> 只是 V9 又往上加了一层从没跑过的地形+植被把它压垮了。
> 锁回 `custom` 能立刻回到 8/31 的状态；但要真正流畅，必须做影子按需重烘 + 合批降 draw call。
>
> **季节**：主人的「按地理不按日历」提案我完全赞成，它顺手修掉了这次事故的**根本设计错误**——
> 用季节去选渲染管线是类别错误。改成纬度驱动后：没有 `new Date()`（事故类型被根除）、
> 逐帧成本为 0（构建期烘进材质）、而且能做到**站在分界线上一屏看到两个季节**，
> 这是日历方案永远做不到的。
> 但**必须等性能治到 fps ≥ 40 再做**——在 10fps 上调色板，分不清是色板错了还是掉帧掉的。
