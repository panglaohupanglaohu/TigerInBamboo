# 信使人形重构 · 2026-09-13

本目录来自独立侧对话，用户明确要求“按照这个重构信使（送信人）模型”。认可参考为 `approved-target.png`，来自本次侧对话生成的《苏丹的游戏》男性气质启发的原创信使概念；不是竹虎角色。

## 交付及状态

- `human-courier.blend`：本地 Blender 建模源文件，带独立摄影棚、前后检查机位。
- `human-courier.glb`：仅角色层级，不含摄影棚，供 Godot/其他引擎导入。尚未替换 Godot 玩家控制器。
- `geometry.js`：同一 Blender 几何导出的网页数据，不是另写的近似模型。
- `approved-target.png`：用户认可目标。
- `/TigerMessenger/artifacts/pipeline/human-courier-v1/index.html`：目标、Blender 渲染、可旋转及动作切换的模型。

已接入 8931 原游戏的玩家工厂。原数字智能体完整源码仍位于 `src/assets/characters/agentMessenger.js`。球面位置、朝向、任务流程及碰撞规则未改。角色建模约 1.78 米，运行时统一缩放 0.48，使视觉高度保持原角色约 0.85 的范围，避免本次角色改造改变世界比例。

保留酒红披风、青绿长衣、右肩胸针、左胯信包、右手信封、卷轴与指南针。服装、头发和脸部为几何与纯色材质；当前无贴图、蒙皮骨架或布料模拟，是可分关节动画的候选版本。脸部自然度、卷发轮廓与衣料细节仍有目标差距，不能标为用户验收完成。

## 验证

`artifacts/pipeline/human-courier-v1/check.json` 保存本轮结果：

- 原游戏启动并存在 `isHumanCourier` 角色。
- 行走/乘坐/腾空/持信状态组合无非有限矩阵。
- 信封父节点为 `handR`，动画过程中局部坐标漂移为 0。
- 持信展示约 52 次绘制、9308 三角形（含展示地面）。刚性细节按关节与材质合批。
- 没有声称完整重新通关任务或 Godot 战斗验证。

## 修改范围与重建

构建器 `tools/pipeline/build_human_courier.py` 使用本地 Blender，未调用 Tripo/Hyper3D/Hunyuan 服务。本机未配置相应生成凭据。

执行 Blender `--background --factory-startup --python tools/pipeline/build_human_courier.py` 可重建此资产与渲染；验证脚本为 `tools/pipeline/check_human_courier.mjs`。所有终端命令遵循项目的 `rtk` 前缀要求。

运行时入口改动仅为 `src/player/agentMessenger.js` 的导出、`src/player/animation.js` 的人形分支、`src/player/player.js` 的说明；新实现位于 `src/assets/characters/humanCourier.js`。

回退时将 `src/player/agentMessenger.js` 的导出恢复为 `export * from "../assets/characters/agentMessenger.js";` 即可回到原数字智能体，不需要删除新资产。不触碰主线程的城堡、地形、其他未提交文件（包括 `boatRide.js`）。
