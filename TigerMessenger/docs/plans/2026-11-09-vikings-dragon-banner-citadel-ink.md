# 书店镇维京远征 · 龙纛反击 · 圣城墨线 —— 总规划（2026-11-09）

> 用户原话（2026-11-09 07:57 / 08:00 北京时间）
> 1）让书店镇的人登船（李白号、Duke 号），信使如果使用 F 键抓住运送到船上的货物也可以登船。登船后，除了信使外，所有书店镇的人都改成 REACodeRefactoring 的维京人，船上乘坐 150 人就发船，两条船同时发出。先参与苔庭之战，再参与高山圣城之战。高山圣城之战，书店镇的维京人与霸天队伍合作；高山圣城需要从旧城源源不断派送队伍到新城参加战斗。
> 2）参考《绍宋》尧山之战，构建龙纛（采用大号的 Bad North 旗帜），构建 Bad North 中与维京人作战的队伍，从旧城发起反击打退维京人；龙纛队伍全部黄金战衣；如何打退维京人，参考 REACodeRefactoring 中的相关能力。
> 3）圣城新设计加墨线描边并带逆光亮边（会改画风）；把剩下 24 条「光照与时间」学习条目逐条变成能力。
> **所有过程都要复用 REACodeRefactoring 的能力、大量使用现有代码；没有的先看待重构的 REACode 里有没有，学习后替换。需要新写的不多。**
> 所有过程由主代理安排；做不完由其他模型按本文接手。

本文 = 第 1、2 项的「上船 + 战斗」规划（按用户要求只写规划，复用为主）；第 3 项由主代理直接实施，进度见文末。

---

## 0. 原则与约束（接手必读）

- **复用顺序**：REACodeRefactoring（`~/…/townscaper-web/REACodeRefactoring/src`）→ 待重构 REACode（`…/REACode/src`、`engine/`）→ 才新写。新写的只限「两边都没有」的胶水（见 §3 缺口表）。
- **不改 REACode / REACodeRefactoring 原文件**。需要的文件**复制**到 TigerMessenger 的 `src/vendor/townscaper-rea-refactoring/src/…`（与已有 vendor 副本同一目录结构），在副本里不改逻辑；适配写在 TigerMessenger 自己的文件里。
- 保真（AGENTS.md）：不替换现有场景模型；同机位前后对照；如实区分「已接入 / 实测 / 未验」。
- 性能：维京人 300 名不能 300 个网格——用 REACodeRefactoring `life/unit-sprites.js`（UnitSpriteBatch，单方向贴图批处理）+ `life/unit-shadow-batch.js`；船上只画甲板可见的一排（Bad North 长船船舷那排圆盾），其余在「舱内」只计数。
- 测试：只用隔离浏览器；入口 `pipeline.html` 或 `/TigerMessenger/?autostart=1&timeOfDay=…&batianAuto=…`；证据进 `artifacts/pipeline/viking-campaign-YYYYMMDD/`。

---

## 1. 可复用能力盘点（已核对源码）

### 1.1 REACodeRefactoring `src/badnorth/`（Bad North 玩法层，已很完备）
| 能力 | 位置 | 用途 |
|---|---|---|
| 维京长船：驶入 → 靠岸卸兵（按座位逐个跳下）→ 驶离；船舷一排橙色圆盾；白色尾迹；死在船上的血/尸体随船走 | `battle.js` `#launchWave` `#longship` `update()` 船段 | 苔庭 / 圣城登陆 |
| 登陆泊位规划（3D SAT 预留泊位与直线进港通道，不撞别的船） | `landing-plan.js` `planLanding` | 两船同时登陆不重叠 |
| 守军小队（步兵 / 矛兵 / 弓手各一队）+ 小队旗（贝塞尔风粒子旗面、分叉尾、白徽记） | `battle.js` `start()` `#flag` `#updateFlag`，`life/banner.js`，`core/banner.js` | 龙纛 = 放大的小队旗 |
| 近战、弓箭（弹道查找表、抛物线、箭粘船）、长矛突刺（线段判定、击退）、眩晕、受伤血浸（soak） | `battle.js` `#hit` `#shoot`，`core/ballistic-table.js`，`core/spear-thrust.js`，`core/combat-state.js`，`core/combat-profile.js` | 双方战斗 |
| 兵种等级外观（tier 3 = 金盔金盾 `#e9d37b/#d3bc61`） | `core/unit-tier.js` | 龙纛队「黄金战衣」 |
| 维京人寻路：分层流场（每 0.25s 按守军重算，找最近守军 + 兵种） | `badnorth/flowfield.js`，`world/battle-navigation.js`，`world/navgraph.js`，`world/layerednav.js` | 维京进攻 / 守军迎击 |
| 窄道左行会车、窄道虚线 | `world/traffic.js` | 旧城→新城的长廊、台阶 |
| 小屋失守（维京人在门口站够 4 秒 → 着火） | `battle.js` + `core/house-door-presence.js` | 圣城建筑被攻占判定 |
| 单位贴地高度逐人取、坠落（被打下崖） | `core/unit-ground-height.js`，`battle.js` `#fallStep` | 台地战斗 |
| 平台锚点（船上物体随船） | `core/platform-anchor.js` | 船上的维京人 / 信使 |
| 选中小队 → 慢动作 → 点地下令（玩家可指挥龙纛队） | `battle.js` `onPointer` | 可选：玩家指挥龙纛 |

Battle 依赖的 `view` 接口：`scene, levelHeight, index.cellAt, mesh, worldMesh.{chimneys,builtVersion}, navLayer.stairs, effects.{fireSources,showFire}, smoke.sources, atmosphere.sample, camera, goreOff, flowDebug`；`world`：REA `World`（`cells, top(), ground(), version, bnHouses`）。

### 1.2 待重构 REACode 中有、Refactoring 战斗里还没有的
| 能力 | 位置 | 用途 |
|---|---|---|
| 击退出崖 → 空中 → 落地 / 落水 | `REACode/src/combatfx.js`（870296307889573889） | 维京人被龙纛矛阵推下码头落水 |
| 几百个小兵：单方向贴图 + 批处理 + LOD | `REACode/src/unitbatch.js`（817323301357948928），`engine/unitbatch.html` | 300 维京 + 守军同屏 |
| 小队旗图集（同杆同横杆、徽记一格一队色、杆顶金属球） | `REACode/src/squadbanner.js`（827216768783495168） | 龙纛杆顶、横杆样式 |
| 多级台地逐人取高度 | `REACode/src/unitsnap.js` | 已被 Refactoring `unit-ground-height` 覆盖，核对后用一处 |

