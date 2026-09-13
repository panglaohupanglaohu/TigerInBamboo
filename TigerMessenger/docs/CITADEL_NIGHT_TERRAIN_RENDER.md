# Godot 圣城夜景山体修正（2026-09-13）

## 原因与实际修复

山体不是丢失或隐藏。实际网格、顶点颜色、可见层均有效；诊断渲染见 artifacts/pipeline/citadel-terrain-render。导出材质没有保留网页flatShading表现，原Godot夜间定向光还使用固定(-45,-30)方向、0.2强度。

- citadel_terrain_color.gdshader：通过视空间顶点导数恢复几何面法线，保持顶点色、几何与碰撞不变。
- 从实际8931夜景读取圣城光源：位置[156.4995654608874,91.10976620311112,58.19060502319397]、目标原点、颜色78aee0、强度0.62；记录godot/data/citadel-night-environment.json。Godot使用对应方向。
- 环境填光校准为9db9d8、0.85；这是Godot画面校准，不宣称两个引擎物理单位完全等同。
- 保留已有新旧城各3处暖色局部光。关闭夜景时恢复主光原方向、颜色、强度与环境能量。

## 证据与范围

实际Godot日夜截图确认岩面分界、临水台基和山坡轮廓可见。夜景环境测试验证方向、日景恢复与六处局部灯光数量；原两城灯光位置及开关测试单独运行。未更改几何和通路，未重复完整通行测试。8931保留已经存在的原游戏光照，本轮修正在Godot适配层。

参考Godot官方空间着色器变量定义：https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/spatial_shader.html

整体目标仍未完成。接下来以CITADEL_APPROVED_TARGET.md及认可scene-target-r01.png为准，继续门后转折平台建筑层次和主堡比例，不能把光照局部修正算成完整美术验收。
