# 书店第三轮模型：实际环境回接

2026-09-08。本批解决图片/模型检视已有，但实际环境仍使用旧几何的问题。

## 可打开结果

- Web 完整原世界：`http://127.0.0.1:8767/TigerMessenger/?autostart=1&timeOfDay=0.38`。WASD 行走，R 接过家书。本轮启动仓库根目录静态服务，原 8765 服务空响应但未被终止。
- Godot：`godot/project.godot` → 默认 `scenes/main.tscn`；也可运行 `Play-Godot.command`。点击开始救援，沿石径走到第一处书店，R 交信。
- `web-world-interaction.png` 是网页默认玩家相机、完整世界真实行走并接信后的画面。
- `web-world-close.png` 是同一完整运行世界、同一照明中的另设近景相机，非模型检视器；没有移除树木、飞行器或 HUD 以冒充玩家画面。近景相机只输出场景画布，因此不包含 DOM HUD。
- `godot-gameplay.png` 是原生默认主场景中真实玩家走到门前并交信后的画面。

## 实际源与接入方式

来源：`assets/models/optimized/bookshop-art-v3.blend`，SHA-256 `e2b65549a56af4f37ca3d1f9f0b7cdbebf223fbebc6cadd8d202fcad1956b3a5`。

Web：后台 Blender 读取保存副本，导出评估后的 27 个建筑网格、原节点局部变换和 50 件新增窗框。`bookshopArt.js` 将其同步接到现有书店工厂，窗框合并成一个网格，保留原运行时墨线、材质、可编辑文字、土坡变体和任务/碰撞对象引用。主环境花丛从遮住入口的旧九丛布局改为 v3 两侧布局，保留原花丛工厂。

Godot：真实 v3 GLB 直接接到默认主场景第一处书店，庭园外缘适应当前球面，并补足建筑/地面碰撞、入口朝向和相机距离。详细证据见 `godot-report.md`。

## 已执行检查

```sh
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --python TigerMessenger/tools/originals/export_bookshop_art_runtime.py
rtk proxy node TigerMessenger/tools/test_bookshop_art_integration.mjs
rtk proxy node TigerMessenger/tools/test_bookshop_runtime.mjs
rtk proxy /Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot --path TigerMessenger/godot --script res://scripts/test_bookshop_integration.gd
rtk proxy /Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot --headless --path TigerMessenger/godot -- --route-test
rtk proxy git diff --check
```

全部通过。第一次 Web 检查因旧 8765 服务空响应失败；改用 8767 后通过，花丛调整后再运行相关整合检查通过。没有将第一次服务失败记为通过。

- Web 来源版本 3 已在默认完整世界确认；10 扇窗从正面法线方向的首个命中均是对应玻璃，未被凸窗遮住。
- 招牌对象及可编辑文字保留；自定义土坡高度保留；重复应用不增加窗框；不匹配的工厂结构原子回退。
- 实际键盘 W 从距书店 7.03 米行走到 3.56 米；建筑碰撞阻止穿墙，角色落地；R 令救援章节由 0 变为 1。浏览器无 pageerror。
- 原无损拓扑路径独立保留（`artGeometry:false`）：同机位差异 0 字节，材质/节点身份和招牌编辑回归通过。此零差异仅指旧拓扑整理，不指本次造型变化。
- Godot 主场景行走、前庭落地、墙体阻挡、R 交信通过；庭园边缘最大接地距离 4.7 厘米；六个现有地点连续步行通过。
- 单建筑对照包含地面的最后一次渲染为 58 次绘制、1454 个三角形；Web 完整世界仍有较高绘制开销。软件 WebGL 数据不作为硬件帧率提升证据。

## 未完成的范围

Godot 周围仍包含旧实验环境，完整原作小镇/世界没有在本批迁移；Web 场景树木仍会部分遮挡招牌，巡游泡泡舱也会在运行中经过建筑前方。Godot 原作墨线/Toon 尚待进一步适配。书店没有新增可进入室内。本批没有新虎生成、付费服务、发布或 Git 提交。用户美术最终验收仍待实际反馈。

原 .blend、GLB 和前台 Blender 未保存编辑均保留。使用游戏总监/图形/验证技能，将实际环境加载、真实输入、游戏截图作为回接完成标准；相关读入指令列于 `artifacts/game-progress.md`。
