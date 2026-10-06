# 东岸真实路线接入：只读合同与最小包装器方案

2026-10-06。仅新增本报告；没有修改或安装源码，没有浏览器操作。已读实际生产 release、user-marked release/plan、splice/startup、tramSystem、freightInterlocking、candidate 和 structure 合同，并向顾问确认参数。工程分析，不是 GPU/通行/艺术验收。

## 已确认的数据边界

顾问入口：`src/world/citadel/targetEastCliffAlignmentCandidate.js` 的 `createEastCliffAlignmentCandidate({enabled:true,input,sourceCurves,retainedRelease,castleMatrix})`。输入来自 `citadel-east-shore-route-20261006/remesh-expanded-shift-audit.json.candidateInput`，地形来自同批 `remesh-expanded-geometry.json`；详见顾问 `REMESH_HANDOFF.md`。

|量|真实含义|
|---|---|
|red sourceStartU = .59|原全球 red.getPointAt 的归一化弧长参数|
|blueSourceU = .5925844302347414|原全球 blue 的独立参数，不用 red 的 .59|
|retainedReleaseEndFraction = .2683333333333333|各自当前 release replacement 曲线的归一化弧长参数，不是全球 source u|
|返回 red/blue.getPointAt(0..1)|仅新东段，原全球递增方向，从东源头到保留 release 接头|
|约新增157m|红线原源起点约 .6506955 向 .59 扩展的估计；蓝线须独立计算，不能复制157m|
|0.22m|瓶颈附近44m支持区的海侧局部偏移，已包含在精确回放 curve，不再次施加|

有限地形检查：红173/蓝177姿态，最终闭合山体三角 OBB 接触0、parity内点0；2949公共承托点保持，最大差约1.99e-6m。不是完整车辆/结构通过。最低扩张包络海面静余量红.09059m、蓝.10817m；波幅上界.067m，额外.3m工程储备未满足。演员、实际最低车体、连续动态水面、上廊和支墩仍未验。

## 建议下一步独占的新模块

我可独占新增 `src/world/citadel/targetEastCliffProductionRelease.js`、`tests/world/targetEastCliffProductionRelease.test.mjs` 和同前缀有限验证文件；不改顾问路线/重网格算法，不改现有 main、tramSystem、candidate 或生产 release。

拟接口（尚未实现）：

```js
createTargetEastCliffProductionRelease({
  enabled: false,
  sourceCurves,       // 原全球 center/red/blue，不能传已拼接全球线
  retainedRelease,    // 当前生产 user-marked 完整 release
  candidateInput,    // 顾问保存的精确回放输入
  castleMatrix,
  terrainArtifact,   // 只校验和声明依赖；包装器不挂场景、不处置共享资源
  centerSourceBracket, // 显式限定东源接头对应的 center 搜索支路
  validation
})
// { release:null, report:{enabled:false,...} } 当默认关闭
// 开启成功返回 { release, startupPreview, rollback, report }
// 失败拒绝候选，保留输入引用；不能静默把旧曲线报作新release成功。
```

包装器只准备可验证数据，永不自己安装。`release` 保持现有 `{curves,specs,segments,ranges,castleMatrix,worldCurve,coastalCliffCuts,structureOptions,walkingConnection,report}` 合同，并附加明确 `terrainDependency`。所有输入曲线借用且不可变；没有材质/mesh生命周期。

1. 直接调用顾问精确 replay。红蓝位置、切线与保存样本核对，不重建近似 Catmull 路线。
2. 每线组合 `newEast + retainedRelease.curves[lane] 的 [v,1]`。按两个真实长度分配新弧长，用分段委托，尾段原函数精确保留。连接前验位置≤1e-4m、切线≤.5°；不依靠 CurvePath 把不连续端点暗接直线。
3. specs.red/blue.startU 使用上述各自源参数，endU 保留该 lane 现 release 的真实 endU；replacementCurve 是完整组合段。`curves` 仍指 replacement 三线，不冒充已闭合全球线。
4. `prepareCitadelRailStartup(sourceCurves,release.specs)` 得到三线闭合全球预览；检查 status 必须为 `composed-before-construction`。它已有原子三线验证，失败会返回 original preserved，包装器须把此状态升级为候选失败，不能忽略。
5. `rollback` 保存旧 release 与原 source 引用/版本/区间；本轮推荐启动前选择，避免在线迁移正在载客的列车。

## center 的具体补齐方式与拒绝条件

缺 center 是真实待实现项。红蓝不能相同归一化 u 求平均：长度与接头参数不一致，那不是同一横断面。

最小路线：以顾问精确 shifted red 为基础，复用现有 `createTargetCliffOffsetCurve` 派生 2.05m 中线，不重写球面圆弧算法。中心起点在调用方限定的原 source center 支路内，按真实源头双线横断面中心求最近点并记录 sourceU/误差；终点精确取 retainedRelease.curves.center.getPointAt(v)，使用两端真实切线。不得无界全星球最近点搜索导致选中另一回程支路。该 center 只引导结构/联锁，不用于重新生成红蓝。

这只是待验构造，不预称正确：重新实测 red→center→blue 单调对应的横断面距离、切线方向、center 是否始终位于双线间、曲率≥25m、坡≤4%、首尾位置切线，以及三线整体地形/结构净空。偏移补间若造成端部居中失败则拒绝，并请顾问补精确 center 对应；不放宽容差、不随意增加另一条线路。center 首端 sourceU 和对应距离目前未实测，本报告不编造数值。

## ranges、segments、连接与 cuts 必须怎么更新

