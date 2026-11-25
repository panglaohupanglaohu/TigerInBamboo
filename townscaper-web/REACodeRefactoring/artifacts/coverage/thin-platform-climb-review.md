# 薄平台生成/标记 + 攀爬可达 · 机制收口（109 帧黄色薄平台续作）

clip 781957658597269506（2016-09-30，无文字，109 帧黄色薄平台/柱/梯）。上一核验（wood-ladders-review.md）记录残差「原薄台/攀爬仍缺」；r56 已把叠层薄台几何做出来（mushroom-c04.js）但其帽片之间不连通、没有通用薄台生成，也没有「爬上薄台」的行为验收。本轮把这两项残差按机制关掉。

## 原片对照范围

片中可见：黄色薄台面错层挂在中心柱上、下台到上台的木梯跨越空隙。本批覆盖的机制面 = 「只一层体素、底下悬空」的可站面 + 沿梯（落差边）上到下层的可达性与轨迹。梯杆倾角/截面/精确长度、黄色美术与整岛造型不在本批；clip 无文字，作者算法未公开。

## 共享实现（REACodeRefactoring）

- `src/terrain/thin-platform.js`（新）：`thinAt/thinTops` 标记「本层实心、上层空、下层空」的薄站立面（第 1 层不算）；`thinLedges` 按同层边邻接连成檐片并记录挂壁邻格；`ledgeSites` 沿高壁（邻格比本格顶高 ≥3 层）在腰上挑檐位（落差 ≤2 保证在梯量程内）；`placeThinLedge` 单层写入，下一层有体直接拒（放上就成柱子不是檐）；`placeLedges` 按种子批量。体素读写与 capabilities/ops.js 同口径，库 World 与 vendor 副本通用。
- `src/world/climb-route.js`（新）：`ladderChannel` = navgraph 落差边 + ladder-profile 的 3D 锚点（ladderAnchors）+ 端点体素接触（ladderContact），usable 判据 = 梯脚站低层顶面/梯身不穿岩/梯顶搭上层顶边；`channelBetween` 对任意相邻格重建通道（nav.stairs 只留最短路树用过的那批，但 stairSet 覆盖全部候选——寻路经过的落差边必有梯位）；`climbRoute` 沿 findNavPath 格序列产出逐点 3D 轨迹（同层走格心、跨层沿 ladderClimb 中轴），通道不可用/无路记 reason 不静默跳过；`climbs[].thin` = contact.thinPlatform（上层支撑深度 < 落差 = 梯子搭在薄台上）。
- `src/world/navlayer.js`：ladderDiagnostics 改为消费 climb-route 的同一份通道（ladderChannels），画出来的和判得出的是同一口径。
- `src/capabilities/terrain.js` + `registry.js`：`terrain.ledge` 能力（薄檐候选→批量放置→标记核对）；`src/terrain/generate.js`：`ledges` 选项在生成管线尾部放檐。

## 验收

库内 `tests/thin-platform-climb.mjs`（register 钩子，Node 直跑）PASS：
- 标记：实心柱顶不误判薄（先前 bug 已修），悬空檐正确成片挂壁。
- 场地攀爬：4 层台地西壁贴两片第 3 层檐，地面与台地高差 3 层 → climbRoute 两把梯（rise2·thin / rise1），轨迹 0.5→2.0；拆掉檐 → 无路（reason 如实记）。
- 生成地形（quad/mixed 两种网格）：通道清单存在、no-anchors 如实暴露（边长 <.2 的梯位 ladderAnchors 拒绝）。
- C04 蘑菇叠层：底座存在能爬到第一片薄台的格（一把 rise=2 薄台梯）；顶层帽片之间不连通是叠层自身上限，如实记 toTop=no-route，不虚报。
- generate(ledges:N) 与 terrain.ledge 能力：放置与标记对得上。

浏览器端到端 `TigerMessenger/tests/thin-platform-climb-browser.mjs`（artifacts/thin-platform-climb-e2e/run-1795511210830）PASS——消费方是**真运行时**：vendor 副本的 BattleNavigation + nav-lab simulateWalk（battle.js 走法复刻），vendor 三个新/改文件与库逐字一致（测试内断言）：
- 单位从 1 层地面出发，178 帧到达 4 层台地顶，逐帧坐标轨迹落 report.json。
- 轨迹实证两段爬升：第一段梯 rung 1→11、progress 0.11→0.93、脚高 0.5→1.43 后站上檐面（脚高 1.5 停留多帧，floor 3）；第二段 progress 0.79→0.89、脚高 1.89→1.94 后上 4 层（floor 4，脚高 2.0）。
- 对照：`avoidThinLadders=true`（原作语义：搭在薄台上的梯不可靠）同一世界同一对起终点 thinLadders=1、plan=null——薄台梯被踢出图即无路。

## 没做到（边界）

- 游戏场景不生成薄檐：acceptance 在合成场地 + 生成地形 + C04 叠层，真实战场景没有薄台供给（avoidThinLadders 仍是游戏默认语义）。
- 原片黄色美术/叠层构图/梯的精确几何未迁；clip 无文字，不反推作者算法。
- C04 叠层帽片间连通性是该结构自身上限（帽片悬空互不邻接），本次只证「地面→第一片」。
- 分析轨迹（climbRoute）与实际行走（simulateWalk）口径一致但非逐帧同一条线（前者沿格心+梯梁中轴，后者含车道/分离修正）。
