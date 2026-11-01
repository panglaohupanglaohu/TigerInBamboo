# GUIDE — 接手指南（写给继续这条路的 LLM / 开发者）

这个目录是 `../REACode` 的**重构版**。`../REACode` 保持原样，作对照用；所有新工作都在这里做。
先读完这一页，再打开 `index.html` 和 `architecture.html` 看一遍，再动代码。

---

## 一、规矩（必须遵守）

1. **先读原文，再看画面，最后写代码。** 素材在 `../../REA-agent/gifs/`：每段 mp4 的原文说明在同目录 `README.md` 里，按帖子 ID 对应。不要去 x.com 抓（有验证码，别绕）。原文和画面对上了才算学会。
2. **不改 `../REACode`，不碰 `.workbuddy/`。** 那里还有别的会话在写。要用里面的东西，复制过来。
3. **只有一张网格、一份体素。** 新功能不许自己再存一份格子数据。地形写 `rock` 位，建筑写非 rock 的 `solid` 位，其余数据（颜色、河流）挂在 `World` 上。
4. **依赖方向固定：** `core` ← `terrain / build / light / water / life` ← `world` ← `ui`。同一层之间不互相 import。
   另外：**格子不一定是四边形。** 用 `c.n`（角数）和 `(i + 1) % c.n`，不要写死 4；"对边"只有方格有（`oppositeEdge()`，三角格返回 -1）。两种网格都要截图。
5. **颜色：** `new THREE.Color('#hex')` 在 three r160 里已经是线性值，**不要**再 `convertSRGBToLinear()`（旧版"画面只有 37% 亮"就是这么来的）。
6. **每处实现都写上帖子 ID 和原文关键句**（注释里），在 `CHANGELOG.md` 记一行，并同步更新 `learn/data.js` 里那条的 `status / where / learned`，以及 `learn/pipeline.js` 对应步骤。改完 `pipeline.js` 跑一次 `node tools/gen-pipeline-md.mjs` 重新生成 `PIPELINE.md`。
7. **每次改完都截图验收**（见「五、验收」），三个场景都要看。

## 二、目录

