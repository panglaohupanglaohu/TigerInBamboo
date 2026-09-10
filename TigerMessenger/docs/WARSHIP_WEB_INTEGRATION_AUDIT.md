# 战船 v4 Web 回接只读审计

审计日期：2026-09-10。结论：**v4 尚未回接 Web；不能把静态 GLB 换进工厂后宣称划桨和登陆已完成。** 当前源节点契约可匹配，主要阻断是实例桨手、连续划桨/麻醉状态和实际登船路径。此次仅新增本文，没有修改工厂、动作、世界布局或模型。

证据来自当前源码、v4 GLB/assembly/已有验证报告，以及 `http://127.0.0.1:8931/TigerMessenger/` 同源页面上的单船工厂实例；未启动完整大战、重新导出或渲染模型。

## 实测资产与当前入口

- 浏览器新建 `createFisherBoat()`：340 个遍历节点，对归档 `fisherBoat.source.json` 的名称和父级逐项比较，**0 项不匹配**；26 支桨、11 个 `InstancedMesh`，每个 26 实例；没有优化绑定标记。左侧前两桨 phase 分别为 `0`、`.22`，右侧首桨为 `.11`。
- [原工厂](../src/assets/harbor.js#L115) 返回同一个 `fisher-boat` 根，保留 `userData.oars/crew/oarPhase/oarSpeed/oarImbalance`、`kind` 和 `collideRadius=6.8`。船体子节点在工厂末统一下移 `.18`；不能在适配时再叠加一次吃水位移。
- [v4 GLB](../assets/models/optimized/warship-battle-v4/warship-battle-v4.glb)：3,391,960 字节，964 节点 = 340 原节点 + 286 展开的实例节点 + 338 新增节点，616 个 mesh 条目，**0 个 glTF animation**。SHA256：`10144f91beac27312813b7166683dce4ec3b2f933a8a67dca7ff753653d4e276`。
- [assembly](../assets/models/optimized/warship-battle-v4/warship-battle-v4.assembly.json) 为 32,613,619 字节，60 fps、301 帧，每帧 486 条动态矩阵。它是离线审查资料，不宜全量嵌成页面启动 JS。GLB 仅 frame 1，不能通过 `AnimationMixer` 自动取得那 301 帧。
- 原始节点由 `three_node_id` 标识，新增节点由 `warship_added_id` 标识。136 个隐藏归档节点带 `candidateHidden` 和 `archivedHiddenMeshIndex`；保留节点和存档几何不等于应把旧壳/描边再次画出。

| 调用位置 | 当前实际行为 | 回接影响 |
|---|---|---|
| [harbor.js:2464](../src/assets/harbor.js#L2464)、[buildingCatalog.js:199](../src/core/buildingCatalog.js#L199) | 港口/资产目录使用同一原工厂 | 全局默认替换会同时影响港口交互，不能只测苔庭船 |
| [canalBoats.js:64](../src/world/canalBoats.js#L64)、[:140](../src/world/canalBoats.js#L140) | 运河及海面巡航船，持续更新划桨与失衡 | 首次适配应显式选择实例，避免同步改所有船队 |
| [moebiusSwamp.js:1971](../src/world/moebiusSwamp.js#L1971)、[:2085](../src/world/moebiusSwamp.js#L2085)、[:2816](../src/world/moebiusSwamp.js#L2816) | 修船、停船、离港及减速动画 | 新几何须保留维修挂点/原对象引用；起停不能直接循环播放审查片段 |
| [saihojiPhalanx.js:609](../src/world/saihojiPhalanx.js#L609)、[:2398](../src/world/saihojiPhalanx.js#L2398) | 苔庭运兵与红方增援，船根 scale=1.7 | 保留根、球面朝向、路线和缩放；候选导出根不能重复套用 |
| [boatRide.js:108](../src/player/boatRide.js#L108)、[:192](../src/player/boatRide.js#L192) | 玩家上船时 `scene.attach` 原船根，驾驶时原桨更新 | 替换根或覆盖世界矩阵会破坏驾驶/摄像机关系 |

## 节点与动作差异

| 部件 | 原 Web 契约 | v4 差异与具体风险 |
|---|---|---|
| 船壳、甲板、眼 | `n1` 船壳；`n231/n233` 甲板相关；`n253` 上层平台；眼 `n23/n25/n47/n49` | v4 收尖两端、修改平台与板面并将眼移到卷曲 **-X** 端。原 **+X** 撞角/航向保持。按目标主 3q 的视觉布局，不得因眼的位置把路线和尾迹方向倒转。眼几何已写回原局部坐标，必须保留节点原矩阵，不能再把 root 坐标当 local 坐标 |
| 桨根 | `n63 + 5*i`，`i=0..25`；`userData.baseQuat/side/index/phase` | [原相位](../src/assets/harbor.js#L254) 为同舷 `i*.22`；v4 改为同舷 `0`、右舷额外 `.11`。只换桨/船壳几何仍会执行旧互碰轨迹。`rows[i].phase` 也须同步，否则桨与身体不同拍 |
| 桨手 | `n219` crew；`n220..n230` 为11个26实例的 `InstancedMesh`，顺序 torso/skirt/head/helmet/crest/crestFeathers/crestStems/armL/armR/legL/legR | 归档 source JSON 的 `type` 为 Mesh，但另有 `instances` 数组；不可仅看 type 判成普通 Mesh。GLB 将实例展开，普通节点替换器会漏掉 `setMatrixAt` 动画或把26人重叠。应保留原实例对象/parts引用，明确 `nXXX:iN` 与 `instanceMatrix[N]` 的映射 |
| 手与新增前臂 | 原来的 `n227/n228` 只是一段摆臂 | v4 增加52只手、52段前臂；分别挂 `n227/n228`。普通 Object3D 子节点**不会自动继承某个 instanceMatrix**，须用该桨手实际肩/肘/桨柄计算自身矩阵，不能仅 add 到 InstancedMesh 下就算握住 |
| 握点/桨架 | 原桨根位于舷侧，原手臂只按 phase 摆动 | v4 每桨新增 `add:oar-handle-i`、collar、oarlock，左右手绑定桨局部 `[0,-.15,0]` 与 `[0,-.23,0]`。根枢轴、加长的内柄和身体位置须作为一组移植，不能只换手网格 |
| 桨手身体/麻醉锚 | `crew.userData.rows` 内保存 x、side、phase、sedateT、attach、oar；`n193..n218` 为26个 attach | v4 正常划桨坐位侧距 `.16`、登船时 `.35`，x 偏移 `-.1`；原 Web 坐位侧距 `.28`，独立 attach 还承担麻醉弹附着。仅修改可见实例会让命中点和身体现实位置脱节 |
| 新跳板/通路 | Web 无 v4 跳板驱动 | `add:boarding-hinge` 根点 `[1.94,.664,.48]`，长1.35，向 +Z，收起 X=-π/2，审查展开 X=.12；26个 `add:seat-leaf-i`、前支索 `n325` 和帆共同让出通路。不能单独转跳板 |
| 灯、尾迹及原材质 | `n337/n338` 灯笼、`n339` 夜灯；尾迹池由原代码动态加入船外父级 | 应保留原灯对象、夜间强度/显隐、贴图/程序材质与尾迹生命周期；不要用 GLB 材质覆盖所有原 VFX。候选几何/材质需共享并明确所有权，不能销毁源共享材质 |

[updateWarshipOars](../src/assets/harbor.js#L429) 不只是视觉函数：它平滑速度、推进/冻结相位、计算麻醉桨下垂和两舷划力，再驱动 [updateWarshipCrew](../src/assets/harbor.js#L949) 与尾迹。[applyBoatOarWobble](../src/assets/harbor.js#L608) 消费失衡值；[sedateWarshipCrewNearest](../src/assets/harbor.js#L627) 使用桨手附着节点。v4 保存的301帧没有覆盖麻醉、任意相位冻结/恢复、单舷失衡或玩家前后驾驶。把该函数整体替成关键帧播放器会丢掉这些现有行为。

换缨和显隐也必须保留：[paintBoatCrewCrest](../src/assets/harbor.js#L1570) 只按 `crew-crest/crew-crestFeathers/crew-crestStems` 名称换材质，且同 side 幂等。换几何后若恢复成源红材质，再调用同 side 不会重刷。不能让所有船共用可变颜色材质。`emptyBoatCrew`[:1591](../src/assets/harbor.js#L1591) 与 [harborLogistics.js:128](../src/assets/harborLogistics.js#L128) 只隐藏 `warship-crew` 整组；任何拆到船根的可见桨手都必须同步该状态，否则出现空船仍有身体或悬空手。

## 登船调用没有连接候选跳板

1. [spawnWave](../src/world/saihojiPhalanx.js#L608) 创建5×5独立登陆兵 cohort，初始隐藏，父级是战役 root，不是战船。船上26名桨手与25名登陆兵在数据上本来分离。
2. [首次到岸](../src/world/saihojiPhalanx.js#L3489) 直接调用 `placeCohort` 在岸上定位；[返航](../src/world/saihojiPhalanx.js#L3507) 在 `BOARD_HOLD_SEC` 倒计时后将 cohort 隐藏，再开船。没有25个甲板座位/站位、逐人通路、离船落地点、队列占用或跳板完成门槛。
3. [广场下船](../src/world/saihojiPhalanx.js#L775) 直接布置岸上队伍并调用 `emptyBoatCrew`，把“25兵下船”表示成“26桨手消失”。这是现有叙事行为与独立桨手语义的冲突，**几何适配层不应悄悄改掉它，也不能称实例恢复已解决**。
4. [玩家上下船](../src/player/boatRide.js#L108) 隐藏玩家并挪到船位；下船使用固定侧向距离1.65及径向高度，没有走 `add:boarding-foot`。[港口巡查](../src/assets/harborLogistics.js#L150) 使用独立 `boatSideWorld` 路径并切换 crew 显隐，同样没有候选跳板契约。
5. v4 展开必须先停桨，再侧移桨手 `.16→.35`，延迟折座叶、收帆至 `.22`，前支索下端 `[2.18,.64,0]→[2.18,.64,-.4]`，最后保证板脚落在真实岸面。`.12` 只是审查角度；真实球面/旋转缩放下须将岸面命中点转到船局部求角，且停泊位置要满足可达范围。

## 最低安全范围与尚缺验证

**第一步可限定为一艘显式选择、不可驾驶/不登陆的停泊审查船**：保留原根/340节点身份与父级，导入 v4 局部几何，使用完整 frame1 的桨手/握点配置，跳板收起；仅用于同镜头视觉检查。它应标“停泊模型候选”，不替换全部 `createFisherBoat()` 默认，也不声称航行动作已接。只换船壳而保留旧桨手姿态，连 frame1 的 v4 净空结论都不能继承。

**最小的实际航行回接**必须一次完成同舷同步相位、11组实例矩阵映射、52手柄约束、身体/attach一致、麻醉/恢复分支、原速度/失衡/尾迹，以及换缨/隐藏/销毁。应保留 `updateWarshipOars(boat,dt,moving)` 接口，将其状态输入交给候选姿态求解；不改变路线/伤害/登陆调度。先用单船起停、冻结恢复、左右麻醉、换缨和隐藏恢复测试，明确帧率/实例数/绘制开销，再扩大范围。将964个GLB对象逐船照搬会把原11次实例绘制展开，616 mesh 条目不能当成原性能预算。

**真实登船另立后续范围**：v4跳板局部几何、停止条件、实际岸面/落脚和25人调度都尚未接入。不得将一次画面可见或单兵通路视为25人全流程验收。

已有 [v4 验证摘要](../assets/models/optimized/warship-battle-v4/validation-summary.json) 通过的是301保存帧（181起停 +120展开/收回），15,652次握点检查最大误差 `1.712e-7`，指定身体/船壳/桨检查与相邻桨检查无失败；板面450个支撑射线在局部连接处无缺口，最大相邻高差 `.017932`。**它没有重跑 v2 的901状态研究，也没有重跑新甲板上的单兵通路、25人调度或完整身体/舱室/货箱碰撞。** 原26桨手仍属旧简脸/头盔家族，不计入已优化六款罗马战斗兵。

此次浏览器探针仅核对当前单船结构和原相位；所有模型动作与几何数值来自上述已有 v4 报告，没有把静态审计记成新增动态测试通过。
