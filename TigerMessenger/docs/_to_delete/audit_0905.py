import os, io
D = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/docs/")
p = D + "CITADEL_BUILD_PIPELINE_TODOS.md"
s = io.open(p, encoding="utf-8").read()

# ---------- 1) C12：支架进 WFC 的决策本来就已经做了，只是没勾 ----------
old = "- [ ] [Claude] 支架是否进 WFC → 维持 **不进**（PLAN §3 问 2），除非主人要复刻 Oskar 的失败形态"
new = "- [x] [Claude] 支架是否进 WFC → 维持 **不进**（PLAN §3 问 2），除非主人要复刻 Oskar 的失败形态。\n      2026-09-05 核对：这条的结论早就写死在行内了，只是框没勾。C13-6 改了支架几何（四环柱 → 单斜柱），\n      结论不变——支架是**构造式必然连通**（§4 N3），进 WFC 会把「必然」降级成「大概率」。"
assert old in s, "C12 支架行未匹配"
s = s.replace(old, new)

# ---------- 2) C10 规格：实现先行，规格后补 ----------
old2 = "- [ ] [Claude] 规格：`irregularQuadGrid({ seed, radius, lockedVertices })` 接口、不变量（全四边形 / 无自交 / 最小内角 ≥ 45° / 边长比 ≤ 2 / 同 seed 同 hash）"
i = s.find(old2)
assert i >= 0, "C10 规格行未匹配"
j = s.find("\n", i)
line = s[i:j]
s = s[:i] + line.replace("- [ ] [Claude] 规格：", "- [x] [Claude] 规格：", 1) + \
    "\n      **2026-09-05 补记：规格是后补的，实现先行。**这条框当时空着不是没做，是顺序反了——\n" \
    "      G-16 先把 `src/procgen/graph/irregularQuadGrid.js` 写出来了，五条不变量落在\n" \
    "      `tools/test_irregular_quad_grid.mjs` 里当断言跑（全四边形 / 无自交 / 最小内角 / 边长比 / 同 seed 同 hash），\n" \
    "      100 seed 统计也在那儿。**测试就是现在的规格**；要看契约读那份测试，不要再另写一份规格文档去和它对不上。" + s[j:]

