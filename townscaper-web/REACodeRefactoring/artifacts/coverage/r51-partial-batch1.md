# 第 51 轮 · 「部分覆盖」88 个模块 · 第 1 批（5 个升级为已迁移/增强）

每个都读 REACode 原模块与其缺口描述，再在重构版共享模块里补机制 + node 测试（帧证据沿用已全帧核过的记录，不重计）。

| REACode 模块 | 片子 | 原缺口 | 本轮落点 | 测试 |
|---|---|---|---|---|
| src/march.js | 1120036868966502401 | 「marching squares 独立等值线与端点一致性未覆盖」（陈旧：core/contour.js 早已是完整迁移） | 实测确认：跨格端点重合、开放端只在外沿、无蝴蝶结、鞍点四角均值决断、多层级 / 反序一致 | tests/march-consistency.mjs |
| src/mipcustom.js · src/mipfilter.js | 777596437534240768 | 贴图实验未覆盖自定义 mipmap 的实际构建和采样 | 新 src/light/mip-chain.js：box / linear / kaiser / sharp 四档、sRGB↔线性、双 / 三线性、各向异性、levelStats；棋盘 sRGB 平均线性亮度 0.214 vs 线性空间 0.5；sharp 保中景、Kaiser 压高频；各向异性横向细节 0 → 0.8 | tests/mip-chain.mjs |
| src/halfedge.js | 1458921394855718917 / 1584623053061099520 / 1447494168448753667 | 显式 next/prev/twin 遍历、边界环 / 顶点扇 / Euler 和分割编辑接口未迁移 | 新 src/core/halfedge.js：buildHalfEdge（next/prev/twin/边界环/顶点扇/Euler）、checkHalfEdge、splitQuads（方格切三角仍流形） | tests/halfedge.mjs |
| src/triGraph.js | 1677242779162877952 | withSuper/locate/clone/edgeMap、局部翻边和改动记录未完整对应 | core/trigraph.js 增 locate（含压边）/ edgeMap / clone / flip（凸性 + 非 Delaunay 才翻、改动记录）/ legalize（Lawson 传播） | tests/trigraph-ops.mjs |

仍缺：mip-chain 未接 impostor 图集 / textures 页；halfedge 未替换 grid.js 内部邻接；TriGraph 仍是浮点谓词（无精确算术）。浏览器未跑。
