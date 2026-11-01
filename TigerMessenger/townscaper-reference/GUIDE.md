# GUIDE — 给接手的 LLM：怎么继续这条学习线

这份文档写给下一个接手的模型（或人）。读完它，你应该能做到三件事：知道已经学到哪了，用同样的方法学下一段视频，把学到的东西接进代码并在 `index.html` 里显示出来。

如果只有 5 分钟，先读这三处：
1. 本文的「零、七条规矩」
2. `PIPELINE.md`（或打开 `pipeline.html`）：判断结论 + 9 步学习路线
3. `learn/pipeline.js`：每一步的状态，你做完要回来改它

---

## 零、七条规矩

1. **先读原文，再看画面。** 每段视频的原文在 `../../REA-agent/gifs/README.md`（帖子 ID、日期、GIF 旁的文字）。不要先看画面再猜它在讲什么：之前有一轮就是看画面猜成了"台地地形"，原文一对才发现在讲"岸边浪"。别去 x.com 抓：代理和人机验证都会挡，README 已经有全部原文。
2. **不要盲信仓库里已有的说明。** `ENGINE.md`、`STUDY-INDEX.md` 和旧版 `README.md` 里有推断，不一定都对。拿视频和原文核实过才算数。
3. **原文 → 画面 → 代码 → 截图验证，四步缺一不可。** 写完代码必须在浏览器里截图看过（见「四」），不能只靠"代码看起来没问题"。
4. **每处实现在代码注释里写上帖子 ID 和原文关键句**，例如 `// 1849732997945110651 "waves travel from the blue line to the yellow"`。这是可追溯性的唯一来源。
5. **学完一条就更新三处数据**：`learn/data.js`（这条的状态与笔记）、`learn/pipeline.js`（管线里对应步骤的状态）、`LEARNING.md`（改了什么）。不更新的话，`index.html` 和 `pipeline.html` 就看不到你的成果。
6. **不要破坏别人正在用的文件。** 这个目录**没有 git**，而且常有两条会话同时在写（另一条在 `.workbuddy/`，主要改 `engine/`）。写回前先看文件修改时间，确认在你读取之后没人动过；引擎依赖的 `src/grid.js`、`src/mesh.js`、`src/town.js` 保持兼容。新能力优先放进新文件。建议用户 `git init`，有了版本控制再做大重构。
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
├── overview.html         成果总览：统计、各页截图、Townscaper 与 engine 分工表
├── game.html             只是跳转到 index.html（兼容旧链接）
├── Townscaper.html       旧版单文件（学习前的基线，双击可开）—— 不要改
│
├── 启动 ────────────────────────────────────────────────────────────────
├── start.sh              起本地 http 服务（默认 8765，占用时自动换口）；建 gifs 软链；打开 index.html
│                         ./start.sh --open learn|pipeline|guide|overview|compare|world|terrain|island|old ；./start.sh --stop
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
│   ├── town.js           体素列：solid[] 层位掩码、colors[]、roofColors[]、regions()、调色板；pointInQuad / buildCellIndex
│   ├── townmesh.js       ★ 建筑网格：屋顶/山墙/基座/钢架/拱/门窗/后院 + #bakeLighting（分层 AO + 彩色反弹）
│   ├── shore.js          ★ 水层：距离场、黄/蓝线、循环顶点着色器岸浪、浪裙、钢架腿泡沫圈
│   ├── scene.js          渲染器、相机、海面、倒影、光照档位 setTimeOfDay、开关 setDebug、拾取 pick
│   ├── learnpanel.js     学习导航面板：管线分组、场景开关、「去看」镜头、视频弹窗、URL 参数
│   ├── demo.js           示例城镇（码头、排屋、塔、围合后院、拱、水上钢架房）
│   ├── save.js           存档字符串（位数组 → 64 字符表，v4）
│   ├── style.css         HUD 样式
│   ├── grid.js           ⚠ 旧版"六边形切风筝块"网格 —— engine/mesa.js、terrain.js 还在用，保持原样
│   └── mesh.js           ⚠ 旧版网格生成器（含 terrain 模式）—— engine/world.html、terrain.html 还在用，保持原样
│
├── engine/ — 地形管线（另一条会话在推进，改之前先看修改时间）──────────
│   ├── world.html        台地岛场景：台地、河流、岸浪、水体切片、逆光边、描边（W 线框 / R 换岛 / D 制图稿）
│   ├── terrain.html      同一体素场读成地貌
│   ├── demo.html         Bad North 式岛屿生成 + 导航
│   ├── mesa.js           台地岛：阈值化高度场 → 台地 → 塔柱 → 峡谷 → 洞窟 → 放房子
│   ├── islands.js        Bad North 那一半：高度场 → 阶梯地形 → 材质 → 寻路
│   ├── terrain.js        早期噪声台地（规则网格），保留对照
│   ├── rivers.js         河流：深度优先坍缩（1769691526924292506）
│   ├── relax.js          防"蘑菇化"：格子趋向期望尺寸（1769641473895432220）
│   ├── normalsmooth.js   体素邻域平均法线（1062374549407350790）
│   ├── surface.js        贴图层：按坡度和高度混合的投影贴片（1781405550061687016 等）
│   ├── vertexlight.js    顶点着色器里查一次低分辨率高度图做光照（1791049306213912823）
│   ├── backlit.js        逆光边：反向外壳描边（1751945034851570056）
│   ├── outline.js        描边 / 亮边后处理
│   ├── roofs.js          台地上的陡坡双坡顶小房子
│   ├── waves.js          岸浪（engine 版）+ makeOceanWaves 动态海面
│   ├── shorefield.js     岸线距离场（1664566546683899905）
│   ├── watervol.js       水体：一叠平面采样 SDF（1758251637280268481）
│   └── noise.js          带种子的 value noise / fbm
│
├── tools/ — 看视频用的工具（没有 ffmpeg 时）──────────────────────────
│   ├── video-frames.mjs  播放 + requestVideoFrameCallback 抽去重帧（不要用 seek）
│   ├── contact-sheet.mjs 把帧拼成总览图
│   ├── measure.mjs/.html 抓 96×96 灰度量帧差、周期、运动方向
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
                         ├─ scene.js ─┬─ townmesh.js
                         │            └─ shore.js
                         ├─ learnpanel.js ◄── learn/pipeline.js, learn/data.js
                         ├─ demo.js, save.js
