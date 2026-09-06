# 球形世界架构：场—区—元—约束（2026-09-05）

> 主人 2026-09-05 定的方向：**WFC 必须是 Terrain System 的一个子系统，不是星球生成器**。
> 同时把 `messenger` / `saihoji` 从「两个场景」升级成「星球—区域—地标—景区」四级空间结构。
>
> 本文只记**已实现的**和**已钉死的边界**。没做的一律标注「未实现」，别当已有能力用。

---

## 0 · 一句话

```
Global field → Regional grammar → Local synthesis → Gameplay constraint
   全局场            区域语法            局部合成            玩法约束
```

中文叫「**场—区—元—约束**」地形生成架构。

**WFC 只住在第三层。** 它上面必须有「区域」和「地形语法」，下面必须有「玩法校验」。

---

## 1 · 六层管线（目标态）

```
Planet Field          球面高度 / 气候 / 大陆场 —— 连续函数，无 WFC
      ↓
Region Generator      按场划分区域边界，决定这块地「是什么」
      ↓
Terrain Grammar       区域内的地形语言：平原→丘陵→峡谷→山口→山脊
      ↓
Semantic WFC          在语法允许的位置做局部合成（模块选型 / 角柱 / 城镇）
      ↓
Gameplay Validation   可走性、路径连通、载具净空、keepout
      ↓
Detail Generation     植被 / 建筑 / 道具
```

### 明令禁止的反面模式

```
Planet → WFC → 所有地形          ❌
```

**禁止理由是可控性，不是性能。** WFC 的输出由 socket 相容性决定；在星球尺度上没有任何人
能预测「峡谷会不会正好切断电车轨道」。约束必须由**上层的语法**（什么地形能挨着什么）
和**下层的校验**（轨道净空、路径连通）提供，而不是指望求解器自己长出分寸。

这条在本仓库有前科可循：C5 阶段实测 V6 目录两两相容率 **74.9%**（水平 87.1%），
「100 seed 零矛盾」当时被当成约束好，实际是**约束太弱**——求解器几乎从不缩小域。
星球尺度铺开只会把这个问题放大。

### 当前各层实现状态

| 层 | 状态 | 落点 |
| --- | --- | --- |
| Planet Field | **部分** | `world/planet.js` 球壳；`hills.js` 的 `groundLiftAt(x, z)` 高度场；`canyon.js` 的 `canyonOffsetDir(dir)` 峡谷场。**无气候场、无大陆场** |
| Region Generator | **本次新增，仅数据层** | `world/worldStructure.js` 声明式区域表。**无按场自动划界** |
| Terrain Grammar | **未实现** | 见 §4 |
| Semantic WFC | **已有，且位置正确** | `citadel/wfcTownSelection.js` + `wfcTownWiring.js`，只决定圣城格子的体块角色（gable / hip / cone / terrace / flat / garden）。开关 `P.wfcTownV1` 默认关。**不需要搬动** |
| Gameplay Validation | **部分，且分散** | `hills.js` 的 `carveHillsForTrack`（轨道压平丘陵）、`nature.js` 的 `settleBuriedAssets`（埋物抬回地表）、`planetV8/landmarkManifest.js` 的 `keepouts` / `routeAnchors` / `waterNeeds`。**尚未收敛成一层** |
| Detail Generation | **已有** | `nature.js`、`citadel/decoratePass.js`（C8 装饰 pass） |

---

## 2 · 四级空间结构（本次实现）

```
Planet
├── Region（静态）
│   └── Landmark
│       └── Zone（景区）
└── Region（移动）
    └── ...
```

Messenger **不再等于「一个岛」**，而是整个世界的起始文明区域；
Saihoji **不再是一个普通 SceneModule**，而是球形世界中的移动型特殊区域。

### 区域表

| region | 名字 | kind | 成员地标 |
| --- | --- | --- | --- |
| `coast-civil` | 文明海岸带 | static | camp · bookshop · harbor · city · lake |
| `highland-sanctum` | 山地圣域 | static | gate · citadel |
| `lake-wetland` | 湖泊湿地生态区 | static | moon |
| `far-nature` | 远方自然世界 | static | **空（预留）**：山脉 / 河流 / 森林 / 草原 / 沙漠 / 极地 |
| `saihoji` | 西芳寺苔庭 | **mobile** | saihoji → 六景 |

