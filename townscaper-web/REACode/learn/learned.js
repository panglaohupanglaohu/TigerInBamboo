/**
 * learned.js — 这 12 轮"逐片学习"的完整台账，供 pipeline.html 的弹窗使用。
 *
 * 为什么单独一个文件而不是塞进 pipeline.js：
 *   pipeline.js 是**结构**（管线/路线/状态），一个条目一行；
 *   这里是**过程**（原文说了什么、画面长什么样、怎么做、量到多少、卡在哪），
 *   一个条目十行。混在一起会让管线图那个 82KB 的文件更难读。
 *
 * 每条 item 的字段：
 *   id      原帖 id（能对上 gifs/<id>.mp4 与 learn/thumbs/<id>.jpg）
 *   title   一句话结论（当成小标题）
 *   quote   原帖原话（英文原文，保留原样；不确定是不是逐字的会标「意译」）
 *   scene   画面观察（帧序号/数量/尺寸，能量就量）
 *   how     做法（"为什么这样做"写在这里）
 *   nums    量出来的数字（没有就写"未量化"）
 *   where   代码落点
 *   page    可以打开的对照页（可选）
 *   pit     这一条踩的坑（可选）
 *
 * 底部 qa 是手工整理的"高频提问"，检索时权重更高。
 */
window.LEARNED = {
  meta: {
    updated: '2026-11-01 09:55',
    total: 134,
    corpus: 237,
    rounds: 12,
    note: '第 9–20 轮（含被并发轮次覆盖的条目）。每一条都先抽帧看，再落地，再用 gl.readPixels / 单元测试量一遍；没量到的会写"未量化"，不编数。',
  },

  // ---------- 方法论：提问里最常问"你怎么学的" ----------
  method: [
    {
      k: '抽帧',
      t: '一条片子先抽 24 帧、拼成 6×4 总览，再对要实现的那条单独看 1 张中段单帧',
      d: '本地启一个静态服务（8801）用 Chrome + canvas 抓帧，因为这台机器上 REA 的视频通道 / WASM / CDP 三条都不可用（WASM 卡宿主禁止 ps、CDP endpoint_unreachable）。抓完用 PIL 拼图。看总览能判断"这条片子到底在演什么"，很多条标题和画面对不上（见第 19 节）。',
    },
    {
      k: '量参数',
      t: '参数优先从帧里量，量不到才估，估的要写明"估计值"',
      d: '例：旗子宽高比 2.2~2.5:1 是把正面帧的旗色做掩膜、算 bbox 得到的；蝴蝶 0.135 世界单位是按"整岛 500px 时蝴蝶 4px"反推的；描边 DPR 是按 uniform 值算的。拍脑袋的尺寸基本都会翻车（蝴蝶 0.052 只有 3px、雪片 320/z 变成雪球）。',
    },
    {
      k: '验证',
      t: '改完在根目录起 8765，用 playwright-core 驱动本机 Chrome（swiftshader）截图 + 收 pageerror + gl.readPixels 做同机位 A/B',
      d: '"看起来没坏"不算验证。判据是：pageerror 为 0、三角面数不骤降、同机位 A/B 有可解释的像素差、关键指标（覆盖率/一致性/守恒误差）能量出来。控制台出现 THREE.WebGLProgram: Shader Error 一律当失败——three 会静默退回上一个能编译的程序，画面照常出图。',
    },
    {
      k: '并发',
      t: '定时任务会和手动会话同时从"未学"里取题，撞了四次；现在动手前先 ls -lat engine/ src/ 看 mtime',
      d: '撞车的处理原则：删掉重复的那份实现，保留不重叠的；STUDY-INDEX 只 append，并写清覆盖关系。第 15 轮（定时任务）和我同时做了 los/fog/blend，我就删了自己的 src/los.js。',
    },
  ],

  rounds: [
    {
      n: 9, date: '2026-10-31 15:35', title: '打包器三连 + 河道导航 + 连通分组 + 蝴蝶 + 镜像距离场',
      items: [
        {
          id: '1764958522398146667', title: '增量二叉树矩形打包：撒点暴力，查询走树',
          quote: '"cute binary tree rect packer" —— 撒点是暴力的（为了钻到各种缝隙里），但碰撞查询走树（意译）',
          scene: '一板彩色矩形；随后切到 3D：矩形像被线框空间树包着的盒子，白点是当前候选落点',
          how: 'place() 生成三类候选（板角 / 贴已有矩形的右下边 / 均匀随机）硬试，canPlace() 只沿与候选相交的枝向下走。允许**多个叶子共用一个 key**，切分只负责把"外面"分出去。',
          nums: '200² 板放 120 块：填充率 0.813（货架式基线 0.572，+42%）；无重叠（O(n²) 复检 0 对）；平均每次放置 3,369 次叶子测试',
          where: 'src/rectpack.js', pit: '第一版把"被覆盖"的部分硬切成正好等于候选的叶子，会在四周留下 1e-6 宽的边条，递归原地打转 → Maximum call stack size exceeded。',
        },
        {
          id: '1765041830461055127', title: '运行时删除矩形：空间会碎，但仍然打包得很紧',
          quote: '"now with removal! Space gets pretty shredded over time... I tried optimizing online but couldn\'t figure out how when it\'s interlocked"',
          scene: '5~12 帧成片矩形消失又长回来；13 帧后重新填满，颜色分布变了',
          how: 'remove() 把叶子标空，再**后序向上合并**两个都空的兄弟节点。',
          nums: '删 40 块：freeLeaves 260→352、largestFree 316→540、merges 90；再补 40 块后填充率 0.813 → 0.750（掉 7.8%）',
          where: 'src/rectpack.js · remove()',
        },
        {
          id: '1765115069837221962', title: '递归解析填充：板越碎，"手臂"的手指越多',
          quote: '"recursive tree parsing grew new rectangles. Note how the arm gets more fingers the more fragmented the board is"',
          scene: '一条细蓝线从左下伸出，线上每隔一段冒出一个矩形；板上有旧矩形时手臂会绕、会分叉',
          how: 'recursiveFill()：主枝每步右移，遇到 3/4 个可用方向就开副枝（手指）。',
          nums: '空板 avgFingers 3.13 → 碎板（已放 40 块）3.72（+19%）；方向对但幅度小于片子',
          where: 'src/rectpack.js · recursiveFill()',
        },
        {
          id: '1795831296952041691', title: '河道导航：沿河更快，尤其顺流',
          quote: '"working on a navigation structure where it\'s faster to go along rivers, especially downstream"',
          scene: '黄折线贴着河道，白点是路径节点；顺流段贴河心、逆流时偏到岸上',
          how: 'buildNavGraph()：顺流 ×0.35 / 逆流 ×1.35 / 非河道每级高差罚 0.55。**流向取自 carveRivers 的开凿顺序**（DFS 源头→河口），不是高差。',
          nums: 'seed 7：19 步、20 格在河里，同一条路线河道价 9.755 vs 走路价 22.30 → 2.29×；逆流价/顺流价 2.59（seed 21 是 2.34× / 3.01）',
          where: 'src/navgraph.js', page: 'engine/world.html', pit: '河道被削成平台后，156 条河道内部有向边里 152 条高差为 0 —— 按高差定流向会让"下游更快"直接消失。',
        },
        {
          id: '938422757288792064', title: '连通度分组：元胞自动机，节点被最强的邻居组吃掉',
          quote: '"really happy with how the grouping turned out. It\'s a cellular automaton where nodes get eaten by the neighbor group they\'re most connected to"',
          scene: '扁长点图先各自一色，3.5s 起从几处种子整片染色，4.8~5.0s 有几块被邻组反吞，8s 稳定成锯齿边界',
          how: 'groupByConnectivity()：阶段一波前生长（只吃"有已上色邻居"的节点，按到各组边权和选）；阶段二边界回吞（要超过 margin 才改判）。',
          nums: '12 个种子：12 组、cut 6.7%、增长 23 层 + 回吞 1 轮；6 个种子会碎成 41 组（孤岛各自成组）',
          where: 'src/grouping.js', pit: '等强边界不加惰性（margin）会每帧翻一次，画面上就是闪烁。',
        },
        {
          id: '938405900573986816', title: '区域散开：节点先推开，再切区域',
          quote: '"campaign generation: islands get pushed apart, then cut into regions"（意译）',
          scene: '一列节点图，白线把图切成几块，边界上的点是红/紫',
          how: 'spreadNodes()：斥力迭代，只动位置不动拓扑。',
          nums: '40 个挤在 4×4 里的节点，40 轮后最小间距 0.97（目标 1.0），位移量级 1.5 世界单位',
          where: 'src/grouping.js · spreadNodes()',
        },
        {
          id: '1273520600221433857', title: '蝴蝶：绕"可能的落点"晃，换点造成漂移',
          quote: '"butterflies move completely differently from birds. They loosely circle a potential landing spot, drift by switching spots, plus world-space noise for variation and consistency (no boids)"',
          scene: '白/米色小片 2~4px，全在草地上方 0.15~0.5 单位；同帧朝向各不相同但位移方向大体一致',
          how: '落点用同一个向下射线（不许悬空、不许落屋顶，avoid 剔掉房子周围）；绕行半径/角速度都在调制，换点用 ease-out 插值；漂移场只吃世界坐标。',
          nums: '近景 A/B（藏掉鸟）：米白像素 175 → 0；尺寸从 0.052 改到 0.135 才量得出来',
          where: 'engine/butterflies.js', page: 'engine/world.html', pit: '0.052 世界单位在整岛视图里只有 1px（米白像素 3 个），等于没画。',
        },
        {
          id: '1104771432440049664', title: '镜像距离场 UI 花边：一张贴图翻着用',
          quote: '"distorted distance field + mirrored UV for UI ornaments; border and center cutoff are tunable separately"（意译）',
          scene: '右下角一张方形小图（唯一贴图）；"Text" 面板一帧帧长大，四角花纹不变形，只有中间被拉长，线粗恒定',
          how: '64² 距离场（只画四分之一，其余靠镜像）+ 两个 cutoff（border 0.055 / center 0.10 当水印）；角花按 4 个镜像朝向贴、边中缩放重复、框线用 1px stroke。',
          nums: '四种尺寸（210×84 / 360×96 / 560×110 / 660×76）角部墨量 0.297 / 0.299 / 0.305 / 0.284（±4%）',
          where: 'engine/ornament.js', page: 'engine/ornament.html', pit: '把 64² 铺满整块面板 → 四角花纹糊成一片黑；框线/角花/边中必须分开处理。',
        },
      ],
    },
    {
      n: 10, date: '2026-10-31 16:30', title: '笼形变形 + 拓扑直线 + 顶点格植被 + 三种网格对照',
      items: [
        {
          id: '1579478470098243584', title: '笼形变形：位移只依赖顶点基准坐标',
          quote: '"to make the cliffs look more organic I\'m doing some pretty radical cage deformation on the cells"',
          scene: '白色线框盒状笼子罩着每块台地，笼面在动、竖棱跟着弯；矮台地几乎不动，高崖扭得最凶',
          how: '位移只依赖顶点**基准坐标** p.bx/p.bz → 共享顶点的格子拿到同一个位移，不裂缝；权重 1+(h−1)·0.22 让高崖扭更多。',
          nums: 'moved 27,384 次顶点、maxShift 0.333 世界单位；变形后体检 repaired 0 / badRatio 0（amount 提到 0.14 会出现 3 个反向格）',
          where: 'engine/cage.js', page: 'engine/world.html', pit: '按"当前格"算噪声会让相邻格各算各的，崖面出现一道道竖缝（每格独立建面，缝就是黑线）。',
        },
        {
          id: '1384958097542819845', title: '拓扑直线：入口对边即出口',
          quote: '"tracing topologically straight lines across the grid"',
          scene: '青灰网格上一根浅色线穿过一格又一格；格内笔直、拐弯全在边上且都是 90°；线还会绕回闭合',
          how: '出口 = 入口的对边（这就是"拓扑直线"的定义），只在格边界允许换边；每格记 perCell{enter,exit} 供渲染按各自高度抬线。',
          nums: '22 条：375 格 / 120 次拐弯 / 3.13 格一拐 / 750 段；连通不变量（相邻两格必须互为邻居）0 违反',
          where: 'src/topoline.js', page: 'engine/world.html',
        },
        {
          id: '959752525867036672', title: '顶点格＝三角网格的对偶，一瓣一株铺植被',
          quote: '"pulsating vertex cells; a dual to the triangular grid and a suitable place to start with foliage placement"',
          scene: '岛上一层半透明白色"圆瓣"，一瓣是一个顶点周围的多边形，贴地形起伏、彼此无缝',
          how: '顶点 → 周围格心**按绕顶点角度排序**围成面；pickFoliageSites 取面积 ≥0.55 中位、间距 ≥1.8 的瓣，一瓣一株灌木。',
          nums: '陆地顶点格 1,004 瓣，中位面积 0.0735（p10 0.050 / p90 0.160），度数 3:357 / 4:485 / 5:10 / 6:152；26 株灌木让绿色像素 9,796 → 34,949',
          where: 'src/dual.js', page: 'engine/world.html', pit: '按 cell id 排序会自交（面积正负乱跳）→ 必须按 atan2 角度排序；表现是"顶点格数量莫名少一截"。',
        },
        {
          id: '1670790425232175108', title: '同一生成器输出纯三角 / 六边 / 方块网格',
          quote: '"I made my generator also output pure triangle/hex and square grids, to illustrate why I\'m going for my mixed approach"',
          scene: '三段各 6 帧：方块（正交、横平竖直）→ 六边（三向斜边、60° 锯齿）→ 三角（更密）；每段都切一次线框再切纯黑剪影',
          how: '把原文三句话变成可数的量：主方向数、面内角、面数、顶点度数。',
          nums: '方块 2 方向 / 90° / 144 面；六边 3 方向 / 120° / 81 面（度数 3）；三角 3 方向 / 45° / 288 面（度数 6，面数正好方块 2×）',
          where: 'src/gridmodes.js', page: 'engine/gridmodes.html',
        },
      ],
    },
    {
      n: 12, date: '2026-10-31 17:00', title: '锚定中心顶点 + 房子插地形 + 图压缩 + 彩色反弹 + 两色层理',
      items: [
        {
          id: '1191990107785572352', title: 'billboard 加锚定中心顶点：不那么扁、有方向感、不打乱朝向',
          quote: '"adding an anchored center vert to the billboards makes them a bit less flat and gives them some directionality without messing with the rotation"',
          scene: '近景绿房子＋一圈灌木；镜头推到俯视时灌木仍像"一小团"而不是一张卡片',
          how: 'PlaneGeometry(1,1) → 5 顶点三角扇（+aAnchor）；中心顶点不随相机转、只钉在实例竖轴半高处，uBend 再让它朝相机鼓 6%。',
          nums: 'bend 0 ↔ 0.06：4.12% 像素变化；三角面 24,264 不变；图集**不需要重烘**',
          where: 'engine/impostor.js', page: 'engine/world.html',
        },
        {
          id: '1584623053061099520', title: '把房子插进地形：参数域开洞',
          quote: '"I wrote a thing to splice houses into the terrain... you can kinda see the structure of my mesh system by how the yellow lines are rotating around the verts"',
          scene: '线框里一格地形出现矩形轮廓，房子与地形之间被一圈四边形填满；侧视能看到洞是真的凹进去',
          how: '在格子的**参数域**里切：四边格用双线性 P(u,v)，footprint 是参数域矩形 → "洞 + 四条补片"天然共享顶点、天然面积守恒，不需要像打包器那样处理细边条。',
          nums: '1,082 个陆地格全部 4 块补片，面积守恒误差最大 1.7e-13',
          where: 'src/splice.js', page: 'engine/splice.html', pit: '验证页的投影比功能本身更容易出错：把世界 y 当 lift 再乘缩放，整块图形被抬到画布上方 3000px，屏幕上只剩文字。',
        },
        {
          id: '1582293326815862786', title: '只在坍缩边缘附近枚举 tile，扩张简化导航图',
          quote: '"the number of possible tiles is large, but it is actually quite small around the collapsed edge; my algorithm now expands a simplified nav graph"',
          scene: '黄、绿两套线框图同时扩张，最后合成一座带斜切边的奶油色岛',
          how: '我做的这一半是**图压缩**：navgraph.simplify({keep}) 把走廊压成"路口—走廊"边，有向权重分别存（顺逆流不能对称化）。',
          nums: '河道子图 61 格 → 30 路口（−50.8%）、94 条有向边、走廊最长 11 格，452/452 对节点代价完全一致；反例：整张 4 邻接网格压不动（1,011 路口 / 3,890 边 / 走廊中位长 1）',
          where: 'src/navgraph.js · simplify()', pit: '在 4 邻接网格上做 junction 压缩毫无意义——几乎每格度数都是 4，压缩比 1.00。',
        },
        {
          id: '1237305125070426112', title: '白进调色板后，终于能展示彩色反弹光',
          quote: '"with white finally in my palette, I can properly show off the colored \'bounce\' light"',
          scene: '小岛上白色高楼夹在红屋与蓝屋之间：白墙朝红的一侧偏暖、朝蓝的一侧偏冷，灰地面上有一圈很淡的色渗',
          how: '三次 Jacobi 反弹本来就是 RGB（邻居 field 带邻居底色），本轮把它显式化 + 可关：setColorBounce(false) 把邻居光降成亮度。',
          nums: 'A/B：7.89% 像素变化、平均蓝通道差 −5.63/1000（关掉后整体偏蓝 = 少了暖色反弹）',
          where: 'engine/lightvol.js',
        },
        {
          id: '1699038611125985317', title: '两色沉积层理：只在陡面上乘色',
          quote: '"looking at sedimentation lines again. Helps make large cliffs more interesting. Also makes their shape a bit more readable maybe"',
          scene: '砂色柱子上是米黄/浅粉两色交替的横带，不是只有深色细线；层与层之间是硬边',
          how: 'surfBandTone()：按层序奇偶返回 0/1，只在**陡面**（1−|n.y|）上乘 ±8% 色调，平地不加。',
          nums: 'A/B（贴图层开/关）：edge 3.834 → 4.308（+12.4%），条带没有爬上台地',
          where: 'engine/surface.js',
        },
      ],
    },
    {
      n: 13, date: '2026-10-31 18:50', title: '光照里混法线 + 风场与旗面 + 窗的列对齐 + AO 四档',
      items: [
        {
          id: '929417420921556993', title: '平滑法线 + 硬法线，在**最终光照里**混',
          quote: '"I generate smooth normals for all my meshes and use a blend between smooth and hard normals in the final lighting"',
          scene: '台地之间的明暗跨过格子连续过渡，但格子轮廓仍是阶梯 —— 只有法线被混，几何没动',
          how: 'normalsmooth.js 把原始硬法线另存成 aFlatNormal；surface.js 在 <beginnormal_vertex> 之后 mix(hn, smooth, uNormalMix)。缺 aFlatNormal 的网格（屋顶）用长度判断回退，否则会被乘成近零向量整片变黑。',
          nums: '近景 A/B（mix 1 ↔ 0）8.33% 像素变化；三角面不变；描边/法线 pass 仍读平滑法线',
          where: 'engine/surface.js', page: 'engine/world.html', pit: 'uNormalMix 只声明在 fragment 的 CHUNK 里，顶点着色器编译报 undeclared identifier，**但页面照常出图**（three 静默退回上一个能编译的程序），A/B 数字全是噪声。',
        },
        {
          id: '926903893866541057', title: '风向量场：主方向 + 地形抬升 + 低频扰动',
          quote: '"this is what my wind vectors look like. They can be used by various systems and shaders"',
          scene: '深色海面上的白描边岛，白点是采样点、红色短箭头是风向量；山顶/建筑附近箭头更竖直更长',
          how: '解析场，不做流体模拟；输出 (vx,vy,vz) 给雪、旗、蝴蝶、草共用。',
          nums: '岛上 400 个采样：速度 0.68~1.10（均值 0.875，无死区），平均上掀度 0.257',
          where: 'src/wind.js',
        },
        {
          id: '926890207298899969', title: '旗面 = 沿虚拟风粒子轨迹扫出来的网格',
          quote: '"not really. I build a custom mesh for the flag using a bezier curve along virtual wind particles"',
          scene: '城垛上几十根细白矛杆，旗帜是长条飘带：近杆端竖着贴杆、往外被风兜平、末端分叉成 2~3 个尖；同簇朝向一致、相位不同',
          how: '从杆顶放虚拟粒子被风吹走 → 轨迹当控制点 → Catmull-Rom 采样 → 布面沿曲线向下扫；杆顶切线固定，所以杆处几乎不动、越远越飘。',
          nums: '7 面旗，杆顶 4.94~6.50，曲线末端水平偏移 0.51~0.74；两帧间 84/91 顶点在动（260ms，最大位移 0.0226）',
          where: 'engine/flags.js', page: 'engine/world.html', pit: '别用 sin 摆动：那是"整面旗在晃"，杆处也跟着晃，和片子里"杆顶不动、末端飘"完全相反。',
        },
        {
          id: '1176516621223043073', title: '窗的风格与密度：先按墙长定列数，再塞窗',
          quote: '"getting a feel for the style and density of windows. Here you can also see what I\'m going for when different colors meet"',
          scene: '密集小城：同一面墙上窗**成列对齐**、间距由墙长决定，墙越长窗越多；空白墙段也不少',
          how: '改成列网格：cols = round(usable × density)，每列中心固定（不再随机左右位置），18% 列留空；行 y 吸附粗网格。',
          nums: '墙长 0.45→2.2 时窗数 1,2,2,2,3,3,4,5,5,6（旧随机版 1.05 之后恒为 5）；相邻窗中心间距变异系数 0',
          where: 'engine/props.js', pit: '不加"留空列"整面墙会变成百叶窗；没有"一列都塞不进"的兜底，就会出现整面白墙。',
        },
        {
          id: '793557992931266561', title: 'AO 五档：flat → up normal → 体素 AO → SSAO → 方向性 AO',
          quote: '"flat → up normal → vertex voxel AO → SSAO → directional AO (with textures and vertex colors I could drop the SSAO)"',
          scene: '4 帧=4 次切换：纯白模 → 出现上下明暗 → 拱洞/墙脚/窄缝变暗但没有方向 → 同一拱朝左偏粉、朝右偏绿',
          how: 'src/voxelao.js 在同一份体素高度场上算四档（SSAO 那档没做），aoviz.html 四联对照。',
          nums: 'upNormal 均值 0.640（侧 0.55/顶 1.0）；AO 均值 0.944 但 p05 0.52（只有暗部掉）；dirAO 方向量均值 0.12 / p95 0.884',
          where: 'src/voxelao.js', page: 'engine/aoviz.html', pit: '开放台地上顶点 AO 确实很淡（这正是原文还要做方向性 AO 的理由，不是我们实现错了）。',
        },
      ],
    },
    {
      n: 14, date: '2026-11-01 00:40', title: '描边 ×DPR + 坡面草 + 瀑布 + 雪与粒子接触 AO',
      items: [
        {
          id: '1017355723171344385', title: '描边线宽记 CSS 像素，上传前乘 DPR',
          quote: '"making some thicker outlines for all you 4k high ballers out there"',
          scene: '两段对照：同一座岛，细描边 vs 粗描边；粗的那版在 4k 屏上才不"消失"',
          how: '线宽记 CSS 像素；真正上传的 uThickness = CSS 厚度 × DPR；setSize 里按新 DPR 重算。',
          nums: 'DPR 1 → uThickness 0.8；DPR 2 → 1.6（同一个 thickness=0.8）',
          where: 'engine/outline.js',
        },
        {
          id: '1063115611289645057', title: '把草加在坡上，让可通行性更好读',
          quote: '"I finally added grass to slopes to make navigability easier to read (especially on overcast levels where the lighting ain\'t helping much)"',
          scene: '缓坡被草绿覆盖，陡崖仍裸岩；远看"能走的路"一眼可辨',
          how: 'uSlopeGrass：slope = 1−|n.y|，取 0.16~0.60 的**带**（崖面太陡不长、平台归色块管），再乘一层草茬细线。',
          nums: 'A/B：10.83% 像素变化，绿通道 +0.83/1000',
          where: 'engine/surface.js', page: 'engine/world.html',
        },
        {
          id: '1007587812462530561', title: '瀑布：只保留"落进低处"的河床掉级',
          quote: '"proper games have waterfalls. Happy to report @BadNorthGame is a proper game now"',
          scene: '深紫蓝的岛，崖面挂 2~3 条细白竖带，往下略张开，落水处一圈白泡沫',
          how: '找河床掉 ≥2 级的棱 → 分段竖缎带（滚动条纹 + 两侧收边）+ 泡沫圈；缎带要朝"下游那格"推出去 0.26，否则埋在石缝里。',
          nums: 'drop≥2 有 21 处（全在峡谷内部，全景一张看不见）；加"落进 ≤1 级"后剩 2 处，落差 2.52 世界单位',
          where: 'engine/waterfall.js', page: 'engine/world.html', pit: '"掉 ≥2 级就是瀑布"是错的判据；数量对不上时先问"看不看得见"。',
        },
        {
          id: '943230624369868800', title: '雪片当然受风系统影响，于是绕着岛流动',
          quote: '"the snow flakes are of course affected by the wind system, so they flow around the island"',
          scene: '雪不是直落：绕过建筑与崖壁时整片倾斜，背风面更稀',
          how: '1800 个粒子逐帧用 src/wind.js 推进（风给方向、重力给下落），出界环绕；"脚下多高"用一张 48² 高度表查。',
          nums: '水平风速 0.928（≈0 就是直落）；开/关近白像素 743 vs 558',
          where: 'engine/snow.js', page: 'engine/world.html', pit: 'gl_PointSize = size*320/z 在 z≈15 时是 20~30px 的大白饼（满屏雪球），42 才是 1~3px 的雪片。',
        },
        {
          id: '823848950553780226', title: '粒子也有 AO（手机上跑得动）',
          quote: '"yes, my dust particles have AO too, and it runs on phones"',
          scene: '尘埃/雪片靠近地面时暗一档，不会在亮地面上"发白成噪点"',
          how: '按**离地高度**给 alpha（0 → 0.35，≥1.5 → 1.0），再按离岛距离淡出。不需要深度纹理。',
          nums: '48² 高度表；第一版对每粒子遍历 1000 格（2200×1000/帧 = 220 万次距离计算，帧率掉一半）',
          where: 'engine/snow.js',
        },
      ],
    },
    {
      n: 15, date: '2026-11-01 06:53', title: '（并发轮）廉价视线 + 贴海雾 + max blend + 边界路径 + Bad North 复刻',
      items: [
        {
          id: '810878197134950401', title: '廉价的导航网格视线近似：牺牲精度换速度',
          quote: '"I found a cheap way to approximate line of sight on a nav mesh. What it lacks in accuracy it makes up for in speed"',
          scene: '俯视红褐色网格，一点向四周射出上百条线扫过全图：穿空的浅色、撞实块的暗红',
          how: '沿直线每隔半格采一个点，看点落在哪个格、能不能站、前后高差有没有超过一级台阶；返回 clear + 首个阻塞点及原因（void/water/wall/cliff）。',
          nums: '我那一版：240 对样本误放行 1/33、误拦 0；每 100 次查询 0.99 ms vs Dijkstra 11.67 ms（≈12×）',
          where: 'engine/los.js',
        },
        {
          id: '906207980802252801', title: '贴海的雾：漂、薄、跟着风绕岛',
          quote: '"I\'ve been working on some new fog (sped up in the gif). For background effects, subtlety is key."',
          scene: '紫灰塔岛浮在淡青底上，贴着水面一层薄雾横向掠过，厚度约岛高 1/5，对比极低',
          how: '几团云絮贴水面横向漂，颜色只在背景色上抬一点点；不参与光照计算。',
          nums: '雾带厚度 ≈ 全岛高度 1/5（岛约 8 单位 → 雾 1.2~1.8），只在岛下缘',
          where: 'engine/fog.js',
        },
        {
          id: '1056999668486471682', title: '白天也成立的火，靠 max blend',
          quote: '"works well in daylight too, largely thanks to the max blend"',
          scene: '白色方块岛上三簇火苗，白天也读得出来；叠合处不累加成白团，保持峰值亮度与色相',
          how: 'blendEquation = MaxEquation（src=ONE, dst=ONE）：逐通道取 max，多层叠加不再相加。加色混合在白天会把火洗成白斑，alpha 混合会发灰。',
          nums: '对照页 engine/blendlab.html 里三档并排（add / alpha / max）',
          where: 'engine/blendlab.html',
        },
        {
          id: '1666429884208381953', title: '海岸线渲染折腾一周，最后回到 Bad North 那套',
          quote: '"a week of messing with coastline rendering, and I end up back at the Bad North approach"',
          scene: '俯视一小片海岸：浪线贴着岸、颜色分层、没有多余的光效',
          how: '结论比技术重要：复杂的岸线 shader 不如"一层浪裙 + 一条岸线 + 中间色"稳。',
          nums: '未量化',
          where: 'engine/badnorth.html',
        },
      ],
    },
    {
      n: 16, date: '2026-11-01 07:00', title: '流场：一张方向场喂一群单位',
      items: [
        {
          id: '816748103193817088', title: '流场：从目标反向 Dijkstra，每格记 argmin 邻居',
          quote: '"I\'m flowing right on the nav mesh, so it depends"',
          scene: '俯视灰色地形上几百个白色小钉同时朝一个方向挪，走同一条贴地路线；转角处整团被"挤"过去，宽处摊开、窄口收窄',
          how: '从**目标**做反向 Dijkstra 得 dist（代价有向，松弛用 cost(u→v)），再每格取"cost(id→n)+dist[n]"最小的邻居当 dir；单位每帧只读一格。',
          nums: 'seed 7：750/750 格流场路径代价与 dist 完全一致；建场 1.81 ms；300 单位沿场 0.09 ms vs 300×Dijkstra 10.6 ms（≈118×）；步数中位 13、300/300 到达',
          where: 'src/flowfield.js', page: 'engine/navflow.html', pit: '方向判定写成 total < dist[id] 会全变 -1（最优邻居恰好相等）；const rev 放在 Dijkstra 之后 → TDZ。',
        },
        {
          id: '807256278154301441', title: '（说明与画面不符）群体寻路',
          quote: '"looking at cheap swarm pathfinding. These dots could possibly be crabs or maybe recently dormant soviet under-water robots"',
          scene: '画面是一座红砖城堡小岛（彩色容器、台阶、平台），没有可见的点群寻路',
          how: '这条标题写机制、画面拍成品，属于"仅展示"。群体寻路这一半由上一条流场做到了。',
          nums: '未量化',
          where: '—',
        },
      ],
    },
    {
      n: 19, date: '2026-11-01 06:45', title: '更正：旗子那条片子我看错了（补录两条真片子）',
      items: [
        {
          id: '1212732478458343424', title: '更正：这条不是旗子，是摆房子',
          quote: '"added some flags. Gotta make it homely and welcoming."',
          scene: '420²、24 帧全是在蓝色空地上摆房子（红/绿房子一栋栋落下），旗子只有几个红点，读不出形状或运动',
          how: '我第 14 轮凭标题写了"所有旗相位不同、方向相同"——那是编的。已改成"仅展示"，并在 STUDY-INDEX 第十九节写明。',
          nums: '未量化',
          where: '—', pit: '写进索引的每个"画面观察"都要能指到某一帧；标题不等于内容。',
        },
        {
          id: '958410200146497537', title: '旗帜图鉴：宽高比 2.2~2.5:1、燕尾缺口 34~46%',
          quote: '"the approach is versatile enough that I can use it for the ingame banners too"',
          scene: '一屏十几面旗正对镜头：平涂高饱和色 + 白色剪影徽记（兔/树/骷髅/塔/猪），没有渐变没有明暗',
          how: '宽高比/缺口深度用旗色掩膜算 bbox 与逐列高度得到；燕尾靠"把越界的列夹到缺口边界"实现（uMax = 1 − notch·(1−|cos((prongs−1)πv)|)）。',
          nums: '宽高比 2.21（量到 2.2~2.5）；notch 0.35~0.45；prongs [2,2,3,3,3,2,3]；旗子开/关 7.38% 像素、高饱和像素 +2,042',
          where: 'engine/flags.js', page: 'engine/world.html',
        },
      ],
    },
    {
      n: 20, date: '2026-11-01 09:00', title: '把学到的装回页面：pipeline 补 5 组 + 路线图 11 步',
      items: [
        {
          id: '816748103193817088', title: '导航层接进管线图（新的一组「导航与群体」）',
          quote: '页面：pipeline.html / PIPELINE.md',
          scene: '四列管线图原来停在"前 8 轮"，导航、细节层、表面配件三块完全没出现',
          how: 'base 车道加「导航与群体」「打包与对照工具」；terrain 加「地表细节」「生物与天气」；build 加「表面与配件」；路线图 9 → 11 步。',
          nums: '12 张"最近新增"卡片；85 个 id 全部有缩略图、0 个缺本地 mp4；页面链接 8 条全 200',
          where: 'learn/pipeline.js · pipeline.html · PIPELINE.md',
          pit: '差点把一个笔误带上线：笼形变形记成 1578478470098243584，真实是 1579478470098243584（差一位）。现在有脚本校验 id 是否在 README/data.js 里。',
        },
      ],
    },
  ],

  // ---------- 手工整理的高频提问（检索权重更高） ----------
  qa: [
    {
      q: '河道流向为什么不能按高差算？',
      keys: ['河道', '流向', '高差', '顺流', '逆流', '平台'],
      a: '因为 carveRivers 把每条河削成几段**平台**，同一段里高度完全相同。实测 156 条河道内部有向边里 152 条高差为 0，按高差定流向会让绝大多数河段两边权重一样，"下游更快"直接消失。正确做法是拿**开凿顺序**（DFS 从源头到河口，paths 数组）当流向；横向相邻边再用"离河口几步"补第二判据。',
      ref: 'src/navgraph.js · flowTo / toMouth',
    },
    {
      q: '流场为什么比 300 次寻路快这么多？怎么证明它是对的？',
      keys: ['流场', 'flowfield', '群体', '快', '一致', 'dijkstra'],
      a: '因为它在**目标**上跑一次反向 Dijkstra，所有单位共用同一张 dist/dir 表；单位每帧只读一格，是 O(1)。正确性有硬判据：随机取格子沿 dir 走到目标，累加沿途边权，必须等于 dist——seed 7 是 750/750 完全一致，seed 21 是 474/474。速度：300 单位沿场 0.09 ms vs 300 次 Dijkstra 10.6 ms。',
      ref: 'src/flowfield.js · buildFlowField / flowCrowd',
    },
    {
      q: '矩形打包器第一版为什么会爆栈？',
      keys: ['打包', 'rectpack', '爆栈', 'stack', '矩形'],
      a: '第一版把"被覆盖的部分"硬切成一个正好等于候选的叶子，于是每放一块就在四周产生 1e-6 宽的细边条，递归在这些边条上原地打转 → Maximum call stack size exceeded。正解是**允许多个叶子共用一个 key**：切分只负责把"外面"分出去，"这块地被谁占了"只存在叶子上。',
      ref: 'src/rectpack.js · _commit',
    },
    {
      q: '顶点位移为什么会撕出竖缝？',
      keys: ['笼形', 'cage', '裂缝', '位移', '噪声', '崖'],
      a: '因为第一版按"当前格"算噪声，相邻格各算各的；而每个格子是独立建面的，两个格对同一条棱算出不同位移，缝就是黑线。改成位移只依赖顶点的**基准坐标** p.bx/p.bz（共享顶点必然拿到同一个位移），再按"共享顶点里的最高高度"做权重就对了。',
      ref: 'engine/cage.js · deformCages',
    },
    {
      q: '为什么模型在、实例也在，画面里一个像素都没有？',
      keys: ['图集', 'atlas', '不可见', '缩略', 'impostor', '灌木'],
      a: '那是 SpriteAtlas 面积超限自动翻倍、但烘焙用的 render target 没跟着变。树×2（96²）+ 云（128²）+ 灌木（64²）= 323,712 px² 超过 512²=262,144，图集自动翻到 1024，而 createImpostors({atlas:512}) 建的 RT 还是 512²，最后登记的灌木被烘到画布外。表现极具迷惑性：40 个实例都在、控制台干净。修法：开顶点草时直接给 atlas:1024。',
      ref: 'engine/world.html · createImpostors({atlas})',
    },
    {
      q: '瀑布为什么 21 处候选最后只留 2 处？',
      keys: ['瀑布', 'waterfall', '落差', 'drop', '候选'],
      a: '因为"河床掉 ≥2 级"这个判据只保证有落差，不保证**看得见**。21 处全在峡谷内部的跌水，全景一张都看不到。加上"落进 ≤1 级（水面/滩地）"之后剩 2 处，落差 2.52，位置和数量才和参考片对上。教训：判据要和"在最终机位里可见"对齐。',
      ref: 'engine/waterfall.js · intoLow',
    },
    {
      q: '雪片的点大小怎么定？为什么会变成雪球？',
      keys: ['雪', 'snow', 'pointsize', '雪球', '粒子', '大小'],
      a: 'gl_PointSize = size * 320 / z 在 z≈15 时给出 20~30px，整屏像下雪球；参考片里雪片是 1~3px 的小点，系数取 42。同一类问题也出现在蝴蝶上：0.052 世界单位在整岛视图里只有 1px（米白像素 3 个），按"整岛 500px 时蝴蝶 4px"反推应该 0.135。',
      ref: 'engine/snow.js · gl_PointSize / engine/butterflies.js',
    },
    {
      q: '改了 shader 但画面"看着没崩"，为什么还要当失败？',
      keys: ['shader', '编译', 'pageerror', 'uniform', '失败', '验证'],
      a: '因为 three 在程序编译失败时会**静默退回上一个能编译的程序**，画面照常出图。我给 surface.js 加 uNormalMix 时，uniform 只声明在 fragment 的 CHUNK 里，顶点着色器报 undeclared identifier，但页面正常渲染——第一次量到的 mean 90.06→90.17 全是噪声。判据只有一条：控制台出现 THREE.WebGLProgram: Shader Error 就必须当失败处理。',
      ref: 'engine/surface.js · uNormalMix',
    },
    {
      q: '房子插进地形为什么用参数域而不是布尔运算？',
      keys: ['splice', '拼进地形', '参数域', '布尔', '开洞', '面积'],
      a: '因为四边格本来就是双线性的 P(u,v)，footprint 在参数域里就是个矩形，于是"洞 + 四条补片"天然共享顶点、天然面积守恒，也不用处理布尔运算在退化三角形上的自交。实测 1,082 个陆地格，面积守恒误差最大 1.7e-13，恒 4 块补片 + 4 块裙边。',
      ref: 'src/splice.js · spliceFootprint',
    },
    {
      q: '为什么同一座岛换个目标，可达面积从 69% 掉到 23%？',
      keys: ['navgraph', '连通', '覆盖', '可达', '岛', '断开', '切断', '分裂', '几块'],
      a: '因为 navgraph.adj 只按台阶差连边，岛被崖和河切成几个互不连通的块：目标在 #3646 时可达 750/1084 格（69.2%），换成 #1178 只剩 251 格（23.2%）。这不是流场的问题，是**生成时没有保证连通性**。下一步对应"刻意生成可通行关卡"那条启发式：把连通块约束喂回 mesa.js。',
      ref: 'src/navgraph.js · buildNavGraph / engine/navflow.html',
    },
    {
      q: '打光/法线/描边这类"看起来只是参数"的东西，怎么量？',
      keys: ['量化', 'a/b', '像素', 'readpixels', '描边', '法线', '验证'],
      a: '统一用 gl.readPixels 做同机位 A/B：法线混合（mix 1↔0）8.33%、坡面草 10.83%、彩色反弹 7.89%、旗子 7.38%、两色层理 edge +12.4%；描边是直接读 uniform 值（DPR2 → uThickness 1.6）。关键前提：**setOpt 重建会复位相机**，A/B 前后都要重新 focus，否则量到的是"相机移动"而不是开关。',
      ref: 'tools/ · /tmp/vidcap/*.mjs 验证脚本',
    },
    {
      q: '这批东西怎么接进现在的工程？',
      keys: ['接入', '工程', '使用', '怎么用', '入口'],
      a: '分两类：① 只加文件不动别人的——src/flowfield.js、src/rectpack.js、src/grouping.js、src/topoline.js、src/dual.js、src/navgraph.js、src/splice.js、src/voxelao.js；② 要在场景里看效果、按单个键开关的——engine/world.html：C 笼形 / A 拓扑线 / X 顶点草 / Z 瀑布 / Q 雪 / I 风旗 / U 坡面草 / O 河道路线 / F 蝴蝶。对照页单开：navflow / aoviz / splice / gridmodes / ornament / blendlab / badnorth。',
      ref: 'index 场景与 engine/world.html 的按键表',
    },
  ],
};