### 1.3 TigerMessenger 现有
| 能力 | 位置 |
|---|---|
| REA View 的移植舞台（REA World + 网格 + anchor 贴到星球局部 + 单独 scene 合成） | `src/world/morrisTownStage.js`、`morrisTownscaper.js`（anchor / stage.update / 拾取代理） |
| 两条船：DUKE（`bookshopJakubHarbor.js`，含跳板 `duke-gangway`、缆绳）、李白号（`bookshopFactoryBase.js`，吊车 `harbor-unloading-crane` + 吊货 `harbor-suspended-cargo`，装卸状态机 `moving[type=unloading]`） | 登船点 |
| 书店镇人群：行人路网（栅格 BFS）`bookshopPedestrians.js`，`robotOperations.pedestrians`，`userData.townWorker` | 谁去登船 |
| 战船水路 / 球面行船 | `warshipWaterRoutes.js` `createWarshipWaterRoutes`，`warshipNavigation.js` `placeWarshipOnSphere` `sampleWarshipRoute` |
| 乘具（F 键）：`player/boatRide.js` `tramRide.js` `airshipRide.js`… | 信使抓货登船复用 boatRide 的乘坐相机 |
| 霸天舰队逐场景出征（campaign：书店镇→十二门徒→高山圣城→…→苔庭…） | `world/batianFleet.js`，main.js `batianTargets` |
| 苔庭之战触发（霸天攻苔庭且旗舰已开火） | `world/saihojiBattleTrigger.js`，`saihojiPhalanx.js`（罗马方阵、运兵战船） |
| 圣城攻城导演 / 小队导演 / 战斗模拟 | `src/agents/citadel/siegeDirector.js` `squadDirector.js` `combatSim.js` |
| 旧城→新城进攻路线、新城守卫点、驻军入城 | `world/citadel/newCityAssaultRoute.js` `newCityGuardPosts.js` `garrisonAdmission.js` |
| 风中旗帜（已接入 REA 贝塞尔旗 + core/banner.js） | `world/windBanners.js` |

---

## 2. 总体架构：每个战场 = 一个「REA 战场舞台」

```
ReaBattleStage(site)            ← 新写（薄）：复用 MorrisTownStage 的做法
  ├─ grid  = buildQuadGrid(radius, hexSize)            (REA)
  ├─ world = new World(grid)                           (REA)  ← 地形高度由实景采样写入（见下）
  ├─ index = buildCellIndex(grid)                      (REA)
  ├─ view  = { scene, levelHeight, index, mesh, worldMesh, navLayer, effects, smoke, atmosphere, camera }
  │          ↑ 直接用 MorrisTownStage 已移植的这些对象（世界网格设为不可见，只作导航 / 碰撞）
  ├─ battle = new Battle(view)                         (REA 原样)
  └─ anchor：site 的局部切平面坐标系 → 星球世界（同 morrisTownscaper 的 anchor.scale / position）
```

- **实景地形 → REA World**：对每个格子中心沿局部「下」方向打射线到实景地形（`terrainRayIndex.intersectTerrainSet` 或 `citadel/mountainSurfaceIndex`），高度 / `levelHeight` 取整写 `world.setSolid(cell, level, true, {rock:true})`；水面以下格子为 0（海）。码头 / 台阶按实景台面高度写入。
- **房子**：`world.bnHouses` = 苔庭 / 新城要守的建筑所在格（失守判定 = REA 原逻辑）。
- **渲染**：REA 单位精灵、旗、血、箭、长船都画在舞台 scene，经 anchor 合成到主画面（与莫西斯湖相同管线）。实景里的 DUKE / 李白号模型在登陆段**由 REA 长船逻辑驱动其位姿**（替换 `#longship()` 返回的网格为实景船，或把实景船挂在 boat.mesh 下），船舷圆盾沿用 REA。

新写文件（全部是薄胶水）：
| 文件 | 内容 | 预估 |
|---|---|---|
| `src/world/rea/reaBattleStage.js` | 上面的舞台 + 实景采样 + anchor | 中 |
| `src/world/vikings/bookshopBoarding.js` | 登船调度（§3.1） | 中 |
| `src/player/cargoRide.js` | 信使 F 抓货登船（§3.2） | 小 |
| `src/world/vikings/vikingVoyage.js` | 两船编队航行与靠泊（§3.4） | 小（复用水路） |
| `src/world/vikings/campaignDirector.js` | 战役状态机：集结→苔庭→圣城（§4） | 中 |
| `src/world/vikings/dragonBanner.js` | 龙纛队编成、集结 / 士气、反击（§5） | 中 |
| `src/vendor/townscaper-rea-refactoring/src/badnorth/*` 等 | **复制** REA 战斗与依赖（§6 清单），不改逻辑 | — |

---

## 3. 第 1 项：上船

### 3.1 书店镇人群登船（`bookshopBoarding.js`）
1. **触发**：书店镇面板（或 Q/E 剧情点）「维京远征 · 集结登船」；也可由战役导演在霸天出征苔庭前自动触发。
2. **谁上船**：书店镇全部行人 / 工人（`bookshopPedestrians` 的 `actors`，`robotOperations.pedestrians`，`userData.townWorker`），**信使除外**。
3. **去哪**：两条船各一个登船点——DUKE：跳板 `duke-gangway` 码头端；李白号：吊车码头 `bookshop-freighter-quay` 靠船边。人群用**已有**行人路网 `route()`（bookshopPedestrians 的栅格 BFS，错峰请求）走到登船点；在登船点排队（REA `world/traffic.js` 的左行会车思路用在跳板窄道）。
4. **上船**：到点后沿跳板走上甲板（`core/platform-anchor.js` 把人锚在船上随船），**一上甲板就换成维京人**：隐藏原人物模型，生成一名 REA 维京单位（`TEAM.VIK` 外观：红衣、橙色圆盾，`battle.js` 的颜色表 `COL.vik` / `shieldV`），座位号按 REA 长船座位排（`seat`、`row = seat%7-3`）。
5. **满员**：每船 150 人。书店镇实际人数不够 300 时，从书店镇建筑门口持续走出「镇民」补足（复用行人生成；出门判定复用 `core/house-door-presence.js`），直到两船都满。甲板只画前 14 名（REA 船舷一排），其余记在「舱内」计数（HUD 显示 `李白号 150/150 · Duke 号 150/150`）。
6. **发船**：两船都满 → 收跳板 / 吊车归位 → **同时**离港（同一帧开始走水路）。

