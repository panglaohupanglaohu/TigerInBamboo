# 新手绘铁路 + 同线双层连续步行结构

最终方向按用户再次确认的 target-v11：下轨上步行，三段 gallery 连续连接两城；独立短桥仅保留为显式回退分支，最终新模式不生成它。

## 生产调用

```js
release.walkingConnection = {kind: 'stacked-connected'};
release.structureOptions = {
  ...release.structureOptions,
  galleryPierWidths: {...release.structureOptions?.galleryPierWidths, oldShore: 0.9}
};
createTargetCityDetailCandidate({castle, cliffTransitRelease: release});
```

candidate 合并 `release.structureOptions` 默认，再叠加调用方 `cliffTransitStructureOptions`；`galleryPierWidths` / `galleryMaxSpans` 逐 section 合并，调用方覆盖保持优先。新参数 `galleryMaxSpans` 与 `galleryPierWidths` 透传给实际 gallery 工厂，并在 `galleries.*.structuralParameters` 报实际使用值。原 release 无显式新模式时行为保留。

源码所有权：本轮仅改 `targetCliffTransitStructure.js`、`targetCityDetailCandidate.js`；没有动 main/tram/地形或顾问的路线。structure 版本 `target-cliff-transit-structure-3`，candidate 已 import `targetCliffTransitStructure.js?revision=3`；主线程外部 candidate 缓存请用新 revision。

## 新线路实际结构

本轮使用 `createTargetUserMarkedTransitRelease`，真实生产 source curves → prepareCitadelRailStartup 最终拼接曲线；applyTargetTerrainCandidate 使用新 curves、新 coastalCliffCuts、同一 cliffTransitRelease，实际 1.7m 目标地形、planet mesh 和编译海面。不是旧 inner 776 姿态数据。

- 下轨三段长：新岸 156.595m、中央 52.891m、旧岸 145.061m。
- 实际拱数：9 / 2 / 9；上层径向距离轨面 6.9m，公共宽 4.4m。
- 新接城离散阶从 `[21.239178348,12.202944951,59.179408604]` 到 `[51,12,39]`，长 **35.9571m**；再通过真实短 connector 接第 14 阶。
- 旧接城离散阶从 `[-26.205606864,13.758016892,39.520142136]` 到 `[-32.231161646,17.3,3.767409819]`，长 **36.2569m**。
- 两条接城阶均最大 riser 0.15m，实际地形顶面探针及基础承托通过。它们由新中央曲线端点重建，不是复用旧 42m 坐标。
- `walkingMode='stacked-connected'`、`independentWalkingBridge=null`，无 `citadel-independent-short-walk-bridge`，保留真实三段 gallery、两条接城阶和新城短 connector。

## 已修复与保留证据

旧岸原 1.2m 柱在第 4 站 landward 外角撞崖，5 个脚样本中 1 点 `terrainAboveDeck=true`。改变跨距至 16m/21m 仍会在该岸段触崖，均保存为失败 JSON。将旧岸柱收至 **0.9m**，轨侧净空内缘保持，缩小实际外角/承台包络，18m 跨保留；新实际柱脚全部 seated，载货三角检测仍清空。没有掩盖采样、假地基、挖山或改轨。

新瀑布联合位置 `[-38.347981926,16.1,36.372847752]`，yaw **15°**，外挑 **11.468m**，供水连接 **24.6166m**；红蓝旧岸均实质穿过水帘后方，槽底最小载货净空 **3.7689m**。这些是新路线重新算出的数值。

保存阶段：`first-cpu.json` / `span16-cpu.json` / `span21-cpu.json` / `pier09-cpu.json` / `stacked-first-cpu.json`。独立桥中间态移入 `independent-stage/`，包括那轮更严格顶面参考射线仍有 9 条数值边界/缺交点观察的报告；不将该过渡分支宣称最终完整导航通过。

## 验证解释

最终完整报告为 `stacked-final-cpu.json`，测试 `tests/world/targetUserMarkedStructure.test.mjs`，夹具 `targetUserMarkedStructure.fixture.mjs`。每条实际接城阶、dock→第14阶、三段 gallery、两个 gallery 接缝和两个接城转角均双向测试，移动 ≤0.1m、身体中心横向 ±0.4m。

连接阶使用真实 walkPath；第14阶短 connector 是裁切后的非平三角面，期望脚高由报告中的真实 connector 三角和实际 tread polygon 做重心插值。早期用“两个同高端点直线”做期望导致 2 条 .307m 偏差，保存 `stacked-before-connector-reference-cpu.json`；修正的是测试参考面，没有抬台阶、放宽 .3m 检查或修改 provider。

949 个新红蓝载货姿态对真实新结构/房屋/供水/瀑布三角 OBB 检查清空；不是全星球所有保留轨段或连续扫掠。显式保留 GPU、动态船、全航路、连续列车扫掠、工程承载和实操玩家验收未完成的限制。CPU 不计入艺术相似度分数。

最终执行结果：新联合测试 **2/2 通过**；**32,728 次 ground、32,668 次 walls，0 失败**，包含两城转入 gallery 的真实转角。release 结构参数默认合并及调用方按 section 覆盖测试同时通过。主线程现已接回源码所有权，本代理不再修改源模型。
