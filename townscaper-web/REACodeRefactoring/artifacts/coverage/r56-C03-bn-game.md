# 第 56 批 C03 · Bad North 玩法 / 展示 / 工具（16 条）

端口 8803。所有截图在 `artifacts/coverage/shots-r56/`，都用 Read 打开看过并与联系表/原尺寸帧对照；控制台零 error（只有基线页同款 `toNonIndexed` 警告）。

## 改动边界

- 新文件：`src/badnorth/battle-c03.js`（8 个开关：kpow / houseFx / torches / plunge / confirm / distIso / tierUp / flair，全部默认关，URL `=1` 或 `battle.c03.set(name,on)`）、`src/core/swarm-maze.js`、`swarm-maze.html`、`src/life/crab-swarm.js`、`src/build/multitile-world.js`；测试 `tests/c03-*.mjs` 5 个；每条片子 `artifacts/coverage/<id>-r56.md`。
- `src/badnorth/battle.js` 只加 7 行挂钩（import、构造、start、stop、onPointer 最前、单位循环 stepStun 后、#draw 之后的 afterDraw），每处 python 断言旧串唯一后替换；C01/C02 的挂钩未动。
- `src/world/app.js` 加 2 行可选挂钩（`?crabs=1`、`?multitile=<种子>`），照 `?propanim` 先例。
- 共享模块：`core/trajectory-fan.js` 只新增导出（旧函数不变）；`badnorth/theme.js` 新增 winter 配色 + `frostVegetation`（只在 winter 时生效、换季还原）；`trajectory-fan.html` 默认显示查找表点阵（旧切线口径保留为开关）。
- 没碰 view.js / worldmesh.js / index.html / REACode / learn/* / 记账文件；没 git 操作。

## 测试

- 新增：tests/c03-battle.mjs、c03-trajectory-grid.mjs、c03-swarm-maze.mjs、c03-crab-swarm.mjs、c03-multitile-world.mjs 全过。
- 全量 `tests/*.mjs` 284 个（8 路并行）全部通过，无 FAIL。

## 逐条

### 816332161036984320

| 原文要点 | PRO TIP: Avoid your ballistics homework by making a lookup table |
|---|---|
| 片子机制 | Unity Trajectory Calculator：原尺寸 frame-0040 复看，白线落在**规则点阵**上，每格点一根 = 打中该格点的出射方向；右上够不着的格点只剩白点；青色扇面是陪衬；Inspector 第三行是 Gravity。 |
| 原缺 | 旧版把白线当成弧上等弧长切线（误读），缺查找表本身与 Gravity 参数；碰撞截断不属于本片（片中无障碍物）。 |
| 本轮做了什么 | core/trajectory-fan.js 新增 heightAtX / solveLaunch（线性阻力下低弧出射角：−89°→89° 扫描 + 二分）/ launchGrid（点阵查找表 + lookup 双线性查表）；trajectory-fan.html 原点移到左侧中线，加 Gravity 滑杆、默认显示查找表点阵（每格点白点 + 出射方向短线，够不着只剩点），旧切线口径保留为开关。 |
| 判定 | **done** |
| 落点 | src/core/trajectory-fan.js · trajectory-fan.html |
| 测试 | tests/c03-trajectory-grid.mjs · tests/trajectory-fan.mjs |
| 截图 | shots-r56/816332161036984320-grid.png |
| 对照 | 截图与 frame-0040 一致：左列竖线（原点正上方 90°/正下方 −90°）、原点右侧近水平、下半区斜向下、右上角够不着只剩白点；Drag/Gravity 增大可达格点减少（195→123→84）。 |

### 810157485638189056

| 原文要点 | Trying out fluid pathfinding on a triangle graph. Making it up as I go along. |
|---|---|
| 片子机制 | 俯视棕色粗走廊迷宫（圆头端点、环路、分叉），一团暗红点像液体一样沿走廊流向 gizmo 拖动的目标，换目标整团立即改道，窄口收束、开阔处摊开。 |
| 原缺 | 旧 note 误判为「路线采样编辑器」；真正的三角图流体寻路没有演示。 |
| 本轮做了什么 | 新建 core/swarm-maze.js（随机格点生成树 + 环边 + 圆头端头的胶囊并集迷宫 → 掩码三角剖分成三角图，保留最大连通块）；流场与群体完全复用共享 world/navmesh-flow.js（顶点距离场、共边带流向、分离、约束回面）。新页 swarm-maze.html：三色 gizmo 可拖、三角线框开关、换种子。 |
| 判定 | **done** |
| 落点 | src/core/swarm-maze.js · src/world/navmesh-flow.js · swarm-maze.html |
| 测试 | tests/c03-swarm-maze.mjs |
| 截图 | shots-r56/810157485638189056-swarm.png |
| 对照 | 截图：棕色圆头走廊迷宫、180 个暗红点成股流动、三轴 gizmo 目标，出图 0；与 sheet-02 的画面结构一致（原片三角图线框较淡，这里可开关）。 |

### 1092709665199345664

| 原文要点 | k-pow !! |
|---|---|
| 片子机制 | 斜俯视崖台：崖脚一次性爆炸（白点→亮黄白火球 2–3 帧膨胀再收缩变暗）+ 正下方红色焦痕贴片 + 橙色火星 + 持续黑烟；崖顶红底白字「k-pow !!」横幅；约 3.5 s 一次循环。 |
| 原缺 | 缺 explodeAt 时序编排与焦痕贴片，未运行验收。 |
| 本轮做了什么 | battle-c03.js explodeAt(p,{r,scorch,sparks,smoke,glow})：火球内核 + 外辉光两层球（0–0.16 寿命膨胀、之后收缩并白→黄→橙→暗红淡出）、焦痕圆片（半透明红 2 s 内变焦黑并留下）、火星点（上抛+重力）、黑烟源（接共享 life/smoke.js，带寿命自动撤）；kpow 开关：崖顶红底白字带锯齿「k-pow !!」横幅 + 每 3.5 s 在岸边格炸一次。 |
| 判定 | **done** |
| 落点 | src/badnorth/battle-c03.js · battle.js（挂钩）· ?kpow=1 |
| 测试 | tests/c03-battle.mjs |
| 截图 | shots-r56/1092709665199345664-kpow.png |
| 对照 | 截图：崖脚火球（白芯橙辉）+ 下方红焦痕 + 前一次爆炸留下的黑烟团 + 崖顶横幅；与 frame-0085/0310 机制一致。横幅贴图为程序化，非原美术。 |

### 1024679338292256769

| 原文要点 | Some UI flair |
|---|---|
| 片子机制 | 灰底上中央青绿徽章 → Ring of Command 标题 → 外围对称卷草/小点逐步展开；收起时中央先退、外围尾迹最后消失。 |
| 原缺 | 共享 SDF 纹饰与本地两轨时序已有（ornament.html），缺游戏内触发。 |
| 本轮做了什么 | battle-c03.js showFlair(title)：用共享 core/ui-reveal.js 两轨时序在 2D 画布上画中央徽章 + 标题与左右对称卷草/小点（卷草按 ornament 进度从中心往外画出），UI 时序走墙钟；flair 开关：守住一波 / 升级时弹出（升级时标题 Ring of Command）。 |
| 判定 | **done** |
| 落点 | src/core/ui-reveal.js · src/badnorth/battle-c03.js · ?flair=1 |
| 测试 | tests/c03-battle.mjs |
| 截图 | shots-r56/1024679338292256769-flair.png |
| 对照 | 截图：战场上方青绿圆徽章 + Ring of Command + 两侧卷草与小点；测试验证中央先显先退、外纹后展后退。徽章/卷草是程序化图形，非原图稿。 |

### 1016680972610359298

| 原文要点 | This is what the confirm popup looks like: |
|---|---|
| 片子机制 | 选中旗队后点目标：空地出单个 Move 确认；目标处有别的队时出 Select / Move / Swap 三项横排；确认后才移动。 |
| 原缺 | 本地 ui.html 有横排布局，未接游戏指令（单 Move、地面标记、Swap 语义）。 |
| 本轮做了什么 | battle-c03.js confirm：battle.onPointer 最前一行挂钩；选中小队后点地面先开弹窗（屏幕投影定位、地面白色六边形标记、慢动作保持），空地 = 单个 Move；点到别队/别队阵地 = Select / Move / Swap。Move 重放原下令路径（plan 校验/虚线/G3 标记）；Swap 两队互换阵地；Select 改选那一队。 |
| 判定 | **done** |
| 落点 | src/badnorth/battle-c03.js · battle.js（onPointer 挂钩）· ?confirm=1 |
| 测试 | tests/c03-battle.mjs |
| 截图 | shots-r56/1016680972610359298-confirm-swap.png · shots-r56/1016680972610359298-confirm-single.png |
| 对照 | 两张截图分别对上 frame-0125/0142 的 Select/Move/Swap 横排（橙蓝橙）与 0063 的单 Move 确认 + 目标格标记。按钮为 DOM 程序化样式。 |

### 1007587828992266240

| 原文要点 | （帖子无文字说明） |
|---|---|
| 片子机制 | 白垩崖岛上两队混战，小屋/崖缘着火、焦痕，紫色旗标，相机绕岛。 |
| 原缺 | 仅判读，未做运行时对齐；缺小屋烧毁后的焦痕/焦黑。 |
| 本轮做了什么 | houseFx（同 828984794407170048）给失守小屋补屋下 + 门口焦痕、火球、屋体焦黑与持续黑烟；加 torches 让维京人真的去点火。快进 35 s 真实战斗截图对照。 |
| 判定 | **done** |
| 落点 | src/badnorth/battle.js · src/badnorth/battle-c03.js · src/life/effects.js · ?houseFx=1&torches=1&standards=1 |
| 测试 | tests/c03-battle.mjs |
| 截图 | shots-r56/1007587828992266240-battle-fire.png |
| 对照 | 截图：两座焦黑冒烟的小屋、焦痕、竖旗、长船登陆中；单位团与原片同为远景色块。原片紫旗/白垩配色属美术，未复刻。 |

### 995034777756536833

| 原文要点 | （帖子无文字说明） |
|---|---|
| 片子机制 | 等距绕岛战斗：血迹贴花累积、队旗、箭；顶部黑条「No valid targets」，底部三颗圆形能力键（紫色 Plunge 带冷却环）；之后队伍跃落敌群，地面白色冲击圈。 |
| 原缺 | 能力系统（Plunge、冷却环、No valid targets）没有。 |
| 本轮做了什么 | battle-c03.js plunge：底部三颗圆形能力键（Plunge 可用，Volley/Brace 占位置灰），SVG 冷却环；castPlunge 先做目标校验（目标点 0.6 内无敌人或超出 3.6 射程 → 顶部黑条 No valid targets，不进冷却）；通过则全队抛物线跃起落到目标（单位循环一行挂钩接管跃起中的单位）、落地白色冲击环 + 范围内敌人走 battle #hit（扣血/击退/喷血）、10 s 冷却。 |
| 判定 | **done** |
| 落点 | src/badnorth/battle-c03.js · battle.js（单位循环挂钩）· ?plunge=1 |
| 测试 | tests/c03-battle.mjs |
| 截图 | shots-r56/995034777756536833-plunge-land.png · shots-r56/995034777756536833-plunge-air.png |
| 对照 | 截图：顶部黑条 No valid targets、底部 Plunge/Volley/Brace 三键、落点一圈白环 + 伤害飘字 +8/+10/+4 + 血。键面图标为程序化。 |

### 943230620242796544

| 原文要点 | I'm heading north … seasonally relevant hype material for @BadNorthGame |
|---|---|
| 片子机制 | 0–209 安静雪岛（白台面、白霜树、细雪），210 硬切到满船围岸 + 蓝队旗帜 + 血迹黑烟的战斗。剪辑切换不是积雪增长算法。 |
| 原缺 | 完整冬景（台面/屋顶/植被覆盖）与船群战斗组合未实现验收。 |
| 本轮做了什么 | badnorth/theme.js 新增 winter 配色（帧 0250 取色：近白台面与屋顶、紫灰崖、灰蓝海、白岸线）+ frostVegetation（给带 emissive 的树冠/灌木材质加冷白自发光，换季还原）；与既有「飘雪与表面积雪」+ 真实 Battle 快进 13 波组合。 |
| 判定 | **done** |
| 落点 | src/badnorth/theme.js · src/world/view.js（既有积雪）· src/badnorth/battle.js |
| 测试 | tests/c03-battle.mjs |
| 截图 | shots-r56/943230620242796544-winter-battle.png |
| 对照 | 截图：雪白台面/屋顶、白霜树、紫灰崖、细雪、9 条长船围岛、焦黑冒烟小屋与血迹——对应 210 之后的战斗景观。草丛 ShaderMaterial 仍保留原色（橙/绿小簇），与原片白色灌木有差。 |

### 902103473365417984

| 原文要点 | Ok, one more visualization. Distances this time. |
|---|---|
| 片子机制 | 岛上铺满等距亮线：在台面上嵌套闭环、绕过小屋，并沿崖壁爬升（三维）。 |
| 原缺 | 只有 2D 格距离场 + marching squares 页；缺三维台阶投影、battle 调试接入。 |
| 本轮做了什么 | battle-c03.js isoLinesOnMesh：渲染网格（三角汤）按位置焊接 → 沿三角边从海平面顶点多源 Dijkstra（表面测地距离，含崖壁）→ marching triangles 抽等距等值线，沿面法线外推防 z-fight；distIso 开关在 Battle 里显示（世界重建自动重算）。 |
| 判定 | **done** |
| 落点 | src/badnorth/battle-c03.js · src/core/distance-isolines.js（2D 版保留）· ?distIso=1 |
| 测试 | tests/c03-battle.mjs · tests/distance-isolines.mjs |
| 截图 | shots-r56/902103473365417984-iso.png |
| 对照 | 截图：30 级、4448 段，其中 2052 段在近竖直面上——线在台面上成嵌套环、绕过小屋、沿崖壁一圈圈爬上去，与 frame-0300 一致。原片线更稀，本地间距 0.22 可调。 |

### 821680056514781186

| 原文要点 | By popular demand: Revenge of the Blues! |
|---|---|
| 片子机制 | 蓝橙两队下行接敌、血与倒地、分离再战、蓝队幸存。 |
| 原缺 | 旧记为仅学习（不能认证软影高度/坡面）。 |
| 本轮做了什么 | 核对现状：第 55 批 G3 已有影子贴合形变地面（shadowFit）、扫掠/盾推（meleeFx），本仓 Battle 有登陆、接敌、血泊、尸体、击退落崖。本轮只做真实 Battle 快进 28 s 实景对照截图。 |
| 判定 | **done** |
| 落点 | src/badnorth/battle.js · src/badnorth/battle-g3.js · ?shadowFit=1&meleeFx=1 |
| 测试 | tests/battle-g3.mjs · tests/c03-battle.mjs |
| 截图 | shots-r56/821680056514781186-melee.png |
| 对照 | 截图：长船靠岸、红衣维京人下船、小屋旁守军接战、大片血泊与尸体；fitted 1129 次影子贴合、sweeps 3。原片橙队是另一队守军色，属配色差异。 |

### 827215002448846848

| 原文要点 | Looking at unit tiers |
|---|---|
| 片子机制 | 三队曲道入场：蓝灰装束 → 银白头盔/盾 → 金色边饰盾与盔饰，配不同旗徽。 |
| 原缺 | 只有外观色阶，缺升级机制与雕饰盾/盔饰/旗徽。 |
| 本轮做了什么 | battle-c03.js tierUp：守住一波 → 每队升一级（setUnitAppearanceTier，不回血），三级头顶加金色盔饰（实例化小冠）；配合 G3 standards 的金饰盾面与骷髅/剑/三叉戟竖旗。 |
| 判定 | **done** |
| 落点 | src/core/unit-tier.js · src/badnorth/battle-c03.js · src/badnorth/squad-standard.js · ?tierUp=1&standards=1 |
| 测试 | tests/c03-battle.mjs · tests/unit-tier.mjs · tests/battle-g3.mjs |
| 截图 | shots-r56/827215002448846848-tiers.png |
| 对照 | 截图：一级原色、二级银白盔、三级金盔 + 金冠饰，盾面金圈徽记、竖旗——三级外观并列，与 frame 40/180/260 一致。升级触发条件（守住一波）是本地规则，原作数值未知。 |

### 828984794407170048

| 原文要点 | PRO TIP: Protect your real estate investments by keeping vikings off your homelands |
|---|---|
| 片子机制 | 沿坡接敌、屋旁燃烧，随后大火球（白芯粉辉光）炸开，房屋焦黑、黑烟，幸存单位移动。 |
| 原缺 | 原火球 / 房屋焦黑缺。 |
| 本轮做了什么 | battle-c03.js houseFx：失守 → 屋下/门口焦痕 → 2.2 s 后屋顶粉辉光大火球（explodeAt glow）→ 直接压暗渲染网格里这栋屋（外扩 1.3 含屋檐、地面以上）的顶点色成焦黑（原色保存，stop 还原）+ 持续黑烟。 |
| 判定 | **done** |
| 落点 | src/badnorth/battle-c03.js · ?houseFx=1 |
| 测试 | tests/c03-battle.mjs · tests/unit-ground-height.mjs |
| 截图 | shots-r56/828984794407170048-blast.png · shots-r56/828984794407170048-char.png |
| 对照 | 两张截图对上 sheet-02 的 0240（白芯粉辉大火球）与 0290（焦黑屋 + 屋顶残火 + 黑烟）。屋体焦黑改 377 个顶点。 |

### 890611046435627008

| 原文要点 | Just a birthday gif from yours truly |
|---|---|
| 片子机制 | 高台蓝队、Move 弹出、沿阶支援、中/下层房屋遇袭燃烧（橙色火团抛向屋顶）、+12/+6 数字。 |
| 原缺 | 原火焰抛射 / 奖励动画缺。 |
| 本轮做了什么 | battle-c03.js torches：维京人到小屋 1.3 内（层差 ≤1）每 2–2.8 s 朝屋顶抛火团（抛物线、橙球 + 辉光 + 火星拖尾），命中加燃烧进度 1.1 并在屋顶爆一小团火；+N 飘字沿用既有 damage-numbers；Move 弹出见 1016680972610359298。 |
| 判定 | **done** |
| 落点 | src/badnorth/battle-c03.js · src/badnorth/damage-numbers.js · ?torches=1 |
| 测试 | tests/c03-battle.mjs · tests/house-door-presence.mjs |
| 截图 | shots-r56/890611046435627008-torch.png |
| 对照 | 截图：火团在空中（黄芯辉光）、屋顶命中火光；与 frame-0610 的橙色火团抛向屋顶一致。飘字的具体奖励含义仍未知。 |

### 807256278154301441

| 原文要点 | Looking at cheap swarm pathfinding. These dots could possibly be crabs … |
|---|---|
| 片子机制 | 红砖多层塔、外阶、门洞，紫色球点成群沿屋顶/台面/台阶移动。 |
| 原缺 | 群体寻路未做（旧轮只迁了四檐顶）。 |
| 本轮做了什么 | 新建 life/crab-swarm.js：整群共用一棵到目标的最短路树（共享分层导航图 layerednav 上反向 Dijkstra，一次算全图下一跳），每只只走「当前节点→父节点」+ 个体侧偏 + 邻居分离；节点高度预先向渲染网格打射线取真实表面，台阶/屋坡连续；目标定时更换整群改道。app.js 一行挂钩 ?crabs=1，任意场景可开。 |
| 判定 | **done** |
| 落点 | src/life/crab-swarm.js · src/world/battle-navigation.js · app.js（挂钩）· ?crabs=1 |
| 测试 | tests/c03-crab-swarm.mjs |
| 截图 | shots-r56/807256278154301441-crabs.png |
| 对照 | 截图（融合场景）：140 个紫点从 1–2 层沿台阶爬到 10 层塔顶，路上拉成一串；平均剩余路程 12.5→0.52。原片是红砖塔楼，这里是共享场景的岩塔，属场景差异。 |

### 827216768783495168

| 原文要点 | And another one |
|---|---|
| 片子机制 | 三队徽记旗（骷髅/剑/三叉戟）、金饰盾、银白盔与蓝灰兜帽三档。 |
| 原缺 | 第 55 批 G3 已做竖旗横杆 + 金饰盾纹（done），本组清单仍挂 partial。 |
| 本轮做了什么 | 核对现状 + 与 tierUp 组合实景截图：竖旗 + 金球 + 金边燕尾旗面徽记、金圈盾面徽记、三级金盔饰。 |
| 判定 | **done** |
| 落点 | src/badnorth/squad-standard.js · src/badnorth/battle-g3.js · src/badnorth/battle-c03.js · ?standards=1&tierUp=1 |
| 测试 | tests/battle-g3.mjs · tests/c03-battle.mjs |
| 截图 | shots-r56/827216768783495168-standards.png |
| 对照 | 截图：三队竖旗、金圈徽记盾、金盔饰/银盔/原色三档同框，对上 frame-0012 的结构；本机位下旗面徽记偏淡（逆光侧），原片是正面大白徽记。 |

### 793545297376972801

| 原文要点 | I got multi tiles and voxel AO working. Would you play a game that takes place on a building like this? |
|---|---|
| 片子机制 | 构件跳着出现的多格 3D WFC；完整多层楼带拱洞、楼板夹缝、内凹 AO；换种子/高度。 |
| 原缺 | 缺接共享 World 与窗洞/栏杆美术模块。 |
| 本轮做了什么 | 新建 build/multitile-world.js：WFC 实心体素按相邻格心间距在共享 World 里取样落格（同格去重，不规则四边形/三角网格都能落），底下垫岩台并外扩一圈；之后墙、窗、门、拱洞底面、屋顶、旗杆全交给共享建筑管线和共享 AO。app.js 一行挂钩 ?multitile=<种子>&mth=<高>。 |
| 判定 | **done** |
| 落点 | src/build/multitile-world.js · src/build/multitile-wfc.js · src/build/buildings.js · app.js（挂钩）· ?multitile=3 |
| 测试 | tests/c03-multitile-world.mjs · tests/multitile-wfc.mjs |
| 截图 | shots-r56/793545297376972801-world.png |
| 对照 | 截图：小镇场景里 5×8×5 WFC 解长成带窗、红瓦屋顶、旗杆、竖向缝隙/悬挑的多层楼，立在岩台上；体素 112/134 落格（不规则网格 3 列重复取样跳过）。窗洞/栏杆用的是共享 Townscaper 建筑模块，非原片美术。 |