engine/world.html, terrain.html ─── src/mesh.js, src/grid.js（旧版，别动）
```

改 `src/town.js` 会同时影响 Townscaper 和 engine；改 `src/grid.js` / `src/mesh.js` 只会影响 engine。

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

页面暴露了 `window.reaTown = { town, grid, view, ... }`，可以在 `evaluate` 里直接操作：

- 镜头：`view.target.set(x,y,z); view.distance = 7; view.pitch = 0.4; view.updateCamera()`
- 开关：`view.setDebug('grid', true)`、`view.setTimeOfDay('night')`
- 统计：`view.townMesh.stats`，例如 `{ triangles, yards, posts, bakeMs, ms, shoreMs }`
- URL 直达：`index.html?on=grid,shorelines&off=waves&tour=arch&time=night`

量颜色时用 PIL 读截图像素，和目标色板比对。

## 五、可以直接复用的接口

| 想做的事 | 用这个 |
|---|---|
| 生成网格 | `buildQuadGrid({ radius, hexSize, seed })` → `{ cells, verts, vertexCells }`；cell: `pts[4]`（共享顶点对象，有 `id/x/z`）、`edgeNeighbors[4]`、`cornerNeighbors`、`cx/cz` |
| 存 / 读体素 | `new Town(grid)`；`isSolid(cell, lv)`、`setSolid`、`top`、`bottom`、`fill`、`regions()`、`snapshot/restore` |
| 点在哪个格 | `buildCellIndex(grid).at(x, z)` + `pointInQuad(cell.pts, x, z)` |
| 出建筑网格 | `new TownMesh(town, grid, { levelHeight }).rebuild()` → `geometry`（color + aGlow）、`posts`；`bake=false` 关掉 AO |
| 出水层 | `buildShore(town, grid, index, { posts })` → `{ skirt, waves, shoreLine, seaLine }`；`makeWaveMaterial()`、`makeSkirtMaterial()` |
| 光照 / 开关 | `view.setTimeOfDay('day' \| 'dusk' \| 'night')`、`view.setDebug(key, on)` |
| 地形（engine） | `engine/mesa.js`、`rivers.js`、`relax.js`（它们用的是 `src/grid.js` 的旧网格） |

## 六、已经踩过的坑

- **颜色被转了两次。** three r160 里 `new THREE.Color('#hex')` 已经是线性空间，再调 `convertSRGBToLinear()` 会让画面只剩 37% 亮度，然后你会被迫把灯拧得很亮。新代码一律不要再转。（`src/mesh.js` 和 engine 里的旧代码还有这个问题，改之前想清楚会不会影响 engine 的画面。）
- **太阳在相机背后时看不到影子。** 用侧光（`setTimeOfDay` 里 day 的 `dir`）。
- **屋顶要在半格点阵上算。** 只在格角上算"到檐口的距离"，一格宽的房子屋顶是平的。要加边中点和格心。
- **一格宽排屋的端头是山墙，不是四坡。** 判定：三条边是檐口、对边是内部 → 远端那条边是山墙。
- **岸浪的相位必须沿岸平滑变化**，否则会出现一道道细碎的白线。
- **抽帧**：见三.3，seek 抽帧是坑。
- **x.com 抓不到**：代理拦截、有人机验证，不要尝试绕过。
- **重建偏慢**：整城重建 ≈115–180ms（AO 烘焙占一半）。连续拖动时能感到卡。优化方向是只重烘改动格子附近的栅格。

## 七、下一步从哪开始

按 `PIPELINE.md` 的路线来，建议顺序是 **0 → 1 → 7**，2–6 按需补：

- **第 0 步 统一网格**：把 `quadgrid.js` 的 cell 抽象成"任意多边形 + 半边结构"，让三角格和方格能在同一张图里共存（`1458921394855718917`、`1447494168448753667`）。
- **第 1 步 共享体素场**：地形格和建筑格放进同一个 `Town`。`#bakeLighting` 里的分层占用图抽成 `src/lighting.js`，让地形也能用。
- **第 7 步 融合**：在同一张网格上，地形格用 engine 的台地逻辑抬高，建筑格用 `TownMesh` 出房子，`buildShore` 按陆地格出岸线。做完在 `index.html` 里加一个"融合场景"开关。
- 之后是第 8 步 **球面**：网格在球面切平面上松弛，每格有自己的"上方向"，水是一层球壳。

每做完一步：把 `learn/pipeline.js` 里对应步骤的 `status` 改成 `done` 或 `partial`，补上 `where` 和（能开关的话）`toggle`，`index.html` 和 `pipeline.html` 就会自动显示出来。
