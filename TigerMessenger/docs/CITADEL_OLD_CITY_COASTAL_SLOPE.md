# 老城低层台地：原岩体衔接 R03

状态：已接默认8931与同一Godot；整体高山圣城目标未完成。目标基准 CITADEL_APPROVED_TARGET.md 不变。

## 实际变化

近景射线核对发现：主地形在老城低层台地前缘抬高，部分岩块伸进房屋/入口前方。初期只改封口岩壁、或仅改低于台地的部分，主镜头改善不足，因此R01/R02不作为交付版本。R03同时处理原 citadel-coastal-cliff-seal 与 citadel-oskar-grid-mountain-surface。

在原老城基座坐标系内，低层海侧（轮廓内部z>8且y在-.15至8）将侵入岩体退到基座下-.15；外围局部岩肩向海展开，最大水平附近位移约5.2。原WFC房屋、上层台地/建筑标高、城门与通路坐标保留。没有把整个城市压成统一高度。调整发生在树木贴地与沿坡小建筑适配之前。

Blender MCP保存了三轮源。当前完整地形检视打开 assets/models/optimized/citadel-old-city-slope/old-city-coastal-main-r03.blend，两个地形部件按同一老城参考系装配，包含检视相机与光照。Web读取 oldCityCoastalR03.js，输入几何摘要不一致会要求重新导出；仅用于启用旧岸坡的布局。

## 工程同步

- Web：src/world/citadel/oldCityCoastalSlope.js，messengerIsland 在封口岩壁完成之后、树木/沿坡建筑适配之前应用。
- 两项原网格：主地形17860→25810三角形；封口342→1028。实体部分合计增加8636，仍为原两个网格；Web既有背光轮廓层也同步新主地形，另增加7950三角形，没有新增轮廓绘制项。
- Godot：test_old_harbor_grade.mjs导出中加入当前封口岩壁，与主地形一起进入 old-harbor-ocean-grade.glb；old_harbor_grade_adapter隐藏旧版封口，避免新旧重叠。
- 原港船F上下船仍通过；前港驻泊船在此次修改范围之外。

## 验证边界

artifacts/pipeline/citadel-old-city-slope 保存同机位Web A/B、Godot昼夜实景、Blender源模型图。Web旧港上城1473点缺失0/阻挡0；Godot实际citadel_world中原装备短剑兵90段到达。路线坐标逐项一致。

这是低层岩体侵入与外缘岩肩的修正，不是完整山势复刻。仍可见上层台地悬挑、过于单一的高塔/背景山峰、稀疏的滨水层次与植被，以及Web灯笼的大球状光晕。后续应直接处理这些主视角体量与照明，避免把继续细分面数当作完成目标。

船员卸载保留在 CITADEL_FRONT_PORT_BERTH.md：旋转跳板内部干涉、长矛船头1处干涉待解，已有Blender V12伸缩板候选，不得以接岸点或F键驾驶代替真实卸载。
