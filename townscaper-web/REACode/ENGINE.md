# ENGINE — 从参考片逆向出来的水面 + 地形 + 渲染

这个目录里有四样东西：

| 目录 | 是什么 |
|---|---|
| `src/` | **玩法引擎**：可编辑的 Townscaper 式城镇（逐体素、屋顶、木构、存档） |
| `engine/mesa.js` `terrain.js` `islands.js` | **地形引擎**：同一个体素场读成地貌 |
| `engine/waves.js` | **水面**：岸边浪（循环顶点着色器）+ 动态海面 ← 参考片的真正主题 |
| `engine/outline.js` `roofs.js` | **渲染特征**：边缘描边 / 暖色崖顶亮边 / 陡坡双坡顶 |
| `engine/surface.js` `normalsmooth.js` `vertexlight.js` | **贴图与着色**（第 3 轮）：投影斑块混合 + 逐像素线宽 / 体素法线平滑 / 顶点一次高度图查找 |

---

## 零、先说方法论：怎么"读"一段片子

`REA-agent/gifs/` 里的四段 mp4 都是 640×640，机器上没有 ffmpeg，所以抽帧走的是浏览器：

```
<video> 播放 → requestVideoFrameCallback 逐帧回调 → canvas.drawImage → toDataURL 落盘
```

关键教训：**`video.currentTime = t` 再 `drawImage` 是不可靠的**。我第一次就用的这个办法，12 帧 MD5 全部相同，于是误判"这是静帧"。实际上 seek 之后画的仍然是第 0 帧。改成"播放 + 逐帧回调"后，同一条片子立刻出来 64 个不同画面。

工具留在 `tools/video-frames.mjs`（抽帧）和 `tools/contact-sheet.mjs`（拼成总览图，方便一眼看完整条时间线）。

抽帧结果：

| 片段 | 时长 | 去重后帧数 | 内容 |
|---|---|---|---|
| `1991099314714902634` | 16.35s | 64 | 台地岛 + **岸线浪花**，缓慢环绕 |
| `1991101097818403263` | 14.40s | 134 | 同一座岛近景，**线框叠加正好落在岸带和海面网格上** |
| `1991103578011029507` | 16.05s | 56 | 小教堂岛 + **轻微起伏的动态海面** |
| `1995813566344011807` | 10.86s | 84 | 他家儿童区的攀爬架（**不是游戏**） |

---

## 一、四条推文的原文决定了做什么

先取原文（`api.fxtwitter.com` 公开接口，不用登录），再动手——这一步之前被我跳过了，结果做偏了：

| 推文 | 原文 | 实际要做的 |
|---|---|---|
| `1991099314714902634` | "Got some pretty sweet new **shore waves** going" | **岸边浪**：岸线上的白色浪花 |
| `1991101097818403263`（回复） | "It's based on a **looping vertex shader**. The data is **baked at generation-time**. Each vert has an **in-direction**, an **out-direction** and a **time offset**." | 实现手法：不跑模拟，生成期把方向和时间偏移烘进顶点属性 |
| `1991103578011029507` | "…a pretty good sense of a **dynamic ocean** without being too distractive" | **动态海面**：幅度很小、不能抢戏的水面起伏 |
| `1995813566344011807` | "I'm designing a **jungle gym** / climbable shelf structure for the play area of our home…" | **不是游戏**，是他家儿童区的攀爬架。这条不该当引擎参考 |

我一开始按画面猜：以为前三条在讲台地地形、岩层、屋顶，第四条在讲"制图稿渲染"。原文一对就发现**前三条讲的是水**，第四条根本不是游戏。

### 先把文字和数据对上：逐帧量化

光看画面容易自说自话，所以每条文字都找一个能量出来的量（`tools/measure.mjs`：播放 → 逐帧抓 96×96 灰度 → 帧间差曲线 + 固定水面色块的频谱）：

