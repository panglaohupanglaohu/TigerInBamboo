# 第 56 批 · C01 组（Bad North 特效 A，14 条片子）

端口 8801。所有截图用 headless Chromium（SwiftShader）拍，放在 `artifacts/coverage/shots-r56/c01-*.png`，每张我都用 Read 打开看过。控制台没有 error，只有基线页本来就有的 `toNonIndexed` warning。

## 改动边界

### 新文件

| 文件 | 内容 |
|---|---|
| `src/badnorth/battle-c01.js` | Battle 扩展，15 个开关全部默认关 |
| `src/life/smoke-c01.js` | Smoke 外挂层。只包一层 `smoke.update`，smoke.js 本体没动 |
| `src/ui/game-portrait-c01.js` | 游戏内头像槽表和绘制表 |
| `tests/battle-c01.mjs` | node 测试 |
| `tests/smoke-c01.mjs` | node 测试 |
| `tests/smoke-c01-probe.js` | 浏览器探针，用 `shot.py --eval` 跑 |

### battle.js 挂钩

只加了 7 行挂钩，每处都先断言旧串只出现一次再替换：

1. import
2. 构造时 `this.c01 = new BattleC01(this)`
3. `start` 里调 `c01.start`
4. `stop` 里调 `c01.stop`
5. 下令后调 `c01.onMove`
6. 行军循环里加一行 `if (this.c01.on.column) ({tx,tz}=this.c01.steer(...))`
7. `#draw` 之后调 `c01.afterDraw`

C02 和 C03 的挂钩是同时加进来的，最后重读确认过，互不覆盖。

### 改动的页面

- `smoke.html`：加了三个复选框（大瓣 / 顶端断开 / 弥散薄雾）。smoke-c01 依赖 three，所以在场景 iframe 里 import。
- `ballistics.html`：Inspector 的 Settings 全部做成现场可改；新增「目标网格」画布。

### 开关

- URL：`index.html?scene=badnorth&c01=all`，或者逐项列 `&c01=squadHud,nodeNet,...`。
- 运行时：`rea.battle.c01.set(name, on)`。
- 15 个开关：`squadHud`、`plank`、`nodeNet`、`orderPillar`、`bloodAge`、`bloodStack`、`fireGlow`、`column`、`routePreview`、`shoreFoam`、`waterBlood`、`smokeShape`、`windTraces`、`raidBoxes`、`portraits`。

### 没碰的东西

