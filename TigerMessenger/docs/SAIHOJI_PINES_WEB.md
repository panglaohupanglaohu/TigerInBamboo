# 苔庭松树：既有 Blender 候选回接 Web

2026-09-10，本批使用实际 `saihoji-pines-v1` 的25个原种子LOD0几何。没有再次付费生成，没有改原GLB、原Blender、`ancient.js`旧工厂。六庭布局和伏击编排由主任务独立接入；此文只记录资产接口与同镜头验证。

## 接口及坐标

`src/assets/saihojiPineOptimized.js`导出`createOptimizedSaihojiPine(seed)`，25个合法种子见`SAIHOJI_PINE_SEEDS`。非法种子抛错，不能静默用一棵通用松树替代。返回`giantTreeGroup`，保留`kind=gardenPine`、`collideRadius=.58`、`sourceSeed`，17原语义节点、5实际可见网格。旧描边语义节点留空隐藏，不生成重叠墨线壳。

返回根遵循原工厂seed yaw和1.02缩放。GLB n0就是返回根，不能在其外面再复制一个原工厂变换；原场景放置函数仍可覆盖yaw、再乘spec.scale。根1.02恢复为精确数，消除GLB浮点回读误差。子节点保持候选本地坐标，不烘焙世界位置。

`getOptimizedSaihojiPineBounds(seed)`返回去掉工厂根yaw/scale的本地范围，供布局使用；树干代理半径.30、碰撞代理.58不是全树包围球。每树真实高度/冠半径以及GLB路径、SHA256逐项见`artifacts/pipeline/saihoji-pines-web/report.json`。

## 材质与目标差距

几何来自现有候选。本批另设Web材质副本`target-palette-web-v1`，按`assets/concepts/ancient-pine-target-v1.png`采用灰褐树皮、深绿和橄榄浅绿层冠。原GLB材质不变。

| 槽 | Web目标sRGB |
|---|---|
| m0 树皮 | #766958 |
| m1 阴枝 | #504a3e |
| m2 暗冠 | #253e2b |
| m3 主冠 | #446439 |
| m4 亮冠 | #72934d |

Three.js由sRGB转线性一次，使用原项目两阶toon梯度。原GLB线性色记录在材质userData.sourceLinear，目标色在targetSRGB。候选连贯枝干、扁云冠明显有别于旧重叠球冠；但云冠仍比目标图薄，树皮细节更简，不能称为完美复刻。

## 数据与检查

`tools/pipeline/export_saihoji_pines_web.py`从25个实际GLB导出只读原二进制缓冲及节点元数据，源SHA与现有manifest逐项核对。生成`src/assets/saihojiPineData.js`约9.49MB，避免庞大数值数组；每seed按需解码一次、共享几何和材质，实例只复制节点变换。不得在单株释放时dispose共享资源。此批LOD0总量约9万三角面，不宣称整体帧率改善；远距LOD接入仍可后续推进。

`tools/pipeline/test_saihoji_pines_web.mjs`：29项通过，包括25seed/17节点/5mesh、有限数、根变换、五色映射、共享缓冲独立变换、非法种子拒绝、25源GLB哈希未变、浏览器无错误。测试在8765同项目目录执行，8931在测试开始时请求超时；实际游戏回接状态应以主任务最新实景为准。

同镜头同光照三图位于`artifacts/pipeline/saihoji-pines-web/`：`original.png`旧工厂，`candidate-source-palette.png`候选原色，`candidate-target-palette.png`候选Web目标色。这里是资产验证，不替代鲸背根部贴地、分散布局、伏击隐蔽和完整战斗验收。

本批读取技能：threejs-game-director、threejs-aaa-graphics-builder及technical-art参考；既有目标与候选已实看。