| 推文里的说法 | 能测的量 | 实测（`tools/measure.mjs`） |
|---|---|---|
| "shore waves" | 岸线是否有一条随时间的白带 | 是。带的位置随时间变化，不是静态贴花 |
| "looping vertex shader" | **整体**是否周期性重复 | **测不到整体周期**——帧间差随 lag 单调上升，没有极小值。这恰好是"每顶点各有 time offset"的预期结果：岸线从不同步，所以整帧永远回不到同一个状态 |
| "dynamic ocean, not too distractive" | 水面像素的亮度主频与幅度 | 主频 **0.125 Hz ≈ 8.0 s**，幅度 **≈0.0013**（约 0.3/255）——极轻 |
| （片段 2 的线框） | 线框落在哪 | 落在**岸带网格 + 海面网格**上，说明动画就发生在这两块几何里 |

三条片子都是 32.6–32.9 fps、约 470–540 帧，所以上面这些数字是逐帧算的，不是抽几帧猜的。

### 岸边浪怎么做的（`engine/waves.js`）

按原文的三个量来：

```
每个顶点烘焙：
  aIn     指向岸上的单位向量      —— 涨潮时往这边走
  aOut    指向海里的单位向量      —— 退潮时往那边走
  aPhase  0..1 的起始相位         —— 让岸线不要整条一起脉动
```

顶点着色器只做一件事：算相位。

```glsl
float t = fract(uTime / uPeriod + aPhase);   // 每条顶点自己的循环位置
float rise = sin(t * 3.14159265);            // 0 → 1 → 0
p += aIn  * (uIn  * rise);                   // 冲上沙滩
p += aOut * (uOut * (1.0 - rise));           // 退回去
p.y += uLift * rise * rise;
vAlpha = aAlpha * (0.3 * rise + 1.2 * crest); // crest 是 rise 的窄峰
```

**为什么能无缝循环**：`rise` 在 `t=0` 和 `t=1` 都是 0，`vAlpha` 也跟着归零。所以相位回绕时，顶点位置和透明度同时回到起点——看不出接缝。实测循环误差 `7.2e-16`（浮点级）。

三条让浪看起来对、而不像贴片的细节：

1. **相位随离岸距离递增**（`t * 0.42 + seed * 抖`），浪峰于是从外海往沙滩走，而不是整条带子整体平移。
2. **alpha 按圈烘焙**：贴着沙滩最强，外圈几乎归零。否则就是一圈贴纸。
3. **径向抖动 + 每顶点噪声**：外缘被撕开，不然浪的外边界是一条尺子画的直线。

### 动态海面怎么做的（`makeOceanWaves`）

不新写 water shader，而是 `onBeforeCompile` 往 `MeshStandardMaterial` 里塞两行位移——这样**阴影、雾、色调映射全部保留**：

```glsl
transformed.z += (sin(x*0.46 + ph) * cos(y*0.38 - ph*0.75) * 0.65
                + sin((x+y)*0.21 - ph*0.5) * 0.35) * uAmp;   // uAmp = 0.04
```

两串斜交的正弦、同一个周期 **8.0s**（从参考片测出的 0.125 Hz）、幅度 3.4cm —— 就是原文说的 "not too distractive"。

只做位移是看不见的：平面没有明暗变化。所以同时把**法线**按位移的解析梯度倾斜一点，水面上才出现缓慢游动的高光——参考片里那点"活气"就来自这里。

校准方式：在 `?readback=1` 下用 `gl.readPixels` 采 8 秒，水面亮度标准差从 1.2/255（初版）调到 **0.72/255**，与参考片测到的 0.3–0.8/255 同量级。

### 顺带确认的一件事

片子 2 里那片**线框**不是随便开的调试：线框正好落在**岸带的网格**和**海面网格**上。也就是说他给我们看的就是"水这块几何长什么样"。`engine/world.html` 按 `W` 复现这个视角（海面 + 岸带切 wireframe），可以直接对照。

---

### 2024-10-25 两条：重叠浪 + 平滑外推岸线

```
1849730611964973481  "Instead of trying to make the waves roll in and out inside one shader pass,
                      I'm creating loads of overlapping waves that each go through their own cycle"
1849732997945110651  "shoreline shown in yellow. A pushed out and smoothed shoreline in blue.
                      The waves travel from the blue line to the yellow (and back a little)"
```

