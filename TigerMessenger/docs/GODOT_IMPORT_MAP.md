# Godot 原作导入映射（G01）
由 `tools/originals/build_godot_import_map.py` 生成，数据源 `assets/models/inventory.json` + 磁盘实际文件。
**这份表只描述映射关系。**「已映射」不等于已导出，更不等于已在 Godot 里看到。导出要在装有 Blender 的机器上跑 `tools/originals/export_godot_originals.py`。
## 规则
- Godot 工程根 `godot`，`res://` 指向它；原作 GLB 落在 `assets/originals/`。
- **不碰** `godot/assets/` 下现有的 10 个旧实验 GLB（aircraft.glb, bookshop.glb, fox.glb, gate.glb, house.glb, messenger.glb, pine.glb, postbox.glb, tiger.glb, tower.glb）——那是前期偏离方向的实验，不计入本批成果。
- 导出源：默认 originals/blender-r3/<id>.blend（原作存档）。batch-candidates-v2 视觉对照未做，不作默认源；optimized/<id>.blend 只有 bookshop 与 moebiusTiger 有，且是 Web 运行时优化产物。

## 统计
- catalog: 72
- exportSourceExists: 72
- withKnownGaps: 72
- representatives: 7
- alreadyInGodot: 72

## 代表资产（先打通这几项）

| id | 名称 | 导出源 | 节点 | 顶点 | 已知缺口 |
|---|---|---|---|---|---|
| `bookshop` | Hard To Find 书店 | ✅ | 59 | 2520 | Godot 材质、描边、程序动画与交互仍需适配和视觉验收 |
| `fox` | 阿狸（小狐狸） | ✅ | 155 | 8830 | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `fisherBoat` | 古战船 | ✅ | 340 | 16992 | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；286 个实例被展开（层级与实例关系需复核）；尚无优化/渲染对照记录（optimization=pending） |
| `citadelWatchtower` | 圣城瞭望塔 | ✅ | 29 | 840 | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `classicAliFox` | 阿狸（经典版） | ✅ | 103 | 6588 | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `moebiusTiger` | 赛博水墨虎 | ✅ | 80 | 2552 | Godot 材质、描边、程序动画与交互仍需适配和视觉验收 |
| `saihoji` | 西芳寺·苔海 | ✅ | 776 | 566820 | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |

## 全部 72 项