REACode、REA-agent、learn/*、记账文件都没碰，没有跑 record-review，也没有 git 操作。

## 测试

- `node tests/battle-c01.mjs`：PASS。
  - 种子固定，连跑 13 次都通过。只有第一次跑（那时还没固定 Math.random）失败过一次。
  - 全关时验证旧行为：血迹材质颜色仍是 8e1f24，没有 instanceColor，也不生成任何对象。
- `node tests/smoke-c01.mjs`：PASS。装上外挂但全关时，实例矩阵与原 smoke.js 逐位相同。
- 全量 `tests/*.mjs` 278 个（8 路并行，每个 timeout 120s），**0 FAIL**。

## 逐条

### 839067977781768193 · 旗顶血量槽 + 击杀飘字 + 登陆跳板 — done

- **原文要点**：没有原文。
- **片子机制**：原尺寸回看 frame-0220。
  - 旗顶有一条细槽，绿 → 黄 → 红按存活比缩短；受击时左端闪红。
  - 击杀飘白色 "+10"。
  - 船靠岸后敌人走木跳板上岸。
  - 地上铺血泊，尸体留在原地，旗布轻摆。
- **原缺**：献血泊 / 尸体、木跳板、旗布摆动、接进 battle.js。
- **核实后已有**：+10 已经在第 60 轮并进伤害数字 Sprite 池，同队连杀按距离合并；血泊、尸体、旗布摆动（`#updateFlag`）都已有。
- **本轮做了什么**：
  - `squadHud`：每队一个 Sprite，用 squad-hud.js 的 `bannerBar` 出四块矩形。槽挂在 Bezier 旗面的上沿中点，跟着旗摆。存活比低于 0.7 变黄、低于 0.34 变红；队伍总血量一下降，就闪红 0.16s。
  - `plank`：船进入卸人状态后，从船头沿朝岸方向找第一处坡度 ≤40° 的地面，搭一块木板。
- **限制**：跳板只是视觉，维京人仍是 battle 原有的逐个瞬移上岸。
- **落点**：badnorth/battle-c01.js · squad-hud.js
- **测试**：tests/battle-c01.mjs
- **截图**：
  - `c01-fight.png`：槽右段露出深色槽底，闪红窗口内左端是红色。
  - `c01-plank.png`：木板从船头搭到岸台。

### 883447205176238083 · 动态节点图线网 — done

- **原文要点**：「A dynamic node graph help the fellas keep track of their mates and share local info」。
- **片子机制**：原尺寸回看 frame-0300。脚下的浅青线网就是**队友之间的连边**，形状是凹的，跟着人走；连边的端点处有小方块。旗顶有白菱形，箭是细白线。旧 note 里「凸包 + 辐条」的读法偏了。
- **原缺**：凹形占位、接入选中态、菱形、箭线。
- **本轮做了什么**：`nodeNet` 与 InfoGraph 同口径建边：同队、半径内（守军 0.42 / 维京 0.55）、高差 ≤0.3、`clearSegment` 视线通。每 0.1s 重建一次。走散就断、靠拢就连，所以线网天然是凹的。另外加了节点小方块、旗顶慢转白菱形、飞行中箭的白线（箭尾 0.22 到箭头）。
- **落点**：battle-c01.js（info-graph.js 同规则）
- **测试**：tests/battle-c01.mjs。测试里边数 >5，另有纯函数 `graphEdges` 的半径 / 视线断言。
- **截图**：`c01-march-4s.png`、`c01-fight.png`

### 837027901853810688 · 夜间烧村 — done（黄条含义是推断的）

- **原文要点**：帖子没有文字。
- **片子机制**：原尺寸回看 frame-0360。
  - 黑烟球。
  - 火光照亮房子和地面。
  - 血迹新鲜时鲜红、旧的暗红，随时间变淡。
  - 一根亮黄竖条立在某队旗顶上，大约 18 帧（0.6s）后消失。
- **原缺**：烟球体积和火光照明的联动、血迹淡出、黄条标记。
- **本轮做了什么**：
  - `fireGlow`：烧毁的小屋放一个闪烁的橙色 PointLight，地形是 MeshStandard，所以真的会被照亮；再加一张贴地的径向软光晕。
  - `bloodAge`：给血迹加逐实例颜色 + 透明度。前 3s 从 #c8262e 过渡到 #8e1f24，25s 后在 20s 内淡到 0.45。
  - `smokeShape`：大瓣 + 顶端断开 + 薄雾，见 1015142746372366336。
  - `orderPillar`：下令后在该队旗顶立 0.6s 的黄竖条 + 细引线。
- **判定说明**：黄条按「下令确认」实现，这是从它的位置（在旗顶）和时长推断的，原片没有字幕能证实。
- **落点**：battle-c01.js · life/smoke-c01.js
- **测试**：tests/battle-c01.mjs、tests/smoke-c01.mjs
- **截图**：
  - `c01-fire-on.png` 对比 `c01-fire-off.png`：黄昏时房子和地面被橙光照亮。
  - `c01-march.png`：黄竖条。
  - `c01-fight.png`：鲜红和暗红的血。

### 816743289500106752 · 成列行军 + 方块集结 — done

- **原文要点**：「3 groups of 100 soldiers being ordered around… flow fields」。
- **片子机制**：原尺寸回看 frame-0120。整队拉成一条长蛇沿路径走，跨台阶时变成竖列，到达后收成 3–4 排方块；路径上有白色引导点。
- **原缺**：成列行军、跨层列队、到达后集结落位，三项都没有。
- **本轮做了什么**：`column` 开关。
  - **排队**：下令时按「到目标的树距离」给队员排序。每人的路线距离 = 下一节点的树距离 + 自己到下一节点的直线距离。前一个人还在走或在排队、而且领先不到 0.15 时，后一个原地等；前一个卡住或在打架时不等，所以不会死锁。
  - **跨层**：大家共用同一棵树走，跨台阶时自然变成竖列。
  - **集结**：到达后用 `blockSlot` 排方块，至少 4 列（100 人时 3–4 排），朝向等于行军方向。
  - **引导点**：由 `routePreview` 提供。
- **对照（同岛、同目标）**：
  - 行军时最大展开：开 1.04，关 0.61（关时是各自奔向目标格）。
  - 到达后最近邻间距 0.12–0.13，与槽距一致；队形中心离目标格心 0.03。
- **限制**：本岛小队是 8 人，不是 100 人；纯函数单独验证了 100 人是 3–4 排。同一个岛上 column 关时也有 2 人卡在窄口，这是旧导航的行为，不是本组引入的。
- **落点**：battle-c01.js（steer / blockSlot）
- **测试**：tests/battle-c01.mjs
- **截图**：`c01-march-4s.png`（单列长蛇 + 线网 + 路线点）

### 1015142746372366336 · 两遍烟：大瓣 / 顶端断开 / 弥散薄雾 — done

- **原文要点**：烟分两遍画，第一遍黑、底部满 alpha；第二遍更亮更透，阈值往里收 1px，形成清晰轮廓。
- **片子机制**：原尺寸回看 frame-0150。柱身由 6–7 个直径约等于柱宽的大瓣组成，柱顶之后断开、另有一团独立烟，两柱之间有一层低对比的薄雾。
- **原缺**：上面三条都没有。
- **本轮做了什么**：`smoke-c01.js` 包住 `smoke.update`，按 drawOrder 逐实例改缩放。
  - 大瓣：每 3 片丢 1 片，留下的放大 1.32 倍。
  - 断开：每 3.6s 留出 1.2s 的发射空档。
  - 薄雾：较老的烟团再画一张 2.4 倍大、alpha ≤0.13 的软圆卡，先于两遍烟画。
  - smoke.html 三个复选框可开关；Battle 用 `smokeShape` 开关。
- **浏览器探针**（同机位离屏渲染，计数口径同 smoke-lobes-browser.cjs）：

  | 指标 | 关 | 开 |
  |---|---|---|
  | 凸起（瓣数） | 8 | 6（原片 6–7） |
  | 断开 bin 数 | 0 | 1 |
  | 薄雾像素 | 3688 | 5676 |

  node 测试量的可见片最大竖向空隙：开 0.39，关 0.19。
- **落点**：life/smoke-c01.js · smoke.html
- **测试**：tests/smoke-c01.mjs、tests/smoke-c01-probe.js
- **截图**：`c01-smoke-shape.png`（左关右开对照）

### 1010979395719319552 · 游戏内头像 — done（程序化替代）

- **原文要点**：「A selection of the many handsome faces」。
- **片子机制**：原尺寸回看 frame-0050。切角卡、多色底、背后有队友剪影，装备有头盔 / 护鼻 / 锁甲兜帽 / 布兜帽，另有胡子。
- **原缺**：原素材、完整装备层级、接入游戏。
- **本轮做了什么**：
  - `game-portrait-c01.js`：用同一个 `sampleSlots` / `drawSlotPortrait` 走表器，只换一张 GAME_SLOTS 表（bg 4 色 + 队友剪影、beard、gear 5 种、frame 切角）。锁甲用逐格小弧做环纹，脸部开椭圆窗。
  - `portraits` 开关：每支守军底部一张卡，卡下是血量条，全灭后变灰。
- **限制**：原作素材拿不到，全部是本地矢量替代，脸型和线条风格与原作不同。这不影响机制复现。
- **落点**：ui/game-portrait-c01.js · battle-c01.js
- **测试**：tests/battle-c01.mjs（卡数、`frame='cut'`、带 gear、血量比）
- **截图**：`c01-portraits.png`（12 个种子 + 战斗底栏 3 张卡）、`c01-fight.png`

### 958371606350454784 · 早期头像生成器 — done

- **原文要点**：只有 5 个示例，「content agnostic and should support a diverse set of inputs」。
- **片子机制**：原尺寸回看 frame-0040。蓝底单脸，脸形、发型、雀斑、粉鼻子组合变化。
- **原缺**：完整 spec、数据接口、剪影 IoU。
- **核实**：note 已过时。r55 已有 PORTRAIT_SLOTS、`sampleSlots`、`portraitSilhouette` / `silhouetteDiversity`、slot-portrait.js 走表器，ui.html 有「槽位表头像」。
- **本轮做了什么**：用 game-portrait-c01 证明「内容无关」：同一走表器换一张表就画出完全不同的内容，走表逻辑零改动。
- **落点**：core/part-random.js · ui/slot-portrait.js · ui/game-portrait-c01.js · ui.html
- **测试**：tests/part-random.mjs、tests/slot-portrait-ui.mjs（全量里 PASS）、tests/battle-c01.mjs
- **截图**：`c01-ui-portraits.png`（与原片蓝底单脸对照一致）、`c01-portraits.png`

### 999185422403055616 · 血迹两套 UV 空间 — partial（本轮未改码）

- **原文要点**：用 skin UV 的 fwidth 在 sprite-space 和 skin-space 之间插值。肚子上用 sprite-space（skin UV 静止的地方），脸上的血跟着头动。
- **片子机制**：原尺寸回看 frame-0096 的棋盘调试图：身体是一套格子，盔和剑是另一套。
- **仍缺**：
  - 本仓只有物体空间一套。
  - 没有按 fwidth(skinUV) 混合的 sprite-space。
  - 血斑是整面块状。
- **本轮**：时间留给了其余 13 条，只做了实核，没有改码。

### 995043346778415104 · 移动路线预览 — done

- **原文要点**：「The pathfinding in some levels does get a bit convoluted」。
- **片子机制**：原尺寸回看 frame-0035。白点串沿台地走，折角是圆角，下崖处往下落。
- **原缺**：#drawPath 没接入；预览是会淡出的一次性点串。
- **本轮做了什么**：`routePreview` 在下令时用 route-preview.js 的 `buildRoutePreview`（落崖弧 → 圆角 → 等距点）替换 battle 原来的点串。小队走完前一直保留，领头人走过的点逐段消掉，走完再交回 battle 原有的淡出。
- **实测**：
  - node：91 点、圆角 16。
  - 浏览器：159 点、圆角 28、已消 12。
  - 下令 3s 后点串仍在。
- **限制**：本岛路线全走楼梯，所以运行时落崖弧数是 0。落崖弧本身由 route-preview.mjs 覆盖。
- **落点**：battle-c01.js · core/route-preview.js
- **测试**：tests/battle-c01.mjs、tests/route-preview.mjs
- **截图**：`c01-march.png`、`c01-march-4s.png`

### 987267068495003648 · Inspector 现场调弹道表 — done

- **原文要点**：用 inspector expressions 现场调弹道查表的 cost function。
- **片子机制**：原尺寸回看 frame-0300。Inspector 里有 Cost / Valid 表达式和 Min/Max Speed、Drag、Gravity、Max Valid Radius；左边是格点目标场，每个格点画最优青色弧 + 白色落点方向线。
- **核实**：note 已过时。G5 已有 Cost / Valid 表达式白名单、阻力烘表、Battle 实际用表。
- **本轮做了什么**：ballistics.html 补齐 Min/Max Speed、Gravity、Max Valid Radius，改任意一项都会 120ms 去抖后重烘；新增「目标网格」：91 个格点，各画最优弧 + 白色落点方向线，不合法的格点只剩灰点。
- **实测**：按原片参数改完（`minDist < 0.2`，drag 2，speed 2–12，g 9.8，r 5.5）：
  - 合法目标从 82/91 变成 60/91，最远射程从 7.97 变成 5.40。
  - 点「应用」后 Battle 实际用的就是这张表（`projectileTable === expr table`，drag=2）。
- **限制**：Start Offset 参数没有暴露。
- **落点**：ballistics.html · core/ballistic-table.js
- **测试**：tests/ballistic-expression.mjs、tests/ballistic-table.mjs
- **截图**：`c01-ballistics-field.png`（与原片格点 + 青弧 + 白线一致）

### 984813819280191488 · 浸血 = 血量、僵直、血迹堆厚 — done

- **原文要点**：「Blood soaking as a health indicator… a proper stun state」。
- **片子机制**：原尺寸回看 frame-0400。浸血和僵直都已有；剩下的缺口是同一处反复流血时变暗（旧 review 的「观察」和「判定」两段互相矛盾，按缺口实现）。
- **本轮做了什么**：`bloodStack`：新地面血斑落在旧斑 0.09 半径内时，旧斑叠一层，每层暗 12%、浓 8%，最多 4 层。
- **实测**：浏览器里一场混战 stacked 273、maxStack 4。
- **截图对照**：`c01-fight.png` 是鲜红外缘 + 暗红厚芯，和 837027 frame-0360 的血一致。
- **限制**：盾面的法向拖尾仍没做。
- **落点**：battle-c01.js
- **测试**：tests/battle-c01.mjs（`bloodLook` 纯函数 + 真实战斗 stacked>0）
- **截图**：`c01-fight.png`

### 974325184525201409 · 维京登陆规划器 — done

- **原文要点**：自己写了 box-box 测试，「Behold, our beautiful viking raid planner」。
- **片子机制**：原尺寸回看 frame-0250。按船着色的线框长盒从岛向外辐射，每条是一条航道；岛周围是候选盒。
- **核实**：note 已过时。第 53 批已有：SAT 泊位盒、整条直线走廊预留、航道压礁检测、车道 × ±0.35 角。
- **本轮做了什么**：`raidBoxes` 把这套判定画出来。每条船画泊位盒 + 14 单位的进场走廊盒，按船着色；下一波候选用同一套判定，被拒的画暗红，可用的画白。
- **实测**：4 条船时，可用 113、被拒 79。
- **限制**：按到达时间的动态避让仍没做，片子也没展示这一项。
- **落点**：battle-c01.js · badnorth/landing-plan.js · core/obb.js
- **测试**：tests/battle-c01.mjs、tests/landing-plan.mjs、tests/obb-policy.mjs
- **截图**：`c01-raid-boxes.png`

### 946660607008403456 · 船血 / 尸体 / 箭粘船 + 小花 — done

- **原文要点**：「making blood, corpses and arrows stick to boats and adding pretty little flowers」。
- **片子机制**：原尺寸回看 frame-0150。船里整舱浸透；水面上有粉红血雾；沿岸有白泡沫带和白点；草地上有白 / 粉小花。
- **原缺**：岸外白泡沫带、白花簇。
- **核实后已有**：船舱浸透、粘船都已有（第 54 轮）。
- **本轮做了什么**：
  - `shoreFoam`：沿海岸格边外 0.05 拉一条白带。顶点法线取相邻边法线的平均（斜接），所以带子连续、不在角上交叉；shader 里沿法线 ±0.035 呼吸。外侧再撒碎白点。平地格按种子长 4–7 朵白 / 浅粉花簇。
  - `waterBlood`：落在水里的血生成粉红血雾，6s 内铺开、随风漂、14s 淡出；同一片水里继续流血时，那团雾变大，不另起一团。
- **实测**：浏览器里海岸边 114 条、花 116 朵、泡沫点 342 个。
- **限制**：泡沫带沿的是**格边界**；渲染出来的崖体有形变，个别位置离崖脚有一点空隙。
- **落点**：battle-c01.js
- **测试**：tests/battle-c01.mjs（泡沫朝外、全落在水里；花数；血雾）
- **截图**：`c01-landing.png`

### 926903893866541057 · 风矢量 — done

- **原文要点**：「Here is what my wind vectors look like. They can be used by all kinds of systems, including shaders」。
- **片子机制**：原尺寸回看 frame-0250。俯视看：岛外是一片白色矢量，近崖处偏转；岛边有红色风粒子轨迹。
- **核实**：note 已过时。wind-flow.js 已有 `traceWind`、`sampleCurve`、`packWindField` + `windFieldGLSL`（view-post-extras 里 GPU 采样），Atmosphere 有矢量箭头。
- **本轮做了什么**：
  - `windTraces`：在岛外一圈、贴岸 / 崖脚、台地上方三处播种，用 `atmosphere.trace` 积分（共享风场 + World 体素滑移），画红色轨迹，每 2s 重算一次。
  - 实测风场偏转（本仓自有采样口径）：`y=0.6L` 时 p95 9.3°、最大 60.5°；`y=1.4L` 时最大 70°。
- **限制**：原作的精确解算器无法从画面恢复（沿用旧结论）。
- **落点**：battle-c01.js · life/atmosphere.js · core/wind-flow.js
- **测试**：tests/wind-flow.mjs、tests/battle-c01.mjs
- **截图**：`c01-wind-traces.png`（白矢量 + 贴崖弯折的红轨迹）
