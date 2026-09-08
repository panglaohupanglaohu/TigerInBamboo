# 原世界书店招牌受光修复

本批只修复原作招牌文字的材质语义，不宣称全书店镇环境或玩法已经完成。原 Web `src/assets/bookshop.js:253` 使用 `MeshBasicMaterial`，文字不受灯光影响；完整原世界 GLB 保留了透明纹理却未带 `KHR_materials_unlit`，原生导入后文字受光。`source-audit.json` 保存唯一 sourcePath、源哈希及导出材质证据。

新增 `godot/scripts/bookshop_world_adapter.gd` 精确绑定原招牌，复制并复用一个 unshaded 材质。透明深度预处理、纹理引用、UV、剔除、过滤、颜色与原几何都保持。六次开关不累积材质；禁用和解绑恢复原表面 override。重复 sourcePath 拒绝绑定。根代理在 `original_world.gd` 加入默认启用挂钩。

正式结果：`final-03/report.json`、`validation.json`、`pixel-validation.json` 均通过。实际原世界 12,727 个带 sourcePath 的节点身份、父级、变换、显隐保持。没有新增房屋、路灯、电线杆、植被或地形，也没有更改已完成石板材质。

截图来自完整 `original_world.tscn` 的真实 Godot OpenGL/Metal 渲染，1280×800，独立快照、后台进程、隐藏主窗口与 SubViewport，不是用户桌面截图或模型摆拍。`sign-before.png` / `sign-after.png` 是同世界、同相机、同光照；正常光照差异较小。`sign-dark-before.png` / `sign-dark-after.png` 仅临时关闭真实场景的灯光和环境光，证明文字受光语义，随后恢复。`bookshop-original-context.png` 展示原地书店与通路；不用于证明自然行走通过。

像素诊断采样 16,191 个金色文字像素：修复前全暗为 RGB 0；修复后均值约 (197,164,51)。修复后正常光照与暗光的文字采样平均差为 2.22/255（包含文字透明边缘），符合不受光的原始语义。实际图片已查看。

运行：`rtk proxy python3 tools/pipeline/test_bookshop_world_godot.py --output artifacts/pipeline/bookshop-world-sign/NEW_RUN --capture`。导入仅发生在新临时项目，活动编辑器缓存未读取或导入；独立历史验证缓存用于种子。代码先解析，再跑无头断言，最后后台捕获。`--capture` 为 macOS 后台应用运行方式。

仍未完成：原世界书店步行/交信交互、动态改名，以及其他原环境着色适配。原生紧凑实验场景的旧路线通过记录不能代替这些原世界验证。早期失败诊断保留在 run-01/run-02，原因写入 summary.json；引用最终 final-03。
