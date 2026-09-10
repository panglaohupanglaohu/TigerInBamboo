# 湖沼救虎关卡配置 · 验证记录

2026-09-10。只完成配置与工作台查看，不声明捕获、改装、防护、护送、存读或登艇玩法已实现。

- 配置：`godot/data/levels/swamp-rescue-v1.json`，SHA256 `9d211c161b4f04a5f6960a9619c5f7e1bd622de2427b6741cd02a7a0b130c279`；16阶段、9区域、6检查点，未启用。
- `tools/test_swamp_rescue_level.mjs`：当前配置通过；15个错误配置反例和68个缺少条件检查通过。检查的是声明性数据，不是角色或物理模拟。
- `tools/test_rescue.mjs`：旧救援规则回归通过；本批没有修改旧主线推进与存档逻辑。
- 隔离工作台：`panel-1788987286472/report.json`，桌面1280×900、窄屏390×844均通过。加载失败/重试、16阶段中文、旧草稿零写入、执行回调零调用、配置文字不作为HTML执行。旧面板窄屏外框的既有溢出未改，新区域无横向溢出。
- 正常完整游戏入口：`world-panel-1788987427806/report.json` 与 `world-armor-config.png`。实际服务器响应与本地配置完全一致、16阶段显示、旧草稿保留、页面错误为零。主代理已查看截图。此截图的书店环境是正常游戏背景，不是湖沼救援已部署证明。
- 本次保留窄范围UI检查，不为只读配置入口重新执行全游戏性能/战斗/通关测试。所有浏览器检查使用独立上下文，不修改用户当前标签页或其浏览器存档。

复查：仓库根执行 `rtk proxy node TigerMessenger/tools/test_swamp_rescue_level.mjs`、`rtk proxy node TigerMessenger/tools/test_storyboard_level_panel.mjs`、`rtk proxy node TigerMessenger/tools/test_storyboard_level_world.mjs`。最后一项需要正在运行的项目HTTP服务，默认8765，可用STORYBOARD_BASE_URL显式覆盖。