保留尾段位置后无需把中央桥重新搜索到邻近错误分支。设每 lane 新东段长 A、旧 replacement 长 B、旧接头 fraction v，新完整长度 L=A+(1-v)B。旧 release 上 q≥v 的弧长边界精确映射为：

`qNew = (A + (q-v)*B) / L`。

- 将原该 lane `ranges.newShore/central/oldShore` 的中央两端边界用上式映射；若任一中央边界 q<v，说明新段实际越过中央桥，须拒绝“仅东岸”范围或显式重新分段，不能直接套公式。
- `segments.newShore` 包含新东段加必要旧东岸尾部。central/oldShore 可直接保留原实际 segment 函数引用，确保原桥头世界位置、旧岸瀑布接口不因全段归一化改变而漂移。三段边界位置/切线必须再次相合。
- `segments.retainedOld` 和 `report.retainedOldSourceIntervals` 仍使用原 source 参数，其起点 specs.endU 未变，保留西岸开敞区间终点。不能把新的 replacement u 写进这个字段。
- `connectionTargets` 继续由 candidate 从真实旧城出口、新城楼梯前缘取值；不由路线报告伪造 Y。若中央 segment 引用不变，原两条回城连接可保持真实落点，但仍重测跨段support/body。
- `newCityTransitLinks` 中55/65等站号与新东段弧长相关，不能复用旧索引；应从已批准公共踏面端点反查新曲线对应站，再重算通路、栏杆开口和轨道侧向净空。无匹配就拒绝该链接，不移动公共广场。
- gallery 用新 center segment 完整重建，默认 upper6.9、width4.4；载货 halfWidth1.75、halfLength3.49、top5.36+margin.35。原支墩站距、上踏面与护栏不能保留旧位置假装新结构。额外源段约157m可能显著增加廊道长度与成本，需显式预算。
- 中央与西岸旧 cuts 可保留。新东岸不能仅根据新中心线再次运行旧 heightfield cuts 得到“近似”地形：已通过的是特定完整闭合 remesh。包装器应声明其 geometry epoch/hash、castleMatrix 与 origin；地形必须匹配后才可引用顾问的0接触证据。
- 新东岸若另生成 cuts，仅作为将来可重建工艺的数据且须重新测量，不能与精确 remesh 重复叠加。首次候选集成应先完成现生产山，再按sourceHash校验换为该完整remesh，不再在替换后追加旧cuts/apron变形。
- remesh buffer origin=[85,0,82.5]，mesh设position即可；重复apply origin是错误。原几何position hash772107960/index hash1617888706/vertices34612。epoch不同拒绝，不强装。

## 为什么需要一次启动事务，而不只是换显示轨道

实际 `tramSystem.js` 在构造最前调用 `prepareCitadelRailStartup`，之后全部消费者从返回的同一 `curves` 取数据。这是正确接入位置，现有 opts 只有 inner/marked 分支，新增包装器本身不会自动接通它；以后由root显式加入开关。

|消费者|必须用的新输入/重算|
|---|---|
|addTrackLane|同一次 startup.curves.red/blue|
|services与所有货车|同引用 red/blue、各自getLength；红direction+1、蓝−1不改|
|通用桥/洞/柱排除区|新center replacementInterval，以及原西岸端通过splice.mapOriginalProgress映射的openCoastEnd|
|货运装载站|factoryFreightStops/trainingDepot世界中心不动；在新service.curve重新最近投影，再用新trackLen计算整列车偏移。原4096采样约粗米级，需比较前后站台侧向误差及停车几何，不把“有progress”当对站|
|联锁|createFreightInterlocking(newGlobalCenter,newServices,FREIGHT_PITCH)重新创建；旧zone/owner不能继承|
|峡谷/告别与能量束|基于新service进度重建既有缓存；不改书店出生点|
|上下车|getNearestBoardable按实际车体距离，本身不需要旧u；但任何保存的乘车对象不能指向已经dispose的旧列车|
|山/廊道/玩家承托|同一release与实际remesh；重建terrain ray/BVH、provider、植被承托缓存|

现联锁按完整center每约2.5m查远隔≥100m且距离<5.2m的相交块，再用实际service车辆占用判断。保留旧center会漏/误建新交汇块，因此只有红蓝显示更新不合格。该算法本身为有限联锁，不等于新线路运营认证。

若未来热换线路：用旧startup.mapSplicedProgress先还原source位置，再用新startup.mapOriginalProgress迁移；被替换内部不可自动保位置，必须拒绝在线热换或另有明确停运/移车策略。不能保持旧normalized progress导致全世界列车跳跃。现在采用重启前统一构造更小、更可回退。

## 下一批应交付的有限验证

- disabled不调用replay、不变任何源对象；错误输入/矩阵/地形epoch/center支路不匹配拒绝。
- 红蓝精确回放；组合尾段与旧曲线世界位置/切线一致；真实三线source区间外委托原线且闭合接缝通过。
- 新旧进度长度映射、替换内部拒绝；三条 lane specs 任一失败无部分release。
- center横断面对应、三线距离/坡度/曲率；分段首尾零位置裂缝，原中央/旧岸世界轨迹保持。
- 从实际source工厂启动，站点与联锁都用这次startup引用；停止点世界偏差、装卸列车排布单独报告。
- 用最终remesh重建实际gallery+城市/原actor/瀑布/船体；三角 OBB/parity、上步道ground/body、接城阶/附加广场链接，分别保留失败与unknown。
- 完整真实车辆最低点/波峰动态余量与GPU同机位后续独立验收。本报告不把350个新东段地形姿态通过扩写为整线或上结构通过。

交回状态：只读计划完成；上述新包装器可作为下一独占实施子任务。本轮未生成包装器源码，未更改现运行场景。
