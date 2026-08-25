# Citadel V4 · G2–G12 交付

日期：2026-08-22  
负责人：Grok  
开关默认关闭：旧 `citadelRange` / `buildCitadelTown` / phalanx 仍是运行时真源。  
`?citadelTownV4=1&citadelTerrainUvV2=1&citadelCombatV3=1` 时 `odysseyCitadel.userData.v4 = compileCitadelV4(...)`。

## 来源事实 / 项目推导

| 栏 | 内容 |
|---|---|
| 来源事实 | 主/对偶网格、可复现 seed、WFC 不擅长长窄有向结构、小队高层命令 |
| 项目推导 | SurfaceProvider 查询拓扑面；模块 2450 为组合空间；攻防为纯数据导演+结算 |

## 测试

```text
node tools/test_citadel_v4_all.mjs
node tools/e2e/citadel_v4_pipeline_e2e.mjs
```

seed `7`。三次编译模块/UV/图一致。10 分钟贴地离表 ≤0.15。150 人决策 ~1ms。单格 dirty 邻域 ~0.3ms。

## 模块

G2 `terrainGenerator.js` `surfaceProvider.js` `terrainUvCompiler.js`  
G3 `moduleCatalog.js` `moduleResolver.js`（47 模块，阳台=花砖，禁止 grass-walk）  
G4 `incrementalBuilder.js` 簇色 `visualTheme.resolveBuildingTheme`；样片 `tools/out/citadel_g4_cluster.json`  
G5 `surfaceGraph.js` 跨台地仅 stairs/waterfall-climb  
G6 `agents/citadel/combatAgent.js`  
G7 `combatResolver.js` `siegeDirector.js` 长枪 reach 2.2；木马 4 绳×2、两组首尾火炬  
G8 `visualTheme.js` `environmentBus.js`  
G9 `blueprintStore.js` `debugLayers.js`  
G10 `resourceRegistry.js` `scheduler.js`  
G11 `surfaceRider.js` `saveSchema.js` v1→v2  
G12 本报告 + `tools/out/citadel_v4_weather_matrix.json`

## G11 补完（场景拆分与开关接线）

- `messengerIsland.js` **273 行**（≤600）。装配拆到 `src/scenes/messenger/`：
  `loadCitadel.js` / `loadMoebius.js` / `loadTraffic.js` / `updateIsland.js` / `swampBgm.js`。
- `attachCitadelV4Runtime`：三开关独立。关 = 旧 `citadelRange` / `buildCitadelTown` / phalanx。
  - `citadelTerrainUvV2`：`wrapWalkLift` 走 SurfaceProvider，挂 SurfaceRider（player/tram/boat/horse）。
  - `citadelTownV4`：模块簇 overlay（不替换旧网格）。
  - `citadelCombatV3`：表面图 + 固定步长仿真，不替换 phalanx。
- 任务 `worldEntityId` 写入 `QUEST_DEFS`；音频适配订阅战斗事件语义。
- `compileWorker.js` 纯数据 payload，hash `d8ec1bce`；无 Worker 时同步同结果。
- 25 镜头拓扑 SVG：`tools/out/citadel_v4_shots/` + `citadel_v4_camera_matrix.json`。
- GPU 实拍：`node tools/e2e/citadel_v4_shots_e2e.mjs` → `tools/out/citadel_v4_gpu/`（5 天气 × 5 机位 PNG）。
- V3 近战：`createCitadelMeleeSoldier()`；`?citadelCombatV3=1` 长枪，默认短剑盾。

## 旧文件（已标记，未整份删除）

主人确认后：五份旧文件打 `@legacy`，见 `docs/citadel-v4-legacy.md`。  
网格/攻城暂留，因为 V4 还没有等价 Three 网格。关开关也会编译 V4 数据层。