### `kind: "mobile"` 与惰性求值的因果

`mobile` 是这套结构的关键一笔，它的存在只有一个理由：

**西芳寺骑在太古浮岛白鲸上，位置每帧都在变。**

所以区域与地标的位置**一律惰性求值**（`getDir()` 函数），**禁止存快照**——
存了就会在鲸游走之后指错方向，而且这种错不会报错，只会让导航悄悄骗人。

这也让世界有了静态/动态之分：

```
Planet
├── Static Regions    文明 / 山地 / 湖沼 / 远方自然
└── Dynamic Regions   Leviathan → Saihoji
```

### 地标分级

| tier | 含义 | 成员 |
| --- | --- | --- |
| 0 `WORLD` | 从整个球体尺度就该看见 | camp · harbor · city · citadel · saihoji |
| 1 `REGION` | 进入所属区域后才出现 | bookshop · moon · gate · lake |
| 2 `LOCAL` | 进入该地标内部才出现 | 六景：moss-entry · master-stones · dry-cascade · moss-islands · empty-court · return-view |

**为什么必须分级**：不分级的话 HUD 会同时列出「水晶城 / 高山圣城 / 旧港 / 叹息之门 /
主石之庭 / 枯瀑之庭 / 苔海岛群 / 空庭 …」，玩家分不出哪个是大陆级、哪个是一块石头。
**六景是 Local POI，不是 Planetary POI。**

### 可见性规则

```
可见 = Tier0（恒显）
     ∪ Tier1（玩家所在 region）
     ∪ Tier2（玩家所在 local landmark）
```

判定见 `locateWorldContext()`：按球面角距取最近的 Tier0/1 地标 → 得 `regionId`；
再看是否落进某个 Tier2 景区的角半径 → 得 `localId`。

于是导航变成三级：

```
Planet Navigation → World Landmark
       ↓
Region Navigation → Regional Landmark
       ↓
Local Navigation  → Local POI
```

---

## 3 · 为什么这是「加层」而不是「重写」

现有代码**语义一行没动**：

| 不变的东西 | 位置 |
| --- | --- |
| SceneModule 契约 `{ id, name, load(ctx) }` | `scenes/sceneApi.js` |
| `loadScenes(ids, ctx) → SceneHandle[]` | `scenes/registry.js` |
| `messenger.landmarks.*`（约 20 键） | `scenes/messengerIsland.js` |
| `saihoji.landmarks.zones[*]` | `scenes/saihojiGarden.js` |

新增的 `worldStructure.js` 只做两件事：**声明层级** + **把层级绑定到活的 scene handle**。
它不持有几何、不进 scene graph、**不 import Three.js**（所以能在 headless 下测）。

```
worldStructure.js  声明：region coast-civil 含 camp
        ↓ 绑定（惰性 getDir）
messengerIsland.js 实体：landmarks.camp.landmarks.anchor.position
```

---

## 4 · 下一刀：Terrain Grammar（**未实现**）

`gate → citadel` 这条垂直探索线最适合先做语法。主人给的序列本身就是一条产生式：

```
平原 → 丘陵 → 峡谷 → 山口 → 叹息之门 → 高山道路 → 高山圣城
```

建议形态（**还没写，别当已有**）：

```js
{ from: "plain",  to: "hill",    maxSlope: ..,  minRun: .. }
{ from: "hill",   to: "canyon",  requires: "water-carve" }
{ from: "canyon", to: "pass",    mustContain: "gate" }      // 地标进语法
{ from: "pass",   to: "ridge",   monotonicRise: true }
{ from: "ridge",  to: "citadel", mustContain: "citadel" }
```

分工：**语法**负责「什么地形能挨着什么地形」，**WFC** 负责「这一格具体长什么样」。

