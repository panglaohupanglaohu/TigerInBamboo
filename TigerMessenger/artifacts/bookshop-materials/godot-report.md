# Godot 书店两阶明暗 · 2026-09-08

本批只将默认主场景书店建筑的直接光照响应改为原 Web 的两阶渐变。保留原导入颜色、文字纹理、墨线、模型、碰撞、灯光和球面庭园；原 GLB/Blender 与前台未保存内容均未操作。

## 具体改动与来源

- `godot/shaders/bookshop_toon.gdshader`：依据 `src/assets/toon.js` 的 `[110,255]`、Nearest 采样，以及项目实际 `vendor/three.module.js` 的 `getGradientIrradiance` / `RE_Direct_Toon`。每盏直接光的法线夹角映射为 `N·L * 0.5 + 0.5`，因此两阶分界是 **N·L=0**，亮档为 1，暗档为 110/255；没有自行改成 0.5 分界。
- 保留实际灯光色、距离/阴影衰减与环境光；去掉原 Web Toon 本就没有的 PBR 高光。多盏灯和环境光叠加后画面仍有多个明度，并非把整个画面硬压成两种颜色。Godot 的 LIGHT_COLOR 已乘 PI，因此自定义光照按引擎约定除 PI，见 [Godot 4.7 spatial shader 文档](https://docs.godotengine.org/en/4.7/tutorials/shaders/shader_reference/spatial_shader.html)。
- `godot/scripts/bookshop_materials.gd`：仅遍历 `hard-to-find-bookshop` 子树，以运行时材质覆盖启用；26 个原实体部件和 50 个新增窗框，共 76 网格、181 个 GLB primitive 表面，复用 9 个材质。多数原盒子分成 6 个材质面，故网格数不等于表面数。
- 原颜色参数逐项直接复制并验证相等。招牌文字保持原有透明贴图材质，不送进不透明光照 shader；庭园、石板、花丛和墨线均不在转换子树内。
- 保留原材质剔除模式。特别是 v3 新窗框使用双面材质：首轮视觉复查发现统一背面剔除会使部分窗框消失，已为其保持 `cull_disabled` 并重跑对照，窗框恢复完整。无需修改源网格。
- `world.gd` 仅增加材料 helper preload 和书店构建末尾的启用调用。

## 实際运行证据

```sh
rtk proxy /Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot --path TigerMessenger/godot --script res://scripts/test_bookshop_materials.gd
rtk proxy git diff --check
```

Godot 4.7.2，Apple M2，OpenGL Compatibility。独立验证脚本只复用之前的行走/check 辅助函数，不覆盖之前两批的证据。

- 默认主场景加载并启用新 shader；全部 181 个表面的原颜色、原 GLB 材质资源、材质剔除状态检查通过。
- 真实玩家落地，步行出生点→书店地点→门前石径，仍能站稳；实际墙体射线阻挡、R 键第一封信交付通过。
- 固定同一玩家相机、灯光、HUD、对象变换，分别关闭/开启材质进行截图。`godot-before.png`、`godot-after.png` 实际均为 976×610，已逐张查看：屋顶完整入镜，右侧凸窗明暗分面更明确；窗框、门廊、原招牌和墨线保留。
- 实测绘制次数 **703→703**，图元 **157902→157902**，没有新渲染通道或额外几何。
- 改变 58975 像素，边界 (309,52)–(592,365)，局限于书店/招牌实体表面，HUD、庭园、石板、周边房屋未随材质开关改变。
- 结构与玩法详细结果见 `godot-validation.json`。当前高绘制基线来自既有原生环境，本批没有宣称全环境性能达标。

## 石板路核实（只检查，未改）

默认可玩场景中存在 `Entrance path 0` 至 `Entrance path 3` 四块 v3 石板；四块均 `visible_in_tree=true`、保留 StandardMaterial3D，剔除模式为 2（双面）。门前真实行走截图能看到石板路，验证日志保存了每块的局部位置及相机投影中心；投影数值使用逻辑视口，截图受桌面实际窗口尺寸缩放，不应直接当图像像素坐标。

抽查保存 GLB 的石板 0：顶面两个三角形的叉积 Y 均为 -3.3856001，说明源顶面绕序确实向内。当前 Godot 双面材质使顶面仍可见，连续庭园承担行走碰撞，因此未出现 Web 单面剔除下的石板消失/底面命中现象。该源数据问题仍存在，本批按分工没有修改石板、庭园或源文件。

## 界限

这是静态书店建筑的原两阶直接光照适配，不是全世界材质迁移。Godot 与 Web 的灯光强度、环境光、阴影采样及色彩映射仍不同，不能声称逐像素一致；移动端与其他渲染后端未验证。细窗框暂保留源双面状态，未顺带修复其底层绕序。没有遗留本批后台进程。

使用已读取的 threejs-game-director、threejs-aaa-graphics-builder（shader-cookbook / technical-art）、threejs-qa-release 的来源核对、预算与真实游戏对照流程；未声称执行浏览器材质测试。
