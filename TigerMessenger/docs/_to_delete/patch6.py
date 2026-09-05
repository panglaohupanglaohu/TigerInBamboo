import os
D = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/docs/")

# ---------- 1. GROK_TASKS：G-20 改成撤单（我 22:06 写的「照做」被 21:51 的实测推翻） ----------
p = D + "CITADEL_GROK_TASKS.md"
s = open(p).read()
old = """## G-20 · 跨格构件分量签名缓存（C4 未尽项）[✅ 可立即派发]

**状态：✅ 主人 2026-09-04 已裁定「照做」——按 (b) 走，把它当作给 C6 接线预留的性能余量。**
下面那段「前提已失效」保留是为了让接单的人知道**现在的门是白送的**：
P90 已经在 150 以内，所以本单的验收**不是"把 P90 压到 150"**，而是
**"把门从 200 改回 150 且不倒退"**——真正难的是 `test_edit_exactness` 的逐格 0 误差别被缓存打破。

**原始复核记录：**"""
new = """## G-20 · 跨格构件分量签名缓存（C4 未尽项）[❌ 撤单·不要派]

**状态：❌ 2026-09-04 撤单。** 决策过程留个记录，免得以后有人照着下面的伪代码再做一遍：

1. 早些时候主人裁定「照做」（当作给 C6 接线预留性能余量）；
2. 当晚并行的一轮 profiling **推翻了立项前提**：`node tools/probe_edit_phases.mjs` +
   `--cpu-prof` 显示一次编辑里 **闭包扩张平均 +0.0 格**——签名缓存想省的那部分**压根没发生**；
   长尾来自「与 dirty 规模无关的全图 pass」（一次编辑跑 5 遍，5 个台地各一次 `buildCitadelTown`）。
3. 于是改削固定成本，三刀都是等价改写、输出逐位不变：内院 flood fill 字符串键 → 位图（3.2×）、
   `breaksFourInARow` O(n²) → O(1)、`collectCitadelHouses` 一次构建收 3 遍 → 收 1 遍。
   实测 P50 中位 99~108ms → **~74ms**，P90 中位 173~179ms → **~130ms**。

**所以本单不做**：签名缓存要维护「分量形状签名」这套额外状态，禁区一大堆
（户色簇必须进签名、`stats.shrubCount` / `ctx.random` 流位置不能进签名、
内院树那处忽略返回值的调用点不能开缓存），而它要省的钱已经被证明不存在。
详见 `CITADEL_BUILD_PIPELINE_TODOS.md` C4 那一节的「G-20 撤单理由」。

**下面的伪代码只作技术存档，不是工单。**

**原始复核记录：**"""
if old in s:
    s = s.replace(old, new)
    print("G-20 撤单已写入")
else:
    print("⚠️ G-20 段落未匹配，跳过（可能已被别人改过）")
s = s.replace("## G-20 · 跨格构件分量签名缓存（C4 未尽项）[✅ 可立即派发]",
              "## G-20 · 跨格构件分量签名缓存（C4 未尽项）[❌ 撤单·不要派]")
open(p, "w").write(s)

# ---------- 2. TODOS：追加派单就绪核对（用追加，不做定点替换，避免和并行改动打架） ----------
p2 = D + "CITADEL_BUILD_PIPELINE_TODOS.md"
t = open(p2).read()
if "## 派单就绪核对（2026-09-04 晚" not in t:
    t += """

---

## 派单就绪核对（2026-09-04 晚 22:1x，Claude 实跑）

主人问「Grok 能按这两个文件干活了吗」。逐条核过，不是看一眼说能：

| 核对项 | 结果 |
| --- | --- |
| 可派单点名的源文件 / 数据文件是否都在 | ✅ 12/12（`cornerPrototypes.js` · `gridMigration.js` · `stencilWindows.js` · `CITADEL_GRID_V6_DOWNSTREAM.md` · `corner_mask_table.json` · 三个 probe · …） |
| 工单让 Grok import 的导出名是否真的存在 | ✅ 逐个 `import` 验过：`cornerBuildAllowedClasses` / `cornerFaceBits` / `CORNER_DELTA` / `migrateAsciiToFaces` / `facesToAscii` / `createCitadelLevelsV6` / `stencilWindowPlan` / `windowSpansCellCorner` 全部在 |
| 工单点名要跑的命令是否真的能跑 | ✅ 17 条实跑：**16 绿 1 红**。红的是 `test_citadel_topology`，本轮之前就红 |
| headless preamble 的行号 | ⚠️ **已修**：工单原写「逐字复制第 14–30 行」，实测 `globalThis.localStorage` 在**第 31 行**，照 14–30 抄会漏掉它、脚本一跑就炸。已改成 **14–31** |
| 每张可派单是否有「读什么 / 写什么 / 伪代码 / 验收命令 / 禁止事项」五件套 | ✅ G-11 / G-13 / G-14 / G-17 / G-18 / G-19 六张都齐了（G-11 与三张判据错的单是本轮重写的） |
| 已作废的单是否标清楚 | ✅ G-01b / G-07 / G-09 / **G-20** 四张标 ❌ 并写了原因；G-03 标「换了载体，不要新建文件」 |
| 工单头部有没有「先跑基线」的硬规矩 | ✅ 已加「开工前 5 分钟」一节，列出 17 条命令与 3 个**本来就红**的脚本 |

### 结论：可以派了

**建议派单顺序**（按前置硬度与返工风险排）：

1. **G-13 + G-14**（角柱图适配器 + 门 J 接缝测试）—— 地基 `tools/test_corner_prototypes.mjs` 已绿，
   而且门 J 在纯 mask 层已经证过「4096 对相邻角柱同名零件截面逐位相等」，Grok 只需把它抬到真几何上。
2. **G-17**（存档迁移测试）—— 最独立，`tools/probe_grid_migration.mjs` 已绿，接口冻结。
3. **G-19**（窗位测试）—— 判据已改写并实现好，直接调 `windowSpansCellCorner`。
4. **G-11**（装饰 pass）—— 唯一要动 `citadelTown.js` 的，放最后；本会话在这个文件上踩过 4 次。
5. **G-18**（下游适配）—— 必须先读 `docs/CITADEL_GRID_V6_DOWNSTREAM.md`，它推翻了工单正文里猜的文件清单。

### 三个「本来就红」的脚本（跑到了别当成自己弄的）

| 脚本 | 为什么红 |
| --- | --- |
| `test_citadel_topology` | 「G0 蓝图 hash 不得因 G1 派生 API 漂移」。`citadelBlueprint.js` 在本轮之前已是 modified。**不要改它的 expected 转绿。** G-18 的清单 §3 专门讲了本单引起的 hash 变化怎么处理 |
| `test_townscaper_support` | 支柱构造被外部改成单斜柱，测试还在断言旧的四环柱设计。改设计的人要决定：测试跟进，还是四环柱回来 |
| `test_planet_v9_runtime_wiring` | `messengerIsland.js` 被外部改过 |
| `test_procgen_profiles_hard_routes` | expected 里 highland 一项写的是字符串 `"PLACEHOLDER"`，**从来没绿过** |
"""
open(p2, "w").write(t)
print("TODOS 追加完成")
