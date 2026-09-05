# 角落模块评估（C9 · Grok→Claude · 2026-09-05）

> G-13 / G-14 交付后的机器数字。Claude 决定是否把 `P.cornerModulesV1` 接到 `buildCitadelTown` 体块路径。
> 本文件不改生产开关。

## 1 · 模块数与域

| 量 | 数字 | 含义 |
| --- | --- | --- |
| 目录件数 | 28 | air 1 / wall 5 / plinth 4 / step 3 / soffit 1 / top.terrace 5 / top.flat 2 / top.garden 1 / roof 6 |
| D4 类 | 55 | 与 `corner_mask_table.json` 一致；允许集是类不变量，G-13 按 classId 建 bans |
| 编译变体 | 78 | `compileVariants(CORNER_PROTOTYPES)` |
| 高山格 | 978 | `HIGHLAND_TOWNSCAPER_TOWN_SPEC` |
| 角柱节点 | **1431** | `createCornerGraph`，mask=0 已丢 |
| floors | 12 | 节点 iy ∈ [0, floors] |
| bans | 102853 | mask-class 不允许的 (cell, variant) |
| 域大小 1 | 27 / 1431 | 只剩 1 个变体的节点 |
| 空域 | **0** | 目录无缺件，不必在适配器里兜底 |

`node tools/test_corner_graph.mjs`：`validate().ok`，空域 0。

域大小 1 只有 27 个，并不反驳「196/256 个 mask 只允许 1 件」：一件带 Y4 的 proto 会编成多个变体。自由度仍然集中在顶面 mask（露台/平顶/花园/脊/坡/歇山）。墙身若要变化，得往同一 class 加第二件（例如 `wall.c2adj` 再来一件带壁柱的）。

## 2 · 接缝（门 J）

`node tools/test_corner_seams.mjs`（装配后真几何，乘 (cs,ch,cs) 平移）：

- 任意选件 **3546** 对：同名零件截面不对齐 **0**
- 两侧同件 **1840** 对：不对齐 **0**
- S19 t=1.05 两列两层贯通墙：基座在顶点十字 x=0.5 上 **2** 对，无 T 型接缝

地基 `node tools/test_corner_prototypes.mjs` 仍绿（4096 对纯 mask 层同名零件 0 不对齐）。

实现约束（Claude 已写进目录注释，实测成立）：凡要跨角柱连续的线（墙、基座、护栏、檐口）必须画在顶点十字（x=0.5 / z=0.5），不能画在对偶立方体外边界。

## 3 · 15 色兼容

角落目录**不着色**。角柱跨四格、可能跨两户；颜色由装配层按格心取（现 `materials[char]` 路径）。socket / bans / 几何都不读户色。接到生产时只要继续按格心取 15 色，不必改目录。

不兼容的做法：按角柱节点 seed 抖色——四格交界会闪。

## 4 · draw call

尚未进生产（`P.cornerModulesV1` 未接线），没有实机 draw call。量级：

- 高山 1431 个非空角柱 × 每件大约 2–4 个零件
- 与现网一样走层组合并的话，增量仍是 **+2/层** 量级（与 stencil 挖窗同一预算），不是每件 +1
- 不合并则上千 draw call，超门 L

建议：进生产必须走现有 `geometryMerge` 路径；不要为角柱另开一套合并。

## 5 · 建议（给 Claude）

1. **可以进生产原型**（`?cornerModules=1` / `P.cornerModulesV1` 默认 false）。图、bans、接缝三件都绿，空域 0。
2. 接线时只替换体块（cell / plinth / wall / roof / terrace），装饰 pass（G-11）和 stencil 窗不要进角柱件。
3. 门 A/B/C/D/F/I 不倒退：角柱网格仍须 `ownCell` / `ownSpanning`（一个角柱跨四格，归属用 spanning）。
4. 要主人看的画面：顶面 196/256 只剩 1 件，天际线变化几乎全在那 15 个顶面 mask 上。和 WFC 接线评估里「顶格 ~35% 长成屋顶」是同一类取舍。
