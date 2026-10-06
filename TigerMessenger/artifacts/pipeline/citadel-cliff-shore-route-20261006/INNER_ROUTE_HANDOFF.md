# 内湾双层交通桥候选交接

本轮只实施曲线求解/诊断，未安装生产铁路、未移动桥或演员。当前路线不是 WFC，使用显式相切世界三次 Bezier + 径向 Hermite 高程以及真实源线端点修正。

## 当前最佳版

`inner-three-lines.json` 是最新交接，不使用较早 `best-route-layout-diagnostic.json` 的前景外移版本。

- 东到西，保持原 global increasing-u 方向。
- 上桥拟接岸旧 `[-32.14,45]`、新 `[17.94,62.89]`（castle XZ），相对旧出口前移约 41 m；绝对上桥高程仍由真实下轨和车顶净高反求，尚未生成上桥。
- 中央段由报告的 `base.report.bridgeIndices` 追踪，不把岸段离崖超限当桥豁免。
- 红最小弯半径31.426m，蓝27.398m，中心29.412m；半米采样。
- 最大径向坡度红1.734%、蓝1.732%、中心1.792%。
- 源线端点位置误差<2e-12m，切线误差<0.018°；各线独立u。

复原：

```js
const red = replayTargetCliffShoreCurve(data.base.report.serialization);
const blue = createTargetCliffOffsetCurve({
  base:red, offset:data.lanes.blue.offsetReport.offset,
  ...data.lanes.blue, blendLength:30
}).curve;
const center = createTargetCliffOffsetCurve({
  base:red, offset:data.lanes.center.offsetReport.offset,
  ...data.lanes.center, blendLength:30
}).curve;
```

工厂导出来自 `src/world/citadel/targetCliffShoreRoute.js`。本文件报告含 samples，但不得用低分辨率 Catmull 拟合 samples 再冒充同一曲线；重拟合必须重测半径/切线。

## 地形与未通过项

单独的 `old-retained-cliff-cut.json` 提供 root `createTargetCoastalCliffCutField` 可消费 cuts。它覆盖旧城西部保留原轨的海侧裙脚，不能只修新连接段末尾24个侵土点而忽略旧原线。

应用该 cuts 后，用实际目标工厂1.7m闭合重网格、真实三角向下射线，红5220/蓝5247有限车底点均无已知地形或官方海面侵入。目标网格不存在的点红143/蓝627独立列出；它们不意味着其他世界mesh不存在。不是全车连续扫掠，也尚未检查桥墩、洞顶、建筑、货物或全世界碰撞。

旧保留线路有限4680点中，已有地形侵入3345→0，785点超原目标山域；切坡最大114m位于球面远西背侧裙片。完整主峰、草台、所有结构的保护仍待整网格检查，不能因此数值把整片西山删掉。fields 本身保护城台core .78；线路原审计使用更保守 .85，不代表完整平台边缘验收。

## 测试

`tests/world/targetCliffShoreRoute.test.mjs` 6项：有限多段搜索、广场绕行、缺海面/实体拒绝、Bezier曲率切线、离岸过远拒绝、精确重放及伴线端点修正。全部通过。CPU结构通过不计为美术分；仍需主线程同机位实景、目标构图及全场有限实体检查。
