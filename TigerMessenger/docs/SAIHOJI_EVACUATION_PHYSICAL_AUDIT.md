# 苔庭接返物理路线审计（2026-09-20）

状态：**未获验，不能接入自动登船**。本轮只读真实8931场景，用上一轮240秒诊断报告的15人坐标作为测量输入；未移动演员、未修改存档、未注入战斗命中。它不是自然战斗全程。

## 实测结果

- 原landing方向：`[-0.5195427402, 0.5237577109, -0.6750949573]`。
- 15个原回撤终点，只有伤员79与护送者80所在两点有海面以上真实支撑。其余13点脚底半径159.776–159.802，实际海面160.5，已经低于海面约0.70–0.72m。因此原finished只代表抵达原方向终点，不能代表登岸。
- 调用现有 `createWarshipWaterRoutes.dock`，搜索原landing周边24m、岸点步长2m：1952个候选姿态全部在船中心最低水深1.5m检查被拒绝。当前0个合格泊位；第一泊位失败就停止，未重复使用index%2冒充第三泊位。
- 本轮没有证明24m以外不存在泊位，也没有验证甲板/座位路线。未到达跳板支撑、船体净空与进出航道后续门限。
- 当前V11跳板本地长1.35m、宽0.34m，船缩放1.7，实际长2.295m、宽0.578m；rootPoint为[1.94,0.664,0.84]。伤员与陪护不应并排走板，必须采用单列搀扶或搬运并实测身体及装备净空。

## 最小接入前置条件

1. 先选定有足够水深的独立靠泊点，复核三船13.8m间距及真实进出航道。如果靠岸深水超出2.295m跳板可达范围，应设计有真实支撑的短栈桥/码头或选择更远同岸段；不能仅降低吃水检查来让船穿底。
2. 保留驻军在真实干地等待，不能先让其走到已知水下home再尝试补救。未证明从当前位置可达干地候船区者报告阻塞。
3. 使用现有地表A*，逐段验证当前位置→候船区→岸端→跳板→甲板→座位；缺任一段，不生成登船成功凭据。
4. 健康者与伤员/陪护原子预约名额只解决容量，不能改变visible、embarked。伤员UID、downed和原对象持续保留。

## 后续独立controller需要的接口

- 泊位：`{ id, position, quaternion, shorePoint, angle, approach, verifiedHullClearance, verifiedWaterDepth }`，每船独立；保存验证时场景/资产版本，地形变化使凭据过期。
- 船停稳：每帧提供船matrixWorld和真实位移/角速度，进入板前占用boardingGate；有人在板、伤员未落位或板未收起不得移动船。
- 乘员：预约返回`{uid,seat,reservationId}`；伤员及陪护需要两个独立座位，一致失败回滚。controller仅在实际到位后调用`commitBoarding(uid, proof)`。
- 物理凭据：`{dockId, routeId, actorUid, reservationId, stage, sampledFootSupport, finalSeatDistance, shipStationary, injuryPreserved}`。必须由实际逐帧路线推进产生，不能凭时间或动画结束填true。
- 阻塞：`missing-dry-start / missing-berth / insufficient-depth / support-gap / occupied-gangplank / escort-unavailable / ship-moving`；保留演员位置与伤势，允许恢复后重新规划。

证据：`artifacts/pipeline/saihoji-evacuation-boarding/physical-route-audit.json`。
复现工具：`tools/pipeline/probe_saihoji_evacuation_boarding.mjs`。

## 港池/海床追加测量

`depth-audit.json` 每个24/40/64m环取32个方位，加landing中心共97点：

| 距landing | 真实海面到球海床深度 | 达到1.5m中心水深 |
|---|---:|---:|
| 0m | 0.499m | 0/1 |
| 24m | 0.481–0.773m | 0/32 |
| 40m | 0.388–0.813m | 0/32 |
| 64m | 0.452–0.830m | 0/32 |

不是整个星球穷举，但足以说明这一带不是靠换A*就能得到合格港池。应先做真实局部港池与航道地形，保留1.5m门限，并与当前V11最低划桨姿态吃水复核。不要只把planet-surface从碰撞查询中排除，让实物穿底。

分类核对：`surface`分别查询planet-surface海床和区域地形，取`max(ground,seabed)`，不会把更高的mossy-terrain忽略。实测部分船体位置ground=mossy-terrain半径160.647，大于同点球海床159.794；因此是确有区域地形承托/阻挡，同时底球又太浅，不是优先级误选。

船姿核对使用脱离场景的生产V11模型，在**原代码landing终点姿态**（半径160.18、缩放1.7、最后航段朝向）调用一次生产划桨更新，逐实例矩阵共检199682顶点。一个可见实例顶点半径159.70346，实际同点海床159.76522，穿底约0.06176m；海面160.36399。该结果只证明这个姿态已穿底，不代表整划桨周期最大穿入量。原船/演员没有被移动。报告最低批次含instanceIndex，正确应用InstancedMesh实例矩阵；初版未乘实例矩阵的数值已作废并被覆盖。

