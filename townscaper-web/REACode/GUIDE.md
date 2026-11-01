# GUIDE — 给接手的 LLM：怎么继续这条学习线

这份文档写给下一个接手的模型（或人）。读完它，你应该能做到三件事：知道已经学到哪了，用同样的方法学下一段视频，把学到的东西接进代码并在 `index.html` 里显示出来。

如果只有 5 分钟，先读这三处：
1. 本文的「零、七条规矩」
2. `PIPELINE.md`（或打开 `pipeline.html`）：判断结论 + 9 步学习路线
3. `learn/pipeline.js`：每一步的状态，你做完要回来改它

> **读之前先知道：这个仓库每天在变，"状态表"永远会落后一两轮。**
> 2026-10-31 15:15 我核对过一遍，当时有 8 条 `status: 'todo'` 其实已经做在 `engine/` 里（球面三角化、
> 树/云 impostor、沉积线+大笔触、鸟、光体积 GI、贴图面阴影、体素阴影、网格体检）；到 16:29 另一条线已经
> 把它们改对了，并把 `src/` 从 15 个文件推到 31 个（`lighting.js` 从 15.8KB 长到 30KB）。
> 所以：**信代码，别信表。** 复核一条状态只要两行：
> ```bash
> grep -l "<模块>.js" *.html engine/*.html src/*.js   # 这个模块有没有被页面用上
> ls -t src/ engine/ | head -20                        # 最近改了什么
> ```
> 本文的「二、目录」「五、接口」「七、下一步」按 17:05 的现状写过一遍；下次再有人大改，接着改这几节就行。

---

## 零、七条规矩

1. **先读原文，再看画面。** 每段视频的原文在 `../../REA-agent/gifs/README.md`（帖子 ID、日期、GIF 旁的文字）。不要先看画面再猜它在讲什么：之前有一轮就是看画面猜成了"台地地形"，原文一对才发现在讲"岸边浪"。别去 x.com 抓：代理和人机验证都会挡，README 已经有全部原文。
2. **不要盲信仓库里已有的说明。** `ENGINE.md`、`STUDY-INDEX.md` 和旧版 `README.md` 里有推断，不一定都对。拿视频和原文核实过才算数。
3. **原文 → 画面 → 代码 → 截图验证，四步缺一不可。** 写完代码必须在浏览器里截图看过（见「四」），不能只靠"代码看起来没问题"。
4. **每处实现在代码注释里写上帖子 ID 和原文关键句**，例如 `// 1849732997945110651 "waves travel from the blue line to the yellow"`。这是可追溯性的唯一来源。
5. **学完一条就更新三处数据**：`learn/data.js`（这条的状态与笔记）、`learn/pipeline.js`（管线里对应步骤的状态）、`LEARNING.md`（改了什么）。不更新的话，`index.html` 和 `pipeline.html` 就看不到你的成果。
6. **不要破坏别人正在用的文件。** 这个目录**没有自己的 git**（实测：父目录 `TigerInBamboo` 是个 git 仓库、branch `main`，但 `townscaper-web/REACode/` 至今是未跟踪的 `??`，所以这里的任何改动都没有版本保护）。而且常有两条会话同时在写：**Townscaper 线**改 `src/`、`index.html`、`learn/`；**engine 线**（每小时的自动化）改 `engine/`、`STUDY-INDEX.md`，改得很勤 —— 一天之内 `engine/` 从 27 个文件长到 33 个。写回前先看文件修改时间，确认在你读取之后没人动过；引擎依赖的 `src/grid.js`、`src/mesh.js`、`src/town.js` 保持兼容。新能力优先放进新文件。**想要版本保护就在 `REACode/` 里单独 `git init`，不要 `git add` 进父仓库**（会把 TigerMessenger 的历史搅在一起）。
7. **说清楚哪些做了、哪些没做。** 部分实现就标"部分"，没做就标"未做"，在 `LEARNING.md` 的"还没做的"里列出来。不要把推断写成事实。

---

## 一、素材与结论（已经确定的）

- 素材：`REA-agent/gifs/` 下 237 个 mp4，文件名就是帖子 ID；`README.md` 是每条的原文。视频 512–640px、10–73 秒。
- 三个时期（按日期划分，见 `learn/data.js` 的 `project` 字段）：
  - **Bad North** 2017–2019（75 条）：方格体素岛；地形、房子、士兵、风、雪共用一个"虚拟体素空间"（`931196707236392960`）。
  - **Townscaper** 2019–2021（75 条）：不规则四边形网格，只有建筑；水沿用 Bad North（`1215644531221311488`）。
  - **第三个项目** 2021–2025（84 条）：不规则网格 + 多格 tile（`1579483114178768898`），房子拼进地形（`1584623053061099520`），最后上球面（`1768627849529893109`）。
- **判断**：Bad North 不是 engine + Townscaper 的综合版，而是祖先；融合发生在第三个项目，终点是球面。
- 风和雪只在 Bad North 期出现过；README 里没有雨。

## 二、目录

### 2.1 外层：素材、构建产物和代码在哪

```
~/Downloads/TigerInBamboo/
├── REA-agent/
│   ├── gifs/                    ★ 学习素材：237 个 <帖子ID>.mp4 + README.md（每条的原文）+ manifest.txt
│   ├── node_modules/            playwright-core 等（tools/video-frames.mjs 引用这里）
│   └── REA-SETUP.md 等          REA 逆向工具本身（吃不进视频，见 STUDY-INDEX.md「诚实的两条限制」）
└── townscaper-web/
    ├── Build/                   原版 Townscaper 的 Unity WebGL 构建（WebGL.wasm / .data / .framework.js），逆向的起点
    └── REACode/                 ★ 本仓库：所有代码、页面、文档（下面 2.2）
```

页面里引用视频用的是相对路径 `gifs/<id>.mp4`：`start.sh` 会在 REACode 里建一个软链 `gifs -> ../../REA-agent/gifs`。所以**不要移动这两个目录的相对位置**，否则视频播放会失效（缩略图还在）。

### 2.2 REACode 内部（逐个文件）

