# 第 56 批 · C06 Townscaper 网格 / 地形 / 工具（19 条）

浏览器验收：VM headless Chromium + SwiftShader（tools/shot.py，端口 8806），截图 `artifacts/coverage/shots-r56/C06-*.png`，每张都用 Read 打开看过并与联系表对照；控制台 0 error（只有共享 View 管线已有的 toNonIndexed warning）。
热点文件只动了 src/world/app.js 三处挂钩行（?gems / ?gameui·?topoline / ?flying，默认全关；无参数时主场景 2516 格、HUD 不变，已截图回归）。共享模块改动：core/infinite.js 加 bugPatches（默认 [] 逐位一致）与流式 evict/cached（不调用不影响）。没有写 learn/*、没有 git。

**结果：19 条全部 done。**（见各节「对照」里写明的美术/平台差异，均不影响机制判定。）

全量测试：`for f in tests/*.mjs` 全部通过（0 FAIL，1m51s）。本组新增 9 个测试：planet-wfc-c06 / marching-cubes-c06 / infinite-c06 / sphere-insert-c06 / game-ui-c06 / obj-view-c06 / merge-bench-c06 / grid-gems-c06 / flying-town-c06。

## 784848286272327680（272 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2016-10-08「You can fill it with anything」 |
| 片子机制 | 球面三角格上逐块拼装：单粒起点→沿前沿铺满整球；内容是一条条蓝白蠕虫管，管子跨格连续；表面有褐/苔绿斑块 |
| 原缺 | 旧判读当成「胞元壳装配」：缺格内细分、起点不可指定、生物群系斑块（其实缺的是「内容无关瓷砖 + 求解器生长」本身） |
| 本轮做了什么 | 新建 src/sphere/planet-wfc-c06.js：球面三角网每个三角形 = 一格（3 条插槽边），瓷砖只有边标签，交给共享 core/wfc.js solveWFC（加权熵 + 传播）求解；内容由瓷砖集 build() 在格内生成。tubes 瓷砖集：标签 1 = 管子穿过该边，端头/弯管/三叉 8 种旋转瓷砖，管子按格心二次曲线扫掠；生长顺序取求解器真实落定顺序（explain 记录），起点用 pins 钉住、页面点任一格重来；biomeField 低频场给管子换褐/苔绿色 |
| 判定 | done |
| 落点 | src/sphere/planet-wfc-c06.js（共享 core/wfc.js）· planet-wfc.html?set=tubes |
| 测试 | tests/planet-wfc-c06.mjs |
| 截图 | C06-planet-wfc-tubes-root400-early.png · C06-planet-wfc-tubes-045.png · C06-planet-wfc-tubes-060.png |
| 对照 | 早期 50/996 块是一小簇蠕虫（对 0005–0010 帧），45%/60% 是缺口半壳、管子连续蜿蜒（对 0030–0099）；冲突 0、前沿率 100%。管子比原片略细略稀，颜色斑块为程序化替代 |

## 784847588893814785（270 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2016-10-08「Content-agnostic algorithm for placing tiles … Basically a Sudoku-solver on steroids」 |
| 片子机制 | 同一求解器换一套瓷砖：跨多格的大平板 + 一整片格内细分的碎块堆，沿前沿铺满 |
| 原缺 | 两级尺度（碎块堆）未实现 |
| 本轮做了什么 | 同一模块的 plates 瓷砖集：P 高板 / L 低板 / R 碎块，27 种边组合；碎块格内再细分 16 个小三角各自随机高度（第二级尺度），板格之间按标签出台阶墙；用 solveWFC 的 allowed 把碎块限制在一片低频区域（片中碎块集中一处），完全交给求解器传播 |
| 判定 | done |
| 落点 | src/sphere/planet-wfc-c06.js · planet-wfc.html?set=plates |
| 测试 | tests/planet-wfc-c06.mjs |
| 截图 | C06-planet-wfc-plates-045.png · C06-planet-wfc-plates-060.png |
| 对照 | 60% 时可见光滑大板 + 台阶墙 + 底部一片碎块堆 + 镂空能看到内壁，与 0041–0180 一致；碎块格平均 411 顶点 vs 板格 195 |

## 784847933686575104（268 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2016-10-08「Currently built for triangular tiles, but would work for squares or voxels too」 |
| 片子机制 | 三角瓷砖：浅灰板面 + 沟槽 + 圆顶，沿前沿逐块铺满，断口处看到薄壳 |
| 原缺 | 起点不可指定、格内细分；且旧实现不是瓷砖拼装 |
| 本轮做了什么 | 同一模块的 tech 瓷砖集：F 平板 / G 沟槽穿边，沟槽从穿边中点经格心刻进板面（9² 细分），平板格另有「圆顶」变体（同插槽不同内容，验证内容无关）；薄壳 + 底面封口，断口有侧壁 |
| 判定 | done |
| 落点 | src/sphere/planet-wfc-c06.js · planet-wfc.html?set=tech |
| 测试 | tests/planet-wfc-c06.mjs |
| 截图 | C06-planet-wfc-tech-045.png · C06-planet-wfc-tech-060.png |
| 对照 | 60% 半壳：外面是带蜿蜒沟槽和圆顶的板面，开口处看到内壁，与 0100–0199 一致；沟槽比原片细、圆顶较少 |

## 1430224300003545091（288 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2021-08-24 Townscaper mesh exporter 公测 |
| 片子机制 | 游戏菜单 Export (Obj) → 文件拖进另一个 3D 软件，看到灰白模型 + 地面网格 |
| 原缺 | 第三方 DCC 视觉未验收；水/植被/材质未导出 |
| 本轮做了什么 | 新增独立 OBJ 读取器 src/tools/obj-parse-c06.js（v/vn/f 各写法、负索引、多边形扇形、无 vn 用面法线，不依赖导出端结构）；obj-view.html 在隐藏 iframe 里开真实主场景，用共享 objexport 导出，再用独立解析器读回，DCC 风格灰白材质 + 地面网格显示，并对账面数/包围盒；也可拖入任意 .obj。原片 DCC 里也只有灰白主体（无水/植被/材质），所以主体导出就是片中范围 |
| 判定 | done |
| 落点 | src/tools/objexport.js · src/tools/obj-parse-c06.js · obj-view.html |
| 测试 | tests/obj-view-c06.mjs |
| 截图 | C06-obj-view-town.png |
| 对照 | 小镇导出 12185 面全部读回、包围盒误差 0；画面是灰白房子 + 栏杆 + 地基，与 0178–0199 帧第三方软件里的灰模一致 |

## 1401145625572425728（349 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2021-06-05 小网格靠 Unity 动态合批在 Switch 上不够快，自写 mesh merger，渲染约快三倍 |
| 片子机制 | 同一座镇子在正常着色与线框（看到合并后的三角）之间切换 |
| 原缺 | 只测了合并后 1 次提交，没有「拆开 vs 合并」对照 |
| 本轮做了什么 | 新增 src/tools/merge-bench-c06.js：把同一份 World 主体几何切成很多小网格（每 64/16 三角一个）与 WorldMesh 已合并的单一几何对照，同相机同材质测 renderer.info 提交次数和逐帧时间；8×8 视口模式去掉填充代价只剩提交开销。主场景 setDebug("wire") 看合并网格线框 |
| 判定 | done |
| 落点 | src/world/worldmesh.js（已有合并）· src/tools/merge-bench-c06.js · index.html |
| 测试 | tests/merge-bench-c06.mjs |
| 截图 | C06-merge-wire.png |
| 对照 | 线框画面对应 0036–0078；本机 SwiftShader：191→1 次提交快 1.1×，762→1 次提交快 1.5×（全尺寸视口受填充限制只有 1.0–1.06×）。方向一致，但「三倍」是 Switch CPU 数据，本机无法复现，如实记录 |

## 1384958097542819845（679 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2021-04-21 拓扑直线脚本，打算用于手柄操作和拖动连刷 |
| 片子机制 | 游戏里鼠标处拉出白色虚线，沿拓扑直线穿过格子，随鼠标方向变，绕回起点即闭环 |
| 原缺 | 没接进游戏（手柄/连刷） |
| 本轮做了什么 | 新建 src/ui/game-ui-c06.js 的拓扑直线层（主场景 ?topoline=1）：鼠标移动时按移动方向选出口边，用共享 traceStraightReport 正反两向拼成整条线画白色虚线；方向键/手柄十字键（navigator.getGamepads 轮询）让光标沿拓扑直线一格格走、左右换向；「直线连刷」工具按下拖动把整条线每格加一层，进同一撤销栈 |
| 判定 | done |
| 落点 | src/core/grid.js · src/ui/game-ui-c06.js · index.html?topoline=1 |
| 测试 | tests/game-ui-c06.mjs |
| 截图 | C06-topoline-loop.png · C06-gameui-menu.png |
| 对照 | 空海面上俯视一条 46 格闭环虚线，与 0285–0299 帧一致；连刷 181 格后撤销完全恢复。真实手柄硬件没测（无设备），只测了键盘路径 |

## 1338829205157646336（316 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2020-12-15 球面 Delaunay 可在球极投影上做；点按纵向=径向排序 |
| 片子机制 | 投影平面上：中心一撮白点 → 超级三角出现 → 点由内向外逐个插入，中心密外围稀，视图逐渐拉远 |
| 原缺 | 缺投影平面里的逐点插入回放、投影往返 |
| 本轮做了什么 | 新建 src/sphere/stereo-insert-c06.js：极点取最北点，其余点 stereoProject 后按半径排序，用共享 TriGraph 逐点 Bowyer–Watson 插入（超级三角按最大半径 1.15 倍、画面内可见），可往回拖重放；插完 liftToSphere 抬回球面并把凸包连极点；页面 sphere-insert.html 视图随插入半径对数拉远 |
| 判定 | done |
| 落点 | src/sphere/stereo-insert-c06.js（共享 core/trigraph.js、planet-town.js 投影）· sphere-insert.html |
| 测试 | tests/sphere-insert-c06.mjs |
| 截图 | C06-sphere-insert-0.008.png · C06-sphere-insert-0.12.png · C06-sphere-insert-0.5.png |
| 对照 | 5 点时只见中心一小撮点 + 超级三角长边（对 0000–0041），300 点时中心是密三角盘、外圈长三角连到超级顶点（对 0080–0199）；每插一点三角 +2，抬回 1196 面闭合、Euler 2、往返误差 2e-15 |

## 1338825080844021760（395 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2020-12-15 随机点 → 散开 → 三角化 → 按三角形松弛 |
| 片子机制 | 球上：随机点散开 → 三角网从底部往上铺 → 松弛成均匀三角球 |
| 原缺 | 动态重三角化、投影往返（阶段动画 r55 已补） |
| 本轮做了什么 | 复核 r55 sphere-stages（planet.html?stageT=）实际画面；本轮补 relaxRetriangulate：每轮按三角形重心松弛后整体重新投影三角化，统计每轮改边数（22→4→2→0…收敛），即原版 relax + 重三角化；投影往返误差进测试 |
| 判定 | done |
| 落点 | src/sphere/planet.js · src/sphere/sphere-stages.js · src/sphere/stereo-insert-c06.js · planet.html?stageT= |
| 测试 | tests/sphere-insert-c06.mjs · tests/sphere-stages.mjs |
| 截图 | C06-planet-stage-0.5.png · C06-planet-stage-1.45.png |
| 对照 | t=0.5 散开点云、t=1.45 下半球已三角化、上半只有点，与 0100–0199 帧一致 |

## 1313837640366596096（315 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2020-10-07 找到网格里的完美环就能建飞岛 |
| 片子机制 | 环内整座镇子悬空，底下等距细腿插进水面带涟漪，岛沿有白色小构件 |
| 原缺 | 建筑随岛抬升、外沿白色构件、主场景接入 |
| 本轮做了什么 | 新建 src/world/flying-town-c06.js（主场景 ?flying=1）：findLoops 找完美环，环内每格整列体素（地形 + 建筑，保留岩石/建筑属性）上移 lift 层，同一 World/WorldMesh 直接渲染成悬空镇子；沿环周等距挂细腿到水面 + 涟漪圈，外沿白色两叶小构件（程序化替代）；之后在岛上照常建造 |
| 判定 | done |
| 落点 | src/core/loop-lift.js · src/world/flying-town-c06.js · index.html?flying=1 |
| 测试 | tests/flying-town-c06.mjs · tests/loop-lift.mjs |
| 截图 | C06-flying-town-small.png · C06-flying-town.png |
| 对照 | 159 格小环上的房子群整体悬空、19 根细腿带涟漪，与 0000–0300 转台构图一致；船壳是岩石崖面而不是原片黄色拼板+铆钉（美术差异），飞行操控片中没有出现 |

## 1302686201401442309（241 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2020-09-06 平滑与翻折 bug：翻折块塌成一团、插值时被拉开，邻块被迫拉长 |
| 片子机制 | 六边块网格里几块塌成深色皱褶，旁边块被拉成长条 |
| 原缺 | 面积回拉松弛（14 格缩到 0.46×）；bug 本身没有复现 |
| 本轮做了什么 | core/infinite.js buildInfinite 加 bugPatches（默认 [] 与旧行为逐位一致）：指定块在块/簇松弛里绕向取反 → 复现翻折 45 格、邻块拉伸>2× 54 格、最大 4.58×，块接缝仍 4e-15；新建 core/infinite-c06.js restoreArea：块边界钉住、每格按原始点阵面积回拉，最小面积比 0.46→0.72、最大 1.83→1.48、<0.6 的格 142→0、无翻折；页面 infinite-stream.html?mode=bug 着色对照 |
| 判定 | done |
| 落点 | src/core/infinite.js · src/core/infinite-c06.js · infinite-stream.html?mode=bug |
| 测试 | tests/infinite-c06.mjs · tests/infinite-verify.mjs |
| 截图 | C06-inf-bug.png · C06-inf-bug-fixed-area.png |
| 对照 | 翻折块沿块边塌成深色细带、外侧邻格黄色拉长条，与 0100–0199 的症状一致（原片塌成星形皱褶更明显） |

## 1301816247479345152（324 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2020-09-04 在生成网格里随机撒手工规则网格补丁，像小宝石，用来建神庙 |
| 片子机制 | 生成网格中嵌着规则放射/四边补丁，在上面建出环院和中央塔 |
| 原缺 | 多补丁/填充世界迁移（其实 r55 已补模板库、多补丁、migrateWorldToPatch）；主场景没有随机撒补丁；塔顶比例 |
| 本轮做了什么 | 新建 core/grid-gems-c06.js sprinkleGems：按种子在生成网格随机撒 4 块（courtyard/radial/block/rhombus），每块走共享 fitTemplatePatch，互不重叠、面积守恒、半边互逆；主场景 ?gems=N 在建 World 之前换网格（默认关，存档不受影响），补丁上直接建造 |
| 判定 | done |
| 落点 | src/core/radial-patch.js · src/core/grid-gems-c06.js · index.html?gems=4 |
| 测试 | tests/grid-gems-c06.mjs · tests/radial-dual.mjs |
| 截图 | C06-gems-temple.png |
| 对照 | 放射补丁上建出放射屋顶的圆形神庙，对 0111–0199 的环院俯视；屋顶/塔的美术造型与原片不同（程序化建筑），机制一致 |

## 1242824460325052417（383 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2020-03-25 给按钮列表轻微倾斜就变俏皮 |
| 片子机制 | 游戏右侧 New/Open/Quit/Save to Clipboard/Load from Clipboard/Undo·Redo/Grid，各自轻微倾斜、分组着色 |
| 原缺 | 未接游戏菜单 |
| 本轮做了什么 | game-ui-c06.js 倾斜菜单（主场景 ?gameui=1）：用共享 playfulJitter 定倾角/偏移、colorFor 分组色；每个按钮接真实命令：New=清空进撤销栈、Open/Load=decodeWorld 原子载入（失败保岛）、Save=encodeWorld 写剪贴板、Undo/Redo=主场景撤销栈、Grid=view.setDebug("grid")、Quit=收起菜单 |
| 判定 | done |
| 落点 | src/core/playful-layout.js · src/ui/game-ui-c06.js · index.html?gameui=1 |
| 测试 | tests/playful-layout.mjs · tests/game-ui-c06.mjs |
| 截图 | C06-gameui-menu.png |
| 对照 | 右侧绿/红/黄/粉/蓝倾斜按钮列与 0100–0199 帧布局一致；菜单 Undo 撤掉连刷后存档串完全恢复 |

## 1205420678859632640（443 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2019-12-13 alpha = 视角 × 映射到球面的叶纹 |
| 片子机制 | 近景盆栽树冠边缘是叶形剪影，随镜头转动边缘变化；后段开线框 |
| 原缺 | 原作手绘轮廓、透明阴影 caster/impostor |
| 本轮做了什么 | 本轮不改代码，按要求在主场景复核：融合场景近景（无参数默认开）树冠是球面叶纹 × 视角 alpha 的叶形边，三类树冠与灌木都走同一材质；原作手绘叶纹无素材，用程序叶纹替代 |
| 判定 | done |
| 落点 | src/core/leaf-atlas.js · src/life/leaf-surface.js · src/life/vegetation.js · index.html |
| 测试 | tests/leaf-atlas.mjs |
| 截图 | C06-leaf-closeup.png |
| 对照 | 近景圆树冠边缘是锯齿叶形、内部有叶纹明暗，与 0200–0299 的盆栽树一致；树冠投影仍是整团圆影（片中看不出影子形状，不影响机制判定） |

## 1201179450668441600（306 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2019-12-01 Icons! |
| 片子机制 | 左侧竖排图标工具条，白色小三角指着当前工具，反复切换；下方撤销/重做/关闭 |
| 原缺 | 没接游戏指令 |
| 本轮做了什么 | game-ui-c06.js 左侧工具条（?gameui=1）：共享 mountIconToolbar + icon-ink 等墨量线宽，建造/拆除/刷色接主场景 setTool，选中项倾斜放大 + 白色三角指示；下方撤销/重做/清空接真实命令；开启时隐藏原 HUD 工具栏 |
| 判定 | done |
| 落点 | src/ui/icon-toolbar.js · src/ui/game-ui-c06.js · index.html?gameui=1 |
| 测试 | tests/game-ui-c06.mjs |
| 截图 | C06-gameui-icons.png |
| 对照 | 左侧竖排图标、粉色选中块 + 白三角，与 0000–0099 帧一致；点击切到 erase/paint 再回 build 均生效 |

## 1198957499027795969（321 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2019-11-25 顶部那行字是当前建造的存档数据 |
| 片子机制 | 左上角一行小字随每次建造/拆除实时变化 |
| 原缺 | 主场景没有实时存档串 |
| 本轮做了什么 | game-ui-c06.js 左上角存档串（?gameui=1）：World.version 变化时重新 encodeWorld 显示场景名 + 长度 + 串；Save/Load 菜单用同一串 |
| 判定 | done |
| 落点 | src/world/save.js · src/ui/game-ui-c06.js · index.html?gameui=1 |
| 测试 | tests/save-atomic.mjs · tests/game-ui-c06.mjs |
| 截图 | C06-gameui-icons.png · C06-gameui-menu.png |
| 对照 | 屏幕顶端一行等宽小字，建一块后串改变（1043 字符），与 0100–0199 帧一致；自定义配色/天气不在片中，不计 |

## 1163836000688365571（353 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2019-08-20 Basic marching cubes on my funky grid |
| 片子机制 | 不规则四边形线框地面上，红色实体从一点长成脊、拱、桥，面只在格边交点上 |
| 原缺 | 3D 等值面整个没有实现 |
| 本轮做了什么 | 新建 src/core/marching-cubes.js marchIrregular：每格 × 每层是不规则棱柱，按面走一圈（外→内「进」、内→外「出」，面歧义一律内部角点分开）直接生成每格等值多边形，等价于带面歧义规则的 marching cubes，不需 256 表；交点按「顶点 id + 层」焊接，插值规范顺序；四边/三角/混合网格通用；growthOrder 生长场；页面 marching-cubes.html?mode=cubes |
| 判定 | done |
| 落点 | src/core/marching-cubes.js · marching-cubes.html?mode=cubes |
| 测试 | tests/marching-cubes-c06.mjs |
| 截图 | C06-march-cubes_t_0.4.png · C06-march-cubes_t_1.png |
| 对照 | 红色实体在暗灰不规则线框上长成带洞的脊和拱，面为斜切三角，与 0100–0352 一致；两种网格每帧闭合、0 非流形、体积为正；造型偏团块（生长场是本地程序），编辑器选框未做 |

## 1151770831619534848（532 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2019-07-18 簇用 3 块代替 7 块，需要预生成的未松弛块更少；黑白两张网互为对偶 |
| 片子机制 | 圆形范围内的格子是松弛好的白网，圈外是暗网，拖动黄点范围跟着动 |
| 原缺 | 按需流式范围、对偶显示在窗口里；性能等价 |
| 本轮做了什么 | 新建 core/infinite-c06.js streamWindow：焦点半径内的块按需最终化（白网），外一圈只生成未松弛拓扑（暗网），更远缓存丢弃（infinite.js 流式生成器加 evict/cached，默认不调用不影响旧行为）；windowDual 用共享 quadDual 画黑网；页面同时显示 3 块簇最终化一块需 7 块拓扑、7 块簇需 19 块（×2.71） |
| 判定 | done |
| 落点 | src/core/infinite.js · src/core/infinite-c06.js · infinite-stream.html |
| 测试 | tests/infinite-c06.mjs · tests/infinite-stream.mjs |
| 截图 | C06-inf-stream-0.png · C06-inf-stream-far.png |
| 对照 | 圆内白网、圈外暗色未松弛网、黄色焦点 gizmo，与 0200–0299 帧一致；块间接缝 3e-14 |

## 1151137783785771008（449 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2019-07-16 aperiodic infinite deterministic irregular relaxed quadrilateral grid |
| 片子机制 | 拖动 gizmo，焦点附近的六边形块一块块冒出来并松弛好 |
| 原缺 | 真无限流式（页面最多 19 块） |
| 本轮做了什么 | 同上 streamWindow：拖动/巡游焦点任意远，按需生成并丢弃远处缓存；走 25 步共生成 287 块、缓存最多 33 块、丢弃 274 块；丢弃后回原处重算逐位一致（确定性） |
| 判定 | done |
| 落点 | src/core/infinite.js · src/core/infinite-c06.js · infinite-stream.html |
| 测试 | tests/infinite-c06.mjs · tests/infinite-window.mjs |
| 截图 | C06-inf-stream-far.png |
| 对照 | 焦点移到 (99,-44) 时画面围绕焦点长出新块，缓存 32 块，与 0100–0199 帧拖动 gizmo 长出新块一致；块内疏密仍是原算法结果（可开面积回拉） |

## 1120036868966502401（703 帧）

| 项 | 内容 |
|---|---|
| 原文要点 | 2019-04-21 marching squares on irregular quadrilateral grids |
| 片子机制 | 编辑器里画一块四边区域 → 铺不规则四边格 → 角点逐个变实 → 深色厚板，板沿是切角（marching squares 轮廓），白格逐渐被盖满 |
| 原缺 | 旧判读为候选格棋盘/区域配色；缺「区域→格→角点→挤出厚板」这条主线 |
| 本轮做了什么 | marching-cubes.js 加 quadRegionGrid：四角 + 一条外鼓边双线性铺格、内点抖动、外圈钉住共享 relaxPolygons 松弛；同一 marchIrregular 只开一层（1、2 层同值、上下层压成 0.02）= 竖墙平顶的挤出 marching squares 厚板；角点按伪随机顺序逐个变实；marching-cubes.html?mode=slab |
| 判定 | done |
| 落点 | src/core/marching-cubes.js · src/world/contour-overlay.js（编辑器叠层，已有）· marching-cubes.html?mode=slab |
| 测试 | tests/marching-cubes-c06.mjs · tests/contour.mjs |
| 截图 | C06-march-slab_t_0.4.png · C06-march-slab_t_0.93.png |
| 对照 | 40% 时白线格上散着切角深色块，93% 时成整块深色厚板只剩两处切角白三角洞，与 0320–0399 帧一致；中间层只有竖墙 |

## 说明：没验证 / 与原片不同的地方

- 原美术都没有，用程序化替代：管子/板/沟槽/圆顶瓷砖、碎块、叶纹、飞岛外沿小构件、补丁上的神庙造型。
- 1401145625572425728：「快三倍」是原作在 Switch 上的数据。本机 SwiftShader 只测到 1.1×/1.5×（视口 8×8，只剩提交开销），全尺寸视口受填充限制，只有 1.0–1.06×。
- 1384958097542819845：手柄只测了键盘方向键这条路；navigator.getGamepads 的轮询代码没有真实设备，未测。
- 1313837640366596096：船壳是 World 原有的岩石崖面，原片是黄色拼板 + 铆钉；飞行操控片中没出现，没有做。大环（474 格）的腿也会落在环内水洞的边上。
- 1302686201401442309：bug 用「绕向取反」复现。原作 bug 的确切成因没有出处，翻折块塌成的是沿块边的细带，原片是更明显的星形皱褶。
- 1205420678859632640：本轮没改代码，只做了主场景复核截图。树冠投影仍是整团圆影。
- 无限网格流式：顶点表（verts）会随走过的路程增长，被丢弃的只有块/簇缓存。
