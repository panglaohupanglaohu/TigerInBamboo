# 主堡前中层台地与房屋调整

2026-09-13，按认可目标释放主阶梯两侧空间。本批位于新城中层y10，未把新城中层调整冒充旧城迁移完成。

- 中层房屋由12栋减至4栋，保留两侧外缘原模型，明确保存原variant索引4/6/13/15；左右位置和高度略错开。原资产文件未删除，远处旧城房屋与自定义地块不受影响。
- 中层两侧台地外角收折（后角5.5米、前角3.2米），中央台地缺口和主路坐标保持；外侧补0.85米护墙和压顶，中央阶梯侧保持开放。
- 复用原Blender柏树及灌木在释放出来的台地上配置绿植。
- Blender MCP两轮：middle-terraces-r01.blend保存收角底座；r02增加外缘护墙/压顶并做0.035米边角处理。当前稳定模块middleTerracesR01.js指向r02，共1064三角形/3个合并材质网格。源几何签名防止回接过期数据。

Web test_middle_terraces.mjs：真实前后12→4栋对照，4栋共20个支撑点通过，7组主堡WFC立面仍正常；test_west_city.cjs当前路线及原木马锚点通过并同步Godot GLB。全src检索未发现战斗逻辑按被移除房屋实例名绑定，原west-city-middle昼夜更新身份保留；这不等于完整战斗验证。

证据目录artifacts/pipeline/citadel-middle-terraces，保留before-sources、round-one.png、最终Web/Godot实景及报告。主体整体和门后平台高差仍未达到目标，原前港船舶/靠泊和完整攻城还未收口。

Godot实际citadel_world场景原短剑兵完成760段、到达顶层出口，phase=arrived。日/夜实景已录制，导入/通行/截图进程均退出0；没有另开常驻Godot窗口。