```
REACodeRefactoring/
├── index.html              主场景：三个场景切换 + 右侧学习面板（系统全局 / 管线开关 / 去看 / 原视频）
├── architecture.html       系统全局：数据流图、模块卡片、新旧对照、未迁移清单（数据来自 learn/architecture.js）
├── pipeline.html           判断 + 学习路线 + 四条管线（数据来自 learn/pipeline.js）
├── learn.html              237 段视频的学习笔记（数据来自 learn/data.js，缩略图 learn/thumbs/）
├── README.md               怎么打开、怎么操作
├── ARCHITECTURE.md         模块职责、依赖、约定
├── GUIDE.md                本文件
├── PIPELINE.md             管线与路线文字版（生成的，别手改）
├── CHANGELOG.md            每一轮学了什么、改了什么（新一轮写在最上面）
├── start.sh                启动本地服务（端口 8766），--open / --stop / --port
├── 启动.command / 停止.command   macOS 双击用
├── tools/
│   └── gen-pipeline-md.mjs 由 pipeline.js 生成 PIPELINE.md
├── vendor/three.module.js  three r160（import map 指向它）
├── gifs -> ../../REA-agent/gifs   start.sh 自动建的链接（原视频）
├── learn/
│   ├── data.js             window.LEARN：每段视频 {id, text, project, topic, status, learned, where}
│   ├── pipeline.js         window.PIPELINE：verdict / lanes / roadmap / statusName
│   ├── architecture.js     window.ARCH：flow / layers / notPorted
│   └── thumbs/             每段视频一帧缩略图（<id>.jpg）
└── src/
    ├── core/               不依赖任何其他目录
    │   ├── grid.js         buildQuadGrid()（四边形）/ buildMixedGrid()（三角 + 方格）；格子是任意多边形
    │   ├── world.js        World + MAX_LEVEL：体素场（solid / rock / color / river）
    │   ├── spatial.js      pointInQuad / decorateCells / buildCellIndex
    │   ├── meshwriter.js   MeshWriter（共享顶点池、软法线、描边方向）、edgeOut、UP / DOWN
    │   ├── palette.js      PALETTES（墙色方案）、BUILD（建筑固定色）、TERRAIN（地形色）
    │   ├── noise.js        valueNoise / fbm / ridged / makeRng / hash01 / clamp / mix / smoothstep
    │   └── atlas.js        Atlas：二叉树矩形打包（impostor 图集）
    │   ├── trigraph.js     TriGraph：增量 Delaunay + 流形检查
    │   ├── infinite.js     buildInfinite()：无限网格（块 + 簇松弛 + 重心插值）
    ├── terrain/
    │   ├── generate.js     generateTerrain()、carveRivers()
    │   ├── shape.js        shapeTerrain()：层级平滑 + 笼形变形 → at(p, 切面)
    │   ├── features.js     addFeatures()：悬垂、石拱、海中石柱；forceChurch()：先压平再放教堂
    │   └── terrainmesh.js  buildTerrain({ shape })：崖壁、起伏沉积线、台地顶、亮边、洞顶
    ├── build/
    │   └── buildings.js    buildBuildings()：码头、墙、门窗、钢架 / 拱、后院、屋顶
    ├── light/
    │   └── bake.js         bakeLighting()：分层 AO + 彩色反弹
    ├── water/
    │   ├── shore.js        buildShore()、makeSkirtMaterial()、makeWaveMaterial()
    │   └── waterfall.js    Waterfalls：河落崖的水帘 + 白沫
    ├── world/

    │   ├── worldmesh.js    WorldMesh：地形 + 建筑 → 烘焙 → 一个几何体
    │   ├── scenes.js       SCENES、buildScene()、generateFusion()
    │   ├── navgraph.js     buildNav()：简化导航图（区域节点）、河上顺流更快、楼梯候选、最短路树
    │   ├── navlayer.js     NavLayer：楼梯几何 + 导航图调试线
    │   ├── townDemo.js     generateTown()
    │   ├── view.js         View：渲染、海面、倒影、时段、调试开关、拾取
    │   ├── outline.js      OutlineLayers：墨线 + 逆光亮边
    │   ├── save.js         encodeWorld / decodeWorld（存档 v5）
    │   └── app.js          入口：输入、工具、撤销、场景切换、地址栏存档、window.rea
    ├── life/
    │   ├── vegetation.js   Vegetation：草丛、小花、灌木、团块树、后院（植被管线）
    │   ├── impostor.js     八方位 impostor（树）+ 云
    │   ├── atmosphere.js   风场、雪、雾
    │   ├── decor.js        旗子、彩旗绳、蝴蝶
    │   ├── effects.js      水花、出现 / 消失动画、火
    │   ├── sound.js        Sound：WebAudio 合成的建造音效（咕咚 / 磕石头 / 啵）
    │   ├── boats.js        Boats：绕岛的长船 + V 字尾迹
    │   └── birds.js        Birds：海鸥
    ├── badnorth/
    │   ├── theme.js        applyBadNorthTheme()：Bad North 调色板（夏 / 晨实测 + 4 套推断）、无地平线、岸线色、晕影
    │   ├── island.js       generateBadNorth()：小岛 + 可走性检查 + 小屋
    │   └── battle.js       Battle：长船登陆、小队、近战 / 弓箭、血 / 尸体 / 箭粘船
    ├── campaign/
    │   └── campaign.js     generateCampaign()、islandSnapshot()（战役图）
    ├── sphere/
    │   └── planet.js       buildSphere()、buildPlanet()、cornerPositions()（防蘑菇化）
    └── ui/
        ├── walkthrough.js  完整管线示例（11 步）
        ├── learnpanel.js   mountLearnPanel()
        └── hud.css         界面样式
```

## 三、一帧是怎么出来的

1. `app.js` 建 `buildQuadGrid({radius:14})` 和 `new World(grid)`。
2. 场景生成器（`buildScene(world, 'town'|'terrain'|'fusion', seed)`）或玩家操作改写 `World`，每次改动 `world.touch()` 使 `version` 加一。
3. `View.render()` 发现版本变了 → `WorldMesh.rebuild()`（分块增量：所有生成器在每格开头调 `w.at?.(c)`，三角形写进该格所在的块；只有内容变了或附近体素变了的块才重烘焙）：
   `shapeTerrain(world)`（每个切面的顶点位置）→ `buildTerrain(w, world, {shape})` → `buildBuildings(w, world)`（返回钢柱位置 `posts`、后院 `yards`）→ `bakeLighting(w, world)` → `w.toGeometry()`（软法线 + 描边方向）。
