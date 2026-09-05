import os
DOCS = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/docs")
p = os.path.join(DOCS, "CITADEL_HANDOFF.md")
s = open(p).read()

# 1) 标题下加复核提要
old = """> 场景：本会话跑 Claude 侧任务，Grok 并行跑 `docs/CITADEL_GROK_TASKS.md` 的工单。
> 本文回答一件事：**TODOS 里标 [Claude] 的项，哪些能交给 GLM-5.3-Flash，哪些必须留给 Grok，哪些谁都不该接。**"""
assert old in s
s = s.replace(old, """> 场景：本会话跑 Claude 侧任务，Grok 并行跑 `docs/CITADEL_GROK_TASKS.md` 的工单。
> 本文回答一件事：**TODOS 里标 [Claude] 的项，哪些能交给 GLM-5.3-Flash，哪些必须留给 Grok，哪些谁都不该接。**

---

## ⚠️ 2026-09-04 晚复核：分配问题已经不是瓶颈了

本文写的时候，默认「有一堆活要分给三方」。当晚把 `CITADEL_GROK_TASKS.md` 20 张单逐张核了一遍，
情况变了：**Grok 那边还没勾的 7 项里，没有一项是「工单写好了、只等 Grok 动手」的。**

| 类别 | 项 |
| --- | --- |
| 作废（判据写反，Claude 已用正确判据做掉） | C3 throw 守门 / G-01b |
| 前提失效（P90 已回到门内），要先决策做不做 | C4 分量签名缓存 / G-20 |
| 工单太薄，已由 Claude 补写成完整五件套 | C8 `decoratePass` / G-11 |
| **卡在 [Claude] 欠的规格上** | C9 角落分段目录 → G-13/G-14；C10 迁移函数 → G-17；C10 下游清单 → G-18；C11 stencil 原型 → G-19 |

**结论换一句话：现在的瓶颈是 Claude 欠着四份规格，不是谁接哪个活。**
这四份写出来，五张 Grok 单同时解锁；写不出来，派谁都一样卡着。所以下面这张分配表要配合
「四份规格的优先级」一起看，不能只按 A/B/C/D 打分派人。

### 欠的四份规格（全是 [Claude]，全部未开始）

| 规格 | 交付物 | 解锁 | 为什么只能 Claude 写 |
| --- | --- | --- | --- |
| C9 角落分段目录 | `src/world/citadel/cornerPrototypes.js`：55 个 mask 类各自的 1/4 格几何、六向 socket、`allowedClasses` | G-13 → G-14 → 角落评估报告 | C 高 D 高：这是「模块单元与 Oskar 拉齐」的本体，错了整个阶段 4 白做 |
| C10 存档迁移 | `migrateAsciiToFaces(levels, grid)` / `facesToAscii(byFace, grid)`；`citadelLevelsKey` 升 v6 | G-17 | 迁移口径（哪个 face 算「最近」、旧档怎么回读）是设计决定，不是实现细节 |
| C10 下游清单 | 一张「文件:函数 → 现在按 (ix,iz) 取中心，改按 faceId 取重心」的表 | G-18 | 要判断哪些地方**不该**改（N5：不重写寻路） |
| C11 stencil 原型 | 窗框写 stencil + 墙 `NotEqualStencilFunc` + `applyInkOutlines` 壳同做 stencil 测试 | G-19 | C 高 D 高：与描边壳的交互只能看渲染结果 |""")

# 2) C4 行修正
old = "| C4 未尽项 · **分量签名缓存** | 屋顶/连拱/内院分量的「形状签名没变就不重发」，把 P90 从 190ms 压回 150 以内 | **Grok** | B 高 D 高：要同时改摘除谓词与发射门，且必须保住 `test_edit_exactness` 的逐格 0 误差。有现成的量化门（P90 ≤ 150、累积 ≤ 5%），Grok 能自证 |"
assert old in s
s = s.replace(old, "| C4 未尽项 · **分量签名缓存** | 屋顶/连拱/内院分量的「形状签名没变就不重发」 | ⚠️ **先别派，前提没了** | 立项理由是 P90 190ms。2026-09-04 实测 `test_castle_building_experience` **P50 75.6–80.2 / P90 123.1–128.5ms**，生产去抖路径更低（`probe_span_cost.mjs`：P50 65.3 / P90 76.0）。本项的验收标准（P90 ≤ 150）**现在无条件满足**。要么把门从 200 收回 150 收工，要么当作给 C6 接线预留余量再做——**这是个决策，不是分配**。工单见 G-20 |")

# 3) C6 门 I 行修正
old = "| C6 · **门 I（传播可见）** | 复现 S19 t=0.70 / t=1.40 的传播 | **谁都不接，留给 Claude** | C 高：判据是「画面像不像」。已有 `tools/probe_c5_prototypes.mjs` 打出 t=0.35/0.70/1.40/3.50 的实际选型，但**要不要认这版**是审美裁决 |"
assert old in s
s = s.replace(old, "| C6 · **门 I（传播可见）** | 复现 S19 t=0.70 / t=1.40 的传播 | ✅ **已完成（Claude，2026-09-04）** | 已固化成 `tools/test_wfc_town_selection.mjs` 门 I 段的五个画面事实。**剩下的审美裁决换了一条**：100 seed 体检显示顶格里只有 ~35% 长成屋顶（其余是晒台 12.7% + 平顶 6.7%），像不像 Townscaper 的天际线**要主人对着 S23 录像看一眼**——没有脚本能判 |")