```
REACode/
│
├── 入口页面 ─────────────────────────────────────────────────────────────
├── index.html            ★ 主入口：three.js 场景（新版 Townscaper）+ 右侧「学习导航 · 管线」面板
├── pipeline.html         判断 + 9 步学习路线 + 四条管线完整图（读 learn/pipeline.js）
├── learn.html            237 条学习笔记：按状态 / 项目 / 主题筛选，点缩略图播放（读 learn/data.js）
├── compare.html          左右并排：旧版 / 新版 / engine 各页任选
├── fusion.html           ★ 第 7 步融合场景：台地地形 + 台地上的房子，一个共享体素场管 AO（src/fusion.js）
├── flow.html             ★ 体素场的另外三件用途：风场箭头 / 简化碰撞（鼠标读高度）/ 地形软法线（src/flowdemo.js）
├── spherefusion.html     ★ 第 8 步球面：同一套台地管线包到三角化球面上（src/spheretown.js）
├── overview.html         成果总览：统计、各页截图、Townscaper 与 engine 分工表
├── game.html             只是跳转到 index.html（兼容旧链接）
├── Townscaper.html       旧版单文件（学习前的基线，双击可开）—— 不要改
│
├── 启动 ────────────────────────────────────────────────────────────────
├── start.sh              起本地 http 服务（默认 8765，占用时自动换口）；建 gifs 软链；打开 index.html
│                         ./start.sh --open learn|pipeline|guide|overview|compare|world|terrain|island|props|sphere|flow|old ；./start.sh --stop
├── 启动.command / 停止.command   双击版的 start.sh / start.sh --stop
├── .server.pid / .server.log     start.sh 运行时生成
├── gifs -> ../../REA-agent/gifs  start.sh 建的软链（视频）
│
├── 文档 ────────────────────────────────────────────────────────────────
├── GUIDE.md              ★ 本文：给接手者的规矩、目录、流程、接口、坑
├── PIPELINE.md           判断 + 9 步学习路线 + 管线表（pipeline.html 的文字版，由 learn/pipeline.js 生成）
├── LEARNING.md           Townscaper 这一轮学了哪些视频、改了哪些代码、还没做什么
├── STUDY-INDEX.md        engine 那条学习线的索引与排队表（另一条会话维护）
├── ENGINE.md             engine 说明（含推断，需核实）
├── README.md             最早的逆向说明（Unity 构建 → 类型骨架 → 玩法），部分内容已过时
│
├── 学习数据 ────────────────────────────────────────────────────────────
├── learn/
│   ├── data.js           window.LEARN：237 条 {id, date, text, project, topic, status, where, note}
│   ├── pipeline.js       window.PIPELINE：判断、四条管线的每一步（status / where / toggle / tour / page）、9 步路线
│   └── thumbs/<id>.jpg   每段视频 45% 处的一帧（320px），共 237 张
│
├── src/ — Townscaper 建筑管线（index.html 用）─────────────────────────
│   ├── app.js            输入、工具切换、撤销栈、存档到地址栏、启动；挂载学习面板；暴露 window.reaTown
│   ├── quadgrid.js       ★ 网格：三角六边形 → 合并 → 细分 → 方形松弛（buildQuadGrid）
│   ├── halfedge.js       ★ 半边结构（n 边形通用）：he.twin.next 绕顶点转、边界环、混合三角/四边形自检；index 开关 halfedge / mixedgrid
│   ├── trace.js          ★ 拓扑直线：进格→从最平行那条边出去；直线刷（工具条 ╱）与开关 trace 都走它
│   ├── town.js           体素列：solid[] 层位掩码、colors[]、roofColors[]、regions()、调色板；pointInQuad / buildCellIndex
│   ├── townmesh.js       ★ 建筑网格：屋顶/山墙/基座/钢架/拱/门窗/后院 + #bakeLighting（分层 AO + 彩色反弹）
│   ├── lighting.js       ★ 共享体素场：buildVoxelField({sets}) → 分层占用 + 颜色，一次模糊；bakeVertexAO()（CPU）与 patchMaterial()（顶点着色器采样贴图）读同一份
│   ├── lightingcache.js  ★ 脏区增量：每格签名 + 它刷过的 texel，编辑后只重刷改动格、只重模糊 rect ± R·P；verifyAgainstFull() 自证与全量一致
│   ├── lightingcache.js  ★ 脏区增量：只重烤动过的那块（整张重烤 ≈ 3.4ms 栅格 + 13.5ms 模糊，而一次点击只改一格）
│   ├── terrainmesh.js    ★ 地形网格：一格落差做软坡、两格以上做崖，平顶/坡面/沙滩/崖面四种材质（fusion.html 用）
│   ├── fusion.js         ★ 第 7 步场景：台地岛 + 台地上的 Townscaper 房子，一个体素场管 AO（fusion.html 用）
│   ├── spheretown.js     ★ 第 8 步：球面三角格 → 量化高度 → 沿各自法线挤出；smoothCoincidentNormals() 跨格平滑法线；buildShoreRibbon() 岸线白带
│   ├── spherehouse.js    ★ 第 8 步：球面上的房子（格内缩 footprint + 沿格法线起墙 + 攒尖顶；不复用 TownMesh，因为它假设 +Y）
│   ├── spherefusion.js   ★ 第 8 步场景：海壳、转盘、开关（spherefusion.html 用）
│   ├── shore.js          ★ 水层：距离场、黄/蓝线、循环顶点着色器岸浪、浪裙、钢架腿泡沫圈
│   ├── scene.js          渲染器、相机、海面、倒影、光照档位 setTimeOfDay、开关 setDebug、拾取 pick
│   ├── learnpanel.js     学习导航面板：管线分组、场景开关、「去看」镜头、视频弹窗、URL 参数
│   ├── voxelflow.js      ★ 同一张场的另外三件用途：collide()（二值掩码，不做三角求交）/ windAt()（8 向遮挡 + 绕流 + 上扬）/ bakeSoftNormals()（地形软法线）。只读场，不产生第二份数据
│   ├── flowdemo.js       flow.html 的场景：三开关 + 鼠标探针（同时显示画面高度与场里量到的高度）
│   ├── birds.js          index 里的海鸥：停驻才描边、会挪动、飞行更流线（1244892370392489989）
│   ├── march.js          marching squares 等值线（engine/contour.js 用它）
│   ├── demo.js           示例城镇（码头、排屋、塔、围合后院、拱、水上钢架房）
│   ├── save.js           存档字符串（位数组 → 64 字符表，v4）
│   ├── style.css         HUD 样式
│   ├── grid.js           ⚠ 旧版"六边形切风筝块"网格 —— engine/mesa.js、terrain.js 还在用，保持原样
│   ├── mesh.js           ⚠ 旧版网格生成器（含 terrain 模式）—— engine/world.html、terrain.html 还在用，保持原样
│   ├── voxelspace.js     建筑那条路的体素空间（begin/carve/finish/diffuse），townmesh 的旧路径；
│   │                     新的共享场在 lighting.js —— 两者并存，别以为它废弃了
│   └── 下面这些是**独立的算法库**，都有"能跑起来"的入口，但不在主流程里：
│       dual.js         顶点格（格子中心围成顶点多边形）→ engine/world.html 的顶点格视图
│       navgraph.js     带"水道加速"的导航图 → engine/world.html
│       topoline.js     拓扑直线的另一版实现 → engine/world.html
│       march.js        marching squares 等值线 → engine/world.html + engine/contour.js
│       triGraph.js     可增量插点的三角图（插点 + 翻边，保持流形 + 近 Delaunay）→ engine/trigraph.html
│       frontier.js     只在"坍缩边缘"枚举 tile 再连成导航图 → engine/frontier.html
│       gridmodes.js    同一地形铺在方块/六边/三角网格上的对照 → engine/gridmodes.html
│       grouping.js     把整张图吃成几块（最相连的邻居赢）（938422757288792064）→ **没有任何页面引用**
│       rectpack.js     矩形打包器：暴力撒点 + 二叉树查询，可增可删 → **没有任何页面引用**
│
├── engine/ — 地形管线（另一条会话在推进，改之前先看修改时间；现在 40 个文件）────
│   ├── world.html        台地岛主场景（最大的一页，29KB）。键位：
│   │                     T 贴图 / N 体素法线 / L 顶点光 / G 沉积线 / B 大笔触 / V 树云 /
│   │                     P 点光源体积(含 AO) / K 坡向条纹 / J 崖肩渗漏 / H 贴图面阴影 /
│   │                     Y 体素阴影 / M 等值线 / W 线框 / R 换岛 / D 制图稿 / S 64² 快照 / 空格 停转
│   ├── terrain.html      同一体素场读成地貌
│   ├── demo.html         Bad North 式岛屿生成 + 导航
│   ├── props.html        墙面道具（窗/门）单独验证页
│   ├── sphere.html       球面三角化验证页（?phase=random|spaced|triangulated|relaxed）
│   ├── gridmodes.html    同一地形铺在方块/六边/三角网格上的对照（1670790425232175108）
│   ├── frontier.html     "只在坍缩边缘枚举 tile"的演示（1582293326815862786）
│   ├── trigraph.html     三角图增量插点 + 翻边，保持流形 + 近 Delaunay（1677242779162877952）
│   ├── ornament.html     UI 花边：一张小贴图镜像着拉成任意尺寸（ornament.js）
│   │
│   ├── 地形与网格 ───────
│   ├── mesa.js           台地岛：阈值化高度场 → 台地 → 塔柱 → 峡谷 → 洞窟 → 放房子
│   ├── islands.js        Bad North 那一半：高度场 → 阶梯地形 → 材质 → 寻路
│   ├── terrain.js        早期噪声台地（规则网格），保留对照
│   ├── rivers.js         河流：深度优先坍缩（1769691526924292506）
│   ├── relax.js          防"蘑菇化"：格子趋向期望尺寸（1769641473895432220）
│   ├── meshcheck.js      网格体检：流形 / 退化 / 细长三角（1677242779162877952）
│   ├── contour.js        把 src/march.js 的等值线画出来，验证不规则四边形上的 marching squares
│   │
│   ├── 表面与光照 ───────
│   ├── surface.js        贴图层：投影贴片 + 沉积线 domain warp + fwidth 像素宽线
│   ├── blotch.js         大笔触色块 + 边缘场 + 坡向条纹 + 崖肩受控渗漏（1696864… / 1786014… / 1696896…）
│   ├── normalsmooth.js   体素邻域平均法线（1062374549407350790）
│   ├── vertexlight.js    顶点着色器里查一次低分辨率高度图（1791049306213912823）
│   ├── lightvol.js       6 向可见度体积 + 点光源 + 96² 半球 AO + 3 次反弹封顶（1582757… / 1168168… / 1580846…）
│   ├── surfaceshadow.js  贴图空间的面阴影，投射高度与 z 测试解耦（1705195… / 1704218…）
│   ├── voxelshadow.js    逐顶点体素阴影，不用 shadow map（1190191289922465793）
│   ├── backlit.js        逆光边：反向外壳描边（1751945034851570056）
│   ├── outline.js        描边 / 亮边后处理（OutlinePass）
│   │
│   ├── 水与天 ───────────
│   ├── waves.js          岸浪（engine 版）+ makeOceanWaves 动态海面
│   ├── shorefield.js     岸线距离场（1664566546683899905）
│   ├── watervol.js       水体：一叠平面采样 SDF（1758251637280268481）
│   ├── reflection.js     平涂中间色倒影（1215644531221311488）
│   ├── snapshot.js       64² 岛快照 + CPU unsharp（911913981731885056）
│   │
│   ├── 生命与装饰 ───────
│   ├── roofs.js          陡坡双坡顶小房子（含山墙）
│   ├── props.js          墙面道具：窗/门，不重叠、不被格子压歪 + stencil 打洞
│   ├── birds.js          鸟：停驻才描边、会反光、频繁挪动（1244892370392489989）
│   ├── impostor.js       8 方位 impostor 烘焙 + 实例化 billboard；球面叶片 alpha（1849427… / 1205420…）
│   ├── spritepack.js     运行时增删的精灵图集打包器（1593215065423245313）
│   ├── butterflies.js    蝴蝶：绕着"可能的落点"打转，靠换落点来漂移
│   ├── cage.js           用"笼子"把格子拉歪，让崖面不那么规整（1579478470098243584 的读法）
│   ├── ornament.js       UI 花边：一张小贴图镜像着拉成任意尺寸（ornament.html 用）
│   ├── sphere.js         球面三角化：随机点 → 散开 → 球极投影 Delaunay → 三角形松弛（1338825… / 1338829…）
│   └── noise.js          带种子的 value noise / fbm
│
├── tools/ — 看视频用的工具（没有 ffmpeg 时）──────────────────────────
│   ├── video-frames.mjs  播放 + requestVideoFrameCallback 抽去重帧（不要用 seek）
│   ├── contact-sheet.mjs 把帧拼成总览图
│   ├── measure.mjs/.html 抓 96×96 灰度量帧差、周期、运动方向
│   ├── shot.mjs          无头截图 + evaluate（channel:'chrome'；这台机器没装 playwright 自带 chromium）
│   ├── ab.mjs            同一机位 A/B 并逐像素统计（AB_SETUP 里的 js 两张图前都跑；不需要 PIL/ffmpeg）
│   └── player.html       上面几个工具用的播放页
│
├── vendor/three.module.js  three.js r160（import map 指向它）
├── screenshot-*.png      各阶段截图（screenshot-game.png = 新版主场景；surface-* 等是 engine 的）
└── .workbuddy/           另一条会话（WorkBuddy）的记忆与自动化配置 —— 不要动
```