4. `View` 用同一个几何体画本体、倒影（`scale.y = -1`）和两层描边外壳，再用 `buildShore(world, grid, index, {posts, shape})` 重建岸浪（海岸取切面 0 的变形位置）。
5. 浪带是循环顶点着色器：数据在生成时烘焙，运行时只推进时间。

## 四、关键接口

```js
// 体素
world.isSolid(cell, lv)  world.isRock(cell, lv)  world.isBuilt(cell, lv)
world.setSolid(cell, lv, on, { rock })   world.fill(cell, h, { rock })
world.top(cell) / bottom(cell) / ground(cell)   // 最高实心层 / 最低实心层 / 最高岩石层
world.isLand(cell)   world.neighbor(cell, i)   world.regions()
world.color[cell]    // 调色板序号，-1 = 默认
world.river[cell]    // 1 = 河床
world.snapshot() / restore(s)   world.touch()

// 网格
cell = { id, pts:[4 个共享顶点 {id,x,z}], cx, cz, edgeNeighbors:[4], cornerNeighbors, convex }

// 地形形状：所有地形顶点都要经过它，否则崖壁和顶面会裂开
const shape = shapeTerrain(world);        // 切面 s = 高度 s·L；崖壁第 lv 段连接切面 lv-1 和 lv
shape.at(p, s) → [x, z]                   // 房子格、外圈格被钉住，返回原位

// 网格写入（同一个顶点池）
w.soft = true; w.quad(...); w.soft = false; // 软法线：同位置、夹角 < 55° 的软面平均
w.quad(a, b, c, d, dir, color, shade, glow)   w.tri(...)   w.box(...)   w.beam(...)
// 写入后 bakeLighting 会按法线采样占用图，所以新几何体自动得到 AO 和反弹光

// 调试与视图（浏览器控制台里 window.rea 可用）
rea.view.setDebug('grid'|'shorelines'|'wavewire'|'waves'|'reflection'|'shadows'|'ao'|'smooth'|'outline'|'backlit'|'lightonly'|'wire', bool)
rea.view.setTimeOfDay('day'|'dusk'|'night')
rea.loadScene('town'|'terrain'|'fusion')
```

## 五、验收

- `./start.sh --open fusion`，三个场景各看一眼：没有黑面、没有缝、浪贴着岸走。
- 勾掉 / 勾上面板里的每一项，画面要有对应变化。
- 控制台没有报错；`rea.view.worldMesh.stats` 看三角形数和各阶段耗时。
- 没有浏览器时，用 Playwright 截图（`chromium.launch()`，SwiftShader 下烘焙会比真机慢 2～3 倍）。

## 六、坑

| 现象 | 原因 |
|---|---|
| 整个画面发灰发暗 | 颜色做了两次 sRGB → 线性转换 |
| 阴影看不到 | 太阳在相机背后；用侧光 |
| 浪是一根根细线 | 浪带太窄、条数太多；2 条、加宽、降低透明度 |
| 岛填满整个六边形 | 径向衰减要从 `span·0.74` 开始 |
| 地形场景烘焙很慢 | 占用图分辨率要随面积自适应（`res = clamp(sqrt(area/40000), 0.08, 0.14)`） |
| 选颜色后不能建造 | 选色不能切换工具（已修，别改回去） |
| 关键词分类出错 | "unit" 会匹配 "Unity"；用词边界 |
| 换成三角 + 方格网格后报错 / 少面 | 某处写死了 4 个角；顶面用 `w.poly()`，循环用 `c.n` |
| 地形崖壁一块亮一块暗（三角形分面） | 变形后的崖壁四边形不共面；崖壁要写成 `w.soft = true` |
| 地形和建筑之间裂缝 | 新的地形几何没走 `shape.at`；或建筑格没被钉住 |
| 改了一格，远处的 AO / 法线没更新 | 新的生成代码没在每格开头调 `w.at?.(c)`，几何落进了别的块；或影响范围超过 `AO_REACH` |
| 块和块之间有一条亮 / 暗缝 | 烘焙没对齐全局像素网格，或法线没带 halo |
| impostor / 云一片片地闪（雪花点） | 在条件分支里采样贴图：mip 级别的导数失效。帧选择放到顶点着色器，片元里无条件采样 |
| 着色器报 `'#' : invalid character` | `#include` 写在了同一行；预处理指令必须单独一行 |
| 小镇里墨线又黑又粗 | Townscaper 没有墨线：小镇场景默认关（learnpanel 按场景切换） |

