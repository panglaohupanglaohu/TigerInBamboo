# 主堡蓝顶塔楼轮廓重构

2026-09-13，按当前认可目标图修正蓝顶塔身与圆顶的连接。本轮从主体体量入手，不更换目标图。

原先8个方盒塔身中的3座蓝顶塔改为八角截面，保留另外5座方形堡垒/中央旋梯塔，形成体量对比。周向7面薄墙与WFC正立面连接，连续八角环檐避免8根重叠檐条的共面闪烁；蓝顶旋转22.5度与塔身转角对齐，顶弧高度由半径的0.98倍降至0.70倍。保留原塔楼位置、主门、中央旋梯、顶层出口及广场/原木马引用。

WFC仍解算7组正立面，保留真实窗洞：3座改造塔分别对窗心及相邻墙做射线，窗后发光面与墙面深度相差0.39米。代码源为targetCastleSilhouette.js，旧版源保存在对照目录before-source.js。本批使用原工程WFC程序模块构建，没有声称新增Blender建模。

Web test_faceted_towers.mjs记录同机位改造前后，7立面求解与真实开窗通过；test_west_city.cjs完成当前路线检查并导出同一Godot；test_web_tower_connections.cjs另确认原塔274个踏步点和旧塔门洞，不将它混称新主堡完整行军。新主堡完整场景原角色行军另用test_faceted_castle_march.gd验证。

当前尚未等同目标完成：整体门后平台/主堡比例、主门入口表现、滨水连续体量、群体攻城及整体氛围仍待推进。证据目录artifacts/pipeline/citadel-faceted-towers/。

## Godot完整场景验证结果

原测试400秒模拟上限不足，停在669段且无阻挡；时限改为按route.size计算，不降低碰撞约束。最终test_faceted_castle_march.gd在实际citadel_world场景使用原gladius模型和生产控制器，760段全部完成，phase=arrived，近199万次几何查询。未覆盖船舶、群体和攻城。capture_faceted_towers.gd已录得同一工程昼夜实景；所有Godot进程顺序运行且退出。