地标以 `mustContain` 的形式**进语法，而不是事后摆放**——这正是
`planetV8/landmarkManifest.js` 已经在表达的东西（每个地标都有
`direction / angularRadius / forward / profile / routeAnchors / keepouts / waterNeeds`），
语法层不必从零造，直接接。

---

## 5 · 验收

```bash
node tools/test_world_structure.mjs
```

守 **8 项结构不变量**（刻意不写会因合法调整而红的数值——改配色、改区域名、
往 `far-nature` 里填地标都不该误红）：

1. 每个 Tier0/1 地标属于**恰好一个** region，且「声明的 region」与「被哪个
   region.members 收录」两处必须一致；地标 id 全局唯一
2. 六景 id/name/radius **完全跟随 `SAIHOJI_ZONES`**（含顺序）。
   另加一条契约锁：六景是固定的文化集合（入口苔径/主石之庭/枯瀑之庭/苔海岛群/
   空庭/回望石组），少一景就红——**光靠「派生 == 真源」抓不到丢景**，
   因为两边同源、删一景会一起变
3. mobile 区域**惰性**：`saihoji` 标为 mobile，`getDir` 必须是函数且跟随 handle
   变化（用可变 stub 验证，返回缓存常量即红）
4. 可见性规则：星球尺度只见 5 个 Tier0；进 `coast-civil` 补出 bookshop/lake 且
   **不得**出现山地圣域的 gate、不得出现六景；进苔庭补出 6 景
5. 绑定容错：`resolveWorldLandmarks({})` 不抛、`getDir` 全 null；
   `?scene=saihoji` 单独加载（messenger 为空）时六景仍可取向
6. 角距自洽：同向 0、正交 π/2、取不到方向为 `Infinity` 而非 `NaN`、零向量为 `Infinity`
7. `far-nature` 保留为空壳（填了地标要同步更新本文档 §6）
8. 生产接线：`main.js` 不得再手写平铺地标（连中文名都不许出现第二份），
   必须走 `resolveWorldLandmarks` / `locateWorldContext` / `visibleLandmarks`；
   `minimap.js` 必须支持可变可见集与图例重建

### 已交付（2026-09-05）

| 文件 | 变化 |
| --- | --- |
| `src/world/worldStructure.js` | **新增**。声明 + 绑定 + 定位 + 可见性，不 import Three.js |
| `tools/test_world_structure.mjs` | **新增**。8 项全绿 |
| `src/ui/minimap.js` | 新增可选 `getVisible`；图例从「构造时定死」改为按可见 id 集合重建；5 处遍历改走当前可见集 |
| `src/main.js` | 删掉手写的 9 项地标数组，改为 `resolveWorldLandmarks` + `getVisible`；`?v=` 标签按 §1.1 处理 |

回归：门 A（无主 0 / 有主 **95,396 tris**，与改动前逐位一致）、门 D（0/0）、
`test_odyssey_citadel`、`test_shot_harness_runtime`、`test_town_grid`、
`test_corner_assembly`、`test_editor_palette_parity`、`test_palette_panel_parity` 全绿。

**尚未人工看画面**：三级导航的进出手感（Tier1 在 `regionEnterRad = 0.55 rad`
处切换、Tier2 在 `localEnterRad = 0.06 rad` 处切换）这两个阈值是拍的，
需要主人实走一遍确认切换时机，不是脚本能判的事。

---

## 6 · 已知缺口（**别当已实现**）

- **区域边界是声明的，不是按场算出来的。** `locateWorldContext` 用「最近地标」近似，
  区域之间没有真边界。要真边界得等 Region Generator。
- **没有气候场 / 大陆场。** 方案图里的 Continental Field / Climate Field 尚无一行代码。
- **Gameplay Validation 没有收敛成一层**，仍分散在 `carveHillsForTrack`、
  `settleBuriedAssets`、manifest 的 `keepouts` 三处。
- **`far-nature` 是空壳。** 山脉 / 河流 / 森林 / 草原 / 沙漠 / 极地都还不存在。
- **Terrain Grammar 未实现**，§4 只是建议形态。
