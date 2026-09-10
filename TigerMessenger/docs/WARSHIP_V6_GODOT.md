# Godot 传统战船 v6 接入（2026-09-10）

`godot/scripts/saihoji_battle_world.gd` 的真实战斗 `_launch_ship` 已由 `originals/fisherBoat.glb` 切换为 `assets/warship-battle-v6/warship-battle-v6.glb`，经 `saihoji_warship_adapter.gd` 绑定，不只是复制资产。

## 保留与修正

- 保留原 GLB 26 位桨手、26 支船桨、原节点和全部 301 帧。52 手握点与对应桨局部坐标逐帧校验。
- 航行重放已保存划桨段，停靠及航路暂停时停桨；航向取球面路线切线，船体 +X 朝前，返航沿反向切线。
- v6 assembly 后段仍存旧跳板展开动作。v6 合同明确旧登船路径失效，因此适配器保持 `boarding.stowedMatrix`，不自动展开不适用的旧路径。
- 保留 GLB 顶点色；不修改 Web、Blender 源、原始 fisherBoat。
- 源与 Godot 副本 SHA 见 `godot/assets/warship-battle-v6/runtime-source.json`。

## 已验证

隔离 Godot 测试项目导入同一资产和脚本，通过 `tests/test_warship_v6.gd`：301 帧、52 握点，最大世界距离误差 0.0000154071；平放板矩阵误差 0。旋转、位移、1.7 倍缩放实际根节点下验证。

`tests/capture_warship_v6.gd` 加载真实 `saihoji_battle_world.tscn`，正常开始战斗后 6.1 秒截图，26 桨手、v6 元数据、pose 66；12 个去返航检查点方向点积最低 0.99999988；重置后船只及适配器实例计数均归零。

证据：`artifacts/pipeline/warship-v6-godot/index.html`。

## 未验收

25 位战士的新版甲板站位和登离船路径、船体对沿途地形的完整碰撞、全程战斗与音乐未在本任务验收。截图可见原 Godot 大地形遮挡，不能作为地形完成。旧 v1 登船路径结论不适用于 v6，不应打开自动展开跳板直到新版路径完成。