- **Dijkstra 的距离数组别用 Float32Array**：`t > time[id]` 里 t 是 float64、time 被截成 float32，几乎每次都"更大"→ 节点被跳过（导航图一度只走到 31/736 格）。用 Float64Array。
- **地形一道崖 = 2 层**（generate.js 量化到偶数层）：按 1 层算的楼梯会钉在半墙上。楼梯 / 导航的最大台阶是 2。
- **笼形变形后崖脚比崖顶更往外**：贴墙放的东西用墙脚切面 `at(p, h)`，方向用变形后的格中心，否则埋进墙里。
- **学视频先读全文再看画面**：一句话末尾顺口提的东西（"…and adding pretty little flowers"）不是视频内容；画面才是。
- **音效要等一次点击**：AudioContext 在第一次 pointerdown / click 时创建，resume 是异步的；第一声要排队不能丢。

## 七、下一步（按收益排）

1. ~~描边 / 逆光~~、~~层级平滑 + 笼形变形~~、~~起伏沉积线~~、~~软法线~~（已完成，见 `terrain/shape.js`、`world/outline.js`）。
2. **烘焙对齐变形**：`bake.js` 的占用图还按未变形的格子栅格化，崖壁移动大时 AO 会偏；改成按 `shape.at(p, lv)` 栅格化。
3. ~~增量烘焙~~（第 3 轮完成：分块 + 内容哈希，一次编辑 ≈ 60 ms）。还可以把生成本身也做成按块增量。
4. ~~三角 + 方格混合网格~~（第 4 轮完成：`buildMixedGrid()`，所有管线都支持任意多边形格子）。下一步：多格 tile（一个房子跨一个方格 + 一个三角格，`1579483114178768898`）。
5. **球面**（`1768627849529893109`、`1338825080844021760`）：网格换成球面三角化，World 不变。
6. 植被剩下的：八角 impostor（`1849427564034498642`）、和树共用 impostor 的云（`1852334860137849222`）、草的对比度描边、小花；水花 / 弹出动画、旗子、楼梯 WFC。

每做完一项：更新 `learn/data.js`、`learn/pipeline.js`、`learn/architecture.js`，跑 `tools/gen-pipeline-md.mjs`，截图。


## 2026-11-01 · 重构状态口径补充（用户确认）

快速扫描两份代码，匹配迁移前后模块；已有可执行主体改进差异的，认可为已重构，保留历史学习成果，不要求重新学习全部视频。部分实现仍记录缺口。新功能继续遵循先读原文再看视频的流程。状态数据由 tools/audit-refactoring.py 生成，页面读取 learn/refactoring-status.js；静态扫描与逐帧、运行验收分别记录。


## 覆盖补差与定时接续

原版 src/engine 全部128个JS的映射在 MODULE-MAP.md，页面 coverage.html。职责映射在 tools/build-coverage.py；逐项实证覆盖写 learn/coverage-overrides.json，避免生成时丢失。每批先读原文再看全帧，证据目录 artifacts/coverage。每30分钟的定时任务承接当前聊天，刷新 learn/coverage-progress.json；index 与 pipeline 共享 src/ui/coverage-progress.js，页面也每30分钟重新读取。不要把自动轮询当作代码审核。

首批导航逻辑测试：node tests/navigation.mjs。浏览器验收：artifacts/coverage/browser-check.json。多层战斗完整接入仍待补齐。后续顺序：多层单位接入 → 左行点线/压力测试 → 确定性WFC/局部修复 → 树冠硬边松弛 → 体素与表面光照。