最后默认伏击回归：`artifacts/pipeline/saihoji-ambush-web/2026-09-20T13-17-25.163Z/report.json`，19项通过、sourceStable=true，包含本轮Crew固定座位接口与dispose清理；不代表物理接返获验。唯一headless已关闭。

## 2026-09-21 岸板甲板候选复验（未发布）

新增 `src/world/saihojiBoardingRoute.js`，仅产出规划快照，不移动/隐藏演员、不授予embarked。支撑来自V11保存的真实primitive及当前作者节点矩阵；不把合并材质批次中的货物或船员当甲板。真实甲板法线用NormalMatrix，演员前向沿生产+X。

- 海床+鲸体障碍候选：3个独立泊位均获验；每次dock前复位跳板，不能复用展开板碰撞姿态做下一艘搜索。
- 原板内端到bow landing无支撑端点：boat本地 `[1.9400,.6830,.8633]` → `[2.0266,.6879,.5968]`，世界距离0.47634m、高差0.00833m；真实板面不是普通毫米板缝。甲板朝船头方向逐渐收尖，直接对角线并不等于可走的甲板通道。
- 固定桥木板候选使3处岸→板→bow deck采样脚底支持通过；**桥板收放扫掠另测失败**，不能部署。`supported`只表示当前展开姿态脚底，不能解释为角色可通行。
- 真实三兵种保守身体/装备包围盒对船体三角检查：战斗持武器姿态部分受手绳阻挡；使用现有收武器姿态后，初段窄板可过，但后段触及hull-low、raised bow stem或n59。须对真实过道中心线及分肢体/装备精确净空继续设计，不应直接删除船体来迎合粗包围盒。初版测试曾误用+Z前向，已修正为生产+X，旧“肩宽1.104m”结论作废，那是前后长度。
- 地形采样行军修正后，47.2模拟秒`whaleReturned`切换return且当帧`updateGarrison`尚未执行，捕获15人原位置：**0/15有海面以上干地支撑**，脚底半径159.808–160.109，小于海面160.5。不是拿240秒后错误home当起点；没有新摆士兵。下一步应审查原12m环状阵位与真实苔庭干地关系。不得用板通行测试掩盖入场/布阵本身的地形缺口。

该测试恢复隔离chapter3存档、固定机队近点/注入600命中、改变电车位置以调用原下车入口；士兵位置不改，临时收武器姿态测后恢复。不是自然全战斗。`candidate-board-audit.json`已记录sourceBefore/sourceAfter/sourceStable=true。`candidate-dock-board.png`是规划机位诊断图（仍含原未搬开的legacy战船，帆也有遮挡），不作为整体画面验收或已部署截图。

Node五项检查：无dock拒绝、缺岸支持拒绝、并排宽度拒绝、收板拒绝、生产+X人体轴回归，见`boarding-support-node.json`。静态支持通过不代表船稳、伤员动作、到座/上下船或扫掠通过。

行军采样修正后的19项默认伏击回归：`artifacts/pipeline/saihoji-ambush-web/2026-09-20T16-17-54.507Z/report.json`，全部通过、sourceStable=true；浏览器已关闭。

### 本轮最后一次：改用原中央过道折线后暂停

前面直达bow-landing几何中心的路线选择不正确，不能由它得出“必须修改船头”的结论。最后一次候选改用原 `citadel/boardingRoute.js` 既有中央过道折线，逐点重新采样真实木板：岸→板→铰链→本地(hinge.x,.664,hinge.z-.08)→(hinge.x,.664,.36)→(1,.664,.36)。

固定桥候选展开状态下，三处脚底支持通过；正确+X前向、实际收武器姿态的三兵种保守净空结果：

| 泊位 | 弓箭兵 | 短剑兵 | 长矛兵 |
|---|---|---|---|
| 0 | 通过 | hull-low包围盒/三角筛查阻挡 | 通过 |
| 1 | 通过 | 通过 | 通过 |
| 2 | 通过 | 通过 | 通过 |

这是当前站姿/装备包围盒与船体三角的路线筛查，不包括转身的连续旋转扫掠、伤员搬运、座位路线或桥板收放。固定桥收放仍失败；15人原进场仍0/15干地支持，故 `physicalBoardingValidated=false` 不变。最新candidate-board-audit.json注明 `original-citadel-central-aisle-with-fixed-bridge-candidate`，sourceStable=true。

按用户要求，已保存上述结果、关闭最后一个headless并停止游戏修改，不继续搜索或改船头。