### 3.2 信使 F 抓货登船（`cargoRide.js`）
- 李白号吊车的吊货 `harbor-suspended-cargo` 在装卸循环里往返于码头与船（`moving[type=unloading]`，`pickupX/Y` 为船上卸点）。
- 信使靠近吊货 3 米内按 **F**：信使挂在吊货下（平台锚点），跟着吊车走；吊货落到船上卸点时信使松手 → **信使登船**（不变维京人）。
- 船上按 F 可下船（发船前）；发船后信使随船（乘坐相机复用 `player/boatRide.js` 的乘坐逻辑 / 相机），到战场靠岸时跟维京人一起下船，或留船观战。
- Duke 号同理可走跳板（走上去即登船，不需要 F）。

### 3.3 维京人外观与规模
- 外观、血、尸体、头盔 / 盾颜色：REA `battle.js` + `core/unit-tier.js`（维京人 tier 1–2），大块头（`kind:'big'`，每船 1–2 名「大维京」，REA `wave>=3` 规则）。
- 300 名同屏：REA `life/unit-sprites.js` 批处理；远处 LOD 参考 REACode `unitbatch.js`。

### 3.4 航行与靠泊（`vikingVoyage.js`）
- 航线：书店镇港 → 苔庭海岸 → 高山圣城前港。水深仍用 `createWarshipWaterRoutes.surface()`；远航用本文件 A*（`planVoyageAstar` / `planBookshopToMoss`），**铁轨/电车高架可跨**（见 §10）。两船各自算到错开锚地。
- 时间线：苔庭开战前约 **10 分钟**离港（`VOYAGE_TIMING.departBeforeMossSec=600`）；巡航约 0.75 m/s，李白实测 ~449 m ≈ 10 min。
- 到达战场外海后，**把船交给该战场的 ReaBattleStage**：用 REA `planLanding(world, boats)` 求两个不冲突的泊位，船按 REA 长船逻辑 `in → unload → out` 靠岸卸兵（卸兵节奏 REA：每人 0.25 s）。

---

## 4. 第 1 项：战斗（苔庭 → 圣城）

### 4.1 战役导演（`campaignDirector.js`）
```
idle → muster(登船) → sail(书店镇→苔庭) → moss(苔庭之战) → reembark(上船) → sail(苔庭→圣城) → citadel(圣城之战) → done
```
- 与霸天同步：霸天 campaign 打到苔庭时（`saihojiBattleTrigger` allowed），维京船队同时抵达苔庭外海；打到高山圣城时同理。可在 `batianFleet` 的目标顺序里把「苔庭」提到「高山圣城」之前，或战役导演等待霸天到场。
- **重新上船**：REA 没有「回船」——新写（小）：维京人走向泊位所在格（流场目标 = 船），到船边即 `u.onBoat = boat; u.seat = …`（就是 REA 卸兵的逆过程），全员上船或时限到 → `boat.state='out'`。

### 4.2 苔庭之战（维京人 vs 罗马方阵）
- 舞台：苔庭 ReaBattleStage（采样苔庭地形，`bnHouses` = 苔庭要守的建筑）。
- 守方：**现有**罗马方阵（`saihojiPhalanx.js`）仍按原样演出；接入方式二选一（按工作量）：
  - A（推荐，复用最多）：把罗马方阵映射成 REA 守军小队——长矛兵 = `squad.pike`，长弓 = `squad.archer`，盾剑 = 步兵；单位位置取原方阵成员，在 REA Battle 里结算近战 / 弓箭；原方阵网格跟随 REA 单位位置播放。
  - B：两套系统并存，只在接触处用 REA `#hit` 结算（耦合多，不推荐）。
- 胜负：REA 原规则（小屋失守 / 一方全灭）；维京人失利或时限到 → 回船（§4.1）去圣城。

### 4.3 高山圣城之战（维京人 + 霸天 vs 圣城）
- 舞台：圣城 ReaBattleStage，覆盖新城广场、港口码头、旧城→新城连接道（`new-city-link` / `old-city-link` / 崖面长廊）。
- 维京人在**前港码头**登陆（`citadel-front-harbor` 一带；`planLanding` 选泊位），流场目标 = 新城守军与新城建筑（`bnHouses` = 新城房子）。
- **与霸天合作**：霸天舰队照常对圣城开火（`batianFleet` target=citadel）；维京人把霸天当友军：REA 只有两队（DEF/VIK），霸天单位不进 REA 单位表，只把霸天的爆炸 / 打击位置作为「对守军的伤害事件」喂进 REA（`#hit`），并让维京流场避开霸天轰炸点。
- **旧城源源不断派兵到新城**：复用 `newCityAssaultRoute` 的路线 + `garrisonAdmission` 的入城空位：每 20 s 从旧城出一队 REA 守军小队（8 人，REA `#spawn(TEAM.DEF, cell, squad)`），沿旧城→新城连接道（REA `traffic.js` 左行）补到新城空缺守卫点（`newCityGuardPosts`）。上限按性能控制（同屏守军 ≤ 120）。

---

## 5. 第 2 项：龙纛反击（尧山之战）

### 5.1 参考要点（《绍宋》尧山之战；细节以原著为准，这里只取战场表现）
- 主帅亲临、**龙纛前移**，全军望纛而进；纛在军在。
- **御前班直金甲护纛**，结阵稳步推进，而不是散开冲锋。
- 敌军阵线一旦被压垮即**全线溃退**。

