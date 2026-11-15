# 第 56 批 · C09 组（第三项目 地形 / 生命，20 条）

清单：`artifacts/coverage/clips-r56-C09-nx-terrain.json`。主端口 8809；组内分四路并行（A=18809 生命/impostor/atlas，B=28809 河流/崖/悬垂，C=38809 表面/边/房屋，D=8809 生成演示/笼/逐笔）。截图在 `artifacts/coverage/shots-r56/`，文件名以片子 id 开头，每张都用 Read 打开看过，并与 `<id>/sheet-*.jpg` 及原尺寸帧对照。控制台 0 error，只有 three.js 原有的 `toNonIndexed` warning 和 ReadPixels 性能 warning。主会话另外抽查了 4 张图，与联系表对照：1708815475801505819-c09b-ridge、1852334860137849222-planet-clouds、1584623053061099520-splice-wire，以及 1708815475801505819 的 sheet-00。

每条片子的详细记录在 `artifacts/coverage/<id>-r56.md`。

## 守住的线
- 没有改 REACode / REA-agent / .workbuddy，没有 git 操作，没有写 learn/*、CHANGELOG、PIPELINE、MODULE-REFACTOR-STATUS、GAP-PRIORITIES，也没有跑 record-review。
- 没有删除任何文件。仓库根有两个调试遗留文件 `tmp-c09a.mjs` 和 `tmp-c09b-probe.mjs`，按规则保留，是否清理请主会话决定。C 组的临时探针放在 outputs/c09c/。
- 新效果默认全部关闭。关闭时输出与旧版一致：几何开关有测试断言逐位相同；着色开关的默认分支代码原样保留，没有改动。

## 改动的已有文件（都是最少挂钩）
| 文件 | 改动 |
|---|---|
| `src/world/navgraph.js` | `buildNav` 新增可选参数 `metric`（弦长）和 `slopeStep`（缓坡直走），默认关闭；不传参数与传默认值结果一致 |
| `src/terrain/terrainmesh.js` | 新增 2 个 import 和 4 处挂钩：`world.shrubFootC09` 控制灌木距离，另有多边形占地挂钩 |
| `src/core/sediment.js` | 新增 mode 3 / mode 4 分支；mode 0–2 不变 |
| `src/world/view.js`（热点） | 只改 1 处：`setStrataStyle` 的上限改为 4 |
| `src/world/view-shading.js` | 新增 `setBlotchTongue` 和 `?tongue=1`；不进 shade 键表，原有 12 个键不变 |
| `src/life/vegetation.js` | 加 1 行：树和草避开多边形占地 |

## 新建文件
- **代码**
  - `src/life/impostor-c09.js`、`src/life/sprite-pack-c09.js`、`src/core/atlas-c09.js`
  - `src/terrain/river-collapse-c09.js`、`src/terrain/rockforms-c09.js`
  - `src/terrain/shrub-edges-c09.js`、`src/core/sediment-bands-c09.js`、`src/terrain/blotch-tongue-c09.js`、`src/terrain/island-quality-c09.js`、`src/build/splice-polygon-c09.js`
  - `src/core/stroke-reveal-c09.js`、`src/terrain/island-viz-c09.js`、`src/terrain/cage-c09.js`、`src/terrain/terrain-strokes-c09.js`、`src/world/build-reel-c09.js`
- **页面**
  - `impostor-planet-c09.html`、`atlas-live-c09.html`、`atlas-tree-c09.html`
  - `planet-rivers-c09.html`、`rockforms-c09.html`
  - `islands-c09.html`、`splice-c09.html`
  - `island-stages-c09.html`、`island-build-c09.html`
- **测试**：`tests/c09-life.mjs`、`tests/c09-terrain-b.mjs`、`tests/c09-terrain-c.mjs`、`tests/c09-terrain-d.mjs`

## 测试
- 4 个本组测试全部通过。
- 主会话最后一次全量跑（309 个，8 路并行，单个超时 120 s），只有 1 个失败：`tests/c11-grass-shrub.mjs`。
  - 失败的断言是「高台沿口往外看，强度 0.000」。
  - 这个测试只导入 C11 自己的模块（c11-maps、view-c11-*），没有导入本组改过的文件。
  - 测试文件和这些模块在跑测试前 1–3 分钟内刚被修改过，判断是 C11 正在改动造成的，本组没有动它。
- 各分队自己跑全量（298–307 个）时都全部通过。

---

## A · 生命（impostor / atlas）

### 1852334860137849222 · 蓬松云
- **原文要点**：蓬松云着色器，和树用同一套 impostor。
- **片子机制**：球面小世界四周有一圈菜花状厚云，云底灰蓝；前景大云遮住半边画面；远处云带贴着地平线；树梢上有小云团。
- **原缺**：没有原作的蓬松云形和前景云层次；impostor 只认世界 +Y 为「上」，所以云放不到球面上。
- **本轮做了什么**
  - `fluffyCloudGeometry`：用 36 个球拼成平底云，把「上白下蓝灰」的颜色烘进顶点色。
  - 云改用无光照材质烘焙。
  - `localUpImpostorField`：「上」取每个实例自己的径向。
  - 云分三层：远处云带、树梢小云、前景大云。
- **判定**：done。云形是程序化替代，192 px 烘焙下云边略有像素感。
- **落点**：`src/life/impostor-c09.js` · `impostor-planet-c09.html`
- **测试**：`c09-life`
- **截图**：`-planet-clouds.png`，与第 150 帧构图一致：右侧大云压住半屏，远处有云带和小云。

### 1849427564034498642 · 八方位树 impostor
- **原文要点**：树用八方位 impostor，转镜时比 billboard 稳。
- **片子机制**：小星球上的树沿径向竖立，低机位转镜；开线框时树显示为卡片。
- **原缺**：多俯仰第 55 批已补；剩下的缺口是树不能放在球面上。
- **本轮做了什么**
  - 局部上方：上方向取自实例矩阵，方位和俯仰都按局部坐标算。
  - `radialMatrix` 生成沿径向的实例矩阵；`localUpView` 在 CPU 上复刻着色器的选图逻辑，供测试用。
  - 页面放了 1800 棵树，支持 `wire=1` 线框和 `snap=1`「只取最近一张图」对照。
- **判定**：done
- **落点**：`src/life/impostor-c09.js` · `impostor-planet-c09.html`
- **测试**
  - 球面上 5 处选图一致；转一周 64 步，连续。
  - 改用世界 Y 作上方时，俯仰误差超过 0.3 rad。
  - 转镜时相邻帧平均像素差：混合版 1.86，snap 版 2.02。
- **截图**：`-planet-wire.png`，树在地平线上径向竖立，线框贴着地形，与第 206–299 帧一致。

### 1593215065423245313 · 运行时精灵图集
- **原文要点**：运行时增删精灵分配区，精灵从网格现场烘焙。
- **片子机制**：分配区有编号和黄框；成批加满、成批删除，删除后留暗残影；有 2×2 多视角分配区。
- **原缺**：编号 UI、释放残影、自动扩容/重排。
- **本轮做了什么**
  - `SpritePackPlan`：走共享 `Atlas.place`，支持单视角或 2×2，带编号和残影；满板时调用 `Atlas.grow()` 扩容，并给出搬迁映射。
  - `LiveSpritePacker`：在 GPU 上压暗残影，扩容时搬运纹理。
- **判定**：done。白模是程序化替代。
- **落点**：`src/life/sprite-pack-c09.js` · `atlas-live-c09.html`
- **测试**：`c09-life`，含 2000 次随机增删、无重叠。
- **截图**
  - `-fill.png`：22 个分配区，带黄框和编号。
  - `-residue.png`：与第 120 帧同构。
  - `-grow.png`：256² 扩到 512²，精灵完好。

### 1765115069837221962 · 递归解析「手臂」
- **原文要点**：可视化加块时的递归树解析；板子越碎，手臂的手指越多。
- **片子机制**：深紫底板，从左下往上填；青色直角折线从树根伸向黄色候选框，并分叉出手指。
- **原缺**：只有 trace 线，没有手臂形态，也没有左下填充顺序。
- **本轮做了什么**
  - `armFromTrace`：用共享 Atlas 的真实查询轨迹画成直角手臂。
  - `placeBottomLeft`：候选从下到上、从左到右逐个碰撞查询。
- **判定**：done。共享 Atlas 的切分会多出竖长条空闲叶。
- **落点**：`src/core/atlas-c09.js` · `atlas-tree-c09.html`
- **测试**：平均手指数随板子变碎从 1.00 升到 2.00；先填底边；已放的块不移动。
- **截图**：`-arm.png`，手臂分两指伸进黄框，与第 150 帧一致。

### 1764958522398146667 · 二叉树打包 3D 展开
- **原文要点**：暴力生成候选位置，用树加速碰撞检查。
- **片子机制**：先 2D 填板，再倾斜镜头成 3D：各层节点框叠起来，白色树枝连接父子节点，镜头绕转。
- **原缺**：原作的 3D 树视图。
- **本轮做了什么**：`treeLayers` 取出各层节点框和父子树枝，`project3D` 做可绕转、可俯仰的投影；对应 `?view=3d`。
- **判定**：done。本地树深 29，原片约 15 层；3D 视图用 canvas 绘制，不是 WebGL。
- **落点**：`src/core/atlas-c09.js` · `atlas-tree-c09.html?view=3d`
- **测试**：节点数 = 2 × 叶 − 1；树枝只连相邻层；俯视和侧视两个极端下投影正确。
- **截图**：`-3d.png`，板面上方节点框逐层叠成塔，与第 140 帧同构。

## B · 河流 / 崖 / 悬垂

### 1795831296952041691 · 沿河导航费用
- **原文要点**：做一个导航结构，让单位沿河走得更快，顺流尤其快。
- **片子机制**：以指针处为起点的最短路树，按距离由绿到黄到橙；有几支沿曲流伸得很远；有红色 `[k]` 区域编号；在星球上。
- **原缺**：球面上没有，复杂汇流和完整接口也没有。
- **本轮做了什么**
  - 共享 `buildNav` 新增 `metric` 和 `slopeStep`，默认关闭。
  - 星球河网的流向接入导航。
  - 新页面画出最短路树和区域编号，可点选起点。
- **判定**：done。速度倍率 0.3 和 0.65 是本地参数。
- **落点**：`src/world/navgraph.js` · `src/terrain/river-collapse-c09.js` · `planet-rivers-c09.html?nav=auto&labels=1`
- **测试**
  - 每条边都满足顺流 < 逆流 < 步行。
  - 汇流处也判为顺流。
  - 主干从源头到河口：顺流 0.743，逆流 1.151，步行 2.476。
  - 另有 11 个导航测试回归通过。
- **截图**：`-c09b-nav-tree.png`，树按绿→黄→橙着色，沿河的分支伸得更远，有 [k] 编号。

### 1769691526924292506 · 巨型河网
- **原文要点**：河道深度优先坍缩，所以能弯得很远；其余部分广度优先坍缩，形成缓坡，只偶尔出现陡崖。
- **片子机制**：整颗星球布满细长弯曲的河，大片缓坡，少量陡崖。
- **原缺**：第 55 批是先生成地形再挖河，顺序不对，河也太短。
- **本轮做了什么**
  - 按配文的顺序重写：先从河口深度优先长河，回溯处长出支流。
  - 其余陆地从河和海出发广度优先定高度，邻格高差不超过 1，小概率出崖。
  - 结果写回共享 World。
- **判定**：done。平面着色的台地是程序化替代。
- **落点**：`src/terrain/river-collapse-c09.js` · `planet-rivers-c09.html`
- **测试**
  - 汇流 19–41 处，最长河 35–45 格，陡边约 5%。
  - 洼地、断流、上坡河段全部为 0。
- **截图**：`-c09b-mega-rivers.png`，4000 格星球，18 个河口、45 处汇流。

### 1708815475801505819 · 斜向崖脊 / 柱群
- **原文要点**：「a cool cliff I came across」。
- **片子机制**：斜向狭长岩脊，经悬空岩桥搭到高柱上，桥下是空洞；周围有圆柱；柱顶和岛面有小屋；镜头环绕。
- **原缺**：没有复现原作的斜脊布局。
- **本轮做了什么**
  - 新写四种原语：斜脊（打开软坡后连成斜面）、岩桥、圆柱、小屋，四边和三角混合两种网格都能用。
  - 原语直接写进主场景的同一个 World。
- **判定**：done，有保留：形体由原语**程序化放置**，不是生成器自己产出的；只证明共享 World 和网格能承载并正确渲染这种形体。如果标准要求由生成器产出，应改判 partial。
- **落点**：`src/terrain/rockforms-c09.js` · `rockforms-c09.html?kind=ridge`
- **测试**
  - 岩脊升高 ≥ 5 层。
  - 悬空格 19–21 个，岩石全部连到地面。
  - 小屋坐在岩顶。
  - 桥底面形变后面积比 0.98–1.03。
- **截图**：`-c09b-ridge.png`（主会话也看过）、`-ridge-mixed.png`、`-ridge-orbit.png`，与 sheet-00 前 30 帧的构图对应。

### 1447488323845509121 · 软坡 / 侵蚀
- **原文要点**：无缝软坡与分明硬崖结合；侵蚀有效、没有局部洼地。
- **片子机制**：软坡与硬崖同框，溪流顺坡流下，岛在旋转；中间穿插白线逐步出现的段落。
- **原缺**：旧 note 已过时，第 55 批已做软坡、侵蚀、湖和侧壁碰撞。
- **本轮做了什么**：补验画出来的软坡顶面本身也能排水。
- **判定**：done。原片的调试材质和白线动画没有逐帧复刻。
- **落点**：`src/terrain/soft-tops.js` 等 · `terrain-r55.html`
- **测试**：World 层没有局部极小；画出的顶面里排不出水的格为 0；软坡和竖崖在同一张网格里并存。
- **截图**
  - `-c09b-soft-erosion-mixed.png`：混合网格上软坡、灰崖、瀑布、湖。
  - `-soft-edges-mixed.png`：叠加台地边线。

### 1671808851895627776 · 岩檐 / 悬垂
- **原文要点**：地形生成器支持悬垂，拿出来炫。
- **片子机制**：几根柱子撑着一块厚岩盖，盖下空洞里能看到下层地面；低机位环绕。
- **原缺**：薄岩檐在平滑形变下会收缩。
- **本轮做了什么**
  - 搭石桌场景：三柱撑两层厚的圆岩盖。
  - 岩盖加厚加宽，并打开形变面积保护。
  - 新增按实际形变量岩盖底面面积的函数。
- **判定**：done，有保留：与上一条相同，形体是程序化放置的，不是原作 WFC 模块产出的。
- **落点**：`src/terrain/rockforms-c09.js` · `rockforms-c09.html?kind=dolmen&cam=low`
- **测试**
  - 未连地面的岩石为 0。
  - 底面面积比 1.03–1.05。
  - 最薄一格的面积比：开保护 0.60–0.66，关保护 0.15–0.35。
  - 岩盖侧壁可碰撞。
- **截图**
  - `-c09b-dolmen.png`：岩盖压在柱上，盖下阴影里能看到沙地。
  - `-dolmen-low.png`：低机位，盖下空洞贯通。

## C · 表面 / 边 / 房屋

### 1707490274425884929 · 灌木贴边
- **原文要点**：「added back the lil' shrubbery at the edges of things」，灌木是纯贴图。
- **片子机制**：锯齿灌木带出现在崖顶、崖脚和墙根。
- **原缺**：只有崖顶有灌木。
- **本轮做了什么**：开 `world.shrubFootC09` 后，崖脚和墙根也画灌木带；同时给出较窄的建议带宽 `SHRUB_FOOT_STYLE`。
- **判定**：done。小格两侧都有边时会出现绕格一圈的带；配色是程序化替代。
- **落点**：`src/terrain/shrub-edges-c09.js` · `src/terrain/terrainmesh.js`
- **测试**：开关关闭时与旧公式逐格一致；只改灌木距离属性，几何和顶点色不变。
- **截图**：`-shrubfoot-0/1.png` 开关对照，与第 160、205 帧一致。

### 1699038611125985317 · 岩壁沉积层理
- **原文要点**：沉积层线让大崖更耐看、形状更好读。
- **片子机制**：层带宽窄不一，交界有细深线，多个崖面同高连续。
- **原缺**：现有层理是等周期条纹，像斑马纹。
- **本轮做了什么**：按高度随机抽岩性的「层柱」，相邻同岩性连成宽带，交界画细线，带抗锯齿；新增 mode 3（直层）和 mode 4（弯层）。
- **判定**：done。岩壁底色与原片不同；水面反射本来就不带表面纹理，所以反射里没有层理。
- **落点**：`src/core/sediment-bands-c09.js` · `sediment.js` · `view.js`
- **测试**：`c09-terrain-c`、`sediment`
- **截图**：`-strata-mode1` 与 `-strata-mode3` 对照，与第 60 帧一致。

### 1696896119794479541 · 草色块翻崖
- **原文要点**：草色块受控地 bleed 过崖边，Art Nouveau 风格。
- **片子机制**：顶面色块翻过崖肩，沿崖面垂成长短不一的圆头「舌头」，有描边。
- **原缺**：rim 场、atlas、bleed 第 55 批已接；但顶面色块与崖面不连续。
- **本轮做了什么**：顶面靠边的色带和崖面舌头共用同一个强度值，在崖边连续；舌头带圆头和描边。对应 `?tongue=1`。
- **判定**：done。舌头是统一的程序化草绿，不是逐格顶面色。
- **落点**：`src/terrain/blotch-tongue-c09.js` · `view-shading.js` · `index.html?tongue=1`
- **测试**：`c09-terrain-c`、`view-shading`、`blotch-atlas`
- **截图**：`-tongue-off/on.png` 对照，与第 350 帧一致。

### 1669315384619540487 · 稳定出好岛
- **原文要点**：「The generator **consistently** spits out pretty cool islands」。
- **片子机制**：一座接一座：空海面 → 海岸线 → 黑剪影 → 成品岛 → 转台。
- **原缺**：实测原生成器在两种网格上各有 3/16 个种子不达标。
- **本轮做了什么**：给岛做体检，清除碎块，不达标就用确定性派生种子重生成；新增连播页面。
- **判定**：done。本项目的岛比原片宽平，也没放小屋。
- **落点**：`src/terrain/island-quality-c09.js` · `islands-c09.html`
- **测试**：两种网格 × 16 个种子全部达标，平均 1.19 次生成。
- **截图**：`-islands-shore`、`-silhouette`、`-full`、`-mixed-full`。

### 1584623053061099520 · 任意轮廓房子拼进地形
- **原文要点**：随意把房子拼进地形；黄线绕着顶点转。
- **片子机制**：深色三角网、带凹口的白色占地、黄线绕顶点转，之后切到实体房子。
- **原缺**：没有任意轮廓插入，也没有周边重网格。
- **本轮做了什么**
  - 任意（可凹）多边形切进地形三角网，周边重新三角化，外圈顶点全部保留，不产生 T 形接点。
  - 盖上墙和四坡顶。
  - 线框模式下黄线按半边结构绕顶点转。
- **判定**：done。新三角形最小角只有 0.7–1.3°；占地不进存档/撤销；软坡顶面下不生效。
- **落点**：`src/build/splice-polygon-c09.js` · `terrainmesh.js` · `vegetation.js` · `splice-c09.html`
- **测试**：面积守恒；整网仍是流形；不加占地时与原网格逐位一致；回归 `splice-house`、`splice-save-undo`、`halfedge`。
- **截图**
  - `-splice-wire.png`（主会话也看过）：L 形占地和黄色三角。
  - `-splice-solid.png`：L 形房子，树已避开。

## D · 生成演示 / 笼 / 逐笔

### 1654401054828638214 · 岛屿生成分阶段
- **原文要点**：「An quaint island being procedurally generated」。
- **片子机制**：黄线三角网逐条长出 → 抬升 → 灰底线稿 → 黑剪影 → 上色（带 AO 软阴影和小屋）→ 转镜。
- **原缺**：AO 软阴影；旧 note 写的「生成后微调」。
- **本轮做了什么**
  - 台地 AO，加朝太阳步进的软阴影（有半影）。
  - 核实「生成后微调」其实是第 229 帧之后的镜头漂移和转镜，按转镜实现。
- **判定**：done。canvas 程序化替代，不是视觉等价。
- **落点**：`src/terrain/island-viz-c09.js` · `island-stages-c09.html?mode=quaint`
- **测试**：`c09-terrain-d`、`pipeline-stages`
- **截图**：`-tri30`、`-lift`、`-outline`、`-flash`、`-color`、`-orbit` 六个阶段，逐一对应原片时间段。

### 1579478470098243584 · 格笼形变
- **原文要点**：用激进的格笼形变让崖面更自然。
- **片子机制**：笼线框逐笔长出 → 着色时笼线叠在上面 → 转镜 → 笼线退掉。
- **原缺**：笼面内部采样；形变后的 3D 碰撞。
- **本轮做了什么**：笼面内部双线性采样、连续截面的 3D 包含判定、形变笼的推出；在主场景按片子顺序播放。
- **判定**：done。形变强度来自现有 shape.js。
- **落点**：`src/terrain/cage-c09.js` 等 · `island-build-c09.html?mode=cage`
- **测试**：与实际墙面偏差 4e-16；生成的墙与地形网格 360/360 一致；推出 60/60 与 r55 的 terrain-collide 互证。
- **截图**：`-cage-wire50`、`-cage-overlay`、`-cage-orbit`。

### 1579474420749725696 · 两岛线框构建
- **原文要点**：「I'm back on the island generation」。
- **片子机制**：第一座岛线框（含小屋）逐笔搭出 → 着色 → 转镜 → 换第二座岛重复一遍 → 转到俯视。
- **原缺**：没有这段演示。
- **本轮做了什么**：坡面和房子的联合生成用现成的 fusion + softTops；每轮重跑生成，取 WorldMesh 特征边逐笔描出。
- **判定**：done。生成规则是本仓的。
- **落点**：`src/world/build-reel-c09.js` · `island-build-c09.html?mode=two`
- **测试**：`c09-terrain-d`
- **截图**：`-a-wire`、`-a-color`、`-b-wire`、`-b-color`。

### 1448039167057879048 · 分层逐笔可视化
- **原文要点**：为演讲准备的「nice timing and visualization」。
- **片子机制**：4 轮，每轮依次是三角化帐篷 → 点阵 → 线稿 → 线网 → 等高线 → 着色，每轮一座新岛。
- **原缺**：旧 note 写竖棒层、线网层、自动计时推进、每轮换岛都缺。
- **本轮做了什么**
  - 核实「竖棒」其实是增量三角化里连向超级三角形三个远点的边，按这个实现。
  - 多层时间轴：4 轮，每轮 17.5 秒，每轮换种子。
  - 真等高线。
  - walkthrough 原本就有自动播放，这项不缺。
- **判定**：done
- **落点**：`src/core/stroke-reveal-c09.js` · `island-stages-c09.html?mode=talk`
- **测试**：`c09-terrain-d`、`stroke-reveal`
- **截图**：`-tent`、`-lattice`、`-strokes35`、`-net`、`-contour`、`-color-r0`、`-color-r1`。

### 1447483550257799171 · 连续换岛 showreel
- **原文要点**：「relapsed into procedural island generation」。
- **片子机制**：彩色岛环绕 ↔ 切黑后白线逐笔累积成岛，每轮岛都不同。
- **原缺**：只能单次生成；线稿没有接地形管线。
- **本轮做了什么**：线稿直接取 terrainSurface 实际画出的墙和顶；每轮换种子（5 / 9 / 17 / 31）重跑地形。
- **判定**：done。彩色阶段沿用主场景画风。
- **落点**：`src/terrain/terrain-strokes-c09.js` · `build-reel-c09.js` · `island-build-c09.html?mode=reel`
- **测试**：线段端点全部来自地形网格的实际顶点，串成笔画后总长不变。
- **截图**：`-r0-color`、`-r0-wire35`、`-r1-color`、`-r1-hold`。