### 2.3 谁依赖谁（改文件前看这里）

```
index.html ─ src/app.js ─┬─ quadgrid.js
                         ├─ town.js ◄──────────────── engine/mesa.js, terrain.js, shorefield.js 也依赖
                         ├─ scene.js ─┬─ townmesh.js ──► lighting.js（体素场 + AO + 软法线）
                         │            ├─ shore.js
                         │            ├─ birds.js
                         │            └─ halfedge.js / trace.js（开关 halfedge / mixedgrid / trace）
                         ├─ learnpanel.js ◄── learn/pipeline.js, learn/data.js
                         ├─ demo.js, save.js

fusion.html ─ src/fusion.js ─┬─ quadgrid.js, town.js
                             ├─ townmesh.js（房子，整块抬到台地顶）
                             ├─ terrainmesh.js（地形：软坡 / 崖 / 沙滩；surfaceAt() 反查地面高度）
                             ├─ shore.js（岸浪绕地形）
                             └─ lighting.js ── buildVoxelField({sets:[地形, 房子+terraceY]}) → 一张场

flow.html ─ src/flowdemo.js ─┬─ 同 fusion 的那套模型（quadgrid + Town + terrainmesh + lighting）
                             ├─ voxelflow.js（★ collide / windAt / bakeSoftNormals）
                             └─ townmesh.js（只为把房子建出来给风当墙）

spherefusion.html ─ src/spherefusion.js ─┬─ spheretown.js ── engine/sphere.js（球面三角化）
                                         └─ spherehouse.js（球面上的房子，自带"上方向"）

engine/world.html ──┬─ src/mesh.js + src/grid.js（旧网格，别动）
                    ├─ mesa.js ─ rivers.js / relax.js / src/grid.js（repairInvertedCells）
                    ├─ surface.js + blotch.js + vertexlight.js + lightvol.js + surfaceshadow.js + voxelshadow.js
                    │   └─ 全部通过 material.onBeforeCompile 链式挂到**同一个** land 材质上
                    ├─ waves.js / watervol.js / reflection.js / snapshot.js / shorefield.js
                    ├─ impostor.js ──► spritepack.js（图集）+ birds.js / roofs.js / props.js
                    └─ outline.js（后处理）

engine/sphere.html ── sphere.js（不依赖 src/，独立页）
engine/contour.js ─── src/march.js
```