### 5.2 实现（全部复用 REA 机制，新写只有「集结 / 士气 / 溃退」三个小规则）
| 战场表现 | REA 复用 | 新写（小） |
|---|---|---|
| 龙纛 = 大号 Bad North 旗 | `#flag` / `#updateFlag`（贝塞尔风粒子旗面）放大 ×5；旗面 `core/banner.js` `bakeBanner`（明黄底、分叉尾）；杆顶金球 + 横杆参考 REACode `squadbanner.js` | 「龙」徽记：在 vendor 副本的 `core/banner.js` 旁新增 `dragonEmblem()`（不改原文件，包一层 `inkAt`） |
| 黄金战衣 | `core/unit-tier.js` tier 3（金盔金盾）+ 单位身体色改金（`COL` 表加一项 `gold`） | — |
| 龙纛队编成 | `#spawn(TEAM.DEF, …)`：前排矛兵（`pike`，`spear-thrust` 突刺击退）、中排盾刀步兵、后排弓手（`archer`，弹道表）；纛手居中 | 编队相对旗位的槽位表 |
| 稳步推进 | REA 小队移动（`#nav(goal)` + `traffic.js`），推进点沿旧城→新城→港口逐段前移 | 推进节拍：每段等前排站稳再前移 |
| 望纛而进（士气） | 战斗数值来自 `combat-profile`（hp/soak）、`combat-state`（眩晕） | **旗下集结**：龙纛半径内守军眩晕时间 ×0.5、伤害 ×1.25；纛前移时半径内落单守军自动归队 |
| 打下码头落水 | REACode `combatfx.js` 击退出崖 → 落水；Refactoring `#fallStep` | — |
| 敌军溃退 | REA 长船 `out` 状态 | **溃退**：维京人阵亡 > 50% 或龙纛推进到码头 → 维京流场目标改为本方船，回船即离港（复用 §4.1 回船） |
| 玩家可指挥龙纛队（可选） | `onPointer` 选中 → 慢动作 → 点地下令 | — |

### 5.3 出场时机
圣城之战开始后 60 s（或新城失守 ≥ 1 栋时），旧城门打开，龙纛队（金甲 3 队 × 12 人 + 纛手）从旧城出发；旧城常规补兵（§4.3）继续。

---

## 6. vendor 复制清单（不改逻辑）
从 `REACodeRefactoring/src` 复制到 `TigerMessenger/src/vendor/townscaper-rea-refactoring/src`（已有目录 core/ life/ world/ … 只补缺的文件）：
- `badnorth/battle.js, flowfield.js, landing-plan.js, theme.js`
- `core/ballistic-table.js, path-samples.js, house-door-presence.js, unit-ground-height.js, unit-tier.js, platform-anchor.js, combat-state.js, combat-profile.js, spear-thrust.js, portal-aim.js, obb.js, sprite-ambiguity.js, unit-shadow.js, banner.js(已复制)`
- `life/banner.js, unit-sprites.js, unit-shadow-batch.js`
- `world/battle-navigation.js, navgraph.js, layerednav.js, traffic.js`（及其 import 链，用 `node tools/…` 扫 import 闭包后一次复制）
- REACode：`src/combatfx.js`（击退落水）、`src/unitbatch.js`（LOD）——先读后按 Refactoring 的接口改写成 vendor 副本里的小模块。

## 7. 分阶段与验收（接手按顺序做）
| 阶段 | 内容 | 验收（隔离浏览器实测） |
|---|---|---|
| P0 | vendor 复制 + import 闭包能加载；ReaBattleStage 在苔庭空跑 REA Battle（REA 默认守军 + 一波长船） | 苔庭出现 REA 长船靠岸、维京人下船、守军迎击；控制台无错；帧率记录 |
| P1 | 书店镇登船（§3.1）+ 维京化 + 150/150 计数 + 两船同时发船 | 两船同一帧离港；HUD 计数；信使不变 |
| P2 | 信使 F 抓吊货登船（§3.2） | 抓货 → 落船 → 随船离港 |
| P3 | 航行 + 苔庭登陆 + 苔庭之战（§3.4、§4.2 方案 A）+ 回船 | 船队到苔庭、`planLanding` 两泊位不冲突、开战、回船 |
| P4 | 圣城登陆 + 与霸天合作 + 旧城持续补兵（§4.3） | 霸天开火时维京人同时进攻；每 20 s 旧城出一队 |
| P5 | 龙纛队（§5）+ 溃退 | 金甲龙纛队从旧城出、稳步推进、维京人溃退回船离港 |
| P6 | 性能 + 回归（霸天 campaign、苔庭原战斗、书店镇行人） | 同屏 300+ 单位帧率记录；原系统不坏 |

## 8. 第 3 项进度（主代理直接实施，见 PROJECT_HANDOFF）
- 圣城新设计墨线 + 逆光亮边：复用 REACodeRefactoring `src/world/outline.js`（OutlineLayers：屏幕像素宽墨线 + 逆光暖边两层反向外壳）。
- 光照与时间 24 条：逐条归入可调能力，做不到的如实标注。

---

## 9. 实施进度（主代理，2026-11-09 起）

### P0 ✅（已实测）
- vendor：REACodeRefactoring `badnorth/battle.js` 的 import 闭包 26 个文件原样复制到 `src/vendor/townscaper-rea-refactoring/src/`（badnorth/battle、flowfield、landing-plan、theme；core/ballistic-table、combat-profile、combat-state、house-door-presence、minheap、obb、path-samples、platform-anchor、portal-aim、spear-thrust、sprite-ambiguity、unit-ground-height、unit-shadow、unit-tier；life/banner、unit-shadow-batch、unit-sprites；world/battle-navigation、layerednav、traffic）。`world/navgraph.js` 更新为 Refactoring 新版（河道方向规则，接口不变；旧版备份 /tmp/vendor-navgraph.before.js）。
  - 坑：import 扫描要匹配 `import{x}from'..'` 这种无空格写法（obb.js / portal-aim.js 第一次漏了）；浏览器会缓存失败的模块，补文件后要整页重载。
- `src/world/rea/reaBattleStage.js`：`new ReaBattleStage({scene, dir, camera, scale, gridRadius})`。
  - 局部切平面 anchor（y = 当地海面），按包围球筛出舞台范围内的网格；星球表面这类大网格只截舞台内三角形。逐格向下射线 → REA World。
  - 平岛（最高 <2 层）临海一圈留 1 层、内陆抬到 2 层，因为 REA 守军要 2 层台地集结。最小 view 接口补齐后，REA Battle 原样运行。
  - 采样 3316 格 172 ms（第一版 9 s，卡主线程，已改）。
- 实测（系统工坊内嵌，`citadelRuntime=1`）：苔庭 `scale:2, gridRadius:16` → 204 格陆地、3 队守军 24 人。长船带船舷圆盾、白色尾迹驶入卸兵；第 2 波时弓箭 96 支、出血、阵亡；控制台无错。
  - 苔庭真正的陆地是 `mossy-terrain`（离海面 0.7–1.8 m）；鲸鱼岛 leviathanGroup 平时在海面下。
- 未做 / 待定：单位尺寸（scale 2 时人约 0.36 m，偏小，P6 调）；Battle 自带 HUD 挂在 document.body（top 128px）；FPS 未测（预览窗口隐藏时被限帧）。

