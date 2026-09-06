# -*- coding: utf-8 -*-
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/docs/")

# ---------------- PLAN §6 门槛表对账 ----------------
p = R + "CITADEL_BUILD_PIPELINE_PLAN.md"
s = io.open(p, encoding="utf-8").read()
pairs = [
("| **J · 角落无缝（新）** | 相邻角柱共享边上的顶点逐位相等；基座跨格零间隙 | 未开始 | 阶段 4 |",
 "| **J · 角落无缝（新）** | 相邻角柱共享边上的顶点逐位相等；基座跨格零间隙 | ✅ 2026-09-05 `tools/test_corner_seams.mjs`：任选件 3546 对 / 两侧同件 1840 对，同名零件截面不对齐 **0**；基座 T 缝 2 对 0 失败 | 阶段 4 |"),
("| **K · 不规则网格有效（新）** | 全四边形、无自交、最小内角 ≥ 45°、边长比 ≤ 2、同 seed 同 hash；ASCII→face 迁移双向可逆 | 未开始 | 阶段 5 |",
 "| **K · 不规则网格有效（新）** | 全四边形、无自交、最小内角 ≥ 45°、边长比 ≤ 2、同 seed 同 hash；ASCII→face 迁移双向可逆 | ✅ 上半（内角 50.49° / 边长比 1.977）+ ✅ 下半 2026-09-05 `tools/test_grid_migration.mjs`（highland 300/978 P95=0.790 · canal 82/235 P95=0.778 · hash `0b70f22c` · 字符级可逆） | 阶段 5 |"),
("| **L · stencil 窗（新）** | 窗洞里不露描边壳；窗位不跨格角；draw call 增量 ≤ +2/层 | 未开始 | 阶段 6 |",
 "| **L · stencil 窗（新）** | **（新增前置）renderer 必须显式申请模板缓冲**；窗洞里不露描边壳；窗位不跨格角；draw call 增量 ≤ +2/层 | ⚠️ 前置 ✅ 2026-09-05 修（见下）· 窗位 ✅ 420 窗跨格角 0 · draw call ✅ +2/层 · **「不露描边壳」仍待目视** | 阶段 6 |"),
]
for o, n in pairs:
    assert o in s, o[:40]
    s = s.replace(o, n, 1)

anchor = "\n---\n\n## 7. 风险（v2）"
add = """

### 6.1 · 门 L 的前置：模板缓冲（2026-09-05 补）

门 L 原来只写了三条画面判据，漏了最底下那条**物理前提**：模板测试要生效，
renderer 必须先申请模板缓冲。本仓库 vendor 的 three（r163+）里
`new THREE.WebGLRenderer({...})` 的 `stencil` 参数默认是 **false**（早年默认 true，
r163 翻了过来），而现网四处创建 renderer 的地方**没有一处传过它**。

实测（云端 Chromium，真 GL 上下文）：

| renderer 写法 | `gl.getParameter(STENCIL_BITS)` | 结果 |
| --- | --- | --- |
| 修之前 | **0** | 模板测试恒真，`P.stencilWindowsV1=1` 打开也不挖洞 |
| 传 `stencil: true` | 8 | 才谈得上挖 |

两个无头脚本（`probe_stencil_windows.mjs` / `test_window_stencil_positions.mjs`）
只查材质状态与网格计数，**拿不到真 GL**，所以两边都漏了这个洞。
已修 `src/core/stage.js`（按 `P.stencilWindowsV1` 条件申请）、`src/planet/main.js`、
`townscaper.html`（`?stencilWindowsV1=1` 直通），并在 `test_window_stencil_positions.mjs`
末尾加了一条**源码级**断言兜底——脚本判不了 GL，就退一步判源码。

### 6.2 · 按 §8 的完成定义，阶段 2 / 4 / 6 目前都不算完成

§8 写死了：「生产代码路径消费该改动（不是死文件、**不是只在 `?flag=1` 下 import**）」。
现状是 `P.wfcTownV1` / `P.cornerModulesV1` / `P.stencilWindowsV1` **三个默认全 false**。
也就是说这三个阶段停在 §7 风险表里点名的那个位置——
「**Grok 交付停在 TESTED**（V4/V6/V7 三代先例）」，只不过这回停在 Claude 手上。
翻默认是这三个阶段唯一剩下的工作，且必须一次一个、每次带截图对照与全量回归。
"""
assert anchor in s
s = s.replace(anchor, add + anchor, 1)
io.open(p, "w", encoding="utf-8").write(s)
print("PLAN §6 已对账")

# ---------------- TODOS 门槛表同步 ----------------
p2 = R + "CITADEL_BUILD_PIPELINE_TODOS.md"
t = io.open(p2, encoding="utf-8").read()
pairs2 = [
("| J | 角柱共享边顶点逐位相等 | 未开始 | C9 |",
 "| J | 角柱共享边顶点逐位相等 | ✅ 2026-09-05 `test_corner_seams`：3546 对 / 1840 对，不对齐 **0** | C9 |"),
("| K | 全四边形 / 无自交 / 内角 ≥ 45° / 边长比 ≤ 2 / 迁移可逆 | 上半 ✅（内角 50.49° / 边长比 1.977）；下半（迁移）未开始 | C10 |",
 "| K | 全四边形 / 无自交 / 内角 ≥ 45° / 边长比 ≤ 2 / 迁移可逆 | ✅ 上半（内角 50.49° / 边长比 1.977）+ ✅ 下半 `test_grid_migration`（P95 0.790 / 0.778 · hash `0b70f22c`） | C10 |"),
("| L | 窗洞不露壳 / 不跨格角 / draw call ≤ +2/层 | 未开始 | C11 |",
 "| L | **模板缓冲已申请**（2026-09-05 新增前置，已修）/ 窗洞不露壳 / 不跨格角 / draw call ≤ +2/层 | 前置 ✅ · 窗位 ✅ 420 窗跨格角 0 · drawCall ✅ +2/层 · 露壳与否**待目视** | C11 |"),
]
for o, n in pairs2:
    assert o in t, o[:40]
    t = t.replace(o, n, 1)
io.open(p2, "w", encoding="utf-8").write(t)
print("TODOS 门槛表已同步")
