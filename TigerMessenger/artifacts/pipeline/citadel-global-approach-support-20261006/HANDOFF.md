# 直接 import 的整包工厂

新增 `src/world/citadel/targetEastGlobalCrossingRelease.js`：

```js
const package_ = createTargetEastGlobalCrossingRelease({
  enabled: true, sourceCurves, retainedRelease: oldUserMarkedProductionRelease,
  candidateInput: shiftAudit.candidateInput,
  terrainArtifact: finalSurfaceArtifact,
  castleMatrix: oldUserMarkedProductionRelease.castleMatrix,
});
```

不重新造路线。下方的手工低层合同现在均封装进该工厂：

- `release` / `startupPreview.curves`：唯一新轨、车、站、联锁输入。
- `terrainPreparation.bootstrapRelease/bootstrapStartup/bootstrapCurves`：唯一旧正式地形来源。先旧bootstrap→refine→source hash严格核对→原Mesh换exact `terrainPreparation.artifact`，然后首次构建surface indices/种树/云/城/导航。**该实际启动顺序未由本离线fixture代验。**
- `approachOptions`：精确本轮210.935m支撑参数、实际车盒、全global扫描、23.437m跨空。调用方只需加真实world径向`sampleGround/sampleSea`；确认原桥末跨存在后传`sourceDeckInterface: package_.expectedSourceDeckInterface`。未确认时此字段故意不自动提供。
- `structureOptions`：6.9m上步道、新岸柱宽1.05、55/65关闭；加release、真实castle samplers/connectionTargets/obstacleGroups给现城市结构工厂。
- `exclusionPlan[lane]`：final global u的`globalApproach/cityStructure/wholeReplacement`，active=false；两种支撑均实际建成后才能激活。
- `rollback`：原production release、bootstrap startup和原source引用。工厂只拥有数据，不创建GPU资源。

`sourceDeckInterfaceVerified:false`、`startupSequenceVerified:false`及release hard flag保留；未自动安装。2项整包测试覆盖default-off、源输入链、实测车盒、bootstrap与新consumer分离和无缝覆盖；合计本批20项。

---

# 最小调用合同：仍默认关闭

## 数据候选

```js
const trial = createTargetEastGlobalCrossingCandidate({
  enabled: true,
  release: eastPrepared.release, // 已校验final artifact的east wrapper
  sourceCurves,                 // 原完整global source，不是上轮splice后的curve
  sourceExtensionMetres: 50,
  startMetres: 10, endMetres: 300,
  lateral: 0, frontLoadedGrade: .0395,
  independentRadialProfiles: true, tailGrade: -.004,
});
if (!trial.report.finiteShapePass || !trial.release || !trial.startup.splice) reject();
```

完整global消费统一`trial.startup.curves`；城市工厂统一`trial.release`。不要取`trial.curves`当完整global：它只是replacement。不要继承base的旧sourceImpact/centerCorrespondence；新模块已清空过时诊断。

## 新global接驳支撑

```js
const support = createTargetGlobalRailApproachSupport({
  enabled: true,
  curves: Object.fromEntries(['center','red','blue'].map(
    lane => [lane, trial.release.segments[lane].globalApproach])),
  vehicleSweepCurves: trial.startup.curves, // 必须全global，查保留回程
  sampleGround, // world p -> {point: actualWorldRadialHit, objectName}
  sampleSea,    // world p -> {radius, upperRadius, officialUpperRadius}
  vehicleBox: measured.box, vehicleProvenance: measured.report,
  sourceDeckInterface: {bottomSections, globalInterval},
  supportGaps: [{id:'retained-global-return-underpass',
    start:190, end:207, maxSpan:28}],
});
if (!support.report.built || !support.report.finitePass) reject();
```

`bottomSections`为当前完整center最终global曲线在生产N=max(240,floor(L/.6))采样表中，replacement开始前**最后两站**的真实8.15m宽、底偏移-.24的左右角点，形状`[[leftXYZ,rightXYZ],[leftXYZ,rightXYZ]]`。原全局deck必须真实生成这些站；不能仅传两组猜点。离线脚本复现了采样公式，正式consumer构建后还要核实mesh存在。

support.group已经WORLD坐标；装到world scene或用显式world→castle转换，禁止再无脑乘castle.matrixWorld。它不铺轨、不加车、不改山，没有上层walkable。海床回调world-radial，不用castle+Y。dispose只销毁本工厂资源。

## 城市结构

调用现`createTargetCliffTransitStructure`，release=trial.release，真实castleMatrix与最终remesh/sea/foundation samplers，原真实connectionTargets，walkwayHeight6.9、galleryPierWidths.newShore1.05、newCityTransitLinks=false。本批未改shared factory。

全局接驳/城市覆盖区间在`trial.release.cityGalleryCoverage.globalParameterIntervals[lane]`，属于**最终global u**。source锚与保留区间另在report.sourceImpact。所有结构通过并真正挂入后，方可将这些覆盖用于通用桥排除；当前release的hard flag故意仍在。

事务需要同时拥有：final artifact epoch安装、结构、轨/枕/车/站/联锁、对应ground/vegetation/cloud缓存，并提供完整回退。现生产API尚不能凭`citadelRailSplice`单参自动完成，不能把本候选当已接线。