### P1 ✅（已实测）书店镇登船
- 新：`src/world/vikings/bookshopBoarding.js`。main.js 懒加载：`?vikingMuster=1` 或 `__tmStartVikingMuster()` 开始；`globalThis.__tmRobotOps` 暴露书店镇行人。
  - bookshopPedestrians.js 只加一个跳过条件 `userData.bookshopBoarding`。
- 人群：书店镇 70 名行人走行人路网 `routeWorld` → Duke 跳板码头端 → 跳板 → 甲板；李白号走到离船中段最近的码头路点 → 跨上船。
  - 不够 300 人时，从行人的家门口复制行人模型补出镇民，同时在路上的 ≤40 人。
- 上甲板即「变维京人」：原人物隐藏、计数 +1。每船甲板画 14 名 REA 维京外观（battle.js 的红衣 / 奶白头 / 橙盾比例，×8.5），其余在舱内。HUD 左上 `李白号 n/150 · Duke 号 n/150`。
- 两船都满 → 收跳板、解缆，同一帧离港（`departedFrame` 相同）。航行用「载具组」：船和父节点之间插一组，整组绕球心旋转。
  - 第一版把船 attach 到 scene，李白号自带的起伏动画（写父坐标系 position.y）把船拽沉，已改。
- 实测：两船 150/150；同一帧离港（frame 3927）；10 s 各驶出 38.3 m；李白号吃水正常（+1.39 m）。全程约 6 分钟（模拟时间：先 60 s 原住民上船，再约 5 分钟补员），可调 walkSpeed / 补员速度。

### P2 ✅（已实测）信使登船
- 新：`src/player/cargoRide.js`。bookshopFactoryBase.js 吊运循环加 `harbor-cargo-trolley.userData.loading` → 倒放 = 装船（码头 → 李白号）。
- 吊货 3 m 内按 F 站上货箱 → 货箱在船上卸点消失的那一刻（倒放循环的终点）松手 → 沿「下」打到船体站上甲板 → 登上李白号。
  - 第一版用世界包围盒判定「在船上方」，在码头就误判登船，已改。
- Duke：走到跳板甲板端 1.4 m 内自动登船。发船前按 F 回到码头；发船后随船（20 s 航行中离船心距离 4.8 → 4.6 m，只是起伏）。信使不计入 150 人、不变维京人。

### P3–P5 ✅ 逻辑全链路已跑通（快进实测）；画面待 P6 校正
新文件：
- `src/world/vikings/vikingVoyage.js`：航线 / 锚地 / 驾船。
  - 复用 warshipWaterRoutes 的 `surface()` 取水深；它自带的 berth/route 一次要 13–20 s，不能用于远航。
  - 大圆每 10 m 取点，水不够就侧向 8…80 m 绕行，再平滑。驾船：先转船头再沿大圆走；船头没对准就减速；落在船尾的航点跳过（否则会绕点打转）。
- `src/world/vikings/campaignDirector.js`：muster → sail-moss → moss → reembark → sail-citadel → citadel → done。
  - 每个 REA 长船（按对象认）从两船舱内扣人；扣完 `battle.nextWave = ∞`。
  - 回船（新写）：活着的维京人走回登陆滩格，离场，人数加回大船。
- `src/world/vikings/citadelBattle.js`：
  - 圣城舞台 scale 8（一格 8 m、一层 4 m、人约 1.4 m）。
  - 霸天炮弹落点伤守军；旧城每 20 s `spawnSquad` 补一队（同屏 ≤120）。
  - 龙纛队：矛 / 盾刀 / 弓三队 × 12，tier 3 金盔金盾 + 金衣；矛队旗 ×5、明黄「龍」字燕尾旗。三队目标格沿旧城→滩头分 5 段推进，站稳 3 s 再进。
  - 望纛：3 格内守军眩晕减半。溃退：阵亡过半 / 龙纛到滩头 / 时限。
- vendor `badnorth/battle.js` 加了 3 处 `[TM]` 接口（不改原逻辑，原 REACodeRefactoring 未动）：
  - `u.bodyColor` 衣色覆盖；
  - 旗子 `userData.scale` 放大；
  - 公开 `spawnSquad({cell, archer, pike, size, tier, bodyColor, bodyScale, flagColor, flagStyle, flagScale})`，内部就是 start() 同款 #flag + #spawn。
  - 原文件备份 /tmp/vendor-battle.orig.js。
- reaBattleStage 采样二版：所有候选三角形换到舞台局部坐标按格分桶，竖直查高度。圣城 208 万三角 29.7 s → 0.18–0.48 s，与旧法 2516 格结果完全一致。
  - 房子不当地形（单位走房脚的地，房子格记 REA 小屋）。
  - 远征大船 `userData.reaIgnore` 不采；之前大船停在苔庭被采成陆地，长船无处登陆。

实测（系统工坊内嵌，`citadelRuntime=1`，手动快进）：
- 两船到苔庭锚地（47 m 外，航线 183–266 m，0 处受阻）。
- 圣城：5 波共 54 人登陆，舱内 300 → 246；旧城 20/40/…/160 s 各补一队；60 s 龙纛出旧城，推进到 3/5 段；维京人阵亡过半，全线溃退。
- 25 人回船，两船 136 + 135，战役 done。

未验 / 已知问题（接手先看）：
1. **单位高度量化**：圣城一层 4 m，单位可能比实景地面低或高 2 m（旧城广场实拍时金甲队埋在地面下看不见）。改法候选：
   - vendor battle.js 绘制时加 `view.visualOffset(x, z)`（每格真实高度 − 层高）；
   - 或圣城拆成「港口 + 新城 / 旧城台地」两个舞台，各自基准高度。
2. **苔庭本轮没出船**：大船被采成陆地。已加 reaIgnore 修复，但这次页面里没重跑苔庭（是手动给载具打标记后跑的圣城）。
3. **霸天合作没跑到**：游戏未开始、`batianAuto=0`，`fleet.start('citadel')` 没生效（idle，0 发），炮弹伤守军这段代码未执行过。要在开局 + 自动战役下验。
4. 苔庭守军仍是 REA 默认 3 队；罗马方阵映射（方案 A）未做。
5. 维京单位尺寸：苔庭 scale 2 太小，圣城 scale 8 合适。
6. 战役导演不等霸天同步；REA Battle 自带 HUD 与远征 HUD 同时显示。
7. FPS 未测：预览窗口隐藏时限帧。

