# THIRD PARTY NOTICES

本文件记录 TigerInBamboo / TigerMessenger 直接参考或改写的第三方开源项目许可边界。
V7 程序生成引擎（WFC + Marching Cubes）的研究与实现依据如下。

## 1. mxgmn/WaveFunctionCollapse

- URL: https://github.com/mxgmn/WaveFunctionCollapse
- License: MIT（软件部分）
- 参考内容：最低 Shannon 熵选择、观察—传播循环、SimpleTiled/Overlapping 两类模型、
  对称展开（旋转/反射）与受约束生成的**机制理解**。
- 边界声明：
  - 本项目**不导入**该仓库的任何示例图片、tiles、XML 数据。
    （mxgmn 明确将示例图片/tiles 排除在软件许可之外。）
  - 本项目以“理解机制后自行开发 ES module 引擎”的方式实现，未复制其 C# 源码。
  - V7 的 2D overlapping pattern 输入只使用项目自有代码生成样例或自有 fixture。

## 2. marian42/wavefunctioncollapse

- URL: https://github.com/marian42/wavefunctioncollapse
- License: MIT
- 参考内容：3D 六向连接器、64 位 ModuleSet（候选集）、ModuleHealth 支持计数、
  边界约束、局部生成与指数回溯的**机制理解**。
- 边界声明：
  - 本项目**不导入**该仓库的任何 Unity prefab、scene、material、texture 或工程文件。
  - 本项目未复制其 C# 源码； BitSet 域、Trail 回溯、兼容表预编译均为本项目独立实现。

## 3. Marching Cubes case/edge/triangle 查找表

- 来源：Three.js `examples/jsm/objects/MarchingCubes.js`，固定提交
  `79497a2c9b86036cfcc0c7ed448574f2d62de64d`（r172 tag 的 peeled commit），
  URL：[raw source](https://raw.githubusercontent.com/mrdoob/three.js/79497a2c9b86036cfcc0c7ed448574f2d62de64d/examples/jsm/objects/MarchingCubes.js)。
- License：MIT（上方 Three.js 条目同源）。本项目只提取标准 `edgeTable`/`triTable`
  数组，放入 `src/procgen/field/marchingCubesTables.js`，没有导入 Three.js 运行时代码；
  角点/棱编号与该实现保持一致。
- 本地完整性 hash：`EDGE_TABLE=f0ca1ea5`、`TRI_TABLE=a2318509`（TigerMessenger
  `hashHex`，逗号连接的整数序列）。`tools/test_procgen_v7_g8.mjs` 锁定 256 和
  256×16 长度，并用球体、法线、索引和 chunk seam fixture 验证消费路径。
- 说明：表的数值是公开算法的查表数据；这里保留来源和精确提交，避免把“自生成”误写成
  “第三方表”。

## 4. Three.js

- URL: https://github.com/mrdoob/three.js
- License: MIT
- 使用方式：CDN 引入 r172 + 本地 `vendor/` 兜底，未修改库源码。

## 5. 其他

- Bad North / Townscaper：仅参考公开访谈与演讲中的**设计方法**（个体模拟、
  地形即战术信息、受约束生成、隐藏复杂数值），不复制其美术、玩法或内部实现。
- Oskar Stålberg 公开线程/演讲：见 `PLAN.md` 8.1 的来源清单；项目推导与来源事实
  分栏记录，不冒充原作实现。