# 4) C6 接线行补数字
old = "| C6 · **接线 `wfcTownSelection` 进 `citadelTown`** | 把 `townscaperModuleSelection` 调用点换成 WFC 选型，开关 `P.wfcTownV1` | **Grok** | B 高。适配器与原型都已交付（G-05 契约 + `townModulePrototypes.js`），剩下是纯接线 + 开关 + 回滚路径 |"
assert old in s
s = s.replace(old, "| C6 · **接线 `wfcTownSelection` 进 `citadelTown`** | 把 `townscaperModuleSelection` 三处调用点换成 WFC 选型，开关 `P.wfcTownV1` | **Grok**（成本顾虑已解除） | B 高。适配器与原型都已交付，剩下是纯接线 + 开关 + 回滚路径。2026-09-04 体检：highland 978 格求解 **P50 16.9ms / P90 20.8ms、100 seed 零无解零回溯**（`tools/report_wfc_100seed.mjs`），相对编辑 P50 65ms 吞得下——「接线会不会拖垮编辑」这条顾虑可以划掉 |")

# 5) 补两行缺的 Claude 项
old = "| C0 · Oskar 演讲取证 | 三场演讲字幕 |"
assert old in s
s = s.replace(old, """| C10 · **规格**：`irregularQuadGrid` 接口与不变量 | 已随 G-15/G-16 事后补齐（接口冻结、五条不变量、`boundaryEdges` 导出） | 已完成 | 本表原来漏了这一行 |
| C10 · **下游适配清单** | 哪几个文件的哪个函数改按 face 重心取样 | **留给 Claude** | 要判断哪些地方**不该**改（N5：不重写寻路）。**这是 G-18 的唯一前置，本表原来漏了** |
| C0 · Oskar 演讲取证 | 三场演讲字幕 |""")

# 6) 结论段
old = """## 一句话结论

- **GLM-5.3-Flash 能接的只有两类**：跑脚本记数字（C7 门 D）、检索誊抄（C0）。它不该碰任何跨 `citadelTown`/`odysseyCitadel` 的接线——今天的教训就是证据（见下）。
- **Grok 能接大部分 [Claude] 工程项**：C4 签名缓存、C6 接线、C8 滞后合并、C10 迁移与编辑器。前提是**每项都带一个非零退出的断言脚本**，并且**先跑一遍再改**。
- **必须留给 Claude 的是四项审美/本体裁决**：门 I 认不认、角落分段目录、笼形变形、stencil 与描边壳的交互。这四项没有脚本能替。"""
assert old in s
s = s.replace(old, """## 一句话结论（2026-09-04 晚更新）

- **下一刀是 Claude 补四份规格**：C9 角落分段目录、C10 迁移函数、C10 下游清单、C11 stencil 原型。
  它们同时是 G-13/G-14/G-17/G-18/G-19 五张单的唯一前置。在这之前，Grok 那边**只有 G-11 一张单能派**。
- **GLM-5.3-Flash 能接的只有两类**：跑脚本记数字（C7 门 D）、检索誊抄（C0，当前阻塞在主人提供字幕）。
  它不该碰任何跨 `citadelTown`/`odysseyCitadel` 的接线——今天的教训就是证据（见下）。
- **Grok 能接的工程项**：C6 接线（成本顾虑已解除）、C8 滞后合并、G-11 装饰 pass、C10 迁移与编辑器拾取。
  前提是**每项都带一个非零退出的断言脚本**，并且**先跑一遍基线再改**。
- **必须留给 Claude 的是三项审美/本体裁决**（门 I 已完成，从四项减为三项）：角落分段目录、笼形变形、
  stencil 与描边壳的交互。外加一条新的：**顶格屋顶率 ~35% 像不像 Townscaper**——这条连 Claude 也判不了，
  要主人看画面。""")

# 7) 教训段补两条
old = "**所以给任何接手者的硬约束**：改守门/判据类代码，先用非致命方式跑一遍全量，把清单贴出来，再决定要不要致命。"
assert old in s
s = s.replace(old, """**所以给任何接手者的硬约束**：改守门/判据类代码，先用非致命方式跑一遍全量，把清单贴出来，再决定要不要致命。

另外两条同类教训（已一并写进 `CITADEL_GROK_TASKS.md` 头部「四条硬规矩」）：

- **不要用占位输入自证。** G-06 / G-10 交付时用的是「六面 socket 全 any」的占位原型，那种输入下
  `fails=0` / `outsideChanged=0` 毫无意义——压根没有约束在传播。两个脚本都被换成真原型重测过。
- **断言不过时，先分清「测试写错」还是「真 bug」。** G-01 报的 `onlyB=65` 被判成前者交回，实际是内院
  `ownSpanning` 只登记了空格这个真 bug（玩家拆围墙时那段内院永远不判 dirty）。判不了就把清单交回，
  不要在测试里把差集过滤掉。""")

open(p, "w").write(s)
print("HANDOFF.md 写回", len(s), "字节")