### 09:11 起这一轮（用户：「船运兵开战，反抗等过程实施；船离开时需要鸣笛」「墨边不用描了，没意义」）
- **离港鸣笛**：audio/worldSfx.js 新增 `sfxShipWhistle(pos, {pitch, dur})`（三音和弦汽笛 + 蒸汽气声，起音上滑，传 420 m）。
  - 两船同一帧离港时各拉一长声：李白号 pitch 0.82 先响，Duke 号 1.18 晚 0.6 s。汽笛口（duke-whistle / leebai-single-copper-funnel）冒一串白汽。
  - 实测 `whistled: true`；声音本身在预览里没法听，未经人耳确认。
- **圣城墨线默认关**：citadelInkOutline 只在 `?citadelInk=1` 装；「圣城蓝调暮色」套装去掉墨线项。
- **苔庭 / 圣城守军 = 罗马方阵编制**（`src/world/vikings/mossDefenders.js`，§4.2 方案 A）：
  - 原方阵实测是圣城红衣驻军 citadel-red-garrison：长矛 28、盾剑 12、长弓 4，离圣城 83 m、离苔庭 273 m。
  - 苔庭：REA 默认 3 队退场，按同样编制在 REA 集结点编成罗马红衣小队（实测日志「长矛 28 · 盾剑 12 · 长弓 4（按编制）」）。
  - 圣城：原地接管红衣驻军，原模型隐藏，战后 restore（尚未在圣城实跑）。
- **单位埋地修正**：reaBattleStage 记每格实景高度，`view.visualOffset(x,z)` = 实景高 − 层高。vendor battle.js 第 4 处 [TM]：画身体 / 头 / 盾 / 矛 / 旗时加这个偏移，逻辑高度不变（截图验证待做）。
- **苔庭长船登陆**：远征大船 reaIgnore 后已正常出船。这一轮苔庭 300 → 294（有伤亡、有回船）。
- **霸天合作**：citadelBattle 每 5 s 请霸天出征圣城，接令 / 到场写日志。需开局（gameStarted）。
- **采样内存**：三角表改 Float32Array。上一轮测试页在圣城战时崩溃（Target crashed）；普通数组存 200 万三角约 160 MB，疑为原因之一。
- **实测补充（09:2x，新页面、已开局）**：
  - 圣城战直建（模拟 300 人）：舞台 0.47 s 建好（采样 168 ms，225 万三角）。霸天「接令出征圣城」→「到场（assemble）」。
    霸天按真实时间飞，预览窗口隐藏时限帧，80 s 战斗时间内还没开炮；炮弹伤守军这段仍未执行过。
  - 旧城 20 / 40 / 60 s 补兵；60 s 龙纛出旧城。
  - 单位高度修正后，金甲龙纛队站在旧城广场上（不再埋地，截图 outputs/dusk/dragon-banner-golden-army.png）。
  - 龙纛 ×5 在 scale 8 下杆高约 24 m、比房子高太多，已改 ×2.5（约 12 m）。
  - 罗马驻军映射修正：盾剑 / 长弓兵身上也挂着长矛装备，按装备认会把 28 人全算成长矛；改按士兵本身名字认。
    实测「长矛 12 · 盾剑 12 · 长弓 4（原地接管）」，战中隐藏 28 个原模型，restore 后全部恢复。

---

## 10. 航线可跨铁轨 · 战前约 10 分钟离港（2026-11-10 用户纠正）

> 用户原话：「我认为不需要这样……Duke 和另外一条船他们应该计算好在苔庭之战前就准备好队伍，在苔庭之战前就需要到达控制位置。所以，算好路径，船是可以跨过铁轨的。这样船的路径就应该好规划了。计算好那条路径，行驶多长时间……我现在估算应该是苔庭之战的前的 10 分钟，你就需要离开书店镇，开往苔庭了。」

### 10.1 障碍规则变更
- **可跨**：电车系统整树（`christchurch-tram-system` / `tram-*`）、`moebius-city-viaduct`、trackside、圣城沿海电车、`jakub-viaduct` / `jakub-rail-embankment`、`global-approach-support`、双层轨桥（`citadel-target-double-deck` / `central-double-deck` / `newShore-double-deck`）。
- **仍挡**：岛体、hills、山体、浅滩、真正陆地建筑；远征本船自身忽略（避免离港点被船体挡住）。
- 入口：`isCrossableRailOrTram` / `createVoyageObstacles`（`src/world/vikings/vikingVoyage.js`）。`createObstacleIndex(..., { crossRails: true })` 为默认。

### 10.2 书店镇港 → 苔庭锚地（2026-11-10 实测）
| 船 | 航长 | 航点 | 来源 | 巡航 0.75 m/s | 锚地离苔庭中心 |
|---|---|---|---|---|---|
| 李白号 | **449 m** | 6 | A*（可跨铁轨） | **≈ 599 s ≈ 10.0 min** | 46.6 m |
| Duke 号 | **322 m** | 3 | A*（可跨铁轨） | **≈ 430 s ≈ 7.2 min** | 60.9 m |

- 固化表：`BOOKSHOP_TO_MOSS_ROUTE`（对照 / A* 失败回退）。
- 战役里集结一开始就 `preplanMoss()`；离港后按预计算点列驾船，不再离港当场卡 10–40 s。
- 编队：两船各自 A*（横向自然错开锚地 48 m / 64 m），不共用强制偏移。
- 对比：把铁轨当障碍时，大圆采样会撞上 viaduct / tram-static-sector / double-deck；侧向绕行会被拉到 ~3 km 且大量 dryLegs。可跨铁轨后 A* 一次通过。

### 10.3 离港 / 开战时间常数（已接代码，不只文档）
```
VOYAGE_TIMING = {
  departBeforeMossSec: 600,  // 离港 = 苔庭开战 − 10 分钟（用户钉死）
  musterBudgetSec: 360,      // 集结预算 ≈ 6 分钟
  cruiseSpeedMps: 0.75,      // 449/0.75≈10 分钟，对齐估算
  dashSpeedMps: 7,           // 圣城段等
  avgBatianTargetSec: 180,   // 粗算霸天每目标
  mossApproachSec: 70,       // 霸天进苔庭 → 旗舰开火
  holdAfterArriveSec: 30,
}
```
- **离港**：`departAt = battleEta − 600`。
- **集结启动**：`musterAt = departAt − 360`（合计开战前约 16 分钟启动集结）。
- **正式战役自动集结**：`main.js` `maybeAutoVikingMuster` — 当 `estimateMossBattleEtaSec(霸天快照) ≤ 960` 时置 `vikingMusterWanted`（`?vikingAuto=0` 可关）。
- **到锚地后**：相位 `hold-moss`，等 `saihojiBattleTrigger` 允许（或无霸天 / 测试超时）再开苔庭 REA 战。
- 手动入口不变：`?vikingMuster=1` / `__tmStartVikingMuster()`；测试可加 `vikingSyncBatian=0` 到锚地短等即开打。

