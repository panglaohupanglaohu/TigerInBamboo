# 城堡装饰边界清单（C8 · Claude 2026-09-03）

> 给 G-11（`decoratePass.js`）用。判据只有一条：**这个网格的存在与形状是否由「该格的体块角色」唯一决定？**
> 是 → 体块（WFC 的 assignment 决定，留在 `buildCitadelTown` 体块循环）；
> 否，它只是贴在体块表面、按 exposure / 户 seed / 随机散布出现的 → 装饰（搬进 `decorateTown`）。
> 名字来自 `citadelTown.js` 里全部 66 个 `town-*`（`grep -o '"town-[a-z0-9-]*"'`）。

## 体块（留在体块循环，归属 = 该格 / 该屋顶连通分量）

| 名字 | 对应 WFC 角色（builderKey） | 说明 |
| --- | --- | --- |
| `town-cell` | body / tower / passage | 格体本身 |
| `town-plinth` `town-grout` `town-floor-band` `town-cornice` | body（iy=0 plinth；层间 band） | 体块自身的横向分层线，随格生成 |
| `town-seawall` `town-seawall-plinth` | body（iy=0，临水） | 基座包边；阶段 4 改角柱件 |
| `town-roof` `town-roof-ridge` `town-roof-eave` `town-roof-fascia` `town-roof-bargeboard` | gable / hip | 屋顶体（C13-4 檐口三层色带随瓦面同生同灭，不进装饰 pass） |
| `town-dome` `town-dome-drum` `town-dome-cap` `town-dome-finial` `town-block2x2-cone` `town-tower-cap` | hip / cone（现规则 block2x2/single 高柱） | 顶盖体 |
| `town-steeple` `town-steeple-tower` `town-steeple-cone` `town-spire` | cone / L·cross 教堂 | 顶盖体（教堂尖塔留待 C9 目录决定去留） |
| `town-plaza` `town-plaza-seam` | flat | 平顶面 |
| `town-courtyard-surface` `town-courtyard-wall` `town-garden-grass` | garden | 花园/庭院地面与周墙 |
| `town-gate` `town-gate-recess` `town-gate-door` `town-gate-portico-column` `town-gate-portico-pediment` | passage（G 格） | 正门是体块开洞 |
| `town-arch` `town-arcade-column` `town-watergate` | passage | 拱洞/水门是体块开洞 |
| `town-door` `town-door-recess` `town-door-leaf` | body（户门面） | **门洞是体块**：它改变墙的拓扑；门扇也随门洞走 |
| `town-window` `town-window-lintel` `town-window-sill` | body（暴露面） | **窗洞是体块**（阶段 6 改 stencil 后仍是「体块层」的事） |
| `town-crenel` | body 顶缘（城墙格） | 城垛跟随墙体拓扑 |
| `town-support-pillar` `town-support-edge` | 构造式（N3） | 悬空格承重，不进域也不算装饰：留在体块循环 |
| `town-canal-water` `town-courtyard-water` | 地形/水 | 不属于建筑装饰 pass |

## 装饰（搬进 `decorateTown`，归属 = 它所贴的那一格；跨格的走 `ownSpanning`）

| 名字 | 依据 | 输入（装饰 pass 只读这些） |
| --- | --- | --- |
| `town-window-awning` | 窗上遮阳，按户 seed 随机 | 该格窗位 + 户 seed |
| `town-balcony` `town-balcony-rail` `town-balcony-canopy` `town-balcony-flowerbox` `town-balcony-flower-tile` | 阳台整组：贴在暴露面，按 seed 出现 | 该格 exposure + 户 seed |
| `town-fence` `town-garden-fence` | 晒台/花园外缘栏杆：**按 exposure**（terrace 朝空的面加栏杆，S19 t=0.35） | assignment（terrace/garden）+ exposure |
| `town-pilaster` | 立面壁柱 | 该格暴露面 |
| `town-gable-oculus` | 山墙圆窗 | 屋顶分量的山墙端 |
| `town-roof-chimney` `town-roof-chimney-cap` | 烟囱按 seed 散布（S19 t=1.40 出现在合并后的屋顶上） | 屋顶分量 + seed |
| `town-steeple-cross` `town-steeple-vane` | 尖顶饰件 | 尖顶位置 |
| `town-clothesline` `town-cloth` | 跨格晾衣绳（`ownSpanning`） | 两格暴露面 + seed |
| `town-bird` | 屋顶/栏杆小鸟 | 屋顶/栏杆位置 + random |
| `town-lantern` `town-boat` `town-boat-hull` `town-boat-sail` | 水面点缀 | iy=0 水格 + seed |
| `town-courtyard-well` | 庭院井 | garden 格中心 |

## 三条规则

1. 装饰 pass 的输入只有 `{ grid, selection(byCell), exposure, houseSeed, ctx }`，**不得再调用 `townscaperModuleSelection`**（那是哈希路径）。装饰变体（栏杆 iron/wood/painted、花箱颜色）用 `hashHex(\`${cellId}|${slot}\`)` 派生，保持同 seed 同结果。
2. 体块循环跑完后 `stats.bodyTris` 固定；`skipDecor` 只影响本表右列的名字——G-11 的 `test_decor_pass.mjs` 用这两张表逐名核对。
3. 合并顺序：体块先合并，装饰下一帧合并（S19 t=2.80 的 0.3s 滞后就是这个）。装饰 pass 的对象仍必须走 `ownCell/ownSpanning`，否则门 A 倒退。
