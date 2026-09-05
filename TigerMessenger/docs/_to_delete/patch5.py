import os
D = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/docs/")

# ---------------- GROK_TASKS ----------------
p = D + "CITADEL_GROK_TASKS.md"
s = open(p).read()

# 1) preamble 行号修正（实测 localStorage 那行在 31，不是 30）
s = s.replace(
"> - 需要 Three.js 的 headless 脚本，**逐字复制** `tools/test_cell_ownership.mjs` 第 14–30 行的 preamble（three 桥接包 + window/document/localStorage 桩），不要自己发明。",
"> - 需要 Three.js 的 headless 脚本，**逐字复制** `tools/test_cell_ownership.mjs` 第 **14–31** 行的 preamble（three 桥接包 + window/document/localStorage 桩），不要自己发明。（2026-09-04 核对：`globalThis.localStorage` 在第 31 行，早前工单写的 14–30 会漏掉它，脚本一跑就炸。）")

# 2) 头部加一节「开工前自检」
anchor = "> 4. **发现断言不过时，先分清「测试写错」还是「真 bug」**。"
i = s.index(anchor)
j = s.index("\n\n---\n", i)
s = s[:j] + """

## 开工前 5 分钟：先跑这一串确认基线

**任何一张单动手之前先跑完这 17 条**，把结果贴在你的第一条回复里。
不是形式主义：这个仓库有 3 个脚本**本来就是红的**（见下），不先确认基线就分不清是你弄红的还是本来红的。

```bash
# 你要改的那块的地基（按你的单挑对应那几条跑，全跑也只要两分钟）
node tools/test_corner_prototypes.mjs        # G-13 / G-14 的地基
node tools/probe_grid_migration.mjs          # G-17 的地基
node tools/probe_stencil_windows.mjs         # G-19 的地基
node tools/report_wfc_100seed.mjs            # C6 体检数字
node tools/probe_span_cost.mjs               # G-20 的成本探针
# 全局不倒退门（每张单都要跑）
node tools/test_cell_ownership.mjs
node tools/test_face_to_cell_parity.mjs
node tools/test_edit_exactness.mjs
node tools/test_edit_soak.mjs
node tools/test_castle_building_experience.mjs
node tools/test_wfc_town_selection.mjs
node tools/test_wfc_incremental.mjs
node tools/test_irregular_quad_grid.mjs
node tools/gen_corner_mask_table.mjs
node tools/extract_adjacency_stats.mjs
node tools/test_citadel_tactical_graph.mjs
node tools/test_citadel_topology.mjs         # ⚠️ 这条**本来就红**，见下
```

**2026-09-04 晚实测：上面 17 条里 16 条绿，只有 `test_citadel_topology` 红**
（「G0 蓝图 hash 不得因 G1 派生 API 漂移」）。它在本轮工作开始前就红了，
`citadelBlueprint.js` 是别人改的。**不要顺手改它的 expected 去转绿**，
也不要因为它红就不敢提交——它跟你的单没关系，除非你的单是 G-18（那张单的 §3 专门讲了怎么处理）。

另外两个已知红项（不在上面的清单里，跑到了别当成自己弄的）：
`test_townscaper_support`（支柱构造被外部改成单斜柱，测试还在断言旧的四环柱设计）、
`test_planet_v9_runtime_wiring`（`messengerIsland.js` 被外部改过）。
`test_procgen_profiles_hard_routes` 的 expected 里 highland 一项写的是字符串 `"PLACEHOLDER"`，**从来没绿过**。
""" + s[j:]

# 3) G-20 已决策
s = s.replace(
"""## G-20 · 跨格构件分量签名缓存（C4 未尽项）[**前提已失效，派前先复核**]

**状态：⚠️ 2026-09-04 复核——立项前提没了。**""",
"""## G-20 · 跨格构件分量签名缓存（C4 未尽项）[✅ 可立即派发]

**状态：✅ 主人 2026-09-04 已裁定「照做」——按 (b) 走，把它当作给 C6 接线预留的性能余量。**
下面那段「前提已失效」保留是为了让接单的人知道**现在的门是白送的**：
P90 已经在 150 以内，所以本单的验收**不是"把 P90 压到 150"**，而是
**"把门从 200 改回 150 且不倒退"**——真正难的是 `test_edit_exactness` 的逐格 0 误差别被缓存打破。

**原始复核记录：**""")

open(p, "w").write(s)

# ---------------- TODOS ----------------
p2 = D + "CITADEL_BUILD_PIPELINE_TODOS.md"
t = open(p2).read()
old = """- [ ] [Grok] **分量签名缓存** → 工单 **G-20**（2026-09-04 新建）。⚠️ **前提已失效，派前先决策**："""
new = """- [ ] [Grok] **分量签名缓存** → 工单 **G-20**（2026-09-04 新建）。✅ **主人已裁定：照做**（按 (b)，给 C6 接线预留余量）。
      注意验收变了：不是「把 P90 压到 150」（它已经在门内），而是**「把门从 200 改回 150 且不倒退」**——
      真正难的是别让缓存打破 `test_edit_exactness` 的逐格 0 误差。原始复核记录："""
assert old in t
t = t.replace(old, new)

t = t.replace(
"""## 当前红项（2026-09-04 20:5x，交接时状态）""",
"""## 派单就绪核对（2026-09-04 晚，Claude 实跑）

主人问「Grok 能按这两个文件干活了吗」。逐条核过：

| 核对项 | 结果 |
| --- | --- |
| 7 张可派单点名的源文件 / 数据文件是否都在 | ✅ 12/12 全在（`cornerPrototypes.js` / `gridMigration.js` / `stencilWindows.js` / `CITADEL_GRID_V6_DOWNSTREAM.md` / `corner_mask_table.json` / 三个 probe / …） |
| 工单让 Grok import 的导出名是否真的存在 | ✅ 逐个 import 验过（`cornerBuildAllowedClasses` / `cornerFaceBits` / `migrateAsciiToFaces` / `facesToAscii` / `windowSpansCellCorner` / …） |
| 工单点名要跑的命令是否真的能跑 | ✅ 17 条实跑，**16 绿 1 红**；唯一红的 `test_citadel_topology` 是本轮之前就红的，已在工单里写清楚「不要改它的 expected 转绿」 |
| headless preamble 的行号 | ⚠️ **已修**：工单原写「第 14–30 行」，实测 `globalThis.localStorage` 在**第 31 行**，照 14–30 抄会漏掉它、脚本一跑就炸。已改成 14–31 |
| 每张单是否有验收命令与禁止事项 | ✅ G-11 / G-13 / G-14 / G-17 / G-18 / G-19 / G-20 七张单都补齐了 |
| 已作废的单是否标清楚 | ✅ G-01b / G-07 / G-09 三张标了 ❌ 作废并写了原因；G-03 标了「换了载体，不要新建文件」 |

**结论：可以派了。** 建议先派 **G-13 + G-14**（角柱，互相衔接、地基已绿）与 **G-17**（迁移测试，最独立），
这三张的前置最硬、返工风险最低。G-18 要先读 `CITADEL_GRID_V6_DOWNSTREAM.md`（它推翻了工单正文里猜的文件清单）。

---

## 当前红项（2026-09-04 20:5x，交接时状态）""")
open(p2, "w").write(t)
print("ok")
