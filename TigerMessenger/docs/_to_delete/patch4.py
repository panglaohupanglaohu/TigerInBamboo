import os
D = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/docs/")

p = D + "CITADEL_BUILD_PIPELINE_TODOS.md"
s = open(p).read()
old = "- [ ] [Claude] 原型：窗框写 stencil（`stencilWrite/stencilRef/stencilZPass`），墙材质 `NotEqualStencilFunc` 丢弃，再画窗内壁；`applyInkOutlines` BackSide 壳同做 stencil 测试"
new = """- [x] [Claude] **stencil 挖窗原型已交付**（2026-09-04）：`src/render/stencilWindows.js` + 自检 `tools/probe_stencil_windows.mjs`；
      开关 `P.stencilWindowsV1` 默认 **false**。它是装配后的一道 pass（与 `applyInkOutlines` 同层次），
      **不动 `citadelTown.js`**，关掉开关就完全回到原路径。
      `node tools/probe_stencil_windows.mjs`：11 层（有窗 10）· 窗 420 · 墙面 396 · 描边壳 99 ·
      **draw call 增量 20（恰好 2/层，门 L 达标）** · cutter 10 / reveal 10 ·
      **共享材质零污染（156 个原件逐个比对）** · 卸载后 1,212 个材质引用逐个还原。
      **两个设计点值得记下来**：
        1. **每层合成一个 cutter + 一个 reveal**，不是每扇窗两个。逐窗是 +2/窗（几百扇 → 上千 draw call，
           直接废掉门 L）；合成之后正好 +2/层。
        2. **cutter 必须写深度**（colorWrite=false / depthWrite=true）。不写的话 stencil 会打穿远处的墙。
           ⚠️ 仍有一个已知失效场景：相机与窗之间还隔着另一堵更近的墙（透过拱洞看过去），那堵近墙会被打洞。
           教科书解法是深度预通道，代价是墙的 draw call 翻倍、超门 L 预算。**先这样做原型，等主人看过截图再决定要不要买单。**
      ⚠️ **我看不到画面**，所以 PLAN 点名的那个冲突（「窗洞里露不露描边壳」）**没有被验证过**——
      能验的只到「描边壳确实拿到了同一道 NotEqual 测试」（86 个壳）。上生产前必须有截图对照。
      ⚠️ **顺带修正 G-19 工单里写错的判据**（详见下一条）"""
assert old in s
s = s.replace(old, new)

old2 = "- [ ] [Grok] `tools/test_window_stencil_positions.mjs`：窗位不跨格角（每窗 AABB 落在单格内）→ **G-19 [等 C11 原型]**"
new2 = """- [ ] [Grok] `tools/test_window_stencil_positions.mjs` → **G-19，前置已交付（2026-09-04），可派**。
      ⚠️ **判据已修正**：原写「每窗 AABB 落在单格内」——**做不到，也不该做到**。
      窗就贴在墙面上，而墙面正是两格的分界面（窗心在 `cx(ix) + dx*(cs/2 + 0.028)`），
      所以 **420 扇窗按旧判据 420 扇全部"跨格"**。真正该守的是**不跨格角**：
      窗沿着墙走的那一段必须完整落在所属格的边长之内（跨格角 = 一扇窗折过 90° 贴到两面墙上，那才是穿帮）。
      判据已实现为 `windowSpansCellCorner()`，实测 **420 扇越界 0 扇，最大越界 −0.81（格宽 2.0）**。
      另：**别把格宽写成 1.6**，高山用的是 **2.0**（`castle.userData.townSpec.cellSize`）"""
assert old2 in s
s = s.replace(old2, new2)
open(p, "w").write(s)

p2 = D + "CITADEL_GROK_TASKS.md"
t = open(p2).read()
t = t.replace(
"**状态：⛔ 仍派不了（2026-09-04 复核）** — 前置 [Claude] **stencil 挖窗原型未开始**。",
"""**状态：✅ 可派了（2026-09-04 晚，前置已交付）** — `src/render/stencilWindows.js` 已上线（`P.stencilWindowsV1` 默认 false），地基自检 `node tools/probe_stencil_windows.mjs` 全绿。

**⚠️ 本单原写的判据是错的，照下面这条做**：
- ❌ 原文：「每窗 AABB 投影到 XZ，断言完整落在某一个格内；跨格窗 === 0」。
  **实测 420 扇窗全部"跨格"** —— 因为窗贴在墙面上，而墙面正是两格的分界面
  （窗心 `cx(ix) + dx*(cs/2 + 0.028)`）。这条门永远过不了，且不该过。
- ✅ 改成 **不跨格角**：窗沿着墙走的那一段（along-wall 区间）必须完整落在所属格的边长之内。
  判据已经实现好了，直接调：
  ```js
  import { stencilWindowPlan, windowSpansCellCorner } from "../TigerMessenger/src/render/stencilWindows.js";
  const plan = stencilWindowPlan(castle);       // plan.windows 每项带 cell / dir / position
  for (const w of plan.windows) {
    const r = windowSpansCellCorner(
      { cell: w.cell, center: [w.position[0], w.position[2]], dir: w.dir, halfWidth: 0.19 },
      { cellSize: castle.userData.townSpec.cellSize, gridSize: castle.userData.townSpec.gridSize }
    );
    assert.ok(r.ok, `${JSON.stringify(w.cell)} 跨格角 ${r.overhang}`);
  }
  ```
  实测：**420 扇越界 0 扇，最大越界 −0.81**（格宽 **2.0**，不是 1.6——别写死）。

**本单还可以顺手加的两条**（都已有现成断言可抄，见 `tools/probe_stencil_windows.mjs`）：
draw call 增量必须是 **+2/层**（不是 +2/窗）；**共享材质零污染**（本模块只 clone，改了原件会污染城门/废墟/岛屿）。

**判不了的别写进测试**：「窗洞里露不露描边壳」要看画面，脚本判不了。""")
t = t.replace("## G-19 · `tools/test_window_stencil_positions.mjs`（门 L 部分）[⛔ 等 Claude 规格]", "## G-19 · `tools/test_window_stencil_positions.mjs`（门 L 部分）[✅ 可立即派发]")
open(p2, "w").write(t)
print("ok")
