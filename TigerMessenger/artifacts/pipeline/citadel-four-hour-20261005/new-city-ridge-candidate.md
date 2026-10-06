# 新城连续低山脊：独立候选 v1

2026-10-05。状态：模块和独立 CPU 测试完成；尚未在实际场景接线、截图或验收。默认关闭，不改变当前发布配置。

目标依据：已查看 `citadel-target-20261005/target-v10-low-new-city-ridge.png` 及 r20 新城/海湾实景。概念图要求旧城右端到新城背后连续低山脊，新城峰顶仅略高蓝穹顶；前湾与交通保持开放。本候选是项目设计的连续高度场，不声称使用 Oskar 未公开算法，也不称为 WFC。

## 接线接口

```js
import {newCityRidgeCandidateOptions, surveyNewCityRidgeAnchors,
  applyNewCityRidgeCandidate} from './newCityRidgeCandidate.js';

// 必须在最终 bay relocation、既有 shapeMountainLandform 后调用。
const candidate = applyNewCityRidgeCandidate(castle, {
  ...newCityRidgeCandidateOptions(), // 仅 citadelNewCityRidge=1 开启
  radius, curves,
  // sceneRoot: scene, // 可明确提供；省略则向父级找到根
  // anchors: [{x,z,crestY,frontWidth,backWidth}, ...],
  // peakCeilingY: measuredBlueDomeTop + 3,
  // protectedObjects: [extraMeshOrGroup], // 在默认保护集合之外追加
  // reservedFootprints: [{name,min:[x,y,z],max:[x,y,z]}], // final castle local
});
if (candidate) surfaces.push(...candidate.surfaces);
// 随后按既有流程 refine/material、最终 surface index、植被和云。
```

不再把新增面送入 bay deformation 或旧 massif shape，否则会二次形变。返回 mesh 名为 `citadel-new-city-continuous-ridge-surface`，root 若使用后续正则选面，需显式纳入。模块本身不修改 `mountainStudy.js`、release、任何建筑或旧 backdrop 可见性。`dispose()` 只清理候选 solid；父流程生成的植被、index、云缓存仍由父流程回收/重建。

`surveyNewCityRidgeAnchors(castle)` 从最终实际顶点测量蓝穹顶与旧山 bounds，返回 `castleMatrix/blueDome/oldMassif/city/anchors/peakCeilingY`。自动 anchors 是**构图提案**，不是已验收接缝。特别是左端约 x=0、z=-31 的预置初始位置，需要 root 实际视图采样校正。静态 `citadelRidgeHeightfield.js` 为旧版快照，未用作最终几何支承。

## 几何及保护

- 一张共享索引的连续带状网格，前侧两处不等宽肩台、后侧缓坡、连续低脊线。没有独立圆锥对象。默认 96×32 采样，封闭底壳与裙边均在官方海面下。
- 海面以最终 castle-local 竖线与 `officialOceanLevelAt` 球面迭代求交，保持 anchor 的 XZ；不是再次把旧作者坐标径向弯曲。
- 左端读取既有最终山体真实三角形高度，用 16 m 过渡区内叠接；旧山 position/index 全部只读。**这是网格重叠接合，不是把旧山边拓扑焊接。** 实景是否有露缝、穿插线或接头突起尚待验收。
- 桥面、楼梯、基础、港口/平台、铺装环取实际最终顶点 footprint；保守扩张一整个采样单元对角线+2 m。区域内候选顶面降至海面以下 3 m。铁路 1200 点/曲线，保护平面半径 12 m+采样余量。实际全场景扫掠检查仍必须运行，不能用这些参数代替测量。
- scene 级 `citadel-trojan-horse` 及子级系绳班组也测实际 footprint，不能只遍历 castle。另从已完成 composition/bay 的 `horseReservation`、`statueAnchor` final castle-local 预留 10 m/12 m 半宽活动域；这是明确的候选保守余量，不是作者参数。`externalHorseMeasured` 和 `protectedReservations` 可审计遗漏。
- 默认未删除旧 backdrop。需实景判断是否有叠层，并由 root 决定候选中隐藏何对象，不能自动重造/删除旧城。

## 独立证据

`tools/pipeline/test_new_city_ridge_candidate.mjs` 和本目录 `new-city-ridge-candidate-tests.json`：默认禁用不改树、重复应用不加对象、释放与确定性通过；旧源 position/index/world matrix 哈希不变；20,904 条边均双向成对、6,970 顶点一个连通实体、无退化/翻面；最小面积 0.4106 m²，底壳厚度≥8.999999 m；旋转且偏心的球面求交误差 <1e-8 m；独立保护区射线 383 点全部低于海面。额外场景级木马和独立活动域验证通过。

这些是可控 fixture 的 CPU 检查。实际新旧山相接、真实桥铁路净空、蓝穹顶相机投影关系、GPU 材质与植被承托、全景美术效果都未因本测试而获得通过结论。
