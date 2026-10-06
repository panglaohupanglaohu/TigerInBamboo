# 橙短线独立步桥，可选接入

本轮修改范围：`targetCityDetailCandidate.js`、`targetCliffTransitStructure.js`；新增 `targetIndependentWalkBridge.test.mjs`。未动 main、tram、地形、gallery、原 bayBridge 工厂、阶梯或其他代理文件。施工前两源文件在 `source-before/`。

## 接口

给显式 release 增加：

```js
walkingConnection: {
  kind: 'independent-short-bridge',
  pathXZ: [[-31,11],[-28,20],[-20,27],[-8,31],[16,38],[49,45]],
  width: 4.4 // 可省；最少 2.4
}
```

没有该字段则原 release 行为不变。不是自动启用新版铁路；新旧 rails 的曲线仍完全由调用方 release 决定。

candidate 用真实旧城公共口、实际第 14 阶 sideEdges 解接点，生成 castle-local XYZ 的 `walkingConnection.path` 交给 structure。结构工厂也允许直接输入 resolved `walkingConnection.path`，但必须和 `connectionTargets` 两个实际公共口在 0.02m 内一致；无效路径、非法 kind、窄于 2.4m 或错口明确拒绝。显式 path 不会自动重写坐标。

版本：structure `target-cliff-transit-structure-2`，candidate 新模式 `target-city-detail-candidate-4-independent-walk`，candidate 已把 structure import 更新为 `?revision=2`。主线程加载 candidate 请用新缓存版本，例如 `?revision=independent-walk-1`。

## 实际几何与端口

路径为：

```
[-32.231161646,17.3,3.767409819]  旧城实际出口
[-31,17.3,11]                    7.3366m 平接段终点
[-28,16.741822830,20]
[-20,16.116376517,27]
[-8,15.372140290,31]
[16,13.901214294,38]
[51.537439018,11.806501302,40.142157476]  实际新端 dock
```

橙图 `[49,45]` 位于既有较低转角/阶 18–21 内。把上桥面直接放这里会压过低阶，原 connector 被全裁成空几何。因此从真实第 14 阶朝该点的最近侧边，向外退 `桥半宽 + .35m`，得到上述 dock，保留调整元数据。实际落点离手绘点 5.4806m。到第 14 阶 `[53.143426628,11.806501302,44.612426349]` 的短 connector 长 **4.75m**，有真实非空裁切踏面、9 个地形样本，不抬原台阶。

短桥采用原真实多拱石桥 factory：6 个真拱、7 个采样基础支墩、4.4m 宽，新增真实 0.10m 桥尾重叠踏面解决径向承托射线的边界收口。最大桥面坡 5.8837%；connector 的实际三角最大坡 18.7197%。护栏在真实 connector polygon 处开口。

启用时旧 `old-city-cliff-link` / `new-city-cliff-link` 两条约 42m 回城结构不生成，`connections=[]`。中央铁路拱柱/保护顶板保留；现有廊道上步面保留但 `walkPaths.mainCityConnection=false`，不称为两城主步行桥。`report.bridge` 指向独立短桥，标记 `independentFromRail=true`。独立短桥真实 `targetWalkable` 面由现 provider 收集。回退只需移除 walkingConnection 并依既有事务重建。

## 检验和未通过范围

`final-cpu.json` 是当前真实 inner release 的独立短桥 CPU 结果，含源 SHA256；不是尚在顾问制作的新橙长铁路验收。新 rail release 到来后必须重新跑相同结构/载货审计。

- 新测试 2/2 通过：整个短桥和新接段双向每 ≤0.1m、身体中心 ±0.4m，**6,402 次** ground/body 采样，0 失败；非法 spec 拒绝及资源只释放一次。
- 非 release candidate 6/6 回归通过（默认模型、回收、流水、原轨候选、WFC事务均保持）。
- 既有 release 7/7 回归通过，保留原双层/42m 连接默认行为、原地形不改、异常原子回收、实例碰撞及载货低顶拒绝。
- 红/蓝实际曲线 **776 个**载货 OBB 姿态，对实际场景三角检查 0 碰撞；独立短桥报告另列其自身车辆净空。
- 实际地形顶面探针 0 侵入，支墩采样全知。首版旧岸4处 2.5–5.48cm 侵土、初版新端空 connector、边界射线落空均保留在 first/second/third JSON，未删记录。
- **桥下通船不通过**：中跨实际全球 planet 浅底的最小水深只有约 0.51–0.55m，小于原 factory 的 0.8m 要求，`navigationSampledPass=false`。拱净高充足并不能改变浅海底事实；未改地形、未隐藏船、未宣称全航路。当前 finitePass 范围是结构/地形/铁路载货，不能当成通船验收。
- 没有浏览器动作、没有 GPU、新铁路未复验。保持 `accepted=false` / GPU 未验证，等待主线程实机和新 release 联合验收。
