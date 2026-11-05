# 显式模块网格种子接入

本批沿用tileforce-learning.md已完成的1751932427272909032全部552帧，不计新增帧。原文强调先生成特定模块需要的局部网格；精确形状仍由模块作者提供，不从抽象邻接图猜测几何。

原版synthesizePatch只按BFS父边生成正多边形，未保证非树邻接闭合；质心落点也不能完整检查交叉重叠。本批不照搬该保证，新增generateModulePatch接受显式vertices/faces模板，先校验再创建新grid。不改变现有World拓扑，不把强制压平当作网格生成。

新增校验：有限值与规模上限、重复/未用顶点、合法索引、严格凸面及绕序、SAT正面积重叠、T接点、按共享边连通。模板复用顶点索引，调用既有grid finishGrid构造同一套edgeNeighbors/edgeTwins/cornerNeighbors/vertexCells，再decorateCells。旋转、缩放、平移不修改输入模板。当前最多128面/512顶点，适合小模块种子，不声称大网格生成性能。

patch.html将结果交给一个真实World，岩层与建筑共同进入WorldMesh；混合5格675顶点、四边形4格594顶点。没有额外缓存一份场景体素。模板是示例，不是影片中精确建筑/格数复刻。

tests/module-patch.mjs通过共享对象半边互反、变换、World岩层、输入不可变，以及重叠（含质心法容易漏的交叉）、T接点、断连和重复顶点拒绝。tests/module-patch-browser.cjs通过两模板真实几何有限值及三主场景回归，errors[]；截图patch-{mixed,quad}.png和patch-regression-*.png。

映射维持部分覆盖：已有随机网格搜索、模板外周边补网与边界接缝、联合WFC和完整稀有率诊断未迁移。新种子并不等于能在活跃存档里安全换拓扑；游戏副本未同步。