改 `src/town.js` 会同时影响 Townscaper 和 engine；改 `src/grid.js` / `src/mesh.js` 只会影响 engine。
改 `src/lighting.js` 会同时影响 `index`（建筑的 AO/软法线）和 `fusion`/`flow`（地形+房子的场）——
这是现在**耦合最重**的一个文件，动它之前把这两页都打开看一眼。

独立算法库各自有入口：`dual / navgraph / topoline / march` 在 `engine/world.html` 里（各有 debug 视图），
`triGraph / frontier / gridmodes` 各有自己的 `engine/*.html` 演示页。
**只有 `grouping.js` 和 `rectpack.js` 至今没有任何页面引用** —— 改它们不会影响画面，但也没有人替你验证。

自检方法：`grep -l "<库名>.js" *.html engine/*.html src/*.js`（注意 zsh 下 `src/*.html` 不存在会直接报错、
把整条命令吞掉 —— 我第一次就因此得出了"8 个库都没接"的错误结论）。

**材质链是这里最容易踩的地方**：`surface.js`、`blotch.js`、`vertexlight.js`、`surfaceshadow.js`
都是往同一个 `MeshStandardMaterial` 上链 `onBeforeCompile`，每个模块有 `DECL`（uniform/varying 声明）
和 `BODY`（插进 `#include <color_fragment>` 的代码）。三条硬规矩：
1. **varying 只能声明一次**（`vSurfPos` / `vSurfNrm` 由 `surface.js` 声明，别的模块直接用，重复声明 = 编译错误）；
2. **每加一层就改 `customProgramCacheKey`**（现在是 `+blot2` 之类），否则 three 会复用旧 shader；
3. 每层都要留「0 = 关」的参数（`sedAmp` / `streak` / `bleed` / `uBlotchAmt`），
   因为 `world.html` 的 `setOpt()` 是整岛重建，不做增量开关。

## 三、怎么学一段视频（标准流程）

