# 东岸 production release 候选包装器 v1

已实现默认关闭的离线包装器；没有修改现有生产/main/tram/candidate，没有安装，没有浏览器/GPU。版本 `east-cliff-production-candidate-1`。

新源码：`src/world/citadel/targetEastCliffProductionRelease.js`。
新专测：`tests/world/targetEastCliffProductionRelease.test.mjs`。
实际复现：本目录 `audit.mjs`，输出 `adapter-audit.json`。

## 调用与资源

```js
const prepared = createTargetEastCliffProductionRelease({
  enabled: true, // 省略返回release:null，不读取其它依赖
  sourceCurves,  // 真实原全球三线，不是已拼接global
  retainedRelease, // 当前 createTargetUserMarkedProductionRelease 的返回
  candidateInput: audit.candidateInput,
  terrainArtifact: remeshExpandedGeometry,
  castleMatrix: retainedRelease.castleMatrix,
  seaRadiusAt: world => 160.5 // 可选、调用方负责；这里只记录导引中心高度
});
```

返回 `release/startupPreview/mapping/eastCurves/terrainPreparation/rollback/report`。`release.curves` 是完整替换段；`startupPreview.curves` 才是闭合的全星球三线。后者给所有轨/车/站/联锁在创建之前统一使用。包装器不构造消费者，不处置借用曲线，无GPU资源或dispose。报错抛明确code，不会部分安装或把原曲线伪称新线。关闭候选/放弃新数据即可回退，rollback保留原release和source引用。

## 实际数据

|线|新source startU|原endU保留|新增原线替换跨度|完整替换段有限最小R|最大坡度|
|---|---:|---:|---:|---:|---:|
|红|.59|.798|157.0264m|25.9889m|3.2817%|
|蓝|.5925844302347414|.800|160.6875m|27.4172m|3.4645%|
|中心|.5924110319368087|.799|155.9814m|27.4877m|3.4923%|

顾问红蓝原东段精确回放，与其0.5m数据<1e-7m；未用JSON折线取代算法。随后以真实长度委托原release尾段，各线头尾拼接和闭合global均过原splice标准。

中心复用既有真实侧向偏移函数，以精确red为基准；其source接头独立求解，距偏移目标1.175cm，终点匹配原center release。174个几何最近对应断面单调，未使用相同u平均：红蓝距离3.9388–4.2377m，中心横向偏移最大.06598m，导引中心与实际双轨断面中点径向差最大.10285m。这是有限引导曲线校验，不是对向载货SAT检验。相对诊断球海半径160.5的中心轨点最低高度.649736m，不能拿它减去任意包络代替真实车辆/海浪检查。

原中央和旧岸segment直接保留引用，世界位置不变；新各lane ranges用真实长度映射。旧岸原source保留区间与瀑布旧段不变。保留 `walkingConnection.kind='stacked-connected'`。新东岸gallery应重建；中央原两条回城连接仍对应原真实桥头。追加广场55/65站号已在structureOptions明确设为false：需对新东段重新测量对应，不能直接复用旧站号。调用方不能强制打开旧索引后称新路通过。

8项包装器测试通过，联合原splice9项+alignment2项，共19项。包含原全球未替换段精确保持、尾段/中央/旧岸世界几何、错误参数与矩阵/地形元信息拒绝、禁用零访问、内部车辆迁移拒绝、进度往返映射、中心对应、实际联锁函数以同一新curve集创建。实际4货运站×2线原世界投影经两代splice迁移误差0；有限4096新最近点结果及3个联锁zone写入audit。不是实车停车/乘车/UI运行测试。

## 不能漏掉的地形安装条件

当前release上的 `coastalCliffCuts` **保留旧bootstrap输入引用，不代表新路线的最终地形**；`terrainDependency.required=true`、`heightfieldCutsSufficient=false` 明确这一点。

调用方必须遵循 `terrainPreparation.bootstrapRelease` 先构造旧生产地形，匹配artifact sourceHash后再替换为顾问完整闭合remesh。不能把新global curves先传旧railCliff heightfield重算base，然后硬套旧epoch artifact；不能替换后追加cuts/apron变形。包装器只校验artifact矩阵、sourceHash格式和拓扑报告，不读取真实scene源几何、没有重复全地形审计（`terrainGeometryAuditInherited=false`）。真实源mesh hash校验由顾问preview模块执行。当前candidate没有通用terrainDependency安装器，root必须显式处理这一步；不能单独将release塞现生产入口后宣称地形匹配。

源epoch：position772107960/index1617888706/vertices34612。artifact origin[85,0,82.5]、castleMatrix必须匹配；变换只用一次。完整几何81,440三角。替换后重建地形/基础/玩家/植物索引。此依赖是exact remesh安装契约，而非恢复旧中心沟槽cut。

## 未通过/待验证

- 顾问外部证据红173/蓝177山面姿态0和2949公共承托保持，不是本包装器新增全场验收。
- 顾问的额外.3m水储备仍失败；实际最低车体/动态波浪、完整对向列车、原演员与功能体未复验。
- 新东岸gallery新增长度、柱拱、上步道、附加广场链接、原海岸资产、船、瀑布和整条连续ground/body需最终geometry联合检查。旧中央segment不变不等于所有新柱站位通过。
- CPU不是GPU；材质、构图、性能、实际站点/乘车、导航未验收。report accepted/installed/structureVerified/actorsVerified/stationRuntimeVerified 均false。

所有权交回root。只新增本模块/tests/本报告目录，没有改动他人源文件。


## 后续合同补充：最终epoch与城市结构作用域

2026-10-06后续任务中只改本新wrapper/test：支持 `remesh-final-surface-geometry.json` 的明确nonindexed源epoch，但必须匹配provenance.baseline.after、raw闭合单连通边0以及final refinement三角数；缺index hash仍拒绝，只有index:null+indexed:false的完整provenance合法。最终refined拓扑和碰撞仍未认证。

新增 `cityGalleryScope:true`（默认false），或 `{entryCastleX:120}`。这会输出globalApproach和缩短的城市newShore segments/ranges，完整三线不变。`cityGalleryCoverage.globalParameterIntervals` 为每线最终global域上的城市结构区与globalApproach区。后者未建支撑，hardFailures保留。最新10项专测过；165.37m新城市廊道有限检测仍有1个基础未seated，不能安装。详见 `../citadel-east-structure-audit-20261006/REPORT.md` 与 `joint-structure.json`；旧结构整319m诊断保留，未抹掉。
