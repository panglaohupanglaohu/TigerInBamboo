# 原雕塑与原木马回接方案（只读）

2026-10-06。本报告查源码，不移动对象，不复制木马。新平台目标为最终castle chart `[62,3,76]`；任何建议点均需实际地面及路径验证，不是已批准落点。

## 身份与坐标证据

- 雕塑工厂 `src/world/citadel/plazaStatue.js:7`：组名 `citadel-plaza-hero-statue`，sourceId=`citadel-soldier-statue-r04`，来自Blender资产，scale=1.2，内部静态合批。`westCity.js:265`先在旧作者框架放 `[PLAZA.statueX,4,76]`。
- `newPlazaLayout.js` 的PLAZA是**原作者布局坐标**：默认shift6，statueX65、horseX81；r03时shift10且statueX仍65、horseX85。不能直接把这些数写进新最终castle chart。
- `compositionFrame.js`先整体[-52,0,0]，旧城+30°、新城−30°绕各自锚点；其后 `bayLayout.js` 对整个westCity施加球面刚性旋转，并把statueAnchor/horseReservation等缓存转换到最终castle-local。必须取实际matrixWorld/最终userData，不再次套作者角度。
- 木马 `citadelRange.js:1562` 只创建一次 `createCitadelTrojanHorse`，scale=.72。1680—1691将最终horseReservation经patrolCastle.localToWorld写到木马position，然后直接 `scene.add(trojanHorse)`。所以木马是**scene子对象、position世界坐标**，不是westCity或castle子对象。`rangeSystem.trojanHorse`、骑乘和战斗系统引用的是这个实例。
- 它还持有tiedownSquad、baseQuat、rangeLocal、placement、nightInfiltration等状态。不能复制一个静态马到广场，再称功能保留。

## 当前隐藏原因

`tools/pipeline/citadel_four_hour_harness.js:145`布局预览把castle内非山/植物/云的Mesh和Line登记到layoutVisibility并隐藏；`:23` suppress每次刷新继续隐藏。因此原雕塑即使Group.visible=true，其合批子Mesh仍可能false。木马在scene外层，不经过这次castle.traverse，所以仍可看见旧位置的原actor。这正是“雕塑消失但马还在”可能发生的具体代码路径；不是资产丢失。

回接必须把原雕塑**整条祖先可见性和子Mesh**从候选隐藏集合中豁免/恢复；不能只设雕塑Group.visible=true。保留原visibility快照，候选关闭恢复。

## 建议实施次序

1. **只读快照先行。** 记录两原对象uuid、parent.uuid、local matrix、matrixWorld、scale、每子项visible、sourceId；木马另保存baseQuat、placement、rangeLocal及actor getState。读原雕塑实际世界原点转换到castle-local，木马也用castle.worldToLocal(worldPosition)，不要从westCity.position猜。
2. **平台候选点测量。** 先试雕塑 `[56,?,76]`、木马 `[72,?,78]`，入口路线终点 `[62,3,64]`留中间通行带。此为搜索中心，可在±3m小范围找承托，不是强制落点。用实际雕塑脚座与木马轮子接触点，不以整个包围盒底角代替脚。逐脚射线求最终平台，所需y含资产局部脚底偏移；要求同一支撑面族、最大脚差受限。若原马尺度无法承托，报告失败，不缩马、不挪山。
3. **原雕塑可采用保持身份的重挂。** 用`castle.attach(originalStatue)`保住初始世界姿态，然后按最终chart设目标位置/朝向；保留原scale。铺装环/低花坛是独立对象，需要另行选择是否跟随，不能默认连旧整块广场一起搬。回退时恢复原parent和矩阵。
4. **原马保持scene父级。** 新点经castle.localToWorld得到世界位置；朝向目标为新城入口/已建出口路径。使用castle世界旋转组合本地yaw，而非把castle坐标直接赋position。保留原对象、geometry、material、children、交互回调和landmarks引用；同步baseQuat、rangeLocal与placement.castleLocal。清理旧缓存必须走真实range坐标转换接口，不能把castleXZ冒充rangeXZ。
5. **先解决潜入系统重定位，再发布。** `citadelInfiltration.js:463`把horseGround复制为闭包baseGround；`:705`的setRoutes只改路径并rebuildPlans，不改baseGround。仅移动马+setRoutes不足以更新下马/绳索/回程起点。应给原控制器增加事务式`relocateGround`能力，更新所有派生落点/静态班组锚点，或在保留原马前提下受控重建控制器并释放旧控制器全部资源。当前是否具备可靠dispose需另查，不能先盲重建。
6. **路径数据统一。** 原computeInfiltrationRoutes依赖westCity.walkRoute/processionalEntry/horsePlazaExit（citadelRange.js:1766起）。新阶梯/新桥未接入这些运行路径时，马虽站好、士兵仍走旧城。应先产生统一最终世界路径并验证连续、坡度、净空，再传setRoutes；不覆盖用户保存的旧布局。迁移失败整个候选回退。

## 必须通过的验证

