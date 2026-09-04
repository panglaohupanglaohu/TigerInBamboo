# Claude 工作项交接判断（2026-09-04）

> 场景：本会话跑 Claude 侧任务，Grok 并行跑 `docs/CITADEL_GROK_TASKS.md` 的工单。
> 本文回答一件事：**TODOS 里标 [Claude] 的项，哪些能交给 GLM-5.3-Flash，哪些必须留给 Grok，哪些谁都不该接。**

## 判据（不是「难不难」）

| 维度 | 说明 |
| --- | --- |
| **A 可机器判定** | 有断言脚本能证明对错 → 谁都能做 |
| **B 跨文件生产接线** | 要同时改 `citadelTown` / `odysseyCitadel` / `geometryMerge` 并保持摘/建口径一致 → 需要长上下文与全局一致性 |
| **C 审美/像不像 Townscaper** | 只能靠画面证据（S19 逐帧）反复对照 → 需要能读图、能持有原始视频证据的模型 |
| **D 失败代价** | 错了会静默丢几何/重影，测试未必抓得住 → 需要能自己造探针定位 |

**GLM-5.3-Flash 的定位**：快、便宜、上下文短。适合 A 高、B/C/D 低的活。
**Grok 的定位**：已经在跑工单、熟悉本仓库测试骨架、能写多文件补丁。适合 A/B 中高、C 低的活。

---

## 逐项判断

| TODOS 项 | 内容 | 谁接 | 理由 |
| --- | --- | --- | --- |
| C4 未尽项 · **分量签名缓存** | 屋顶/连拱/内院分量的「形状签名没变就不重发」，把 P90 从 190ms 压回 150 以内 | **Grok** | B 高 D 高：要同时改摘除谓词与发射门，且必须保住 `test_edit_exactness` 的逐格 0 误差。有现成的量化门（P90 ≤ 150、累积 ≤ 5%），Grok 能自证 |
| C6 · **接线 `wfcTownSelection` 进 `citadelTown`** | 把 `townscaperModuleSelection` 调用点换成 WFC 选型，开关 `P.wfcTownV1` | **Grok** | B 高。适配器与原型都已交付（G-05 契约 + `townModulePrototypes.js`），剩下是纯接线 + 开关 + 回滚路径 |
| C6 · **门 I（传播可见）** | 复现 S19 t=0.70 / t=1.40 的传播 | **谁都不接，留给 Claude** | C 高：判据是「画面像不像」。已有 `tools/probe_c5_prototypes.mjs` 打出 t=0.35/0.70/1.40/3.50 的实际选型，但**要不要认这版**是审美裁决 |
| C7 · 门 D 数字 | WFC 路径下 P50 ≤ 150 | **GLM-5.3-Flash** | 纯 A：跑脚本、记数字、贴回 TODOS |
| C8 · **装饰边界清单** | 已交付 `docs/CITADEL_DECOR_BOUNDARY.md`（66 个 `town-*` 逐条分类） | 已完成 | — |
| C8 · 滞后合并 | 体块先合并、装饰下一帧合并 | **Grok** | B 中：动合并调度，要保住门 A/B |
| C9 · **角落分段目录** | 55 个 mask 类各自的几何 + 六向 socket | **留给 Claude** | C 高 + D 高：这是「模型单元与 Oskar 拉齐」的本体，错了整个阶段 4 白做 |
| C10 · 存档迁移 v5→v6 | ASCII 格 → face id，旧档可回读 | **Grok** | B 高 A 高：有 `test_grid_migration` 的双向可逆断言兜底 |
| C10 · 笼形变形 | 模块几何按四边形四角双线性插值 | **留给 Claude** | C 高：变形对不对只能看画面（接缝/穿模） |
| C10 · 编辑器拾取改 face id | `citadelSceneEdit` / `citadelEditorPanel` | **Grok** | B 中，行为可用点击坐标测试覆盖 |
| C11 · stencil 挖窗原型 | 窗框写 stencil + 描边壳同做测试 | **留给 Claude** | C 高 D 高：与 `applyInkOutlines` 的交互只能看渲染结果 |
| C0 · Oskar 演讲取证 | 三场演讲字幕 | **GLM-5.3-Flash** | 纯检索誊抄；但当前工具取不到 YouTube 正文，**阻塞在主人提供字幕**，换谁都一样 |

---

## 一句话结论

- **GLM-5.3-Flash 能接的只有两类**：跑脚本记数字（C7 门 D）、检索誊抄（C0）。它不该碰任何跨 `citadelTown`/`odysseyCitadel` 的接线——今天的教训就是证据（见下）。
- **Grok 能接大部分 [Claude] 工程项**：C4 签名缓存、C6 接线、C8 滞后合并、C10 迁移与编辑器。前提是**每项都带一个非零退出的断言脚本**，并且**先跑一遍再改**。
- **必须留给 Claude 的是四项审美/本体裁决**：门 I 认不认、角落分段目录、笼形变形、stencil 与描边壳的交互。这四项没有脚本能替。

## 今天的教训（写给下一个接手的人）

Grok 交付 G-01b 时把守门判据写成「有没有 `ownCell` 作用域」，而不是「有没有网格最终无主」。结果 `town-cell`（自己写 `userData.cell`，不需要环境作用域）第一个撞上，`buildOdysseyCitadel` 直接抛，**全部城堡测试变红**。

工单 G-01b 原文写了两步：① 先用 `console.warn` 跑一遍收集清单；② 清单为空才改 `throw`。这一步被跳过了。

**所以给任何接手者的硬约束**：改守门/判据类代码，先用非致命方式跑一遍全量，把清单贴出来，再决定要不要致命。

顺带说明：这次误伤反而挖出了 4 类真实的归属空洞（`town-plaza` / 内院 241 件 / `town-canal-water` / `town-watergate` / z 向连拱），说明原来的 `test_cell_ownership` **会漏报**——无主的面不进 `faceToCell`，合并之后就从普查里消失了。这条已写进 TODOS。
