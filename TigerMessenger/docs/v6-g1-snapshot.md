# V6-G1 · CitadelWorldSnapshot 与真实开关

日期：2026-08-22  
负责人：Grok  
级别：**TESTED**（不是 DEFAULT_ON / VISUAL_ACCEPTED / PERF_ACCEPTED）  
命令：`node tools/test_v6_g1_snapshot.mjs`  
机器可读：`tools/out/v6-g1-snapshot.json`  
seed：`7`

## 做了什么

不可变 snapshot 统一携带 mesh / surface / UV / nav / module / prop / semantic material 和 version/hash。  
可见镇体、SurfaceProvider、路径、prop 槽和战斗 sim 都读同一份。  
`citadelTownV4=false` 时 walkLift **就是**传入的 legacy 函数（不再 wrap）。  
`true` 时高度只来自 `surfaces.sampleWalkLift`，禁止回落到 legacy y。

编辑/开关切换：`compileWorldSnapshot` → `assertSnapshotConsistent` → 入队 → 帧边界 `flushCommit` 原子替换。  
player / tram / boat / horse / 士兵占用 dirty 或失效面时投射到 `surfaces.nearest`。

## 数字

| 项 | 值 |
|---|---|
| schema | 1 |
| cells | 487 |
| walkable = nav nodes | 543 |
| hashLegacy | `3a1261c7` |
| hashTown（同编译，flags.town=1） | `b8eb5e27` |
| 默认开关 | 全关 |
| prop slots | 0（G3 stub） |

## 回滚

`?citadelTownV4=0`（默认）：legacy 镇体可见、灯数不变、walkLift 引用不变。  
测试覆盖对象数 / 灯数 / walk 源 / oracle hash。GPU 5×5×3 矩阵仍缺，不把本阶段标 VISUAL_ACCEPTED。

## 未做（按 PLAN 10.13 下一扇门）

- 不把 V6 presentation 设为默认
- 不删 `@legacy` 文件
- G2 不规则骨架 + 约束传播
- G3 成品模块几何与真实 prop
