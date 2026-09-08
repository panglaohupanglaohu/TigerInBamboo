# -*- coding: utf-8 -*-
"""把 Claude 这一批的真实状态写进 TODOS.md（H01 接管核对 + G01 + G02/G06）。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/docs/TODOS.md")
s = io.open(P, encoding="utf-8").read()

anchor = "### 本次交接的实际状态"
assert s.count(anchor) == 1

block = """### 接手批次 · Claude Opus（2026-09-07）

**H01 接管核对 — 执行环境（重要，与 Codex 不同）**

| 项 | 实际情况 |
|---|---|
| 执行客户端 | Claude（Cowork），通过桌面桥接连到本机 |
| Shell | **Linux VM**（aarch64），只挂载了 `TigerInBamboo` 这一个文件夹 |
| Blender | **够不到**。`/Applications/Blender.app` 在 macOS 上，这个 VM 里不存在 |
| Godot | **够不到**，同上 |
| `rtk` | **不存在**。PROJECT_HANDOFF 里的 `rtk proxy …` 是 Codex 的 macOS 环境，本客户端用不了 |
| Blender MCP | 未在本客户端注册；按 AGENTS.md 要求「接手客户端需核对自己的配置」——**未配置，未使用** |
| Node / Python3 | 有。Web 侧的 `tools/test_*.mjs` 全部可跑 |
| 无头渲染 | 云端容器里有 Chromium + Playwright，可离屏渲 three.js 做视觉对照 |

所以这一批能做的是**不需要 Blender/Godot 二进制的部分**：清单、脚本、Godot 场景文本、
Web 侧实现与验证。需要跑 Blender/Godot 的两步（G02 实际导出、G05 实际导入）
**写好了但没执行**，留给有那两个程序的机器。这一点没有绕过去的办法，也不假装做过。

未提交改动：接手时 `git status` 54 项，全部保留，没有 reset/clean/checkout。

**G01 原作导入映射 — 已完成并可复核**

- 新增 `tools/originals/build_godot_import_map.py`（纯 Python，无 Blender 依赖），
  已在本机跑过；产出：
  - `assets/models/godot-import-map.json`（72 项）
  - `godot/assets/originals/import-map.json`（Godot 工程内副本——`res://` 看不见外层 assets/）
  - `docs/GODOT_IMPORT_MAP.md`（人读版）
- 结果：**72/72 导出源文件真实存在**（`originals/blender-r3/<id>.blend`）；
  代表资产 7 项；`godot/assets/originals/` 目前 0 个 GLB（还没导，如实记为 0）。
- 导出源的选择规则写在脚本头部：默认取**原作存档**。
  `batch-candidates-v2` 自己标着「视觉对照未做」，拿它做「原作检视场景」自相矛盾；
  `optimized/<id>.blend` 只有 bookshop 与 moebiusTiger 两项，且是 Web 运行时优化产物。
  两者的路径与状态都逐项记在 `alternates` 里，将来要换源是改一个字段的事。
- **导入前就已知的缺口（70/72 项有）**，逐项写进 `knownGaps`：
  - 线/点图元 10 项 —— glTF 没有线图元，Blender 导出器会**直接丢**：
    `swamp_canopy` 108 个、`moebiusCity` 8、`moebiusSwamp` 4、`swampZone` 4、
    `moebiusTower` 3、`tramSystem` 2，其余 1 个。这是 Godot 迁移的第一个真问题。
  - 实例被展开 5 项：`moebiusSwamp` / `swampZone` 各 572、`moebiusCity` 420 ——
    层级与实例关系要复核，否则 Godot 里是几百个独立节点。
  - 70 项 `optimization=pending`（只有 2 项做过渲染对照）。

**G02 导出通路 — 已写，未执行**

- 新增 `tools/originals/export_godot_originals.py`。`--dry-run` 在本机跑通
  （7 项代表资产的源→目标映射逐条打印正确）；真正导出需要 Blender。
- 三条硬规则写进脚本并**断言**：① 只从映射指定的原作存档导，不碰任何通用模型生成器；
  ② 输出落在 `godot/assets/originals/`，**断言**不覆盖 `godot/assets/*.glb`
  那 10 个旧实验资产；③ 目标比源新时跳过，只读 .blend 从不保存回去
  （前台 Blender 可能有未保存内容）。