第一条改**着色器**：现在一次并算 3 个周期（相位错开 1/3），浪峰互相穿过，而不是整条带子一起脉动。
第二条改**几何**，而且是关键的一条：浪带不是逐格四边形，而是

```
边界边 → 串成闭合环 → Chaikin 平滑两遍（这就是"smoothed"）→ 沿法线外推（这就是"pushed out"）
→ 两条环之间生成缎带 → 浪在缎带里从外环跑向内环
```

逐格四边形（我最早的版本）内缘是扇贝形的、面与面之间有硬折角，看起来像一排白瓷片；
换成缎带之后内缘是连续曲线，浪才能顺。

### 2024-01-29：逆光边缘

```
1751945034851570056  "adding another inverted mesh outline layer that shows up when looking into
                      the sun. And masked by shadows, of course."
```

`engine/backlit.js`：复制地形几何、沿法线外扩一点、只画背面（inverted hull）。
外壳在物体**后面**，深度测试会自动把它挡掉，只剩轮廓一圈——正好就是那条亮边。
判据是「相机是否朝着太阳看」：`dot(表面→相机, 太阳方向) < 0` 才亮。
（第一版把这个符号写反了，外壳一直不出现。）

已知差距：原文说"masked by shadows"，这里用深度遮挡近似，阴影贴图的遮罩没做。

---

### 2022-06-02：距离场式岸裙

```
1664566546683899905  "Here's a distance field-like mesh skirt solution very similar to
                      Townscaper and Bad North. It works for calm waters I guess..."
```

之前那版浪带是"沿法线固定外推"：在内湾里两条法线会交叉，带子自我折叠，泡沫被掐住。
改成距离场之后没有这个失效模式——每一圈都在**真实距离**上，所以内湾自然变宽、岬角自然收紧。

```js
// shorefield.js
栅格化陆地（逐样本测真实四边形，不是刷格子的包围盒）
  → 两遍 chamfer 距离变换（3-4 度量）
  → march(x, z, nx, nz, target)：沿法线走到场值等于 target 的位置
```

`waves.js` 的每一圈因此从 `a + n * width * t` 变成 `a + n * march(..., width * t)`。

### 2024-03-18：河流

```
1769691526924292506  "special cased the rivers by collapsing them depth-first to let them
                      wiggle real far, and then the rest is collapsed breadth-first,
                      making nice gentle slopes that only occasionally meet steep cliffs"
```

`rivers.js`：从高点起，用**带回溯的深度优先**沿地形往下走，每一步只在下降、平走、最多上升一层里选，
走不动就回退换一条支流——这正是"让它绕远"的来源。贪心版本（每次选最陡的下坡）走了四格就卡死，
换回退之后同一条河能拉到 20 格以上。

河道按单调下降的河床开挖，两侧邻居压低一层形成 V 形剖面。

**一个我踩过的误解**：把"breadth-first collapse"理解成"广度优先把地形压平"，结果整座岛被削掉三分之一
（三角面从 24,190 掉到 18,338）。原话说的是**网格层级坍缩**（LOD），不是高度压平。现在只做河岸剖面。

---

## 二、代码地图

```
engine/
├── waves.js       岸边浪（闭合环 → Chaikin 平滑 → 按距离场放环 → 缎带；3 个周期并发）+ 动态海面
├── shorefield.js  岸线距离场：栅格化陆地 + chamfer 变换 + 沿法线定位
├── rivers.js      河流：带回溯的深搜开凿 + 河岸 V 形剖面
├── backlit.js     逆光边缘：反向外壳，只在朝太阳看时出现
├── watervol.js    水面体积：7 层水平切片（替代翻转网格反射）
├── relax.js       蘑菇化修正：按高度设目标面积，让格子收缩
├── birds.js       小鸟：停驻/飞行两套几何 + InstancedMesh，射线实测落点；index 与 world 共用
├── reflection.js  平涂中间色倒影：镜像几何 + 无光照单色，颜色取建筑与海的中间调
├── snapshot.js    64² 岛快照：正交 RT → 读像素 → unsharp 掩膜 → 3× 放大（S 键）
├── outline.js     边缘通道：颜色 + 法线 + 深度 → Sobel → 深色墨线 / 暖色亮边
├── roofs.js       陡坡双坡顶、瓦垄、白山墙、尖塔；含整栋小房子（墙身+勒脚+窗）
├── mesa.js        台地岛：阈值化高度场 → 台地 → 塔柱 → 峡谷 → 洞窟 → 上色 → 放房子
├── world.html     组装：光照、水面、屋顶、描边、环绕相机、D 键切制图稿
├── terrain.js     早期版本：噪声台地（规则网格），保留作对照
├── islands.js     Bad North 侧：高度场 + 材质 + 悬崖裙边 + A*
└── noise.js       value noise / fbm / ridged / 域扭曲
```

