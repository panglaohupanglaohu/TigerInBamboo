# 山坡孤立树冠复查（2026-09-13）

上一轮为实际进展（广场前缘）。本轮先从截图反查像悬空的灰绿块。audit_visible_citadel_trees.mjs 实际像素射线确认其主要来自 highland-canopy-groves，而不是新的柏树。原26树冠及10棵完整圆冠树中心根部测量无整体高度偏差，不能宣称修复了不存在的整体坐标漂移。

压低灰绿球团仍像悬浮片，已淘汰该中间方案。当前 mountainForest.js 用已认可的 citadel-cypress-v1.blend 替换原独立球团，统一按3米间距、通路预留、5点根部支撑筛选。105来源点中31株柏树通过，74不适合点省略；独立圆团为0，原完整圆冠树不变。保留原生成代码与来源资产。

4个合并材质面4960三角形。Blender布局文件 assets/models/optimized/citadel-mountain-forest/mountain-forest-layout-r03.blend 已依据实际Web导出更新（原r02保留）。Godot原港适配器允许空的旧圆团节点，并隐藏旧版本，原生检查31株、4960三角形与0圆团通过。

实际网页广场1406支撑点、原船F键上下船通过；本轮没有改变通路。证据 artifacts/pipeline/citadel-visible-trees/index.html。没有完成平台与山崖衔接、主堡比例或完整攻城；接下来回到这些主体工作。
