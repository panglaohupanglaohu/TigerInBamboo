# REACode 学习记录（用户自写的 Townscaper 式实现）

来源：用户本机 `townscaper-web/REACode/`。这是用户自己写的代码，不是 Oskar 的代码，也不是逆向产物，可以学习并借鉴。
已读：README.md、src/grid.js、src/town.js、src/mesh.js。未读：scene.js、app.js、demo.js、save.js。
源码位置：`TigerInBamboo/townscaper-web/REACode/`（Mac 上为 `/Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACode/`）。需要核对实现细节时，直接读取这里的 `src/*.js`，不要只依赖本笔记。


## 系统结构

- grid.js：六边形轴向格，每格拆成 6 个 kite 四边形 `(边中点, 角点, 边中点, 中心)`。共享顶点用 hash01 做确定性抖动，再做凸性松弛（最多 6 轮，越界顶点回拉 ×0.62）。输出 edgeNeighbors（边邻接）与 cornerNeighbors（角邻接）。半径 15 时共 4326 格。
- town.js：每格一个 9 位层掩码 `solid`，允许在柱子中间掏洞（拱、吊脚塔由此而来）。`colors` 管墙，`roofColors` 管屋顶，两个色槽互相独立。`regions()` 把同顶高的连通格子合成一个 region：一栋房子或一条走道，由 region 统一出屋顶、外墙和栏杆。
- mesh.js：墙按暴露的连续层段生成（wallSpan），开窗（opening）包含框、玻璃和中梃。屋顶（roofSurface）对 region 顶点做到边界的距离场，rise = min(d, cap)·0.85，边界顶点外推做挑檐。悬空格子有底面（soffit）和木构（柱、系梁、斜撑），柱子按角点去重。岸边泡沫（foam）用带 alpha 的分段四边形。所有几何写进同一个池子，一次 draw call。

## README 自述的差距

没有拱、桥、楼梯、码头模块；模块传播只是简化的邻域判定；装饰件很少；屋顶是单色；网格固定半径，岛屿不无限延展。

## 可迁移到莫里斯岛的部分（按价值排序）

1. region 作为装配单位：城堡的塔、翼楼、村舍用同一规则生成屋顶和外墙，避免逐块手工。对应 Highland 城堡的塔楼顶。
2. 距离场屋顶：攒尖、长脊由同一公式给出，适合坡屋顶。
3. 层掩码加开洞：拱门、城门、吊脚房都能直接用掩码表达。
4. 岸边泡沫的分段写法：可直接用于上游溪流岸线，与当前溪流近景工作相关。
5. 木构支撑（悬空格子）：可用于桥墩、栈桥、吊脚屋，与桥的净空检查相关。
6. kite 网格加凸性松弛：可作为不规则地面面片的候选，对应待决策的地面面化问题。
7. 角点去重的柱子：可用于栏杆和围墙柱，避免重复生成。

## 不能直接搬的部分

- 莫里斯岛是高度场地形，加上溪流路径和山路。REACode 是海面上的体素城镇，不能替代地形。
- REACode 的 4326 格和 9 层上限是为小城设计的。城堡尺度需要按米制重新定标。
- REACode 的色板（town、pastel、dusk）与 Highland 配色不同，不能直接沿用。
- 花草、鸟兽、桥、山路是莫里斯岛独有的子系统，REACode 没有对应实现。

## 结论

REACode 教给顾问的是建筑级的装配规则（region、距离场屋顶、掩码开洞、木构支撑），不是整岛地形。它适合支撑城堡和建筑模块的重构，不适合替代莫里斯岛的地形与植被系统。整岛重构仍需要先按子系统拆分。

## 待补

读完 scene.js（水面、相机、拾取）、app.js、demo.js、save.js 后再更新本文件。当前规则在莫里斯岛尺度下的视觉效果尚未验证。
