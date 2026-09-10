# 圣城岸线局部修正候选

实际执行 Blender 后台建模、保存 .blend、导出 GLB，再使用 Godot Metal Forward+ 渲染检查。

修正平台侧墙与顶面轮廓不一致、父级变换重复、岸前山体及背光高亮层穿出的问题。沿岸切分原三角面，同步降低两层山体的前缘，并把岸墙延伸到水面以下。建筑与原水面所在 candidate.glb 未改动。

正面穿出的深蓝色大块已消除。侧面仍有生硬的山体交接，岸墙也仍是平直大面；整体山体层次、岸墙细节、植被衔接及金色水面倒影未达到目标图。此候选未替换正式游戏，也未验证全场景通行。Godot 退出仍有 7 Texture RID 泄漏警告。

复现脚本：tools/fix_shore.py。模型：shoreline-corrected.blend。对比：index.html。
