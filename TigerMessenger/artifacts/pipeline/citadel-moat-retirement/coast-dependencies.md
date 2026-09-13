# 圣城海湾遗留结构：真实场景定位

基准画面：after-rebuild.png，1440×900。2026-09-12，8931真实场景射线命中；不是靠颜色猜测。

| 画面像素 | 首个实体 | 归属 | 下一步约束 |
|---|---|---|---|
| 460,659 | causeway-deck | navona-harbor-causeway | 原纳沃纳广场R门到旧港的连港步道；迁移前核对两端实际支撑 |
| 660,615 | navona-plaza-basin-stone | citadel-navona-canal-plaza | 原广场槽底及围墙，不能当护城河再次删掉 |
| 572,647 | citadel-oskar-grid-mountain-surface | 原连续山体 | 岩柱本体源于地形；仅删除后来cliff-seal会露空而不会去掉岩柱 |
| 580,847 | citadel-oskar-grid-mountain-surface | 原连续山体 | 前景岩块同源，需改源岸线并同步海床/碰撞 |

## 已读实际依赖

- citadelRange.js的buildHarborCauseway由placeNavonaPlaza调用，按原广场R门和old-harbor-scene陆侧终点建立步道。
- saihojiPhalanx.js的plazaDir直接读取citadel-navona-canal-plaza世界位置并归一化；用于返航、蓝增援靠近和集结。不能将该水路端点直接改为新城高处广场：泊位与地面集结是两个不同位置。
- loadCitadel.js中plazaLocal仅在citadelCombatV2且没有latestAssault时用于旧战术图；不能据此声称当前所有战斗都依赖该图。
- 新城已有plazaAnchor、harborAnchor、harborRoute及boardingRoute；港内连接局部验证通过，港外航线仍未通过。不允许以瞬移或假泊位替代完整接入。

## 下轮实施顺序

1. 分离原舰队的水上回港端点和原士兵地面集结端点，分别对应实际泊位与新城广场；复用原兵船和士兵池。
2. 明确旧纳沃纳广场的新位置及步道两端，保留其对象身份和原剧情功能；验证完成后才撤除海湾遗留几何。
3. 在原地形模块消除孤立岸线残片，Blender副本迭代后回接同一几何，同步Godot；复测地面支撑和真实船体净空。
4. 固定相机重新对照目标图，保持完整山脉、旧城、新城、港口和角色可见；不得仅靠本次局部排查称整城完成。

本轮是定位证据，没有新的几何改动，没有新的通路或战斗完成声明。
