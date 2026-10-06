# 两个 WFC 仓库源码研究

日期：2026-10-04。顾问：`oskar_world_advisor`。本次只读官方仓库并在 `/tmp` 执行无依赖小验证，没有修改 TigerMessenger 运行时代码，也没有安装依赖。这两个项目都不是 Oskar 的私有引擎源码。

## 版本和阅读覆盖

研究使用官方Git克隆，以下链接固定到本次实际 `HEAD`，不使用随时变化的master行号：

| 项目 | commit / 提交时间 | 实际读取 |
|---|---|---|
| LingDong-/ndwfc | `3479af8ee855455b0922b9b2f4c26d5378b0cbee`；2020-05-21 | README 1–189；ndwfc.js 1–229全文；ndwfc-tools.js 1–418全文；index.js 609–645的worker循环；LICENSE全文 |
| mxgmn/WaveFunctionCollapse | `de7d22e705e816b62b4d613199d0463820fcaef3`；2026-03-21 | README算法/Tilemap/Higher dimensions/Constrained synthesis/Comments/Used work/How to build节；Model.cs 1–255全文；OverlappingModel.cs 1–150全文；SimpleTiledModel.cs 1–254全文；Program.cs 1–72全文；LICENSE全文 |

官方入口：[ndwfc固定版本](https://github.com/LingDong-/ndwfc/tree/3479af8ee855455b0922b9b2f4c26d5378b0cbee)、[原版固定版本](https://github.com/mxgmn/WaveFunctionCollapse/tree/de7d22e705e816b62b4d613199d0463820fcaef3)。未阅读所有tileset资源、全部样例和历史提交。没有把README里的GIF当成本轮已观看内容。

## ndwfc：扩展到底保留了什么

核心有两份状态：`wave` 是已固定坐标→瓦片编号；`wavefront` 是未提交坐标→候选位数组。坐标是任意整数格的逗号字符串。`nd` 可以变，但邻居仍是每轴±1，**不是任意图邻接接口**。方向别名次序是 y、x、z。

[`expand`（169–188）](https://github.com/LingDong-/ndwfc/blob/3479af8ee855455b0922b9b2f4c26d5378b0cbee/ndwfc.js#L169) 枚举半开区间 `[xmin,xmax)` 的笛卡尔积，过滤已有单元，为新增单元置全候选，再从全部已提交wave传播。已有格不被覆盖；区域外尚未存在的格不构成约束。它不提供“最大世界边界”或周期环绕参数；多次扩展形成已请求区域的并集，不会自动删除旧区。

[`step`（190–224）](https://github.com/LingDong-/ndwfc/blob/3479af8ee855455b0922b9b2f4c26d5378b0cbee/ndwfc.js#L190) 扫描整个frontier计算加权熵；选择时再加[-0.5,0.5)噪声，因此并非只打破完全相同熵的平局。一个候选的格跳过；多候选格按权重随机定值再传播。全部熵为0时才将readout并入wave，清空frontier，返回true。

矛盾导致零候选，熵产生NaN。此时重置**整个当前frontier**，再从已提交wave传播，返回false。这不是记录决策栈的回溯，也不会撤回旧wave来让新区域可解。普通尚未完成同样返回false；永久无解输入会不断重试。源码没有重试预算、取消状态或矛盾位置API。

[`propagate`（58–129）](https://github.com/LingDong-/ndwfc/blob/3479af8ee855455b0922b9b2f4c26d5378b0cbee/ndwfc.js#L58) 以栈处理候选删减。候选对匹配还要线性扫描rules；不是原版支持计数结构。它只向frontier传播，未注册的邻格跳过，已提交wave之间也不做合法性审计。第80行的fallback条件/赋值检查x而不是y，是值得修查的代码异常；不能据此宣称改一行就解决全部问题。下文测试直接确认了非法固定输入漏检。

**两种seed不可混用：** 构造参数 `wave` 是固定瓦片输入；随机性来自全局Math.random，原库没有随机seed参数。扩展和初始化后的固定约束仍需调用方验证。不能为复现实验在游戏主线程长期替换全局Math.random；工程版应注入私有PRNG。

`readout(false)`（143–155）把候选位按数量归一，不含weights。因此[1,9]权重的两个候选仍显示[0.5,0.5]；它是候选分布调试显示，不能当成真实选择概率。`readout()`会包含frontier中单候选格，**不代表这些格已经提交到wave**。

## helpers 和教程 API 的差别

[ndwfc-tools.js](https://github.com/LingDong-/ndwfc/blob/3479af8ee855455b0922b9b2f4c26d5378b0cbee/ndwfc-tools.js) 用字符边界匹配生成规则：2D比较边、3D比较面。2D默认增加旋转并检查重复；3D默认是指定的绕y旋转与fy组合，不等于自动展开所有立方体对称。默认权重按变体存储，不能把原型权重直接理解为原型出现总概率。

README例子写 `transformations`，实际addTile解构字段是 `transforms`（72、318行）。实测前者被忽略并走auto，后者才关闭旋转。这会直接影响手工图集索引与模块朝向，接入必须按源码核对。

固定版本全库检索没有 `destroyTile`，核心公开接口只有 `readout/expand/step`，`propagate`还是闭包内部函数。[既有教程字幕研究](WFC_DESTRUCTIBLE.md)将06:03–07:12的destroyTile/updateCurrentTiles记为讲者新增，16:59–18:25是保存幸存瓦片后重建输入。本次源码结果与该区分一致：**不能把教程扩展当原库标准API。** 本次未独立取得教程修改源码，不声称审计了其精确实现；网络精确词检索未找到可核验的修改仓库。

[index.js worker循环](https://github.com/LingDong-/ndwfc/blob/3479af8ee855455b0922b9b2f4c26d5378b0cbee/index.js#L609) 在一个worker中运行求解，再postMessage完整readout；这能让UI不直接执行求解，不等于核心传播算法多核并行。

## 原版：两个模型共享同一传播器

[OverlappingModel.cs](https://github.com/mxgmn/WaveFunctionCollapse/blob/de7d22e705e816b62b4d613199d0463820fcaef3/OverlappingModel.cs#L50) 从示例图提取N×N块、统计频次，按symmetry参数加入旋转反射，再按重叠区域像素一致构建兼容表。periodicInput决定取样越界绕回；periodic决定输出邻接绕回，两者不是同一开关。它约束局部模式，不学习“港口上城必有道路”等全局语义。

[SimpleTiledModel.cs](https://github.com/mxgmn/WaveFunctionCollapse/blob/de7d22e705e816b62b4d613199d0463820fcaef3/SimpleTiledModel.cs#L45) 读取显式XML模块、子集、权重、邻接；用L/T/I/反斜杠/F等对称类别展开朝向和邻接。规则不是必然由“边标签相等”导出，能描述更一般的成对许可关系。它适合借鉴为我们手工岩台/城墙接口库，不能仅凭像素模型自动推断几何焊接。

[Model.cs](https://github.com/mxgmn/WaveFunctionCollapse/blob/de7d22e705e816b62b4d613199d0463820fcaef3/Model.cs#L38) 给固定宽高分配wave、四方向支持计数与传播栈；禁用状态后只更新相关支持，计数归零再禁用下游状态。熵缓存为 `log(sumWeights)-sumWeightLogWeights/sumWeights`。Entropy、MRV、Scanline是可选策略；Entropy平局扰动为1e-6量级，和ndwfc的0.5级扰动不同。

原版当前C#核心的邻接方向仍是二维四邻居，没有expand，也没有公开固定格输入参数；README讲高维理论及其他实现，不能据此称这个Model.cs已是通用三维/球面求解器。`ground`是一个特殊约束，不是通用固定建筑接口。

### Run 返回值是接入陷阱

`Run(seed,limit)`每次先Clear并新建Random(seed)，**不是接续上次预算位置**。limit<0执行到结束；limit=0不做观测也可返回true；正limit用尽后同样到96行返回true。只有走89–93行的结束分支才生成observed。故true不能单独区分“全部定值”与“本轮步数用尽”。这些是静态源码结论，本次未运行C#。

[Program.cs 49–65](https://github.com/mxgmn/WaveFunctionCollapse/blob/de7d22e705e816b62b4d613199d0463820fcaef3/Program.cs#L49) 在外层最多重试10次。指定seed时同一截图的每次k重试仍用相同seedStart+i，不能期待改变随机分支；未指定seed才每次选新seed。这里也没有通用决策回溯。工程包装应增加明确完成度检查和预算状态，不直接照搬演示程序的DONE字样。

## 已执行的七项小验证

实际使用仓库原始ndwfc.js与helper，Node执行 `/tmp/ndwfc-audit-20261004.cjs`，零依赖、零源码修改。以下“通过”表示复现预期行为，包含明确缺陷，不表示库已适合生产。

| 输入/操作 | 实际结果 |
|---|---|
| 1D交替规则0→1、1→0，固定0位为0；expand[0,4)，再[-2,6) | 首轮4格，次轮8格，旧值保持，全部交替正确 |
| 同样交替规则，但fixed wave为0位0、1位0 | step返回true，非法固定相邻保留：没有初始固定约束审计 |
| 只有一种瓦片，rules为空，expand[0,2) | step返回true并输出两个0：单候选不能代替相邻检查 |
| 两候选、rules为空、固定0位0，expand[0,2) | 连续三次step都false，1位域始终[0,0]，不会自己修好 |
| weights=[1,9]，一个全候选格，readout(false) | [0.5,0.5]，不是[0.1,0.9] |
| 非对称2×2字符块，分别传transformations:[]与transforms:[] | 前者4变体，后者1变体 |
| 测试夹具临时注入LCG Math.random，两次seed77生成16格 | 两次完全一致；验证可注入的方向，不是库原生seed功能 |

反例可用以下最小代码复核（先require固定版本）：

```js
const w = new WFC({nd:1, weights:[1,1],
  rules:[[0,0,1],[0,1,0]], wave:{'0':0,'1':0}});
w.expand([0],[2]);
console.log(w.step(), w.readout()); // true, {'0':0,'1':0}
```

没有测试：浏览器渲染、多worker并发、3D性能、长时间内存、全部tileset、球面拓扑、C#编译执行。本机未找到dotnet；没有为此安装环境。有限limit和外层重复seed属于源码推导，不伪称运行测量。

## 无限扩展不等于无限成本

ndwfc会保存所有已提交wave；没有卸载、分页或旧区压缩接口。expand先枚举请求包围盒再滤旧格，重复请求不断增长的大盒子仍要枚举旧坐标；并且从全部wave重传播。每step扫描frontier计算熵，传播对候选对与规则表扫描，readout还复制结果；示例worker发送完整结果也有复制成本。

原版固定画布主要状态随格数×候选数增长，另有方向支持计数与成对兼容表。Overlapping的模式数受样本和N影响，预建相容性也有成本。两者都不保证生成一定成功或给出恒定时间结果。

我们的流式方案应保存chunk边界约束/版本与已批准结果，限制活跃求解域，预算耗尽不提交。卸载几何和卸载求解约束是两回事；丢掉边界语义后再回访会发生接缝不一致。固定边界过紧则应报告无解，不能偷偷移动铁路或城基。

## 球面 graph 的迁移方案（本项目设计）

1. 用稳定cellId和半边邻接取代逗号坐标及dx/dy。每条有向边存对方cell、对方边号、边界朝向映射及局部切线基。球面局部up取法线，不假定全世界共享x/y/z。
2. 把候选定义为“原型+合法朝向”；兼容性按两端接口在共享边坐标系比较。五价/六价格、跨patch边缘和不同朝向必须有反例测试，不能把正方形D4旋转表直接用于所有面。
3. 借鉴原版支持计数与删减队列，但每cell按真实度数分配；传播发现任意cell空域立即记录矛盾。别直接复用仅检查索引0的结束逻辑于可能不连通的graph。
4. 铁路、门洞、港口路径先固定；端口连通另存内部连通图。邻接合法后仍跑导航和车辆扫掠净空，求解器不自动替代这些检查。
5. 仅在固定边界包围的小试验区做删除补全。结果标明solved/contradiction/budget_exhausted/cancelled、未定格数、seed、输入版本；固定边界哈希、所有共享边、几何承托及通路全部通过才发布。
6. 输出的模块选择再进入几何拼接/受限松弛和最终地表采样。MC/MT、草树、云、AO各自维护依赖，不把WFC选择包装成完整渲染引擎。

建议分工：用ndwfc理解“保留已完成区，再向外扩展”的最小机制；用原版学习候选数据、对称展开和支持计数。实际球面实现写成项目自己的受测graph求解器，保留两者的失败教训。单纯把NxN贴在球面上不会解决极区、接缝、非四价邻接或全局路线。

## License

[ndwfc LICENSE](https://github.com/LingDong-/ndwfc/blob/3479af8ee855455b0922b9b2f4c26d5378b0cbee/LICENSE)：MIT，Copyright 2020 Lingdong Huang。[原版 LICENSE](https://github.com/mxgmn/WaveFunctionCollapse/blob/de7d22e705e816b62b4d613199d0463820fcaef3/LICENSE)：MIT，Copyright 2016 Maxim Gumin，并明确附带图片样本与tiles不属于该软件。若以后复用实质代码应保留相应版权和许可；不能由代码MIT推断所有样本美术都可照搬。本次交付为原创研究报告，未向运行时引入第三方代码或美术。