1. **选题**：从 `pipeline.html` 的路线里挑一步，或在 `learn.html` 里筛「未实现」+ 某个项目 / 主题。优先选原文里写了实现细节的。
2. **读原文**：在 README 里找到这条，**连同前后几条一起读**。他经常连发好几条（同一天、ID 很接近），后面几条才是解释。比如 `1991101097818403263` 是 `1991099314714902634` 的回复。
3. **抽帧看画面**（有 ffmpeg 时）：
   ```bash
   # 20 帧拼成 5x4 总览图
   d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 X.mp4)
   ffmpeg -v error -i X.mp4 -vf "fps=$(python3 -c "print(20/$d)"),scale=256:-2,tile=5x4:padding=2" -frames:v 1 X.jpg
   ```
   没有 ffmpeg 时用 `tools/video-frames.mjs`（必须"播放 + requestVideoFrameCallback"；`currentTime=t` 再 `drawImage` 永远画第 0 帧，之前因此误判成静帧）。
4. **写下"看到了什么"**：几何结构、动画节奏（周期多长、往返还是单向）、颜色。能量化就量化（`tools/measure.mjs` 可以量帧差和周期）。
5. **决定落点**：属于哪条管线、哪一步；能复用哪个现有函数（见「五」）。
6. **实现**：注释里写帖子 ID 和原文（规矩 4）。
7. **验证**：截图 + 数值（见「四」）。能在场景里开关的，给 `scene.js` 的 `setDebug()` 加一个开关，再在 `learn/pipeline.js` 对应步骤上写 `toggle: '名字'`，面板会自动出现勾选框。
8. **登记**：更新 `learn/data.js`、`learn/pipeline.js`、`LEARNING.md`（规矩 5）。

## 四、验证：截图和量数

无头浏览器截图（Playwright + Chromium，用 SwiftShader 也能跑 WebGL）：

```js
// node shot.mjs <url> <out.png> [w h] [js]
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(url); await page.waitForTimeout(2500);
if (js) console.log(await page.evaluate(js));
await page.screenshot({ path: out });
```

**每页都留了自动化钩子**（写截图脚本时先看这个，别去点 UI）：

| 页面 | 钩子 | 能拿到什么 |
|---|---|---|
| `index.html` | `window.reaTown` | `town / grid / view / encodeTown / decodeTown / generateDemo` |
| `fusion.html` | `window.reaFusion` | `grid / land / town / townMesh / terrainMesh / field() / surfaceAt(x,z) / setToggle(id,on) / rebuildField() / terrainStats()` |
| `flow.html` | `window.__flow` | `field() / flow() / auditData（碰撞与风的验收数字）/ applyToggle(id,on) / probeAt(x,z)` |
| `spherefusion.html` | `window.reaSphere` | 球面网格、高度、房子、转盘开关 |
| `engine/world.html` | `window.__engine` | `stats / world / setOpt(name,on) / setSeed / focus / parkLight` |
| `pipeline.html`、`learn.html` | `window.PIPELINE`、`window.LEARN` | 数据本身，改完台账直接读它自检 |

以 `index.html` 为例，可以在 `evaluate` 里直接操作：

- 镜头：`view.target.set(x,y,z); view.distance = 7; view.pitch = 0.4; view.updateCamera()`
- 开关：`view.setDebug('grid', true)`、`view.setTimeOfDay('night')`
- 统计：`view.townMesh.stats`，例如 `{ triangles, yards, posts, bakeMs, ms, shoreMs }`
- URL 直达：`index.html?on=grid,shorelines&off=waves&tour=arch&time=night`

`setDebug` 现在只认这 9 个键（`src/scene.js`，没有的就是没实现，加了新开关记得回来更新这张表）：

| key | 作用 | 出处 |
|---|---|---|
| `grid` | 网格白线 | — |
| `shorelines` | 岸线黄线 + 外推蓝线 | 1849732997945110651 |
| `waves` | 浪裙 / 岸浪 | 1215644531221311488 |
| `wavewire` | 浪带线框（关掉浪裙，只看环） | 1991101097818403263 |
| `reflection` | 平涂中间色倒影 | 1215644531221311488 |
| `shadows` | 太阳投影 + 接影板 | 1305948413872267265 |
| `ao` | 分层 AO（关掉 = `townMesh.bake=false`） | 1168571866405097472 |
| `lightonly` | 只看光照（顶点色关掉，换成白模） | 1313841094069817344 |
| `wire` | 建筑线框 | — |

**engine 那侧不走 `setDebug`**，它的开关是 `engine/world.html` 里的 `opts` + `window.__engine.setOpt(name, on)`，
键名：`surface / smoothNormals / vertexLight / sediment / blotch / trees / lightvol / streak / bleed / shadow / voxelShadow / contour`。
`window.__engine` 还给了 `stats`（含 `gridHealth`、`gridRepair`、`lightVol.ao`）、`focus()`、`parkLight()`、`setSeed()`。

量颜色时用 PIL 读截图像素，和目标色板比对。

## 五、可以直接复用的接口

### 5.1 Townscaper 侧（`src/`，index.html 用）

