# Godot 书店实际环境回接 · 2026-09-08

本批将现有 `assets/models/optimized/bookshop-art-v3.blend` 对应的 `godot/assets/art-pilots/bookshop-art-v3.glb` 接入当前默认 `scenes/main.tscn` 的第一个书店地点。`project.godot` 主场景设置未更改，原 Blender、原 GLB 与独立检视场景均保留。

## 实际修改

- `godot/scripts/world.gd`：第一处书店从旧 `assets/bookshop.glb` 换成上述 v3；建筑维持原作 1:1 比例，墙体实测 4.60001 × 7.00001 × 3.60001 米。保留原 GLB 的窗框、凸窗、两侧绣球、材质及 HARD TO FIND BOOKSHOP 文字贴图。
- 入口朝向现有邮路，模型在球面上重新定向及接地。书店庭园范围内不生成旧小镇房屋，避免穿插。
- 仅运行时庭园外裙适应该原生小球的地形，内庭与建筑不变形；庭园视觉网格生成同形碰撞，墙体、凸窗、台阶、门柱等使用对应网格碰撞。独立小铺路石共用下方连续庭园碰撞，解决角色被每块约 8 厘米高的边缘卡住的问题。
- 为七米高书店将初始跟随镜头距离调至 14 米，保留现有滚轮调节。加书店局部柔和补光；未换掉 GLB 的原材质。
- `godot/scripts/test_bookshop_integration.gd`：在真实主场景中驱动原生玩家，验证资源、尺度、招牌、外裙接地、门前行走、实际墙体碰撞与 R 键送信。

## 实际运行与结果

引擎：Godot 4.7.2，Apple M2，OpenGL Compatibility。

```sh
rtk proxy /Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot --path TigerMessenger/godot --script res://scripts/test_bookshop_integration.gd
rtk proxy /Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot --headless --path TigerMessenger/godot -- --route-test
rtk proxy git diff --check
```

- 主场景回接验证通过：出生点落地、步行到书店地点、步行至门前铺路、门前落地、墙体阻挡、R 键完成第一封信，零失败。
- 庭园最外圈顶点与球面表面最大距离 0.04685 米，边缘轻微压入地形，未见悬空裙边。
- 原有全部六个地点用 CharacterBody3D 连续步行通过，耗时 12.5 秒；本项验证路线没有被大书店或碰撞阻断，不代表故事机制深化已经完成。
- `git diff --check` 通过。
- `godot-integration.json` 保存结构与玩法结果；`godot-gameplay.png` 是玩家走到门前并送信后的真实主场景截图，已查看：完整屋顶可见，窗口、门廊、花丛、原文字招牌与地面衔接可辨。
- 图像实际为 976 × 610 像素，窗口受当前桌面可用空间限制；没有将其冒称 1280 × 800 验收。没有为截图替换相机、隐藏 HUD 或换成独立模型检视画面。

## 交付入口与界限

双击 `TigerMessenger/Play-Godot.command`，点击“开始救援”，沿金色石径前往首个书店即可看到新版；WASD 行走，右键拖动转向，滚轮改变距离，R 送信。

这是新版书店进入现有原生可玩环境的接入结果。周围房屋、地球、玩家和后续地点仍包含旧实验实现；不代表完整原作书店镇或世界已迁移。Godot 材质仍为导入的标准材质，原 Web 墨线/Toon 着色器未完整移植；原作建筑没有可进入的室内。用户美术验收尚未完成。

已读取技能：threejs-game-director、threejs-debug-profiler、threejs-qa-release；针对本次原生接入，采用真实运行、行走与实际画面验证原则，未宣称执行 Three.js 浏览器检查。未操作前台 Blender，无额外后台作业遗留。
