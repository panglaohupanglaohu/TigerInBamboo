# Godot 书店墨线回接 · 2026-09-08

本批只给实际主场景中的 Blender v3 书店恢复原 Web 反向壳毛笔墨线。未修改原作表面材质、灯光、地形、其他区域、保存的 GLB/Blender，也未操作前台 Blender。

## 来源与实现

已阅读 `src/assets/toon.js`、`src/assets/bookshop.js`、原作 `assets/models/originals/bookshop.source.json` 的描边节点与材质、v3 GLB 的节点 extras。原 GLB 保留 `three_node_id`，但没有保存 Web 的 `isOutline` 子网格。Godot 当前导入结果不将该键提升为直接节点 metadata，因此本次使用保留的稳定 n<ID> 名称白名单兜底映射。

- 建筑主体、压顶、两侧凸窗、三角门廊采用原来的 0.025 局部单位厚度；台阶、玻璃、门洞、柱子、招牌实物部分采用原来的 0.015。
- 原 `#211e19` 松烟暖墨色、不受光、仅渲染背面、深度测试保留；压力表达式仍为 `0.65 + 0.6 * fract(sin(dot(position, vec3(12.9898,78.233,37.719))) * 43758.5453)`。
- 静态顶点在各自原局部空间一次性外扩，再按完整变换合并，保留非均匀缩放关系。实际外扩范围 0.00992134–0.03118505 局部单位。
- 片元沿用原局部 XY 的 `floor(position * 36)` 哈希飞白，`dry = 0.05`。UV 在墨线专用网格内只用于携带原局部 XY；原模型 UV 和文字贴图不变。
- 26 个原建筑实物部件的反向壳合并为 **1 个网格、1 个表面、416 个三角形**。招牌文字平面、v3 新增的细窗框、庭园和花丛不生成重复外壳。
- 墨线节点关闭投影和 GI，没有碰撞对象或拾取子节点。原墙体、庭园、玩家及交互系统不变。

代码：`godot/scripts/bookshop_ink.gd`、`godot/shaders/bookshop_brush_ink.gdshader`；`world.gd` 仅新增 preload 和书店构建末尾的 attach 调用。

## 实际验证

```sh
rtk proxy /Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot --path TigerMessenger/godot --script res://scripts/test_bookshop_integration.gd -- --ink-comparison
rtk proxy /Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot --headless --path TigerMessenger/godot --script /Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/bookshop-refinement/godot-pixel-check.gd
rtk proxy git diff --check
```

Godot 4.7.2 / Apple M2 / OpenGL Compatibility。主场景实际行走到书店和门前、落地、原招牌纹理、原建筑尺度、庭园边缘接地、实际墙体阻挡和 R 键首封信送达全部通过；新增描边部件数、单表面、厚度范围、无阴影/碰撞检查通过。

`godot-ink-off.png` 与 `godot-ink-on.png` 均来自真实主场景玩家镜头，先完成行走送信，再冻结同一个场景进行关/开对照，没有改变相机、灯光、HUD 或其他对象。实际画幅均为 976 × 610，已逐张查看：屋檐、凸窗外形、门廊、窗洞和招牌得到细暖黑勾边，主体色块保留，未见整面黑色覆盖。`godot-gameplay.png` 为本批最终开启墨线的游戏画面。

| 实测量 | 墨线关闭 | 墨线开启 | 增量 |
|---|---:|---:|---:|
| 渲染器总绘制次数/帧 | 702 | 703 | +1 |
| 渲染器总图元/帧 | 157486 | 157902 | +416 |

原场景的 702 次绘制基线已经偏高，本批没有宣称全环境性能达标；墨线没有额外阴影通道。

固定画面对照仅 1181 像素变化（全图 0.19837%），变化边界为 (309,51)–(593,365)，集中在书店及招牌，未扩散到 HUD、周边地形或房屋。像素面积检查用于辅助排除整面重复覆盖，不能替代美术验收。

详细结果：`godot-integration.json`、`godot-pixels.json`。此前 `artifacts/bookshop-integration/` 的证据未覆盖。此次测试支持 `--ink-comparison` 单独输出到本目录。

## 保留的差异与下一步界限

这次恢复静态建筑墨线，没有把 Godot 标准表面材质改成 Web 的两阶 Cel-shading。光照、色彩映射和细小亚像素线的表现仍可能与 Three.js 不同。压力哈希在 CPU 一次性计算，浮点精度与原 GPU GLSL 不完全相同，飞白哈希也受后端精度影响；不能宣称逐像素相同。v3 新窗框、花丛和庭园不在本次原建筑外壳映射中。

已用技能：threejs-game-director、threejs-aaa-graphics-builder（shader-cookbook / technical-art）、threejs-qa-release。采用原来源参数、合批预算与真实游戏对照流程；未作整个游戏 premium 或完整美术迁移声明。无本批后台作业遗留。