| 想做的事 | 用这个 |
|---|---|
| 生成网格 | `buildQuadGrid({ radius, hexSize, seed })` → `{ cells, verts, vertexCells }`；cell: `pts[4]`（共享顶点对象，有 `id/x/z`）、`edgeNeighbors[4]`、`cornerNeighbors`、`cx/cz` |
| 存 / 读体素 | `new Town(grid)`；`isSolid(cell, lv)`、`setSolid`、`top`、`bottom`、`fill`、`regions()`、`snapshot/restore` |
| 点在哪个格 | `buildCellIndex(grid).at(x, z)` + `pointInQuad(cell.pts, x, z)` |
| 出建筑网格 | `new TownMesh(town, grid, { levelHeight }).rebuild()` → `geometry`（color + aGlow）、`posts`；`bake=false` 关掉 AO |
| 出水层 | `buildShore(town, grid, index, { posts })` → `{ skirt, waves, shoreLine, seaLine }`；`makeWaveMaterial()`、`makeSkirtMaterial()` |
| 光照 / 开关 | `view.setTimeOfDay('day' \| 'dusk' \| 'night')`、`view.setDebug(key, on)`（键见上表） |
| 共享体素场（多份体素集 → 一份 AO） | `buildVoxelField({ grid, levelHeight, sets:[{ town, cells?, y?, colorOf? }], res })` → `{ sample, sampleOcc, sampleBounce, texture(), sliceCanvas(layer), stats }`；`bakeVertexAO(field, pos, col)` 走 CPU，`makeLightingUniforms(field)` + `patchMaterial(material, uniforms)` 走顶点着色器 |
| 出地形网格 | `buildTerrainMesh({ town, grid, levelHeight, softSlopes })` → `{ geometry, stats:{ faces, cliffs, slopes } }`；软坡靠"一格落差两侧共用同一条棱高" |
| 球面（第 8 步） | `buildSphereGrid({ count, seed })` → `{ unit, tris, cells[{ tri, centre, nbr[3] }] }`；`generateHeights(grid)` → `{ heights, values }`；`carveRivers(grid, heights, values)` → `{ heights, carved, lakes }`（流量累积，必须从高到低扫）；`buildSphereMesh({ grid, heights, values, softSlopes })`；`buildSphereHouses({ grid, heights, levelHeight, radius })`；`buildShoreRibbon({ grid, heights })` |
| 等值线 | `src/march.js`（marching squares），`engine/contour.js` 是它的可视化 |
| 碰撞 / 风 / 地形软法线（同一张场的另外三件用途） | `fieldFlow(field, { sets, windDir, windSpeed, gradStep })` → `{ collide(x,z), windAt(x,y,z), windSpeedAt(), softNormal(), bakeSoftNormals(geometry,{blend}), auditCollide(samples) }`。**注意 `sets` 必须传**：碰撞要的是二值体积，模糊过的 `field.occ` 会把薄墙和屋顶判没 |
| 地面高度反查（含软坡） | `buildTerrainMesh(...)` 的返回值多了 `surfaceAt(x, z)`：走的是**画出来的那张面**（同样的两个三角形、同样的角点高度），不是 `top*levelHeight`。放东西、贴地、限制相机都用它 |
| 回追某个格子的地面 | `buildCellIndex(grid).at(x,z)` 找格 → `town.top(cell) * levelHeight`（那是体素列顶，软坡抬起的一层不在里面） |
| 半球 / 半边结构 | `buildHalfEdge(grid)` → `{ halfEdges, twin, next, verts }`；`boundaryLines()`、`ringArrows()`、`halfEdgeReport()`、`mixedTopologyCheck()`（index 的 halfedge / mixedgrid 开关） |
| 拓扑直线 | `traceStraightRuns(grid, ...)`、`runGeometry()`、`runThrough()`、`runAtCell()`（`src/trace.js`；`topoline.js` 是同一件事的另一版实现，未接） |

### 5.2 engine 侧（`engine/`，world.html 用）—— 这些现在都能单独调

| 想做的事 | 用这个 |
|---|---|
| 台地岛 | `buildMesa({ seed, radius, hexSize, towers, caves, houses })` → `{ town, grid, houses }` |
| 网格体检 | `repairInvertedCells(grid)` / `auditCells(cells)` / `cellIsBad(...)`（`src/grid.js`）；返回 `{ caught, repaired, kinds }` |
| 顶点光照 | `createHeightLookup(town, grid, { res })` + `attachVertexLookup(material, lookup)` |
| 光体积 + AO + 反弹 | `createPointLightVolume({ town, grid, geometry, radius, bounces, bounceRadius, bounceGain })` → `update(pos)` / `setAO(v)` / `stats.ao` / `stats.bounceGain` / `aoNear(x,y,z)` |
| 大笔触 / 条纹 / 渗漏 | `createBlotch({ town, grid, scale, strength, streak, bleed, levelHeight })` + `attachBlotch(material, b)` |
| 投影贴片 / 沉积线 | `makeSurfaceMaterial({ strength, scale, base, sedAmp })` |
| 面阴影 | `engine/surfaceshadow.js`（投射高度与 z 测试解耦） |
| impostor | `createImpostors(renderer, { atlas })` → `addObject(key, { geometry, height, tile, leaf })` / `place()` / `finalize()` / `setLeaf(v)` |
| 精灵图集 | `new SpriteAtlas(size)` → `insert(key,w,h,padding)` / `release(key)` / `slots` / `occupancy()` |
| 球面三角化 | `engine/sphere.js`：`randomSpherePoints / project / unproject / delaunay2D / relaxOnce / triangleStats` |
| 河流 / 松弛 | `carveRivers(town, grid, { seed, count, wiggle, depth })`、`relaxCellAreas(grid, heightOf, { passes, strength })` |
| 水 | `buildShoreWaves(...)`、`makeOceanWaves(material, {...})`、`createWaterVolume({...})`、`createFlatReflection(mesh, town, {...})` |
| 快照 | `createIslandSnapshot(renderer, scene, { size, upscale }).shoot({ half, hide })` → `{ dataUrl }` |

## 六、已经踩过的坑

- **颜色被转了两次。** three r160 里 `new THREE.Color('#hex')` 已经是线性空间，再调 `convertSRGBToLinear()` 会让画面只剩 37% 亮度，然后你会被迫把灯拧得很亮。新代码一律不要再转。（`src/mesh.js` 和 engine 里的旧代码还有这个问题，改之前想清楚会不会影响 engine 的画面。）
- **太阳在相机背后时看不到影子。** 用侧光（`setTimeOfDay` 里 day 的 `dir`）。
- **屋顶要在半格点阵上算。** 只在格角上算"到檐口的距离"，一格宽的房子屋顶是平的。要加边中点和格心。
- **一格宽排屋的端头是山墙，不是四坡。** 判定：三条边是檐口、对边是内部 → 远端那条边是山墙。
- **岸浪的相位必须沿岸平滑变化**，否则会出现一道道细碎的白线。
- **抽帧**：见三.3，seek 抽帧是坑。
- **x.com 抓不到**：代理拦截、有人机验证，不要尝试绕过。
- **重建偏慢**：整城重建 ≈115–180ms（AO 烘焙占一半）。连续拖动时能感到卡。优化方向是只重烘改动格子附近的栅格。

