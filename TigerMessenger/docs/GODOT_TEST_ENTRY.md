## 用户最新要求：原地址直接加载优化后的游戏

打开 http://localhost:8931/TigerMessenger/ 应直接进入优化后的原游戏，不显示 Godot 跳转按钮或测试大厅。已撤掉跳转按钮，发布辅助脚本不再修改原入口。Godot 导出与大厅只作为开发诊断，不能代替原游戏交付。

每项改进必须核对原游戏真实加载引用，并在原场景中验证。仅完成 Godot 的圣城塔壳、旋梯和通行等仍需接回原游戏或完成原游戏整体引擎迁移，不能称已在8931主游戏生效。最终引擎迁移也应在同一入口直接加载完整游戏，不要求用户进入检视场景。

## Web 验证边界（最新）

中文大厅、圣城、苔庭和返回大厅已在浏览器显示；音频读取修正后无原解码错误。点击开始后的截图仍为待命，尚未证明 Web 战斗推进，需继续排查输入/启动；不能称网页完整战斗可玩。详见 artifacts/pipeline/godot-web-entry/report.json。

## 2026-09-10 首版网页导出

8931 原入口顶部已加入“Godot 新版测试 · 圣城 / 苔庭”。实际输出 `godot-web/index.html`，浏览器成功显示中文大厅、原场景圣城、苔庭，并返回大厅。截图在 `artifacts/pipeline/godot-web-entry/`。首次资源包约268 MB，尚未分区拆包。中文使用附带 OFL 许可的 Noto Sans CJK。

发现并修复苔庭音频以 FileAccess 读取导入资源的问题，改为 ResourceLoader 并对BGM实例复制后设循环；不改变原音频来源。自动浏览器检查不等于人工试听，也不等于完整战斗通关。

知识库合入指南：`docs/INTEGRATION_PLAYBOOK.md`。后续按其12步执行。

复现导出：在 Godot 项目执行 `--headless --export-release Web`，成功后运行 `python3 tools/pipeline/publish_godot_web.py`（从 TigerMessenger 目录）。官方模板已保存在 `tools/godot-templates/`。下一步实现版本目录发布与回退，避免覆盖用户正在运行的资源。

# Godot 统一测试入口

用户指定：在 http://localhost:8931/TigerMessenger/ 网页内直接运行 Godot，保留原网页版作为对照。不以启动本机窗口冒充网页运行。

当前已完成：主场景改为 scenes/test_hub.tscn。四个入口为圣城通行演练、苔庭战斗、原作全局与资产检视。TestNavigation 在同一进程切换，先移除并释放旧场景，再加载下一场景；右下角返回大厅会重置当前演练。已验证大厅→真实圣城→大厅，旧场景释放检查通过。

Web 发布正在接入：export_presets.cfg 使用 Compatibility、单线程 Web，避免额外跨域隔离前提；本机尚缺匹配 4.7.2 的导出模板。完成导出和真实浏览器验证之前，不标记为网页可用。

后续优化统一进入同一 Godot 项目，并重新导出 Web 后验收。Blender 候选导出、Godot 桌面接入、Web 发布、人工验收分别记录。圣城当前只包含三兵种通行，完整攻城待实现。

内存规则：最多一个编辑器和一个测试实例；重型测试串行，运行结束检查退出。禁止反复 open -n；不得关闭含未保存内容的编辑器。2026-09-10 已关闭核实的旧苔庭运行窗口，未关闭编辑器。