- 原马和雕塑UUID不变，创建前后实例数各1；非所需旧资产不dispose。候选开关反复两次位置/可见性可恢复。
- 原马骑乘目标、腹门回调和tiedownSquad仍绑定同一actor；日/夜切换后不跳回旧位置，士兵下马、返马路径落在新平台。仅`errors=[]`不算通过。
- 实际脚点承托、雕塑环与木马包络不相交；入口—广场—桥通行带全宽净空。面海视图同时能认出雕塑和马，不被新房/树冠遮满。
- 先无云近景验证，再开云；固定山体geometry hash不变。只允许新增独立铺装/承托部件，不能以改山恢复支撑。

该方案尚未执行。尤其闭包baseGround与旧route引用是功能迁移的阻断项，不能用一个外观正确的复制木马绕过。

## 补充核查：控制器入口、雕塑子树与测量字段

本补充在迁移API实现后只读完成；没有调用真实场景迁移。

**控制器获取：** `messenger.landmarks.citadelRange.nightInfiltration` 才是含 `relocateGround/getPlacementState/setRoutes/update` 的控制器（citadelRange.js:1933）。`trojanHorse.userData.nightInfiltration` 只是它的root Group，不能对其调用迁移方法。若range刚创建而尚未ensure相应场景，字段可能null，需等原actor正常创建，不能补建替代马。

**雕塑完整子树：** 用原工厂在Node内独立构建检查（不是场景副本接入）：`citadel-plaza-hero-statue` Group下面正好4个Mesh，4个name均为空、无子节点。合批前部件名字不再存在，不能以`getObjectByName('statue-head')`之类伪名字恢复。实际运行额外效果若增加子树需以现场traverse为准。该工厂原点即脚座底，保留scale1.2时包围盒为x/z ±1.59600005、y0—8.25600014；这可指导脚座环采样，不是运行时最终坐标。

**可见性恢复：** 对原Group的完整descendant集合按Object3D身份从layoutVisibility屏蔽清单豁免，逐项恢复之前保存值（不强迫原本就hidden的效果显示）；还应列祖先visible。仅name为空的4个Mesh正是按名字过滤容易漏掉的情况。回退把原map及每项visible原值放回。禁止把整个highland-west-city显示回来，否则旧房/旧广场与候选重叠。

**木马脚点：** 原资产轮心local x±2.55、z±2.7、y.68，轮半径.68；理论接地点y0，原actor scale .72后横距±1.836、纵距±1.944。先取实际原actor矩阵将四接点转世界，再射线核对；其子班组/绳索包围盒不能代替四轮底。转角后必须重新采四轮，不能只测原点。轮子几何与描边实际略差可给小容差，数值需记录。

### 建议harness一次导出的只读JSON

- `castle.matrixWorld`；`westCity.matrixWorld`、`compositionOffset`、`bayLayout.rotation`；`westCity.userData.{plazaAnchor,statueAnchor,horseReservation,processionalEntry,horsePlazaExit}`，标注这些缓存是final-castle而不是westCity-local。
- 每个原物件：`uuid/name/sourceId/parent.uuid/parent.name/localMatrix/worldMatrix/scale`、`worldPosition`和`castleLocalPosition = inverseCastle × worldPosition`；完整ancestor链visible，以及每个descendant `uuid/name/type/visible/layoutVisibilityHasEntry/layoutOriginalVisible`。
- 原马：`range.trojanHorse.uuid`与scene检索UUID是否同一、`baseQuat`、`placement`、`rangeLocal`；controller存在及`getState()/getPlacementState()`。只序列化数据，避免递归整个Object3D。
- 最终surface：实际可见地形meshUUID/geometryUUID/position.version；广场搜索点 `[56,76]` 和 `[72,78]` 周围±3m每1m采样，记录原始命中face/world/castleLocal/normal；雕塑脚座中心+8环点、木马四轮点及中心分别采样。所有miss保留，不以解析高度替代。
- 目标姿态下包围盒/脚点、到route端点[62,3,64]及主路径的最近距离、与原地标/植物/房屋包络交叠。额外记录建议方案，不写position。

现r26保存的JSON未含上述原地标世界矩阵/脚点，所以本报告不能凭原作者常量给出“木马现在的最终castle坐标”。需要这一次现场导出才能确定真实新落点；建议坐标仍只是可行性搜索中心。

### 迁移后可执行验收顺序

先确认controller.safeToRelocate为true（白天空闲），构造真实支撑点及worldQuaternion，再调用原controller.relocateGround；仅ok后更新外部rangeLocal/placement等元数据。保存API回退句柄和外部元数据快照。若随后又setRoutes，会使旧回退句柄失效，应把需要的新路径放进本次迁移参数，一次提交，不先迁移再随手setRoutes。

验收：场景原actor数量1、UUID相同、四轮gap合格；调用前后getPlacementState的baseGround/anchors/drops一致迁移。再实际日→夜→回程→日验证原actor腹门及兵组，不以API单测代替。若触发战斗/回程，回退会安全拒绝，不能强制改pose；等回到允许状态再使用当前有效回退或明确重定位事务。候选开关的外部可见性/元数据回退必须与控制器回退配对，失败不得只恢复一半。
