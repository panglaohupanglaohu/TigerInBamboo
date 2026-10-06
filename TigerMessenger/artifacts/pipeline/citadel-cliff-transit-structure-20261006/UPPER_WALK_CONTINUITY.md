# 三段上步道连续性：有限 CPU 检查

2026-10-06。本轮只新增连续性测试和本报告，并按主线程授权给既有 fixture 补传 `cliffTransitRelease: release`，使旧岸补岩参数与正式 terrain 一致；未修改任何 `src`。

## 范围与方法

实际生产 `createChristchurchTramSourceCurves` → `prepareCitadelRailStartup`，使用最终 center/red/blue 全球拼接曲线、coastal cuts、旧岸 stepped-rock-link apron、真实 planet mesh 和编译 ocean。创建实际 candidate，挂入 castle 后调用其真实 ground/walls provider。上层距离轨面 6.9m，已装载列车净空模型保持不变。

沿旧岸 → 中央 → 新岸及反向逐段走完整上层路径；单次移动不超过 0.1m，身体中心测试横向 -0.4/0/+0.4m。另逐截面测试 -1.8/0/+1.8m 地面；两处独立生成的几何接缝各取前后三个截面重复跨越。地面相对指定廊道顶面偏差标准保持 0.06m，不修改 provider 原有上阶或身体参数。

| 上步道 | 实际上层长度 | 报告顶面顶点数 |
|---|---:|---:|
| 旧岸 | 81.5840m | 106 |
| 中央 | 58.9635m | 77 |
| 新岸 | 161.2115m | 208 |
| 合计 | 301.7590m | 391 |

不是只测试两条回城连接，也不是用曲线包围盒替代真实三角承托。

## 结果分类

更新 apron 的实测：ground 20,259 次、walls 19,020 次。中心 ±0.4m 连续通行带承托及身体查询 **0 失败**，没有 missing ground。旧岸/中央接缝为 0.000270m，中央/新岸为 0.000437m。

外沿保留 **8 条**顶面平顺度偏差（包含接缝重复采样），来自实际 `old-city-link-treads` / `new-city-link-treads`，是回城连接踏面略高于廊道，约 6.675–7.853cm。没有把这八条删除、放宽 0.06m 标准或算成平整通过。主线程要求保留真实台阶，故测试另列 `edgeStepObservations`，只允许**实际连接踏面、正向高差、在现有 provider 0.4m 上阶预算内**的记录归入该类别；其他地面空洞、负向跌落、陌生网格或身体失败仍使核心检查失败。

关键 castle-local 位置：

- 旧岸接头最大高差约 0.078534m：`[-32.7838, 12.7668, 44.9605]`，命中 `old-city-link-treads` face 3。
- 旧岸相邻外沿：`[-32.0858, 12.8333, 44.5943]`，高差约 0.066754m。
- 新岸外沿：`[19.0170, 11.9142, 64.0678]`，高差约 0.067606m，命中 `new-city-link-treads` face 2。

这些位置的边缘身体行走仍待实机检查。当前身体测试覆盖的是中心 ±0.4m 带，不能把地面横断 ±1.8m 的采样称为全宽身体通行验收。

## 文件与复现

- 新测试：`tests/world/targetCliffTransitWalkContinuity.test.mjs`。
- 旧夹具首轮：`upper-walk-continuity-cpu.json`，保留当时统一平顺断言失败。
- 带正式 apron 的严格平顺首轮：`upper-walk-continuity-apron-cpu.json`，同样保留八条失败原始记录。
- 分类后的最终报告：`upper-walk-continuity-final-cpu.json`，含 source SHA256、查询数、完整偏差、provider 合同；`flatnessPass` 保持 false，`edgeWalkingVerified` 和 `gpuVerified` 均 false。

```sh
CITADEL_WALK_CONTINUITY_REPORT=artifacts/pipeline/citadel-cliff-transit-structure-20261006/upper-walk-continuity-final-cpu.json node --test tests/world/targetCliffTransitWalkContinuity.test.mjs
```

这是实际静态几何的有限 CPU provider 检查，无浏览器、无 GPU、无实际玩家输入；provider 本身使用有限身体射线，不是精确胶囊碰撞，不涵盖动态船、全场 ceiling、跳跃、未来 WFC 修改或全导航。不能据此提高视觉分数或宣称整条正式玩法已验收。