### 6.1 engine 那条线踩出来的（2026-10-31 第 3–5 轮）

- **GLSL/JS 里的变量遮挡会"静默出错"。** `lightvol.js` 的 AO 循环里把法线写成 `nx/ny/nz`，正好盖住了外层的体积分辨率；
  `floor(负数)` 得到 -1，射线立刻 break，于是每个顶点的 AO 都算成 1.00 —— **shader 编译通过、画面完全正常**，
  只有去看 `stats` 才发现。写数值代码时，循环内的临时变量一律加前缀（`nnx/nny/nnz`）。
- **AO/距离场的分辨率必须比它要分辨的空隙更细。** 光照体积是 32²（一格 ≈ 0.97 世界单位），而一个 quad 只有 0.8 宽，
  相邻两列几乎必然落进同一格 → 每个竖直面顶点四周全实心，AO 中位数 0.000，整片崖面变灰绿。
  修法不是调强度，而是给 AO **单独烘一张 96²** 的栅格。
- **占用栅格别填到顶点所在的高度。** `floor(top/cellY)` 会把最上面一格填满，顶点就站在实心格里，
  任何射线第一步都撞自己 → AO 全 0。要写 `floor(top/cellY) - 1`（保证最后一格的上表面 ≤ 顶面）。
- **判断绕向要用"未抖动"的坐标。** 抖动本身能把小格子抖翻；用抖动后的位置当基准，把顶点归位反而被判成"反转"，
  jitter 0.95 时有 290 个格子永远修不好。基准一律取 `(bx, bz)`。
- **整数哈希别用浮点乘法。** `seed * 1442695040888963407` 超过 2^53，低位被吃掉，噪声分布被压成 0.09~0.39，
  阈值 0.42 永远进不去 —— 整层色块**一点都没画出来**，但 shader 编译成功。全程 `Math.imul`。
- **精灵图集要"先全部登记、再统一烘"。** 边插边烘时，打包器一重排，先前烘好的像素就"搬家"了，
  而 slot 记录还停在原地 → billboard 采到别人的格子，画面上出现一块巨大杂色方块。
- **烘图集要先关 tone mapping**，并把 RT 的 `colorSpace` 设成 `LinearSRGBColorSpace`；
  否则 billboard 的着色器再编一次 sRGB，树冠灰白发白。
- **`fwidth` 求像素宽线在掠射角必须 clamp**，不然整格变黑，出现棋盘格。
- **`gl.readPixels` 要等两个 `requestAnimationFrame`**，否则读到的是上一帧（做 A/B 对比时特别容易误判）。
- **做 A/B 不要只比"平均亮度"。** 本轮 AO 让全局 mean 只动了 0.9%，但 p05 掉了 2.9 —— 只看 mean 会以为"没效果"。
  同理，判断某个效果落在哪，最可靠的是**同机位两张图的逐像素差异图**（`screenshot-bleed-diff.png` 就是这么来的）。
  现成工具：`node tools/ab.mjs <url> <关掉它的 js>`，`AB_SETUP` 环境变量里的 js 会在两张图之前都执行（相机要放进这里，
  否则 A/B 的差异里混着机位变化 —— 本轮的第一次 AO 对比就是这么白测的）。它用 canvas 逐像素比，不需要 ffmpeg/PIL。
- **格角高度必须由"共享量"算出来，不能各格自己平均。** 软坡第一版用"相邻两条棱的平均"当角高，于是同一条棱两侧的格子
  算出 1.5 和 2.5，草地里裂开一道缝、能看见海。改成"棱高取这条棱两侧的 max、角取两条棱的 max"后，两侧算出同一个数，缝就没了。
  一般规律：**跨格共享的东西（高度、法线、AO）都要有唯一的计算口径**，否则一定裂。
- **但"每格自己取 max"还不够 —— 要按顶点存。** 上面那条改完之后库里还剩 **84/912 个顶点有两套高度**（最大差 2 层 = 1.0 世界单位）：
  软坡只抬"该抬的那条棱"，而一个顶点还被两三个**等高**的格子共用，它们不抬 → 沿棱裂开竖缝，草坡上一片片青色三角（实测 2065 px）。
  正确做法是把高度存进 `Map<顶点对象, 高度>`（`y(v) = max over 共用它的格子`），所有格子读同一个值，接缝按定义不存在。
  代价与配套：① 低格子的角会被抬高，所以**墙顶要跟着角点走**（梯形，不是平的 `t*L`），否则抬起的角悬空又裂；
  ② 抬角要封顶 `t+1`，不然紧挨三层塔的低格会被拉成尖刺（画面上真会出现一排三角锥）。
- **补缝的判据还是"邻居比我低"，不要改成"这条棱上还有没盖住的高度"。** 后者听着更稳，实际会让**等高格互相补一遍墙**，
  两块面片完全重合 → z-fighting，画面上是一条条**虚线状黑边**（比裂缝还难看，而且只在特定机位才闪）。
- **数裂缝要用泛洪，不要数"青色像素"。** 海色判据会把整片海算进去（26 万像素）；正确做法是从画框边缘泛洪标出"外面那片海"，
  剩下没被标到的海色像素才是洞（`tools` 之外的一段 20 行 python，Pillow 装在 `~/.workbuddy/binaries/python/envs/default`）。
  本轮实测：修前 2065 px / 12 个 ≥20px 的碎块，修后 799 px / 4 个；关掉房子再测是 516 px，说明其中约 280 px 是**房子底座与
  被抬高的地形之间**的缝（另一个问题：房子整块按 `top` 平移，地形角点却被软坡抬起了一层）。
- **`onBeforeCompile` 里拿到的 uniforms 是编译那一刻的引用。** 重建光照场时如果 `Object.assign` 换掉整个 uniform 对象，
  已编译的 shader 还指着旧的，改值不生效。要么原地改 `.value`，要么 `material.needsUpdate = true` 重编译。