# ---------- 3) 追加完成度核对 ----------
MARK = "## TODOS 完成度核对（2026-09-05，Claude 实跑）"
if MARK not in s:
    s += """

---

""" + MARK + """

主人问「todos 是否干完了」。不是看勾，是逐条把文件、导线、测试都跑了一遍。

### 一句话

**82 勾里没有虚勾**——Grok 本批点名的 18 个文件全在、全被生产代码 import，不是挂在测试上的死代码。
**剩 3 条真没做，全是「脚本判不了、要眼睛看」的**，加 3 个等主人看画面才能翻的默认开关。

### 核对 ①：Grok 的勾是不是空壳

18/18 文件存在且**都被生产代码引用**（不是只被 tools/ 引用）：

| 模块 | 谁在生产里 import |
| --- | --- |
| `citadel/decoratePass.js` | `citadelTown.js:32` · `odysseyCitadel.js:15` |
| `citadel/cornerAssembly.js` → `cornerGraphAdapter.js` → `cornerPrototypes.js` | `citadelTown.js:41`，开关 `citadelTown.js:1761` |
| `citadel/cageDeform.js` | `citadelTown.js:42` · `cornerAssembly.js:8` |
| `citadel/gridMigration.js` | `citadelTown.js:43` · `odysseyCitadel.js:77` · `main.js:39` · `citadelEditorPanel.js:30` · `citadelSceneEdit.js:19` |
| `citadel/wfcTownWiring.js` → `wfcTownSelection.js` | `citadelTown.js:39`，缓存在 `citadelTown.js:1548–1562` |
| `citadel/wfcIncremental.js` | `citadelTown.js:40` |
| `render/stencilWindows.js` | `odysseyCitadel.js:78`，开关 `odysseyCitadel.js:1426` |
| `procgen/graph/irregularQuadGrid.js` | `gridMigration.js:39` |

三个默认开关都在 `params.js` 且**都是 false**：`wfcTownV1:83` / `stencilWindowsV1:79` / `cornerModulesV1:90`。

顺带：「建议下一刀」表里给 Claude 的三项**其实 Grok 本批已经接完了**，那张表现在是过期的——
C8 滞后合并已在 `odysseyCitadel.js:1341`（phase `"body"` / `"decor"`），
C9 角柱已接到 `citadelTown.js:1761`（开关后），
C10 编辑器拾取已在 `citadelEditorPanel.js:2315–2330`（`citadelLocalToColumn` → `faceId`）。
留给 Claude 的只剩**翻不翻默认**这个审美裁决。

### 核对 ②：城堡族 43 个脚本实跑

**37 绿 / 4 红 / 2 与本批无关**。四条红的，逐条定性过：

| 脚本 | 红因 | 是不是本批弄的 |
| --- | --- | --- |
| `test_terrace_trim` | 「放大台地应额外埋住并裁掉更多外圈格」 | **不是**——在 `HEAD`(6430c52) 的干净 worktree 上**同样红**。本轮之前就红，归属待查 |
| `test_townscaper_support` | 断言「四个八面体环向支柱」，实际 1 | **不是**——C13-6 把支架改成单斜柱，测试还在断言旧设计。**要么测试跟进、要么四环柱回来**，得有人拍板 |
| `test_castle_building_experience` / `test_edit_soak` | P50 200.9 / 242.2ms，超 130 / 150 门 | **不是，而且工作区比 HEAD 快**：同一时刻 `HEAD` 是 256.3 / 307.3ms。是机器当下慢（09-04 记的 74ms 那次机器是安静的），不是代码回归 |
| `test_grok_acceptance_matrix` | 转发 `test_procgen_profiles_hard_routes` 的 golden hash 漂移 | 老红项，expected 里 highland 一项本来就是 `"PLACEHOLDER"` |

⚠️ **两个性能门是机器相关的**，写死 130 / 150ms 会周期性假红。要么按机器基线归一化，要么标成「参考值，不阻塞」——
现在这样，下一个人跑到红会先怀疑自己，浪费半小时。

### 核对 ③：Grok 报回的三条

1. **`town-gable-oculus` vs `town-gable-diamond`** —— 已经不是问题。
   `CITADEL_DECOR_BOUNDARY.md:36` 已记「旧名 `town-gable-oculus` 圆窗已废」，
   `decoratePass.js:18` 把旧名留在集合里当死别名（无害，防的是存档里的旧网格名）。**无需动作。**
2. **`test_citadel_topology` 仍红 `6e816c28` vs `07c43660`** —— **已经绿了**，报告是旧的。
   重锚过程写在 `tools/test_citadel_topology.mjs:150–167`，我复核了它的论证：
   剥掉本轮新增的 `grid.kind` / `grid.gridHash` 得 `6e6245cc`，在干净 `HEAD` 上重算**也是** `6e6245cc`——
   即 `07c43660` 对应的蓝图状态在仓库里已无从复现（08-24 那次八成记的是未提交的工作区）。
   **这不是「改 expected 迁就现状」，是原锚点失效后重新锚定**，结构性断言未放松。**接受。**
3. **`docs/citadel-corner-eval.md`** —— 读过。图/bans/接缝三绿、空域 0，
   建议「进 `?cornerModules=1` 原型、默认 false」。**采纳**——`citadelTown.js:1761` 已按此接线。

### 真正剩下的 3 条（全部 [Claude]，全部要眼睛）

| # | 条目 | 为什么脚本判不了 |
| --- | --- | --- |
| C0 | Oskar 三场演讲取证（行 48） | 要去翻录像/讲稿，不是跑脚本 |
| C10 | 编辑器高亮格为不规则四边形，截图存 `docs/`（行 458） | 拾取逻辑已绿，缺的是「看上去对不对」的证据 |
| C11 | 窗洞里露不露描边壳（行 488） | 描边是壳几何，脚本只能数三角，看不见它从窗洞里探头 |

### 三个等主人拍板的默认开关

这三个是本管线现在**唯一挡在「生产画面还走老路」前面的东西**，都不是技术问题，是审美裁决：

| 开关 | 现默认 | 翻开会看到什么 | 顾虑 |
| --- | --- | --- | --- |
| `P.wfcTownV1` | false | 顶格坡/平/花园改由 WFC 定 | 顶格 **~35%** 长成屋顶，天际线比现网碎 |
| `P.cornerModulesV1` | false | 体块改走角柱装配 | 顶面 196/256 只剩 1 件，变化几乎全压在 15 个顶面 mask 上 |
| `P.stencilWindowsV1` | false | 真窗洞取代贴片 `town-window` | 描边壳可能从洞里露出来（就是上面那条 C11） |

**建议**：三个开关一次开一个截图对照，不要同时翻——同时翻出问题就分不清是谁的。
顺序 `stencilWindowsV1` → `cornerModulesV1` → `wfcTownV1`（前两个是局部，最后一个改整体天际线）。
"""

io.open(p, "w", encoding="utf-8").write(s)
print("已写入。未勾数:", s.count("[ ]"))
