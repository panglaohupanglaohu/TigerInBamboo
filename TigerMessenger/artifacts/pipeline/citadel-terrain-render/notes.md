# 夜景山体材质调查

实际同机位对照证明山体网格仍在，颜色输入非零。current、standard-linear、standard-srgb、unshaded、normal-debug、color-display 为独立诊断渲染。

当前 citadel_terrain_color.gdshader 已用屏幕导数重建几何面法线，恢复低多边形面分界，不修改网格或碰撞；Godot实际场景日夜渲染成功。face-normal-after.png 可见分面，但夜景整体山体仍偏暗，尚未完成目标图布光。

参考 Godot 官方 spatial shader 文档中的 fragment VERTEX/NORMAL/VIEW 空间定义：https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/spatial_shader.html

下一步继续核对定向光与新城补光覆盖；不得以此局部材质修正宣称整座圣城已达到认可目标。
