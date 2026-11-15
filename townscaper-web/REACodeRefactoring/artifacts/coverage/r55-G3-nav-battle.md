# r55 · G3 导航 / 战斗组（12 个「部分覆盖」模块）

所有截图都在 headless Chromium（SwiftShader）里拍，用的端口是 8793、8803、8804。每张都用 Read 打开看过，控制台没有 error，只有 three 的 `toNonIndexed` 警告，基线页也有这条。截图放在 `artifacts/coverage/shots-r55/g3-*.png`。

`tests/*.mjs` 全量 251 个，全部通过。最后一次全量跑没有 FAIL。

portrait、borderpath、navgraph 三个模块交给了两个协助子代理，用的是 8803 和 8804 端口。它们的截图我也复看过。

## 改动边界

- **没碰的文件**：view.js、worldmesh.js、REACode、learn/*、CHANGELOG 等记账文件都没碰，也没有 git 操作。
- **battle.js**：只做了 9 处一行级的精确插入，每处都先用 python 断言旧串恰好出现一次再替换：
  1. import
  2. 构造时创建 `this.g3`
  3. `start()` 里调 `g3.start()`
  4. `stop()` 里调 `g3.stop()`
  5. 新增公开的 `applyHit(v, by)`，内部转发给 `#hit`
  6. 近战出手处先问 `g3.melee()`
  7. `u.sweep` 推进
  8. 下令之后调 `g3.onMove`
  9. `#draw()` 之后调 `g3.afterDraw()`

  其余逻辑都放在新文件 `src/badnorth/battle-g3.js`。
- **新开关**：全部默认关。可以用 URL 参数打开（`?finePortals=1&continuousFlow=1&standards=1&meleeFx=1&ladders=1&shadowFit=1&commands=1`），也可以在运行时调 `battle.g3.set(name, on)`。
- **面板**：要加面板项的话，请 G1 在 view 面板里加，接法就是上面的 `battle.g3.set(...)`。

## 逐模块

### 三个 nav 模块：cheesenav / holenav / voxelnav（共用一份实现）

- **片子**：906425294533394432、797119718477991936
- **原缺口**：格内精细门户和形变侧壁都没有
- **本轮做了什么**：新文件 `src/world/fine-portals.js`。它按 `buildings.js` 的 `underside()` 同一套规则，算出每个洞道节点头顶的几何：
  - **两对边有支撑时是椭圆拱**：用 `archFloorBudget` 同源参数，净空 = (spring − 地面) + rise·√(1−(2u−1)²)。身高放不下的两条边带封掉，剩下的门户区间是 [u0, 1−u0]。
  - **形变侧壁**：侧壁是笼形双线性映射下 u=u0 的直线。在不规则网格里，它夹在两条支撑边的方向之间，和格边都不平行。
  - **平底时有角上钢柱**：柱子位置是 `mix(角, 格心, .06)`，粗 .045，会占掉门户两端；天花板比身高低时整格封死。
  - **门户的两侧都算**：门户 = 本侧区间 ∩ twin 边区间（twin 边参数反向）。

  `BattleNavigation` 新增 `finePortals` 和 `unitHeight` 两个选项，切换后会重建：
  - 门户宽写进 `portal.width`，体型树会自动避开放不下的门；
  - `discFits` 加查被封段、侧壁和钢柱；
  - `steerTarget` 对准收窄后的门户，直线穿不过时先对准门户上最近的可穿点。

  `navigation.html` 新增「精细门户（拱洞墙）」和「按门户走」两个复选框，URL 参数是 `?fine=1&finenav=0|1&h=`。页面上的小人真实调用 plan/steerTarget/move 走一遍。
- **判定**：done
- **落点**：world/fine-portals.js；world/battle-navigation.js；navigation.html；ui/navigation-review.js
- **node 测试**：tests/fine-portals.mjs
- **浏览器截图**：
  - `g3-nav-fine-1.png`：俯视拱洞墙。绿色是门户，红色是门户两端被封的段，橙色是两道斜的形变侧壁，灰色小柱是钢柱。这次的数字是：拱 3、平底 7、钢柱 3、收窄 22；身高 .42 时小人到达，洞内离被封段最近 0.056，不小于半径 .055。
  - `g3-nav-fine-0.png`：同一个岛按整条格边走（旧行为），洞内离被封段只有 0.007，身体压进了低净空带。
  - `g3-nav-battle-on.png`：北境 `?finePortals=1&continuousFlow=1`，零 error，24 人都在。

**局限**：北境岛（generateBadNorth）本身没有洞道节点，Battle 里 `covered=0`，所以那里开了也看不出变化；效果只在有拱的场景和演示页里能看到。

### flowfield

- **片子**：816748103193817088
- **原缺口**：连续转向默认关，鞍点会困人
- **本轮做了什么**：
  - 新增 `navmesh-flow.guardedFlowAt`，即鞍点守卫。只有当连续流向要出的那条边是墙、或树距离不下降时，才改走面级 Dijkstra 树的出口（树距离严格下降，不会来回打转）；其余时候保持连续流。`stepCrowd` 新增 `polyField` 选项来启用它。
  - Battle 的 `flowAim` 也改走守卫，并且加了两条：与图方向偏差超过 60° 时听图的；整段扫掠都要放得下才采用。
- **测试数据**：双网格 × 3 个种子，24 人。
  - 无守卫：只到达 3–23 人（例如 quad/11 只到 3 人）。
  - 有守卫：每组都是 24/24 到达；守卫接管的步数约 7–13%；面心处 368/405 保持原连续流。
- **是否默认开**：真实 Battle 里实测 20 s 后的平均剩余路程：
  - mixed：与通口前视持平（2.38 对 2.56，11.96 对 11.93）；
  - quad：仍然更慢（7.4 对 5.92，21.4 对 21.0）。

  所以没有改成默认开。
- **判定**：**partial**。鞍点问题解决了，但默认开不成立，还缺 quad 网格上的提速。
- **落点**：world/navmesh-flow.js；world/battle-navigation.js
- **node 测试**：tests/flow-saddle-guard.mjs；layered-continuous-flow.mjs 仍然通过
- **浏览器截图**：`g3-nav-battle-on.png`，连续流 6 s 内被采用 799 次，零 error。

### navgraph（子代理完成）

- **片子**：1795831296952041691、1582293326815862786
- **原缺口**：riverFlow 不进存档
- **本轮做了什么**：
  - 在 `save.js` 末尾加一个可选尾段：先写 1 位标志，然后每个河格 3 位，记「下游是第几条邻边」。
  - 没有 riverFlow 的存档与旧 v5 逐字节相同，所以旧码照常能读。
  - 读档后用 `riverFlowChains` 重建 paths/mouths。
  - `river-nav.html` 新增「存档→读档 / 旧码对照」，URL 参数是 `?roundtrip=`。
- **判定**：done
- **落点**：world/save.js；river-nav.html
- **node 测试**：tests/river-flow-save.mjs，共 8 个地形，91 段流向全部一致
- **浏览器截图**：
  - `g3-navgraph-flow-save.png`：hash 读档后的岛上有绿色顺流箭头，状态行显示「carve，53 段中 0 段不同」。
  - `g3-navgraph-flow-legacy.png`：旧码读档，退回 mouthDistance，7 段方向不同。

### combatfx

- **片子**：870296307889573889 等 8 条，参照 1022573208590057472
- **原缺口**：完整动作美术、旋转武器扫掠、3D 遮挡、盾推力都没有
- **本轮做了什么**：新文件 `core/melee-sweep.js`。
  - **扫掠**：武器是一条绕握点转的线段。每帧按扫过的扇形做连续判定，身体半径用 asin(r/d) 放宽，每人每次挥砍最多命中一次（hitSet）。
  - **3D 接触遮挡**：每帧细分扫过的角度，刃碰到实心体素就停在那里（clang）；刃到目标那一下也要无遮挡，目标还要在同层高度带内。
  - **盾推力**：有盾的一方被正面 ±72° 打到时格挡：不掉血，攻击者被沿法向推开 .09，背后是 ≥2 层落差就走落崖那条路，攻击者硬直 .35 s；盾有 .9 s 冷却。
  - **接线**：大个子维京人和守军步兵用扫掠；守军步兵和小个维京人有盾。刃用白色细板实例画出来。
- **判定**：**partial**。扫掠、遮挡、盾推力已经接进 Battle；「完整动作美术」需要原作动作素材，这里只有程序化的刃和身体转向。
- **落点**：core/melee-sweep.js；badnorth/battle-g3.js；battle.js 3 处挂钩
- **node 测试**：tests/battle-g3.mjs，覆盖 15 fps 下一扫 3 人不漏、墙挡刃、正面挡背面不挡、冷却，以及真实 Battle 里开时扫掠 ≥2、命中、格挡都 >0，关时都是 0
- **浏览器截图**：
  - `g3-combatfx-1.png`：北境，维京人被挪到步兵身边，守军与红衣维京人贴身交战。eval 显示扫掠 2、扫中 1、刃被墙挡 1、盾挡 2、推开 2。注意：刃的瞬间画面不一定被拍到，挥一次只有 .24 s。
  - `g3-combatfx-0.png`：关掉时，同样的场面，所有计数都是 0。

### squadbanner

- **片子**：827216768783495168
- **原缺口**：金饰盾纹、竖旗横杆、Battle 里的替换都没有
- **本轮做了什么**：新文件 `badnorth/squad-standard.js`。
  - **竖旗**：杆 + 横杆 + 金属球；旗面挂在横杆下，旗底用军色派生（三队同一族蓝），带 2px 金边和燕尾下摆。徽记从图集那一格逐像素拷进来，所以旗面墨量等于图集格墨量，并加了深蓝描边。旗面是公告板，偏航夹在 ±40°。
  - **盾面**：盾色圆盘 + 金饰外圈 + 内金线 + 同格徽记，每种徽记一张 InstancedMesh，贴在盾面前。
  - **接线**：`standards` 打开时隐藏 Bezier 飘带旗，关掉后恢复。原作美术素材没有，以上全部是程序化的。
- **判定**：done
- **落点**：badnorth/squad-standard.js；badnorth/battle-g3.js
- **node 测试**：tests/battle-g3.mjs，覆盖墨量 84/38/66 等于图集、金边比例 0.416、旗面在横杆下、球高于横杆、偏航夹 40°、盾面数 = 在场守军数（24），以及关掉后恢复
- **浏览器截图**：
  - `g3-squadbanner-on.png`：竖旗、横杆、金球、金边燕尾旗面加徽记。
  - `g3-squadbanner-shields.png`：盾面上的金圈和徽记。
  - `g3-squadbanner-off.png`：同一机位下原来的 Bezier 飘带旗。

### terraceladder

- **片子**：781957658597269506、1669315384619540487
- **原缺口**：寻路没有避开薄平台，也没有攀爬动画
- **本轮做了什么**：`BattleNavigation` 新增 `avoidThinLadders` 和 `ladderMode` 两个开关；view 打开 woodladders 时会自动跟上。
  - **避开薄平台**：上层支撑深度小于 rise 的梯子（与 `ladderContact.thinPlatform` 同一判据）不进分层图。
  - **攀爬**：在梯子上时（梯脚 run 用 `ladderAnchors` 同参数），脚高按横档 .08 分级，相邻横档之间用 smoothstep 过渡，表现手脚交替一级一级往上爬。
  - **姿态**：`battle-g3` 在 #draw 之后、LOD 之前改写攀爬单位的实例，让单位面朝墙、前倾，按横档左右摆。
- **判定**：done
- **落点**：world/battle-navigation.js；badnorth/battle-g3.js
- **node 测试**：tests/battle-g3.mjs
  - 地形场景 quad r9 / seed 7：2 把薄平台梯子，开关前后进图条数 2→0，其余 64 把照常进图。
  - 攀爬高度单调、到顶 1.0。
  - 真实岛上最多 6 人同时攀爬，单帧高度变化 ≤.278。
- **浏览器截图**：
  - `g3-ladder-1.png`：木梯上一名蓝兵面朝墙、前倾，爬到 78%（第 5 级横档）；eval 显示 ladderMode 已开，图上有 23 把梯子。
  - `g3-ladder-0.png`：关掉时没有梯子，也没有攀爬。

### blobshadow

- **片子**：820977247083528192、821321422140309504、821680056514781186
- **原缺口**：形变斜坡贴合没做
- **本轮做了什么**：`UnitShadowBatch.groundSampler`，由 Battle 的 `shadowFit` 开启。
  - 每个单位向**渲染出来的形变网格**（view.mesh 和楼梯网格）打 5 条射线，取最接近脚高的那一层，用最小二乘拟合平面。
  - 软盘逐顶点贴到这个平面上，坡向椭圆用拟合出的坡度。
  - 单位不动就复用缓存。
- **判定**：done
- **落点**：life/unit-shadow-batch.js；badnorth/battle-g3.js
- **node 测试**：tests/battle-g3.mjs，12° 斜面拟合出 12.00°，顶点误差 .006；关掉后回到楼层平面
- **浏览器截图**：两张都关掉了场景投影，并隐藏了单位，只看软影。
  - `g3-blobshadow-1.png`：软影贴在台面和楼梯脚，没有悬空，也没有 z-fighting；eval 显示 23 个影子都走了拟合，踩在楼梯上的那个拟合坡度 72°。
  - `g3-blobshadow-0.png`：关掉时的对照。

  北境的台面本身是平的，所以两张图肉眼差别很小，判定主要靠度量。

### uikit

- **片子**：1242824460325052417、1016680972610359298、1024679338292256769、1201179450668441600
- **原缺口**：单 Move 目标、地面标记、游戏指令都没有
- **本轮做了什么**：`commands` 打开后：
  - **指令条**：选中小队时左侧弹出「移动 / 原地坚守 / 退回小屋」三个按钮。用 `layoutList` 做轻微倾斜和错位，槽位仍然等距、不重叠；色相用 `colorFor`，图标是 `GLYPHS` 描边，阴影是硬阴影。
  - **地面标记**：每队最多一个（单一 Move 目标），再下令就挪过去，不会叠第二个；标记会转动，到达后收起。
  - **指令真的生效**：hold 把目标设成脚下节点，retreat 把目标设成最近未失守小屋的门口。
- **判定**：done
- **落点**：badnorth/battle-g3.js（用了 core/playful-layout.js）
- **node 测试**：tests/battle-g3.mjs，覆盖连下两次令只有 1 个标记且标记已挪到新目标、overlaps 0、最大倾角 .77°、hold/retreat 改写 goal
- **浏览器截图**：
  - `g3-uikit-1.png`：选中的小队有白圈，左侧三个歪着摆的彩色按钮带白色图标，远处地面上有一个粉色方形倾斜标记；eval 显示 markers 1、overlaps 0。
  - `g3-uikit-0.png`：关掉时没有指令条，也没有标记。

### portrait（子代理完成）

- **片子**：958371606350454784、1010979395719319552
- **原缺口**：ui.html 没有用 part-random
- **本轮做了什么**：
  - 新文件 `src/ui/slot-portrait.js`，按 `PORTRAIT_SLOTS` 的顺序逐个槽位画程序化矢量头像，包括兜帽。原素材没有，是程序化替代。
  - ui.html 新增「槽位表头像」按钮和 `?portrait=slots` 参数，默认保留旧部件树。
- **判定**：done
- **落点**：src/ui/slot-portrait.js；ui.html
- **node 测试**：tests/slot-portrait-ui.mjs
- **浏览器截图**：
  - `g3-portrait-slots.png`：8 张脸，有兜帽 / 侧分 / 平头等发型；剪影差异 0.269，画布剪影与掩码的 IoU 0.994。
  - `g3-portrait-tree.png`：旧部件树，对照用。

### borderpath（子代理完成）

- **片子**：1097458505315946496
- **原缺口**：campaign.html 没有画前线
- **本轮做了什么**：
  - 新文件 `src/campaign/frontier-overlay.js`。
  - campaign.html 新增「多条前线 + 两侧场细分」复选框和 `?fields=1` 参数，默认关。图上画三条前线、四个分带上色的场、ear-clip 细分线和节点带号。
- **判定**：done
- **落点**：src/campaign/frontier-overlay.js；campaign.html
- **node 测试**：tests/frontier-fields-campaign.mjs
- **浏览器截图**：
  - `g3-borderpath-fields-on.png`：3/3 条前线，732 个三角形，交叉 0。
  - `g3-borderpath-fields-off.png`：关掉时的对照。
  - 另有 step2 / step4-reseed 两张。

**画质说明**：现有 `frontierFields` 是对「前线 + 矩形角」做 ear-clip，所以图上能看到从矩形角发出的长扇形三角。原帖第 4 步是用「Bezier + 三角网」细分；这是 frontier.js 算法的保真度问题，本轮没改。

## 新文件

- **src/world/**：fine-portals.js
- **src/core/**：melee-sweep.js
- **src/badnorth/**：squad-standard.js、battle-g3.js
- **src/ui/**：slot-portrait.js
- **src/campaign/**：frontier-overlay.js
- **tests/**：fine-portals.mjs、flow-saddle-guard.mjs、battle-g3.mjs、slot-portrait-ui.mjs、frontier-fields-campaign.mjs、river-flow-save.mjs

## 改动的已有文件

- **src/world/**：battle-navigation.js、navmesh-flow.js、save.js（子代理改的）
- **src/life/**：unit-shadow-batch.js
- **src/ui/**：navigation-review.js
- **src/badnorth/**：battle.js（9 处一行级挂钩）
- **页面**：navigation.html、ui.html、campaign.html、river-nav.html
