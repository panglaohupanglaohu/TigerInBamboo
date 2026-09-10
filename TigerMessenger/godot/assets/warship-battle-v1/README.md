# 战船：已保存的受限候选，尚不可战场发布

保留原船体、+X 船头双眼与撞角、340 原节点父级、每侧13桨、26独立桨手（286源实例）。新增真实桨柄握点、前后臂、舷桨架、清空中路的货箱布局、折叠座板、可收起登船板与挂点。26桨手仍为原简脸/头盔家族，不算新版六种罗马战斗兵脸型完成。

已检查的最终结果：

- 301帧保存矩阵误差0；15,652次手/桨柄锚点误差最大1.72e-7。
- 全301帧：全部桨柄对26身体、桨对甲板/舷缘、腿对甲板/固定及折叠座板，真实三角面交叉均0。
- 229个实际蓝短剑兵全网格位置通过甲板、侧门、登船板；盾剑对自身胸头腿无交叉。原29个可见士兵网格几何未改变，握点误差≤1.46e-7。仅单兵持盾通过姿态，不是行走步态或25人调度。
- GLB全原节点/父级、754可见UV网格、31原材质因子与18可见材质回读通过；矩阵误差<4.77e-7。主船体/撞角/双眼局部几何误差≤5.97e-8。

**未通过：相邻原桨叶在36/301帧相交。** 只读源与候选交叉帧、桨对完全一致。不得把前面的分项通过称为“所有划桨净空通过”，也不得正式回接战场。下一步先修划桨同步和相邻净空，再做25人调度、原实例化恢复。静态GLB无动画；完整301帧在Blender及assembly内。登船板还需真实岸面求角、足底IK，麻醉/战损/夜灯/航迹仍由原运行时管理。

最终GLB为961节点、754可见网格、50,040三角、3,184,712字节。此为证明候选；未认证舰队运行性能。Godot目录仅存候选文件与阻断合同，没有修改运行时、导入缓存或启用替换。

入口：`PLACEMENT.md`、`validation-summary.json`、`boarding-path.json`。完整检视动画：项目 artifacts/pipeline/warship-battle-v1/boarding-review.blend。实图入口：同目录 review.html。

复验命令（项目目录，独立后台）：

```
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python artifacts/pipeline/warship-battle-v1/validate_and_roundtrip.py -- --no-render
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python artifacts/pipeline/warship-battle-v1/audit_seats.py
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python artifacts/pipeline/warship-battle-v1/validate_boarding_path.py -- --no-render
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python artifacts/pipeline/warship-battle-v1/check_carry_contract.py
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python artifacts/pipeline/warship-battle-v1/check_oar_neighbors.py
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python artifacts/pipeline/warship-battle-v1/check_source_oar_neighbors.py
```
