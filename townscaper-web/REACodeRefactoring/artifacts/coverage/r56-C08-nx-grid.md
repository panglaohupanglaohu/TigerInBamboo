# 第 56 批 · C08 第三项目 网格 / 建筑 / 工具（19 条）

浏览器验收：VM headless Chromium + SwiftShader（tools/shot.py，端口 8808；job-c08 需 cross-origin isolation，用 tools/coi-server-c08.py 端口 8818），截图 `artifacts/coverage/shots-r56/C08-*.png`，每张都用 Read 打开看过并与联系表对照。
热点文件（view.js / battle.js / worldmesh.js / app.js / index.html）本组没有改。演示页只加挂钩行（URL 参数，默认关）；逻辑都在本组新文件（文件名带 `-c08`）。没有写 learn/*、没有 git、没有删除任何文件。

## 1769641473895432220（479 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2024-03-18：瓦片星球上高山会「蘑菇化」（越高格子越宽）；用 relax pass 让所有含模块的格子趋向期望形状和大小；注意左上角格子在收缩 |
| 片子机制 | 线框球面 → 模块线框 → 着色星球；可见格子从放大状态逐步收缩（松弛过程本身） |
| 原缺 | 显式模块约束/逐格诊断已有，r55 加了整片相似收缩；但「收缩过程」本身看不到，只能开/关对比 |
| 本轮做了什么 | 新建 src/sphere/planet-relax-c08.js：`relaxFrames` 每帧就是共享 `cornerPositions` 真实跑 k 次弹簧迭代（k=0 纯径向 … 40），可在末帧追加 r55 'shape' 解；`cellOutlineSegments` 给每个陆地格顶环描线，按面积比着色（红=仍蘑菇化、黄、青=到达期望大小）；planet.html `?relaxanim=1` 自动播放，`&relaxT=0..1` 定格 |
| 判定 | done |
| 落点 | src/sphere/planet.js（共享求解器）· src/sphere/planet-relax-c08.js · planet.html?relaxanim=1 |
| 测试 | tests/planet-relax-c08.mjs（首帧=纯径向、末弹簧帧=默认 cornerPositions 逐值一致；面积比 1.98→1.42 基本单调收缩；红格变少；坏参数拒绝） |
| 截图 | C08-planet-relaxanim-t0.png · C08-planet-relaxanim-t1.png |
| 对照 | t0：高台面积比 1.90，552 个顶环全红，白色山顶格明显过大；t1（40 次迭代）：1.35，红 278 / 黄 229 / 青 45，山顶白格肉眼可见收缩——对应原片「cells contracting」。原文只说 mitigate，宽大高原残留的蘑菇化与原片一致地没有完全消除；原模块美术为程序化替代 |

## 1768627849529893109（229 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2024-03-15：把这套东西放到球面上 |
| 片子机制 | 球面上的台地地形：平滑弯曲的海岸/崖线 + 深色描线、多层台地、海；整球旋转 |
| 原缺 | 球面对偶柱群、World 融合（r55）已有；但地形是棱柱六边形，原片平滑海岸/描线视觉缺 |
| 本轮做了什么 | 新建 src/sphere/planet-smooth-c08.js：`levelBoundaries` 按层取 H≥l / H<l 的边界折线；`smoothCoastSampler` 只对这些边界角点在单位球面上做 Taubin λ/μ 平滑（防缩水、分叉点钉住、半径保持），网格仍由共享 planetMesh 生成；`coastOutline` 出崖顶深色描线。planet.html `?smoothcoast=1`（默认关） |
| 判定 | done |
| 落点 | src/sphere/planet.js · src/sphere/planet-smooth-c08.js · planet.html?smoothcoast=1 |
| 测试 | tests/planet-smooth-c08.mjs（边界平均转角 58.5°→25.2°；非边界角点逐值不变；半径保持；翻折 0→0） |
| 截图 | C08-planet-smoothcoast.png |
| 对照 | 页面实测转角 58.1°→21.9°（6 层 2274 条边界边）；画面是弯曲平滑的台地 + 深色崖顶描线 + 海，对应 0100–0199 帧。原片绿色调与软圆崖面属美术，这里配色沿用星球原调色板（程序化替代） |

## 1765041830461055127（558 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2024-03-05：矩形装箱现在也能删除；用久了空闲区会很碎、互相卡死，但仍然装得很紧 |
| 片子机制 | 斜视 3D：底层是彩色矩形，上方是白色的树结构；持续增删，空闲区碎片化但占用率高 |
| 原缺 | 共享 Atlas 已有句柄/删除合并/跨叶 allocateAt，但缺 REACode RectBin 兼容接口和长时间增删的 3D 树视图 |
| 本轮做了什么 | 新建 src/core/rectbin-c08.js：在共享 core/atlas.js 上做 RectBin 外观（placed Map、stats 的 places/removals/tests/splits/merges、leaves、canPlace、place、remove、recursiveFill、report 含 avgFreeLeaf），不复制第二份树；`churn()` 持续随机增删并记录占用率 / 最大空闲块占比曲线；`treeNodes()` 展开全部节点。新页 rectbin-c08.html：斜投影「3D 树」——底层彩色矩形，内部节点按深度抬高画连线，空闲叶青色描边，左下角占用率/碎片曲线 |
| 判定 | done |
| 落点 | src/core/atlas.js（共享）· src/core/rectbin-c08.js · rectbin-c08.html |
| 测试 | tests/rectbin-c08.mjs（接口面；1500 步增删后零重叠、不出界；存在跨多叶的块 52 个；后段平均占用 0.60；全部删除后回到 1 个叶） |
| 截图 | C08-rectbin-churn.png |
| 对照 | 800 步：存活 120 块、占用 78.1%，空闲叶 239、最大空闲块只占空闲面积 3%（很碎），树深 24——即原文「fragmented … still packs tight」；画面构图对应 0200–0299 帧的彩色矩形 + 白色树 |

## 1751932427272909032（552 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2024-01-29：可以强制指定模块出现；先生成该模块需要的那一小块网格（大模块在随机网格里几乎不会碰巧出现） |
| 片子机制 | 岛 → 黄线小块网格（4 方 + 三角）→ 向外三角化铺满 → 模块实体出现在岛上 |
| 原缺 | note 里的 prefab/socket、补网/WFC 已由 r55（spliceModulePatch / solveWithPrefab）补上；本轮复核 |
| 本轮做了什么 | 复核 prefab.html：synthesizeModulePatch 由邻接图合成 4 方 + 3 三角的小块 → spliceModulePatch 挖洞缝进已有网格（31 个接缝三角，半边闭合、Euler=1）→ 3 层共享 WFC 强制出现两层 prefab，周围按 socket 补齐 |
| 判定 | done |
| 落点 | src/core/module-patch.js · src/core/wfc.js · prefab.html |
| 测试 | tests/prefab-splice.mjs、tests/module-force.mjs、tests/module-patch.mjs（全量回归中通过） |
| 截图 | C08-prefab-probe.png |
| 对照 | 截图：原网格 6 处同构足迹 → 绿色合成块 + 橙色接缝 → 赭红两层 prefab（深色门），0 冲突；对应 0124–0147 帧「先造那一小块网格再向外铺」。原片是先造小块再向外生长，我们是缝进已有网格，机制等价（模块需要的网格先被生成）；美术为程序化体块 |

## 1724449858369568780（134 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2023-11-14：按钮切换 ScriptableObject bool → FloatSelectNode 监听 → 一串节点式组件移动一块 UI |
| 片子机制 | 左边 Toggle 按钮 + Moving! 块上下慢移；右边 Unity Inspector 里一串节点组件 |
| 原缺 | note 写缺可视化连线与序列化——核实：node-graph.html 已有连线图（每帧重画）和 JSON 导出/载入（tests/node-graph-serialize.mjs 21 项）。原片本身没有节点连线编辑器，只有 Inspector |
| 本轮做了什么 | 浏览器复核：点 Toggle 后 2.5 s，Moving! 从 top 471 上移到 410（lerpTowards 正在逼近 −33.8），连线图节点值、Inspector 同步，UnityEvent 计数 183 次；导出 JSON 7 节点 / 6 边 |
| 判定 | done |
| 落点 | src/core/node-graph-runtime.js · node-graph.html |
| 测试 | tests/node-graph-runtime.mjs、tests/node-graph-serialize.mjs |
| 截图 | C08-node-graph-toggled.png |
| 对照 | 与 0018–0030 帧一致：按下后块匀速上移，Inspector 数值随之变化 |

## 1714613599035863191（620 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2023-10-18：另一种贴图风格，像抽象的田地；能很清楚地显示游戏格子 |
| 片子机制 | 顶面是一块块「田」：弯曲条纹随格子换向、每块色调不同、地块之间有深色垄沟线 |
| 原缺 | 已有逐格固定方向的导数抗锯齿条纹（uFields=1）；田块拼贴（多块、各自色调与垄向、垄沟描边）缺 |
| 本轮做了什么 | src/terrain/field-pattern.js：原条纹原样改名 fieldToneStripes（uFields=1 逐字不变）；新增 fieldTonePlots：在每格自己的旋转坐标系里做扭曲格栅分地块，每块独立色调与 0/60/120° 垄向 + 弯曲、导数抗锯齿垄沟描边；`fieldTone` 按 uFields>1.5 分派。fields.html 新增「田块拼贴」复选框 / `?plots=1`（设 view.fieldOn=2），默认关 |
| 判定 | done |
| 落点 | src/terrain/field-pattern.js（共享，旧模式逐字保留）· src/world/view.js（未改）· fields.html?plots=1 |
| 测试 | tests/field-plots-c08.mjs（旧条纹函数体逐字存在、分派正确；一格内 11 个地块、空间连贯 0.978）；tests/texel-skip.mjs 回归通过 |
| 截图 | C08-fields-plots.png · C08-fields-plots-close.png |
| 对照 | 近景：每个格顶被分成若干田块，垄向各不相同，块间有深色垄沟，格子边界清楚——对应 0300–0399 帧的田纹；原作手绘纹样/投射 atlas 不可得，用解析纹样替代 |

## 1677242779162877952（279 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2023-07-07：重写通用三角图；压力测试不断加随机点，保证一直是流形、近 Delaunay |
| 片子机制 | 白色三角线框逐点外扩，外轮廓不规则；每次插入时被改动的边短暂亮成绿/黄/青 |
| 原缺 | 共享 TriGraph 有增量插入/全查/翻边；缺局部编辑接口（删点、移点）和改动边可视化 |
| 本轮做了什么 | 新建 src/core/trigraph-edit-c08.js：`addTracked`（插点并返回新增/删除边差分）、`removeVertex`（取星形环 → 耳切 → Lawson 合法化）、`moveVertex`（删+插，失败回滚）、`checkLive`（排除已删点的流形 + 全量 Delaunay）。新页 trigraph-c08.html：逐点插入、外轮廓外扩，新边绿→黄→青淡出，每 10 步全查；可删 5 点 / 移 5 点 |
| 判定 | done |
| 落点 | src/core/trigraph.js（共享，未改）· src/core/trigraph-edit-c08.js · trigraph-c08.html |
| 测试 | tests/trigraph-edit-c08.mjs（300 次插入每 25 步全查、60 次删点、30 次移点后都保持流形 + Delaunay；越界移点回滚） |
| 截图 | C08-trigraph-insert.png · C08-trigraph-delete.png |
| 对照 | 180 点 / 361 面全查 ✓，彩色新边出现在插入处；删 5 点后 511 面全查 ✓——与 0100–0199 帧的白线框 + 彩色改动边一致。外轮廓按外接圆半径过滤（仅显示），原作外轮廓规则不可知 |

## 1458921394855718917（511 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2021-11-11：在研究 Half Edge 结构，轻量、强大、通用 |
| 片子机制 | 圆内撒下一组组旋转的方格块（彩色）→ 剩余区域的边界环被彩色描出 → 间隙用三角网填满 → 重置 |
| 原缺 | core/halfedge.js 有 next/prev/twin、边界环、顶点扇，但没有接到这个「块 + 剩余区域 + 填网」流程，也没有页面 |
| 本轮做了什么 | 新建 src/core/halfedge-patch-c08.js：`scatterGroups` 圆内撒互不重叠的旋转方格块；`fillGaps` 间隙撒点 + 共享 TriGraph Delaunay + Sloan 式强制翻边恢复约束边（块外边、圆边）+ 去掉块内三角；`gapLoops` 只用间隙三角建共享半边，boundaryLoops = 剩余区域的边界环；`fullMesh` 方格 + 三角合成一张网格再建半边。新页 halfedge-c08.html 按三阶段播放并换种子循环 |
| 判定 | done |
| 落点 | src/core/halfedge.js · src/core/trigraph.js（共享，未改）· src/core/halfedge-patch-c08.js · halfedge-c08.html |
| 测试 | tests/halfedge-patch-c08.mjs（5 个种子：约束边 0 缺失；边界环数 = 块数 + 1；合成网格单边界环、Euler=1、checkHalfEdge 0 错误）。注：测试种子里 Delaunay 自然满足约束，强制翻边分支实际触发 0 次，未单独验证 |
| 截图 | C08-halfedge-t0.6.png · C08-halfedge-t1.9.png · C08-halfedge-t3.2.png |
| 对照 | t1.9：13 组彩色方格块 + 14 条彩色边界环（圆 + 块）；t3.2：灰色三角网填满间隙，方格保留——对应 0110–0199 帧。原片块形有 L/T 形，这里是矩形块 |

## 1670725072540106755（164 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2023-06-19：无平滑 / 普通平滑 / 分层平滑对比；分层平滑保留输入瓦片的意图，又抹掉怪网格和有限坡角带来的毛糙 |
| 片子机制 | 同一岛三种模式轮换：锯齿 → 融化 → 保形且顺滑 |
| 原缺 | note 写完整三模式缺——核实：r55 已有 edge-smooth.html 三栏（方格目标松弛 + 边类门控） |
| 本轮做了什么 | 复核 + 补材质边演示（见下一条）；三栏：无平滑 regularity 26.8°，普通 13.7°（但硬边位移 0.121、陆地面积漂移 0.41%），分层 20.3°（硬边位移 0.012、漂移 0.00%） |
| 判定 | done |
| 落点 | src/terrain/edge-square-relax.js · edge-smooth.html |
| 测试 | tests/edge-square-relax.mjs、tests/edge-hierarchy-modes.mjs、tests/edge-material-c08.mjs |
| 截图 | C08-probe-edge-smooth_html.png · C08-edge-smooth-materials.png |
| 对照 | 普通平滑把黑色海岸/台阶拉变形（对应原片 dumb 的「融化」），分层平滑保持黑线、内部格变规整（对应 hierarchical）。原片是 3D 岛，这里用 2D 俯视展示同一机制 |

## 1670720537662836736（102 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2023-06-19：按边类型层级平滑；黑=硬、红=游戏格边界、蓝=材质边界；顶点只被同级或更低级拉，且只沿相应的边 |
| 片子机制 | 线框上叠黑/红/蓝三类边，平滑后各类边沿自己滑 |
| 原缺 | 演示世界里几乎没有蓝色材质边（vrank 材质顶点 0~2 个） |
| 本轮做了什么 | edge-smooth.html 加「地表材质分区」复选框 / `?materials=1`（默认关、关时世界逐值不变）：岩石顶面按低频场分草/沙两种材质，交界为蓝色 material 边，走共享 classifyWorldEdges / squareRelax |
| 判定 | done |
| 落点 | src/terrain/edge-square-relax.js（共享，未改）· edge-smooth.html?materials=1 |
| 测试 | tests/edge-material-c08.mjs（蓝边 49~52 顶点；分层模式下材质顶点平均位移 0.001~0.007，普通模式 0.11~0.13；硬边 0.012 vs 0.121；默认世界分类不变） |
| 截图 | C08-edge-smooth-materials.png |
| 对照 | 三栏都可见黑/红/蓝三色；分层栏里蓝线只沿自身平滑、不被自由格拉走，与原文规则一致。3D 模块/材质三角网的原美术不可得 |

## 1670064751181791233（420 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2023-06-17：在 Burst 里模仿 Thread.Sleep()——把时间存进 static unsafe NativeArray，主线程写、job 里读；用于可视化和调试 |
| 片子机制 | 生成过程被慢放：清空 → 三角网从一条线逐点长出 7 s → 抬起 → 灰模停 4 s → 剪影 → 上色 → 静止，四轮循环 |
| 原缺 | 已有单线程 StageRunner + 共享时钟盒；缺真正的 job 线程，片子节奏没还原 |
| 本轮做了什么 | 新建 src/terrain/pipeline-job-c08.js + pipeline-job-worker-c08.js：生成管线（共享 islandPoints / liftHeights + 共享 TriGraph 逐点插入）跑在真正的模块 Worker 里；主线程把时间倍率 / 暂停写进 SharedArrayBuffer（= static NativeArray），job 内 `sleep()` 每 ≤16 ms 重读一次并 Atomics.wait 阻塞（= Thread.Sleep）；`CLIP_RHYTHM` 按 review 逐帧量出的一轮 22.83 s（clear 210 / triangulate 7070 / lift 200 / clay 4000 / silhouette 400 / color 6000 / hold 4950）。页面没开 cross-origin isolation 时退回复制倍率 + 忙等并如实标 mode。新页 job-c08.html；带 COOP/COEP 的静态服务 tools/coi-server-c08.py |
| 判定 | done |
| 落点 | src/terrain/pipeline-stages.js · src/core/trigraph.js（共享）· src/terrain/pipeline-job-c08.js · src/terrain/pipeline-job-worker-c08.js · job-c08.html |
| 测试 | tests/pipeline-job-c08.mjs（节奏总长 22.83 s、三角化占比；虚拟时钟下 4 轮阶段顺序与总 sleep 精确相等；网格逐点单调增长；控制块倍率/拒绝负值；倍率 2 → 忙等 2 倍、倍率 0 不等） |
| 截图 | C08-job-4000.png · C08-job-9500.png · C08-job-16000.png |
| 对照 | shared-atomics 模式实测：clear 226–231/210、triangulate 7379–7388/7070（+4%，TriGraph 插入与消息开销）、lift 201/200、clay 4050/4000、silhouette 404/400 ms。4 s 时白色三角网 88/152 点正在长，9.5 s 停在灰模，16 s 上色——与 0030–0149 / 0154–0224 / 0232–0343 帧一致。普通 http.server（无 COI）下为 copied-busywait 模式（截图 C08-job-nocoi.png 未逐张检查画面，只读回 mode）。截图服务器用 tools/coi-server-c08.py 在 8818 端口（8808 由普通 http.server 占用） |

## 1582293326815862786（434 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2022-10-18：以为逐个评估 tile 放置会太贵；但坍缩边附近的候选其实很少，所以算法改为扩展（并互连）一张简化导航图 |
| 片子机制 | 3D 线框岛上黄色导航线从几处起点向外生长、彼此连通，最后出完整岛 |
| 原缺 | r55 已在 core/frontier-candidates.js 实现 expandFrontier（坍缩边枚举、最少候选优先、前向检查、导航边并查集互连）；但没有页面可看生长过程 |
| 本轮做了什么 | 新页 frontier-c08.html：两颗种子格开始按 expandFrontier 的真实 order 回放；绿框 + 数字 = 当前坍缩边上每格的候选数（只读 frontierCandidates 重新探测），黄线 = 已放格之间的可走导航边，红圈 = 两片导航区互连那一步；放完按 tile 高度着色成岛 |
| 判定 | done |
| 落点 | src/core/frontier-candidates.js（共享，未改）· frontier-c08.html |
| 测试 | tests/frontier-expand.mjs（全量回归通过） |
| 截图 | C08-frontier-step40.png · C08-frontier-step999.png |
| 对照 | 第 40/203 步：坍缩边 23 格、平均候选 22.3（全集 81/27），导航边 54，两片在第 35 步互连；完成时导航边 322、死格 0。对应 0100–0190 帧黄色导航线生长；原片是 3D 线框，这里是俯视 2D |

## 1579483114178768898（177 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2022-10-10：大改，把不规则网格（Townscaper）与多格 tile（Bad North）结合；有的房子 tile 同时盖住一个方格和一个三角格 |
| 片子机制 | 不规则三角+方格岛上的黄色房子，一栋占两格（方 + 三角） |
| 原缺 | note 列的通用模块身份 / 统一撤销栈 / 完整 prefab 不是片子展示的内容；片子机制（跨方格+三角的双格房屋写进共享 World）已有 |
| 本轮做了什么 | 浏览器复核 multicell.html：真实融合场景（三角+方格）6 栋双格房屋，模板 kinds=[4,3] 即「方格 + 三角」；整栋改层/移除/撤销/工程 JSON 往返照常 |
| 判定 | done |
| 落点 | src/build/multicell.js · src/world/scenes.js · multicell.html |
| 测试 | tests/house-project.mjs、tests/multicell*.mjs（全量回归通过） |
| 截图 | C08-multicell-probe.png |
| 对照 | 截图：混合网格岛上 6 个双格房屋（下拉 house:1 · 51+250），与 0020–0099 帧「房子跨方格与三角」一致；房屋美术是共享建筑管线的程序化房子 |

## 1490068909042642944（427 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2022-02-05：深夜神秘图 |
| 片子机制 | 原尺寸回看 0250/0390：几条同心「环带」，每条带本身是一张三角/四边小网格的邻接图；带与带之间只靠东南西北几根单边辐条相连，外圈还有外伸悬挂点；0200–0299 从中心向外搜索（黄/红前沿边），定稿时按环带分色（青/蓝/品红/黄橙）；底下是极坐标参考网 |
| 原缺 | 旧实现是 BFS 极坐标同心环布局 + 按根分支扇区上色——与原尺寸帧对照，原片颜色是按环带分段，不是按扇区；极坐标刻度缺 |
| 本轮做了什么 | 新建 src/core/graph-bands-c08.js：在共享 grid.js 混合网格的真实格邻接上取 4 条同心环带（每带只留最大连通块），带间加 4 根辐条、外圈加 4 个悬挂点；Tarjan 找桥（迭代版）、去掉切割边后的连通分量、BFS 分层回放。新页 graph-bands-c08.html：空心圈节点（桥端点放大）、中心向外搜索的黄/红前沿、按区域上色、极坐标参考网（同心圆 + 12 放射线 + 72 刻度） |
| 判定 | done |
| 落点 | src/core/grid.js（共享）· src/core/graph-layout.js（旧布局保留）· src/core/graph-bands-c08.js · graph-bands-c08.html |
| 测试 | tests/graph-bands-c08.mjs（小图桥/2-边连通分量；2 万节点长链迭代不爆栈；环带图 4 个区域按半径嵌套、每区单一环带；悬挂辐条是桥、带间 4 根并联辐条不是桥；全图连通） |
| 截图 | C08-graph-bands-t0.45.png · C08-graph-bands-t2.3.png |
| 对照 | t2.3 与 0390 帧同构：四圈彩色环带、东南西北辐条、外伸悬挂点、底网；t0.45 对应 0250 的四向对称搜索前沿。原图的数据含义作者未说明（「cryptic」），这里复现的是可见结构与操作；颜色语义是「去掉带间连接后的连通区域」的推断 |

## 1481661852887265288（425 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2022-01-13：又一个光照烘焙器，做了些 ray marching；贴图：1 程序化大笔触法线，2 3D 有符号距离场，3 ±X/Y/Z 六向 3D AO |
| 片子机制 | 灰白模型旋转；顶部是三张贴图（彩色笔触法线、SDF 切片、六向 AO 切片） |
| 原缺 | note 写笔触法线/切线贴图与 SDF 命中 UV/mega 反馈缺——核实：笔触法线 core/paint-normal.js 已由 r55 接进 View（?shade=paintnormal，切线空间扰动）；SDF（体素中心 EDT）、保守步进 + DDA 兜底、六向 AO 已在 lightvolume.html 接真实 View。「SDF 命中 UV / mega-texture」不在原文三项之内 |
| 本轮做了什么 | 浏览器复核：主场景 ?shade=paintnormal + 只看光照（白模），顶面可见大块笔触法线的明暗块；lightvolume.html 切到「六向距离 AO」，±X/±Y/±Z 六张切片 |
| 判定 | done |
| 落点 | src/core/paint-normal.js · src/world/view-shading.js · src/core/voxel-distance.js · src/light/lightvolume.js · lightvolume.html |
| 测试 | tests/paint-normal.mjs、tests/voxel-distance.mjs、tests/lightvolume-distance.mjs（全量回归通过） |
| 截图 | C08-paintnormal-lightonly.png · C08-lightvolume-probe.png · C08-lightvolume-ao.png |
| 对照 | 白模 + 笔触明暗块对应 0200–0219 帧灰模；六向 AO 切片对应顶部第 3 张贴图。与原文一样是「ad hoc」近似；形变表面 SDF 未做（原文未要求） |

## 1471817524148940807（556 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2021-12-17：岩岛；想让网格自然可读又有趣——方，却又像六边 |
| 片子机制 | 方格地形岛：顶面可见方格线，崖边一折一折呈六边感；分阶段生成 / 旋转 |
| 原缺 | 只有 2D 切角轮廓（corner-cuts.html）与只读 islandFootprints，没进 3D 地形 |
| 本轮做了什么 | 新建 src/core/rock-island-c08.js：在共享 World（四边形网格 + generateTerrain）上，用共享 corner-footprint.js 的二分着色切角方案，逐层只切「落在该层区域边界上」的着色顶点——区域内部方格完整相接、边界一折一折；墙逐层按该层轮廓挤出、顶面画方格线。新页 rock-island-c08.html（切角开/关、四边形/正方格、换种子） |
| 判定 | done |
| 落点 | src/core/corner-footprint.js（共享，未改）· src/core/rock-island-c08.js · rock-island-c08.html |
| 测试 | tests/rock-island-c08.mjs（两种网格：切角后墙段 454→860 等明显增多；顶面积比 0.84~0.9 只在边界损失；World 不变；混合网格非二分明确拒绝） |
| 截图 | C08-rock-island-still_1.png · C08-rock-island-still_1_cut_0.png |
| 对照 | 开切角：方格顶面 + 锯齿状六边感崖边；关切角：普通方块崖——对应 0216–0299 帧。原片崖面圆滑、带阶段生成动画，这里是硬边挤出，未做圆滑与阶段动画；切角是否为原作算法片子不能证明（沿用 r53 的本地解读） |

## 1670790425232175108（610 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2023-06-19：生成器也能输出纯三角/六边形和纯方格网格，用来说明为什么要用混合方案 |
| 片子机制 | 同一条生成管线在纯六边形 / 三角 / 方格网格上各出一座岛 |
| 原缺 | 纯格型只在 2D 网格实验室；独立六边形地形没进主场景 |
| 本轮做了什么 | 新建 src/core/grid-kinds-c08.js（PURE_GRIDS：共享 buildHexGrid / buildSquareGrid / buildMixedGrid mergeRate 0）；src/world/app.js 加一行挂钩：`?grid=hex|square|tri` 时才并入网格表（默认 quad/mixed 不变，菜单也只在带参数时多出三项） |
| 判定 | done |
| 落点 | src/core/grid.js（共享）· src/core/grid-kinds-c08.js · src/world/app.js（1 行挂钩）· index.html?grid=hex|square|tri&scene=terrain |
| 测试 | tests/grid-kinds-c08.mjs（三种网格纯格型、互反邻接；共享 generateTerrain：六边 271 格陆地 95 / 7 层，方格 961 格 372 / 9 层，三角 1944 格 576 / 11 层；radius 键不与分享链接冲突） |
| 截图 | C08-grid-hex-terrain.png · C08-grid-tri-terrain.png · C08-grids-kinds-probe.png（square 截图 C08-grid-square-terrain.png 只读回统计、画面未逐张检查） |
| 对照 | 真实 View 里的纯六边形岛：六边格崖线、台地、湖；纯三角岛有瀑布河道——对应 0200–0299 帧的六边形岛。原岛美术为黄色软坡，这里用主场景地形美术 |

## 1447496205282549761（383 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2021-10-11：底图就是一张朴素的不规则三角网 |
| 片子机制 | 白色不规则三角底网 → 竖向线框 → 完成的岛（崖体、地表、河流），换种子循环 |
| 原缺 | 不规则三角底图上的完整岛没在主场景验收 |
| 本轮做了什么 | 同上一条的 `?grid=tri`：纯不规则三角网（共享 buildMixedGrid mergeRate 0，松弛后不规则）走共享地形管线出岛；打开 grid 线可见三角底网 |
| 判定 | done |
| 落点 | src/core/grid.js · src/terrain/generate.js（共享）· src/core/grid-kinds-c08.js · index.html?grid=tri&scene=terrain |
| 测试 | tests/grid-kinds-c08.mjs |
| 截图 | C08-grid-tri-wire.png · C08-grid-tri-terrain.png |
| 对照 | 海面上白色三角底网 + 岛上台地、河道 27 格、瀑布——对应 0104–0199 帧「底网 → 岛」。原片的软坡/曲面崖为原美术，这里是共享台地美术 |

## 1447494168448753667（178 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2021-10-11：仍是 tile 式 WFC；这次三角 tile 与方形 tile 混用（方形沿两条对角线切成 4 个三角） |
| 片子机制 | 摆开的模块库：平 / 坡 / 曲面 tile，边上彩色插槽线，方块可见对角细分 |
| 原缺 | 四子格联合约束 r55 已做（joint3d.html）；模块库本身没有可视化 |
| 本轮做了什么 | 新页 module-lib-c08.html：直接取共享 core/wfc.js `jointSubtileCatalog` 的目录（351 个子 tile），把每个方格 tile 的 4 个子三角拼回一个模块画出（外边颜色 = 插槽高度，白细线 = 只与同方格相邻子三角匹配的辐条插槽，形体按插槽高度做平/坡/曲），三角 tile 原样；复核 joint3d.html 三层联合求解 0 冲突 |
| 判定 | done |
| 落点 | src/core/grid.js（buildTriangularSubgrid）· src/core/wfc.js（jointSubtileCatalog / layeredJointCatalog）· module-lib-c08.html · joint3d.html |
| 测试 | tests/tri-subtiles.mjs、tests/wfc-weighted-3d.mjs（全量回归通过） |
| 截图 | C08-module-lib.png · C08-joint3d-probe.png |
| 对照 | 81 个方格模块（各 4 子三角、648 条辐条插槽）+ 27 个三角模块，彩色插槽边——对应 0000–0099 帧的模块库；原 3D 曲面美术不可得，用程序化体块 |

## 改动清单

- 新文件：src/sphere/planet-relax-c08.js、src/sphere/planet-smooth-c08.js、src/core/rectbin-c08.js、src/core/trigraph-edit-c08.js、src/core/halfedge-patch-c08.js、src/core/graph-bands-c08.js、src/core/grid-kinds-c08.js、src/core/rock-island-c08.js、src/terrain/pipeline-job-c08.js、src/terrain/pipeline-job-worker-c08.js、tools/coi-server-c08.py；页面 rectbin-c08.html、trigraph-c08.html、halfedge-c08.html、job-c08.html、frontier-c08.html、graph-bands-c08.html、module-lib-c08.html、rock-island-c08.html；测试 11 个（planet-relax-c08 / planet-smooth-c08 / rectbin-c08 / field-plots-c08 / trigraph-edit-c08 / halfedge-patch-c08 / edge-material-c08 / pipeline-job-c08 / graph-bands-c08 / grid-kinds-c08 / rock-island-c08，及复用已有测试）。
- 共享模块：src/terrain/field-pattern.js（uFields=1 的条纹函数体逐字保留，只在 uFields≥2 时走新田块；view.js 没动）。
- 热点文件：只有 src/world/app.js 加 1 行（`?grid=hex|square|tri` 才生效）；默认主场景截图 C08-index-default.png：2516 格、只有 4 边格、网格菜单仍两项、0 error。
- 演示页挂钩：planet.html 两行（?relaxanim=1、?smoothcoast=1；默认截图 C08-planet-default.png 两个挂件均未加载）；fields.html 一个复选框（?plots=1）；edge-smooth.html 一个复选框（?materials=1，关时世界逐值不变，有测试）。
- 全量：`for f in tests/*.mjs` 0 FAIL（1m54s，含其他组当时的文件）。没有写 learn/*、没有 git、没有删除任何文件（包括探针截图）。

**结果：19 条全部判 done。** 其中 5 条（1751932427272909032、1724449858369568780、1579483114178768898、1481661852887265288、1670725072540106755）主要是核实旧 note 已过时 + 浏览器复核，没有新增实现；其余 14 条有新代码。各节「对照」写明了美术替代与仍不同的地方。