跑起来：

```bash
./start.sh
# 台地岛（片 1/2/3 的还原）：http://localhost:8765/engine/world.html
#   R 换岛   D 切制图稿   W 线框（看浪的网格）   S 岛快照   拖动旋转   滚轮缩放
# 规则网格岛屿（Bad North 侧）：http://localhost:8765/engine/demo.html
# 四边形网格地形：              http://localhost:8765/engine/terrain.html
```

---

## 三、台地岛怎么生成（`mesa.js`）

1. **高度场**：fbm + ridged + 域扭曲，再乘径向衰减 —— 和 `islands.js` 同源。
2. **阈值化**：`< 0.34` 直接是海，之上按 `pow(k, 0.62) * (levels/2)` 量化到**偶数层**。偶数层是关键：相邻两档至少差 2 层，崖壁才是垂直的而不是斜坡。
3. **塔柱**：随机撒几个圆心，把半径内的格子抬到更高一层，做出片子那种"平台之上再起石柱"的层次。
4. **去毛刺**：比四邻高/低 3 层以上的单格拉回来，跑两遍。
5. **峡谷**：用 ridged 噪声的**零交叉带**当河道，`< 0.24` 削到海面，`< 0.32` 削到 2 层 —— 这是把一整块饼切成几座 butte 的那一步。
6. **洞窟**：从临水的高格子出发，往里走 3 格，挖掉第 1~2 层。体素网格会自动给洞补一个暗色顶棚，所以看起来是洞，不是穿帮的空洞。
7. **上色**：墙永远是岩石色（不看色槽），**色槽只描述顶面**（沙 / 苔 / 碎石）。早期让色槽同时决定墙色，结果整面崖壁变成了竖条码。
8. **放房子**：挑四邻同高的平台格，间距 ≥1.9 格，随机 35% 长成两层 + 尖塔。

---

## 四、哪些是证据，哪些是推断

**证据（来自构建产物 `global-metadata.dat`）**
- `Placemaker.GridGenerator` 的 45 个方法（`HexToPlane` / `GetSubdivisions` / `relaxationSteps` / `GetQuad`）
- `Graphs.Qube.cornerValues` / `possibleModules`
- `ModuleBuilder.ApplyModule` / `BigMeshMaster` / `AoBaker`
- `VoxelType` 的 15 个色槽、`TextSaveSystem{bitArray, chars, bitsPerCharacter}`

**证据（来自参考片逐帧）**
- 面的构成、层理位置、亮边颜色（`#193a4a` 墨线、暖色调亮边）、配色（背景 `#295263`、石 `#637373`~`#a3a49d`、苔 `#7b7b52`、赭 `#b58452`）
- 屋顶形制：双坡、约 50°、白山墙、瓦垄、檐口外挑
- 洞窟位置：临水崖体的第 1~2 层

**推断（片子只能看到结果，看不到参数）**
- 屋顶按 region 而非按格生成
- 木构支撑的触发条件（底部悬空）
- 台地量化参数、峡谷阈值、洞窟深度
- 亮边是"法线朝上的边缘"这条规则 —— 也可以做成屏幕空间的后处理，我选了法线判据

推断项全部做成了可调参数，不写死：`levels` / `towers` / `caves` / `houses` / `slope` / `rows` / `glow`。

