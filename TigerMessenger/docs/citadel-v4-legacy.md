# Citadel V4 · 旧文件标记（主人 2026-08-22）

主人指示：**删除旧真源、做标记。**  
V4 还没有等价的 Three 网格和完整日夜攻城，所以下列文件**不能整份删掉**，已改标 `@legacy`，禁止往里面加新玩法。

回滚：把本表文件的 `@legacy` 头注释去掉即可；V4 编译不再依赖 URL 开关。

## 标记表

| 旧文件 | 标记 | V4 替代 | 为何还留着 |
|---|---|---|---|
| `src/world/citadelTown.js` | `@legacy` 网格装配 | `citadel/moduleResolver.js` `incrementalBuilder.js` | 编辑器/主场景仍靠它出房子 |
| `src/world/citadelRange.js` | `@legacy` 地形/walkLift | `citadel/surfaceProvider.js` `terrainGenerator.js` | 瀑布、护城河、木马、碰撞高程 |
| `src/world/saihojiPhalanx.js` | `@legacy` 攻城状态机 | `agents/citadel/siegeDirector.js` `combatSim.js` | 运兵、长弓、拔河、蓝盔攻城 |
| `src/world/citadelInfiltration.js` | `@legacy` 木马巡查 | `siegeDirector.makeTrojanWave` | 四绳下降、天亮回腹 |
| `src/world/citadelTacticalGraph.js` | `@legacy` V2 环采样图 | `citadel/surfaceGraph.js` | 仅 `?citadelCombatV2=1` |

机器可读表：`src/world/citadel/legacyMarks.js` → `CITADEL_LEGACY`。

## 已删的旧分叉

- **关开关就不编译 V4**：已删。有蓝图就 `compileCitadelV4`。
- **Town overlay 当默认外观**：已删。只有 `?v4Debug=1` 才挂调试盒子。

## 开关（不再等于“回到无 V4”）

| URL | 作用 |
|---|---|
| （默认） | V4 数据层编译成 `CitadelWorldSnapshot`；外观与 walkLift 仍走 @legacy |
| `?citadelTownV4=1` | 隐藏 `town-terrace-*`，挂 Box/Cone 镇体，walkLift 改为 snapshot `sampleWalkLift`（不再混 legacy 高度） |
| `?citadelTerrainUvV2=1` | 外观仍可 legacy，walk/坐骑走 snapshot surfaces |
| `?v4Debug=1` | 模块 overlay |
| `?citadelCombatV3=1` | 表面图战斗仿真 + 近战长枪 |
| `?citadelCombatV2=1` | 旧环采样战术图（测试/对照） |

高山圣城镇体外观已切到 `presentationMesh.buildTownV4Mesh`（`loadCitadel` 隐藏 `town-terrace-*`）。  
`buildCitadelTown` 仍在 `odysseyCitadel` 里跑一遍以保留门锚/编辑器统计，但主场景不可见。  
外围地形与攻城状态机仍走 @legacy 文件。
