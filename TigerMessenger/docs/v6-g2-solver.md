# V6-G2 · 不规则骨架与局部约束求解

日期：2026-08-22  
负责人：Grok  
级别：**TESTED**（不是 DEFAULT_ON / VISUAL_ACCEPTED）  
命令：`node tools/test_v6_g2_solver.mjs`  
seed：`7`（golden 另含 1 / 42 / 884）

## 做了什么

Half-Edge **稳定 ID 不变**，只抖视觉 XZ。门、楼梯、瀑布口、运河、道路、港口顶点锁定。  
`resolveTown` 改为 domain 初始化 → 最小熵 → 邻域传播 → 回溯 ≤32。无解给 emptyCells / lockedRoutes / suggestions，**不再静默塞 floor/base**。

全城可见镇体仍是 Box/Cone（G3 才换 family builder）。开关默认关。

## 数字

| 项 | 值 |
|---|---|
| skeleton hash | `e78f0eeb` |
| locked / moved | 300 / 1708 |
| module hash | `62d30adc` |
| golden fallback | 0 |
| 100 seed contradiction | 0 |
| 100 seed fallbackMax | 0 |
| msP50 / msP95 | ≈234 / ≈265 |
| dirty 两环 | 62 格，区域外 hash 不变 |
| compile payload | `79d15ed2` |
| snapshot hashLegacy | `42725e05` |

## 回滚

数据层始终编译；`?citadelTownV4=0` 画面仍是 legacy 镇体。删/关求解器可把 `resolveTown` 退回逐格 `resolveCell`（仅 coverage 还在用）。

## 未做

- 不规则 quad 尚未喂给 presentationMesh（G3）
- 不把 V6 设为默认
- Three 交互 debug overlay 归 G8；本阶段交付 SVG + `solverDebugModel`
