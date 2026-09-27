# 苔庭目标图：Godot 本批接入与失败记录

2026-09-19。本批目标为 `assets/concepts/saihoji-battle-ambush-target-20260919-v2.png`。

## 已接入

- 使用 Web 导出的 `godot/data/saihoji-target-garden-20260919.json`，在原鲲背岛局部坐标接入 81 个网格、6550 个三角面、6 处浅池、25 棵原松位置。
- 原 91 块町步石隐藏，替换为当前 Web 的 26 块散布石。原资产未删除。
- 岛局部矩阵转换的最大树位置误差为 0.00001079；静态外围伏击地继续留在星球上，未挂到升起的鲲身。
- 实际 Godot GPU 截图：`artifacts/pipeline/saihoji-target-integration/godot-garden-after.png`。这是手动抬升鲲后的布局检查，尚非自然触发战斗截图。

## 舰队规则审计

- aircraft 独立巡航与吸取，不悬吊 SOCCO。
- SOCCO 为独立世界节点，抵岸后通过实际后坡板下客；只有 GatePod 的乘员使用索降绳。
- 增援只能由有效舰队命中触发；列阵、发现鲲、鲲升起均不能自行触发增援。
- `test_saihoji_ambush_signal.gd` 通过；`test_saihoji_battle_director.gd` 42 项通过；`test_saihoji_combat_rules.gd` 23 项通过。

## 明确未通过

既有 v3 静态松改用原资产 n8..n12 节点后，旧掩护算法仍识别 `_crown_` / `_trunk_`，导致识别为零。旧测试未检查实际50人容量，曾出现退出0的假阳性。

本批修复为：仅在 `_original_pine_` 父节点下识别 n8/n9 树干、n10/n11/n12 树冠；兼容 Godot 将名字中的点改为下划线。容量测试现在要求实际保留50个不重复、真实干地支撑的隐蔽位。

实际结果：识别10棵静态松、30个树冠批次、568个干地采样，但满足树冠覆盖及树干净空的隐蔽位只有 **3/50**。测试正确退出1。该问题源于既有静态外围布局，不由本批鲲背浅池替换引起。

**Godot 完整苔庭战斗未通过，不能宣称本批完成整场战斗回接。** 下一步需协调静态外围松冠与可行走干地，重新获得50个真实安全伏击位，再测登陆、隐蔽、发信号、机队受击、增援与撤离全流程。

视觉上还存在松冠拥挤、鲲背苔地覆盖不足和鲸身受光偏黑，未完成目标图视觉验收。

## 验证入口

Godot 程序：`/Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot`。均以 `--path TigerMessenger/godot --script res://tests/<测试名>` 执行；规则与容量使用 `--headless`。director 测试需设置 `SAIHOJI_REPORT` 输出路径。

- `test_saihoji_target_garden.gd`：同源网格与坐标通过，报告 `artifacts/pipeline/saihoji-target-integration/godot-layout-report.json`。
- `test_saihoji_pine_cover.gd`：真实失败，报告 `artifacts/pipeline/saihoji-target-integration/godot-cover-report.json`。
- 本批 GPU 渲染只启动一个临时 Godot 测试进程，截图后已退出。