| id | 名称 | 源存在 | 目标 res:// | 已知缺口 |
|---|---|---|---|---|
| `bookshop` | Hard To Find 书店 | ✅ | `res://assets/originals/bookshop.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收 |
| `house` | 水墨小房 | ✅ | `res://assets/originals/house.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `pine` | 古松 | ✅ | `res://assets/originals/pine.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `signpost` | 路牌 | ✅ | `res://assets/originals/signpost.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `lamp` | 街灯 | ✅ | `res://assets/originals/lamp.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `pole` | 电线杆 | ✅ | `res://assets/originals/pole.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `rock` | 焦墨岩 | ✅ | `res://assets/originals/rock.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `hydrangea` | 绣球花丛 | ✅ | `res://assets/originals/hydrangea.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `flower` | 水墨小花 | ✅ | `res://assets/originals/flower.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `lawnHill` | 草坪山丘 | ✅ | `res://assets/originals/lawnHill.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `fox` | 阿狸（小狐狸） | ✅ | `res://assets/originals/fox.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `fisherBoat` | 古战船 | ✅ | `res://assets/originals/fisherBoat.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；286 个实例被展开（层级与实例关系需复核）；尚无优化/渲染对照记录（optimization=pending） |
| `harborCrane` | 港口起重机 | ✅ | `res://assets/originals/harborCrane.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `stackedCrates` | 货柜木箱堆 | ✅ | `res://assets/originals/stackedCrates.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `oldHarbor` | 修船厂码头 | ✅ | `res://assets/originals/oldHarbor.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；286 个实例被展开（层级与实例关系需复核）；尚无优化/渲染对照记录（optimization=pending） |
| `citadelWatchtower` | 圣城瞭望塔 | ✅ | `res://assets/originals/citadelWatchtower.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `citadelElderTree` | 圣城参天树 | ✅ | `res://assets/originals/citadelElderTree.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `snowMassif` | 雪山组 | ✅ | `res://assets/originals/snowMassif.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `snowMountainPeak` | 单座雪峰 | ✅ | `res://assets/originals/snowMountainPeak.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `moebiusSwamp` | 莫比斯湖沼 | ✅ | `res://assets/originals/moebiusSwamp.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；4 个线/点图元（glTF 可保留坐标；线宽、点精灵和着色器需引擎适配）；572 个实例被展开（层级与实例关系需复核）；尚无优化/渲染对照记录（optimization=pending） |
| `moebiusTower` | 莫比斯塔 | ✅ | `res://assets/originals/moebiusTower.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；3 个线/点图元（glTF 可保留坐标；线宽、点精灵和着色器需引擎适配）；尚无优化/渲染对照记录（optimization=pending） |
| `moebiusAirship` | 莫比斯航空艇 | ✅ | `res://assets/originals/moebiusAirship.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `moebiusAircraft` | 莫比斯飞碟 | ✅ | `res://assets/originals/moebiusAircraft.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `tram` | 基督城电车 | ✅ | `res://assets/originals/tram.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `bubblePod` | 气泡座舱 | ✅ | `res://assets/originals/bubblePod.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；1 个线/点图元（glTF 可保留坐标；线宽、点精灵和着色器需引擎适配）；尚无优化/渲染对照记录（optimization=pending） |
| `fence` | 木栅栏 | ✅ | `res://assets/originals/fence.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `bridge` | 木桥 | ✅ | `res://assets/originals/bridge.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `lowPolyTree` | 低多边形树 | ✅ | `res://assets/originals/lowPolyTree.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `cloud` | 云朵 | ✅ | `res://assets/originals/cloud.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `blackRock` | 黑岩 | ✅ | `res://assets/originals/blackRock.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `craneOnRock` | 岩上鹤 | ✅ | `res://assets/originals/craneOnRock.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `classicAliFox` | 阿狸（经典版） | ✅ | `res://assets/originals/classicAliFox.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `moebiusTiger` | 赛博水墨虎 | ✅ | `res://assets/originals/moebiusTiger.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收 |
| `bird` | Boids 小鸟 | ✅ | `res://assets/originals/bird.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `longWingGlider` | 异星滑翔长翼鸟 | ✅ | `res://assets/originals/longWingGlider.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `craneNPC` | 丹顶鹤 NPC | ✅ | `res://assets/originals/craneNPC.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `messenger` | 送信人（玩家） | ✅ | `res://assets/originals/messenger.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `agentMessenger` | 数字孪生送信人 | ✅ | `res://assets/originals/agentMessenger.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `bookshopHydrangeas` | 书店绣球 | ✅ | `res://assets/originals/bookshopHydrangeas.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `grassTuft` | 草丛 | ✅ | `res://assets/originals/grassTuft.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `mossyGround` | 厚涂苔藓地被 | ✅ | `res://assets/originals/mossyGround.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_whale` | 沼泽·白鲸 | ✅ | `res://assets/originals/swamp_whale.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；1 个线/点图元（glTF 可保留坐标；线宽、点精灵和着色器需引擎适配）；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_worldTree` | 沼泽·世界树 | ✅ | `res://assets/originals/swamp_worldTree.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_nativeDoll` | 沼泽·原住民人偶 | ✅ | `res://assets/originals/swamp_nativeDoll.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_lotusLeafBoat` | 沼泽·莲叶舟 | ✅ | `res://assets/originals/swamp_lotusLeafBoat.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_eel` | 沼泽·黄绿鳗 | ✅ | `res://assets/originals/swamp_eel.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_tubeWorm` | 沼泽·橙红管虫丛 | ✅ | `res://assets/originals/swamp_tubeWorm.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_mushroom` | 沼泽·紫蘑菇/珊瑚 | ✅ | `res://assets/originals/swamp_mushroom.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_pinkHanger` | 沼泽·粉垂生物 | ✅ | `res://assets/originals/swamp_pinkHanger.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_bird` | 沼泽·沼泽鸟 | ✅ | `res://assets/originals/swamp_bird.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_monkey` | 沼泽·长尾猴 | ✅ | `res://assets/originals/swamp_monkey.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_lizard` | 沼泽·发光蜥蜴 | ✅ | `res://assets/originals/swamp_lizard.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_ribbonFish` | 沼泽·发光带鱼 | ✅ | `res://assets/originals/swamp_ribbonFish.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_shell` | 沼泽·贝壳 | ✅ | `res://assets/originals/swamp_shell.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_rimPalm` | 沼泽·坑缘棕榈 | ✅ | `res://assets/originals/swamp_rimPalm.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_toweringTree` | 沼泽·苍天巨树 | ✅ | `res://assets/originals/swamp_toweringTree.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_canopy` | 沼泽·树冠顶棚 | ✅ | `res://assets/originals/swamp_canopy.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；108 个线/点图元（glTF 可保留坐标；线宽、点精灵和着色器需引擎适配）；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_glowFlower` | 沼泽·发光花蕊花 | ✅ | `res://assets/originals/swamp_glowFlower.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_giantFlower` | 沼泽·巨花 | ✅ | `res://assets/originals/swamp_giantFlower.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_stamenSpike` | 沼泽·花蕊尖锥 | ✅ | `res://assets/originals/swamp_stamenSpike.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_fishSchool` | 沼泽·绿黑斑纹小鱼群 | ✅ | `res://assets/originals/swamp_fishSchool.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swamp_fireflies` | 沼泽·萤火虫群 | ✅ | `res://assets/originals/swamp_fireflies.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `swampZone` | 莫比斯湖沼生态区 | ✅ | `res://assets/originals/swampZone.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；4 个线/点图元（glTF 可保留坐标；线宽、点精灵和着色器需引擎适配）；572 个实例被展开（层级与实例关系需复核）；尚无优化/渲染对照记录（optimization=pending） |
| `moebiusCity` | 莫比斯水晶城 | ✅ | `res://assets/originals/moebiusCity.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；8 个线/点图元（glTF 可保留坐标；线宽、点精灵和着色器需引擎适配）；420 个实例被展开（层级与实例关系需复核）；尚无优化/渲染对照记录（optimization=pending） |
| `startingCamp` | 起始营地 | ✅ | `res://assets/originals/startingCamp.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `saihoji` | 西芳寺·苔海 | ✅ | `res://assets/originals/saihoji.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `planet` | 小星球本体 | ✅ | `res://assets/originals/planet.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `hills` | 岛丘地形 | ✅ | `res://assets/originals/hills.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `moonLake` | 月牙湖 | ✅ | `res://assets/originals/moonLake.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；尚无优化/渲染对照记录（optimization=pending） |
| `tramSystem` | 电车轨道系统 | ✅ | `res://assets/originals/tramSystem.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；2 个线/点图元（glTF 可保留坐标；线宽、点精灵和着色器需引擎适配）；尚无优化/渲染对照记录（optimization=pending） |
| `equatorialClouds` | 轨道云墙（书店→峡谷） | ✅ | `res://assets/originals/equatorialClouds.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；1 个线/点图元（glTF 可保留坐标；线宽、点精灵和着色器需引擎适配）；尚无优化/渲染对照记录（optimization=pending） |
| `platforms` | 平台土坡 | ✅ | `res://assets/originals/platforms.glb` | Godot 材质、描边、程序动画与交互仍需适配和视觉验收；1 个线/点图元（glTF 可保留坐标；线宽、点精灵和着色器需引擎适配）；尚无优化/渲染对照记录（optimization=pending） |