---

## 五、贴图与着色三件套（第 3 轮，`engine/world.html` 里 T/N/L 三个键）

| 模块 | 原文 | 做了什么 |
|---|---|---|
| `surface.js` | `1781405550061687016` + `1241096929490149376` | 地面投 XZ、崖面投竖面，按法线混合（"seamless patch blending"）；线宽由 `fwidth` 给出，恒为 1.35px（"UV 冲过每第 2 个像素"的解析等价物） |
| `normalsmooth.js` | `1062374549407350790` + `929417420921556993` | 地形网格顶点是按面拆开的，`computeVertexNormals()` 只能出平面法线；按**位置**空间哈希、一格半径内平均，再把差异过大的地方退回硬法线 |
| `vertexlight.js` | `1791049306213912823` | 24×24 高度图（r=格内最高列、g=最低列），顶点着色器**一次**采样，低于本地天际线就压暗 |

量化（`gl.readPixels`，seed 7，1000×700）：基线平均亮度 92.71 / 边缘能量 2.522；只开贴图 → 边缘 2.934（+16%）；只开法线 → 边缘 2.405（−5%）。三角面数 24,152 全程不变。

## 六、还没做的

| 片子里有 | 现在 |
|---|---|
| 浪打到沙滩会**卷起**（crest 有翻卷的厚度） | 只是一层带 alpha 的薄面 |
| 浪在礁石上的**溅射** | 没有 |
| 洞窟口是**拱形** | 方口 |
| 崖面有竖向裂纹 | 只有水平层理 |
| 水面有柔光的反射 | 没有（只有投影 + 浪圈） |
| 拱桥 / 楼梯 / 码头 | 没有 |

优先顺序：浪的翻卷 → 拱形洞窟口 → 水面反射。

---

## 六、第 4 轮（小鸟 / 平涂倒影 / 64² 快照）

| 帖子 | 原文关键句 | 落地 |
|---|---|---|
| `1244892370392489989` | "only has outlines when sitting" | `engine/birds.js`：16 只 InstancedMesh，停驻实例用暗色（读作轮廓），飞行实例近白 |
| `1215644531221311488` | "the bright colours wouldn't let me get away with a monochrome reflection, so I had to figure out this somewhat abstract flat coloured mid point" | `engine/reflection.js`：镜像 + 无光照 + 建筑平均色与海色中间调 |
| `911913981731885056` | "Saving island snapshots to 64² textures and then crisping them back up" | `engine/snapshot.js`：64² RT + CPU unsharp + 3× 放大 |

### 这一轮踩的四个坑

1. **`vertexColors: true` 把 instanceColor 吃掉**：几何没有顶点色属性时，渲染成纯黑。
   InstancedMesh 自己就会乘 `instanceColor`，不要开 `vertexColors`。
2. **停驻高度算错**：`town.top()` 是墙顶，房子还要加一层墙身 + 山墙，鸟全埋在屋顶里看不见。
   +0.72 之后才露出来。
3. **描边通道会把鸟染成橙色箭头**：小鸟的三角形法线朝上，命中"朝上的边用暖色"规则。
   给鸟标 `userData.overlayOnly = true`，排除出法线通道。
4. **倒影被不透明水面挡住**：水面原来是纯不透明平面，水下什么都不显示。
   改半透明 0.88 之后倒影才透得出来——这是"看起来该有却没有"的典型。

### 一条做不成、已撤回的

`1062374549407350790`（体素法线平滑）我在 `src/mesh.js` 里试过按位置平均法线：
0.58 时台地失去主光、整体发闷；0.30 时亮度回来了，但**每层墙各自是一段 quad**，
平均后层缝变成横向棱纹（瓦楞），比不平滑还难看。
参考片平滑的是焊接过的低模壳，我们的地形是逐层生成的四边形带，没有可跨的面。
`engine/normalsmooth.js` 用"一格半径 + 硬边 dot 衰减"解决了同一问题——那条路才对，
所以我把自己的按位置平均实现删掉了，不保留第二份弱答案。