- 导出后会**再数一遍**只有边的网格与曲线对象，丢了就标 `partial` 并写进
  `export-report.json`——不拿一个能打开的 GLB 冒充导入成功。

**G06 检视场景 — 已写，未在 Godot 里打开过**

- 新增 `godot/scenes/asset_review.tscn` + `godot/scripts/asset_review.gd`。
- 读 `res://assets/originals/import-map.json` 列 72 项；**按需**实例化（一次一项——
  `moebiusSwamp` 4004 节点，开场全塞会卡死）；自动取景按包围盒算距离
  （bookshop 几米到 moebiusSwamp 半个星球，跨三个数量级，固定机位一定有一头看不见）。
- 每项在屏幕上显示**来源路径 + 导出状态 + 已知缺口**；没导出的显示占位与原因，
  不静默跳过——空场景最容易被误读成「导完了」。
- ⚠️ 我**没有 Godot 可以打开它**。GDScript 未经引擎解析，`.tscn` 未经加载验证。
  下一个有 Godot 的执行者第一步就是打开它，报语法/API 错误。

**下一条可以直接执行的动作**（需要 macOS + Blender + Godot）：

```sh
python3 TigerMessenger/tools/originals/build_godot_import_map.py      # 已跑过，可重跑
python3 TigerMessenger/tools/originals/export_godot_originals.py --representative
# 然后用 Godot 打开 godot/project.godot，运行 scenes/asset_review.tscn
```

**Web 侧本批实际完成（与 Godot 队列并行，不占用 G 的依赖）**

这几项是用户在本轮直接提的需求，已实现 + 有测试 + 有离屏渲染对照：

- 舰队编队学：僚机两档队形（密集/战术掩护轮）、气垫艇低通跟位、侦察机 standoff 盘旋
  与空中曳光指示。`tools/test_fleet_own_style.mjs`、`test_scout_fleet_wing.mjs`、
  `test_fleet_cohesion.mjs`、`test_flagship_autonomy.mjs` 全绿。
- 拆掉 `missionLock`：主舰只按自己的航线飞，登陆队对它只读不写；空降的唯一触发
  改成「主舰受到攻击」。
- 月亮湖的月牙（`src/world/moonOrb.js`）：`tools/test_moon_orb.mjs` 9 项全绿。
- 苔庭之鲸参战（`src/world/whaleMaw.js`）：被绳索拉扯的挣扎、沿口裂线切开的下颌下沉 +
  喉囊鼓胀、吞入重甲兵（一路挣扎）、腹中运送、排出后军服变土黄。
  `tools/test_whale_maw.mjs` 10 项全绿。
- 顺带修了一个真 bug：`updateLakeFx` 在此之前**全仓库没有调用点**，
  湖的涟漪 / 涉水水花 / 倒影呼吸三样写好了从没跑过；已接上主循环。

预存红：`tools/test_leviathan.mjs`「松树投影超出地壳板」。经核对与本批无关——
它依赖未提交的 `src/world/saihoji.js` 改动，那不是本批改的文件。

---

""" + anchor
s = s.replace(anchor, block, 1)

# 队列表里的 H01 / G01 状态跟着更新
s = s.replace(
  "| H01 接管核对 | 待接手者执行 |",
  "| H01 接管核对 | ✅ Claude 已执行（2026-09-07，见下方接手批次） |", 1)
s = s.replace(
  "| G01 原作导入映射 | 可立即执行 |",
  "| G01 原作导入映射 | ✅ 已完成（godot-import-map.json，72/72 源存在） |", 1)
s = s.replace(
  "| G02–G03 代表资产导出 | G01 后执行 |",
  "| G02–G03 代表资产导出 | 通路已写好，**待有 Blender 的机器执行** |", 1)
s = s.replace("- [ ] G01 建立原资产 ID → 源快照",
              "- [x] G01 建立原资产 ID → 源快照", 1)

io.open(P, "w", encoding="utf-8").write(s)
print("patched TODOS.md")
