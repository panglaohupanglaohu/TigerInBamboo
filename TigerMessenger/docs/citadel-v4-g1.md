# Citadel V4 · G1 报告

日期：2026-08-22  
负责人：Grok  
前提：G0 已通过。

## 来源事实 / 项目推导

| 栏 | 内容 |
|---|---|
| 来源事实 | Half-Edge 适合 n-gon 与邻接；主网格承载房屋/角色，对偶网格承载 field |
| 项目推导 | 台地环带 + 占格四边形作为主网格；瀑布缺口不生成面；对偶顶点=面重心 |

## 交付

- `src/world/citadel/topology.js`（514 行，**不 import Three.js**）
- 蓝图：`validateCitadelBlueprint`、`citadelBlueprintEntityIds`（不改变 G0 hash `6e6245cc`）
- 测试：`node tools/test_citadel_topology.mjs`（7 项）
- 叠图：`tools/out/citadel_g1_topology.svg`、`tools/out/citadel_g1_topology.json`

## 编译结果（默认 highland 蓝图）

| 项 | 值 |
|---|---|
| 台地面 | 56（12/11/11/11/11，缺口各少 1 扇） |
| 占格面 | 487 |
| 半边边界 | 缺口 + 占格外轮廓 |
| 对偶顶点 | 543（一面一对偶点） |
| 港口标记 | 最低台地 +Z / 缺口邻面 |
| 第一层瀑布 | `terraceId===1 && nearNotch` |

## 回滚

未接线到 `citadelRange` / 编辑器。`citadelTerrainUvV2` 仍默认关。G2 才把 SurfaceProvider 接到 walkLift。