### 10.4 代码入口
| 文件 | 作用 |
|---|---|
| `src/world/vikings/vikingVoyage.js` | 可跨铁轨障碍、A*、固化航线、VOYAGE_TIMING、`planBookshopToMoss` |
| `src/world/vikings/campaignDirector.js` | 集结预计算、巡航驾船、`hold-moss`、接霸天触发 |
| `src/main.js` | 自动集结阈值、把 fleet / syncBatian 传给导演 |
| `tools/tests/test_viking_voyage_timing.mjs` | 时间常数 / 铁轨判定纯测（无浏览器） |

### 10.5 实测证据 / 未验项
**已测**
- 隔离浏览器：`createVoyageObstacles` 后大圆不再命中 viaduct/tram；A* 李白 449 m / Duke 322 m，`source:'astar'`。
- `?vikingMuster=1` 实景：战役 `preplan-moss(leebai:449m/599s/astar · duke:322m/430s/astar)`，控制台无错；集结进行中。
- `tools/tests/test_viking_voyage_timing.mjs` 通过。

**未验**
- 整段 10 分钟实航（巡航 0.75 m/s）人目跟船到锚地（本轮只验了预计算与时间常数接入）。
- 霸天自动战役下「距苔庭 ≤16 分钟 → 自动集结 → 战前 10 分钟离港 → hold → 开战」完整连跑。
- 苔庭→圣城段 A* 在可跨铁轨下的长度/时长（接口已接 dash 速度，未单独测）。
- 仍开放的旧问题见 §9：霸天炮弹伤守军、整局连续圣城、FPS。

---

## 11. 复查：未做 / 未验清单（2026-11-10，读代码核对，非实测）

### 11.1 结构性问题（流程会走错，先修）
1. ✅（2026-11-10 已改，见 §12）**霸天战役顺序与维京相反**：main.js `batianTargets` = 书店镇 → 十二门徒 → **高山圣城** → 旧港 → 湖沼 → **苔庭**。维京是苔庭 → 圣城。正式战役里维京到圣城时霸天早已打完圣城，`citadelBattle.askBatian` 用 `fleet.start('citadel')` 硬拉回，会打乱霸天战役且未验；红衣驻军可能已在霸天打圣城时受损。需用户定：霸天把苔庭提到圣城前，或其他同步方式。
2. **离港没有真正钉在「战前 10 分钟」**：只有集结启动按 ETA 反推；`bookshopBoarding` 满员即走，不看 `departAt`。补员约 5 分钟且随帧率变，早满早走、晚满晚走。ETA 的 `avgBatianTargetSec=180` 是粗估，未用霸天实测每目标时长校准。要加：满员后码头待命到 `departAt`；集结超时兜底（到 `departAt` 不满也走或加速补员）。
3. **战后收尾缺失**：citadelBattle 注释写「两船起锚离开」，代码没有——`done` 后两船停在圣城锚地；书店镇被隐藏的居民不恢复；无返航。
4. **信使到战场无法下船**：cargoRide 发船后 F 无效，规划 §3.2「靠岸随维京人下船 / 留船观战」只有后者。
5. **回船是直线滑行**：campaignDirector / citadelBattle 回船直接 `u.x += …` 朝滩格走，不走流场，会穿房穿崖，台地上高度不跟地。应改为把流场目标设为滩格（REA navigation.plan）。

### 11.2 规划写了、代码没做
- ✅ 击退出崖 → 落水（REACode `combatfx.js`）已搬，见 §12。
- 几百小兵 LOD（REACode `unitbatch.js`）未做（REA 自带 UnitSpriteBatch 在用）。
- 望纛只做了「眩晕减半」；「伤害 ×1.25」「落单守军归队」未做。
- 旧城补兵直接在旧城格生成交给 REA 流场；没走 `newCityAssaultRoute`、没补到 `newCityGuardPosts` 空缺。
- 维京流场避开霸天轰炸点：未做。
- 苔庭→圣城航段 `dashSpeed 7 m/s`（巡航的 9 倍，画面会冲）；A* 失败时 `astar-failed` 仍按点驾船，无回退表。
- REA Battle 自带 HUD 与远征 HUD 同时显示。✅ 苔庭单位偏小已改为 1.7 m（§12）。

### 11.3 未验
- 书店镇→苔庭 10 分钟实航人目跟船；整局连跑（上次圣城段页面崩溃，Float32Array 后未整局重跑）；霸天自动战役下自动集结 → 离港 → hold → 开战；霸天炮弹伤守军（从未执行）；汽笛人耳；P6 FPS 与回归（霸天战役、苔庭原战斗、书店镇行人）。

### 11.4 第 3 项
- 墨线已按用户要求默认关（`?citadelInk=1`）。
- 24 条落成 6 个能力，但约 10 条「只学未接」：体素阴影 1190191289922465793、高度图阴影 1704218784028905984 / 1705195380457996629、体素 GI ×4（1580835075629133825 / 1580846877855338497 / 1580845127207387137 / 1582757294672314368）、软硬法线混合 929417420921556993、岩层 1707490932017279035 / 1063115611289645057；AO 网格可视化未做；体素 AO 默认未开。

---

## 12. 2026-11-10 落水 · 霸天顺序 · 士兵 1.7 m

### 12.1 击退落水（REACode combatfx.js → vendor）
- 新 `src/vendor/townscaper-rea-refactoring/src/core/knockoff-water.js`：按 Refactoring 单位接口改写 combatfx 的三条规则（原 REACode 文件未动）：
  - 推到 / 推向水（REA 格 top 0 或网格外）→ 上抛 + 翻滚（combatfx.knockback：vy、spin）；
  - 落到水面 → 溺水（combatfx：y < waterY → DROWN）：不摔死、不留尸体和血，竖着下沉 1.6 s 后不再画，两圈白色水花；
  - 长矛命中沿矛轴「顶着走」0.12（combatfx.thrust push），顶到水边必掉；普通近战水边沿用 REA 崖边 60%。