- **流量累积一定从高往低扫。** 河网是按"每条沟记录最陡下游 → 上游面积累加到下游"做的；如果按势能**升序**跑，
  下游先算完、上游的贡献后到，整张网会塌成每条支流 2–4 格（实测最大流域 4 格 / 5000 格，看起来像没有河）。
- **排水势能不能只用高度。** 平滑过的高度场里全是单格洼地（平滑正是为了海岸线干净），排水图会被切成无数 1 格汇。
  加上"到海的距离"当底，才保证每滴水都能流到海里，才有长河。
- **高度场要先平滑再量化。** 逐格采噪声直接量化，高频项一翻阈值就多一级台阶，海岸线变椒盐、整颗球像揉皱的纸。
  正确顺序是：连续场 → 邻域平均若干遍 → 量化，并且阈值之间要留足一格。
- **球面/碎面上的平滑着色不能在材质上开 `flatShading` 解决。** 每格有自己的半径、顶点无法共享，只能事后按位置合并法线
  （只合 dot > 0.3 的，崖角才留得住）；`engine/normalsmooth.js` 是同一套思路。
- **地形"水面一侧"要单独判。** 邻格为空（水）时格顶也在 level 1，如果只按"落差 1 格 = 软坡"处理，
  海岸线就没有挡土墙、地块漂在水上。判定要分成"邻格是陆地且落差 1 = 坡 / 邻格是水或网格外 = 墙"。

## 七、下一步从哪开始

**先修正认知**（2026-10-31 15:15 核对）：`learn/pipeline.js` 里有 8 条状态是旧的，engine 那条线已经把它们做掉了 ——
球面三角化（`engine/sphere.js` + `sphere.html`）、树/云 impostor（`engine/impostor.js`）、
沉积线 + 大笔触（`engine/surface.js` / `blotch.js`）、鸟（`engine/birds.js`）、光体积 GI（`engine/lightvol.js` 已有 6 向体积 + 96² 半球 AO + 3 次反弹，第 3 次之后增量 0.07%）、
贴图面阴影（`engine/surfaceshadow.js`）、体素阴影（`engine/voxelshadow.js`）、网格体检（`engine/meshcheck.js`）。
所以第 8 步（球面）不是"从零"，而是"把 `sphere.js` 接进主场景"。

按 `PIPELINE.md` 的路线来，建议顺序是 **1 → 7 → 0**（把 0 往后放，理由在下面）：

- **第 1 步 共享体素场**：**已做（partial）**。`src/lighting.js` 把 `#bakeLighting` 的私有栅格抽成了
  `buildVoxelField({ sets })` —— 任意多份体素集（地块、房子，各带自己的 `y` 偏移）栅格进同一组层、模糊一次；
  CPU 的 `bakeVertexAO()` 和 GPU 的 `patchMaterial()` 读的是同一份场，数学完全一致。剩下的：风场、碰撞、
  软法线还没接进来；每次重建整张重烤，没做脏区增量。
- **第 7 步 融合**：**已做第一版（partial）**，见 `fusion.html` / `src/fusion.js`。同一张 `quadgrid` 上：
  噪声高度量化成体素列 → 台地 + 沙滩 + 两处坡道；`src/terrainmesh.js` 出一格软坡、两格断崖的地形；
  **没改一行**的 `TownMesh` 整块抬到台地顶出房子；`buildShore` 只看地块那一份 Town。
  没做的：房子还不能跨格（多格 tile）、只有一级可建台地（靠整体平移对齐，所以一栋房子不能跨两个高度）。
- **第 0 步 统一网格**（另一条会话在推）：`quadgrid.js` 改成"任意多边形 + 半边结构"是一次大改，
  而现在 engine 侧的 `world.html` 是这条线唯一稳定的可视化，动网格会同时打断两边。
- **第 8 步 球面**：**已做第一版（partial）**，见 `spherefusion.html` / `src/spheretown.js`：5508 陆地格、7860 面，
  一格落差做软坡（关掉就变 1609 侧台阶崖），重合顶点合并法线跨格平滑，岸线有细白带。
  河网用流量累积刻出（235 格河 + 16 格湖），村子的房子用 `src/spherehouse.js`（每格自己的基向量）。
  没做的：球壳岸浪、防蘑菇化 relax、球面没有共享体素场、河道直接切到海平面（没有独立水位）。
  `engine/sphere.js` 已经把"随机点 → 散开 → 球极投影 Delaunay → 三角形松弛"跑通了
  （1193 个三角形，最小角从 1.74° 提到 23.64°，细长三角 0 个）。下一步是让它出四边形而不是三角形，
  再给每格一个局部"上方向"。

每做完一步：把 `learn/pipeline.js` 里对应步骤的 `status` 改成 `done` 或 `partial`，补上 `where` 和（能开关的话）`toggle`，`index.html` 和 `pipeline.html` 就会自动显示出来。

### 7.1 两条会话怎么不打架

这个仓库现在有两条线在同时写：**Townscaper 线**（`src/`、`index.html`、`learn/`）和 **engine 线**（`engine/`、`STUDY-INDEX.md`）。
engine 线是每小时的自动化在跑，改得很勤（一天之内 `engine/` 从 27 个文件长到 33 个）。

- 改 `engine/` 之前先 `ls -la engine/` 看修改时间；改 `src/` 之前看 `index.html` 和 `learn/data.js`。
- **不要动** `.workbuddy/`（另一条会话的记忆与自动化配置）。
- `learn/data.js` 是两边都会写的（engine 线学完一条也会登记），冲突概率最高 —— 写之前先读一遍，改完再读一遍确认没被覆盖。
- 想要版本保护：在 `REACode/` 里单独 `git init`，**不要** `git add` 进父仓库
  （`TigerInBamboo` 是个 git 仓库，branch `main`，但 `townscaper-web/REACode/` 至今是未跟踪的 `??`，
  加进去会把 TigerMessenger 的历史和这里搅在一起）。