- vendor `badnorth/battle.js` 新增 [TM] 处：`#hit(v, by, thrust)`、`#fallStep` 入水分支、`#drown`、溺水 / 水花每帧、绘制下沉与空中翻滚；`battle.drownStats`（knocked / drowned / vik / def）。原 REA 崖边摔落规则不变；**行为变化**：掉出网格外原来是摔死留血，现在算落水。
- 测试：`node tools/tests/test_rea_knockoff_water.mjs`（node 直接跑 REA Battle）通过。画面未在浏览器里看过。

### 12.2 霸天出征顺序（用户：改）
- main.js `batianTargets`：书店镇 → 十二门徒 → **苔庭 → 高山圣城** → 旧港 → 湖沼 → 月湖 → 叹息之门。
- `batianMossGate()`（main.js，接在霸天 `autoReady`）：霸天下一站是苔庭时，等维京船队到苔庭锚地（`hold-moss` 及之后）才出征；兜底 20 分钟；`?vikingAuto=0` 且没手动集结时不等。控制台 `__tmBatianMossGate()`。
- campaignDirector `mossBattleReady` 兜底放宽：霸天已在苔庭最多等 5 分钟开火；霸天还在前一站最多等 10 分钟。
- 时间影响：苔庭现在是第 3 站，开局估算 ETA = 2×180+70 = 430 s < 960 s → 开局即自动集结；集结 6 分钟 + 航行 10 分钟，霸天打完前两站会在十二门徒等维京人到锚地。之后霸天下一站自然是圣城，维京人回船后同去 → 同场打圣城。
- 未验：浏览器里霸天自动战役整条跑。

### 12.3 士兵 1.7 m，长船同比放大（用户）
- reaBattleStage 新参数 `unitHeightM` → `view.unitScale = 身高 /(0.18 × scale)`；battle.js [TM] 按 unitScale 放大单位（含 big）、旗、长船，船上座位间距同倍，船停泊点往海里退 0.64×(倍数−1)（船头不扎进岸）。战斗逻辑格距不变。
- 苔庭：scale 2 → **4**（一格 4 m），单位 / 长船 ×2.36 → 1.7 m；舞台半径约 36 m（gridRadius 9）；`?mossScale=` 可调。
- 圣城：scale 8 不变，单位 ×1.18 → 1.7 m（原 1.44 m）；龙纛旗随之约 14 m。
- 风险 / 未验：苔庭格子变粗（原 204 陆地格会减到约四分之一）；放大后的人在逻辑上仍按原碰撞半径站位，可能显得挤；画面未在浏览器里看过。

### 12.4 甲板维京人悬空 / 站太高（用户截图，2026-11-10）
- 原因：`bookshopBoarding.deckSlots` 每条射线取第一个命中面。集结时 Duke 跳板斜搭码头，一排甲板位落在跳板上，收跳板离港后人留在半空 / 海面上方；其余人站在舱顶、驾驶台顶，比码头铁轨还高。
- 改：排除跳板、吊车 / 吊货、缆绳、旗、白汽等；只认朝上的面；船面铺 28×7 射线找「主甲板高度」（最低且 ≥12% 射线的那层），只在露天主甲板（−0.3…+0.6 m）按分位沿船长排人、左右舷交替。
- 测试：`node tools/tests/test_viking_deck_slots.mjs`（合成船：船体 + 舱室 + 烟囱 + 斜跳板 + 桅杆）通过；真船画面未复看。备份 artifacts/backups/viking-20261110/bookshopBoarding.before-deckslots.js。

### 12.5 提速（用户「船的速度太慢」，2026-11-10）
- `VOYAGE_TIMING.cruiseSpeedMps` 0.75 → **5 m/s**（离港出港段本来就加速到 6 m/s，之前一出港就降到 0.75 像停住）。李白 449 m ≈ 90 s，Duke 322 m ≈ 65 s；苔庭→圣城段仍 7 m/s。`?vikingSpeed=` 可调。
- 离港仍按「苔庭开战前约 10 分钟」（departBeforeMossSec 600 未改）：现在约 1.5 分钟就到锚地，余下时间在锚地待命；霸天出征苔庭本来就等维京到锚地（batianMossGate），实际会提前开战。

### 12.6 航速 15 m/s（用户：直接调成 vikingSpeed=15）
- `VOYAGE_TIMING.cruiseSpeedMps` 5 → **15**，`dashSpeedMps`（苔庭→圣城）7 → 15。李白 449 m ≈ 30 s、Duke 322 m ≈ 21 s（+ 加速 / 进锚地减速约 10 s）。
- `createShipPilot`：接住离港时已有船速（不从 0 起步）；加速度 = max(1.5, 0.15×速度)；转向率默认 max(0.9, 0.08×速度)（15 m/s 时 1.2 rad/s）。
- 未验：15 m/s 时实航偏离航线（`pilot.maxDeviation`）与过窄水道。

### 12.7 苔庭：维京人真的打霸天（用户：「到达可以小船，但是攻击你必须安排」）
- 新 `src/world/vikings/mossBatianAttack.js`，campaignDirector 在苔庭开战时挂上、回船时停：
  - **投矛打霸天舰队**：上岸维京人每 2.4–3.6 s 向 140 m 内最近的霸天单位（aircraft / 护航舰）掷标枪，抛物线追目标飞；
    飞行中 `interceptSaihojiFleetProjectile`（护盾拦截）、落点 `applySaihojiFleetHullContact`（扣船体），与罗马标枪同口径 javelin=8。
  - **扑先锋重甲兵**：`vanguard-squad` 落在舞台陆地上且比最近的守军近 → REA 寻路目标改成它所在格（vendor battle.js [TM] `u.tmGoal`，近身守军仍优先）；
    2 m 内挥斧 `hitVanguard(tr,'melee')`（与罗马兵同账：15 刀 1 伤）；重甲兵每 1.2 s 反砍身边一名维京人（代差）。
  - 统计：`__tmVikingCampaign.stats().batianAttack`（throws / shield / hull / trooperStrikes / trooperWounds / trooperKills / vikingsCut / pursuing）。
- 维京人仍与 REA 罗马守军交战（三方混战）；圣城之战维京人与霸天合作，不挂这层。
- 测试：`node tools/tests/test_viking_moss_batian_attack.mjs`（真 REA Battle + 假舰队 / 假重甲兵）通过，连跑 6 次稳定。
- 未验：真游戏里霸天单位离苔庭舞台的实际距离（140 m 射程是否够）、重甲兵是否落在 REA 舞台陆地格上。
