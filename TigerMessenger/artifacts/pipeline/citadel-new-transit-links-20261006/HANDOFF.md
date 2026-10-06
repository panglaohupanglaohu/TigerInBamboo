# B方案：新岸上步道接广场的两条候选石阶

已读 `citadel-transit-contact-20261006/OPTIONS_REPORT.md`。本轮只新增 `targetNewCityTransitLinks.js`、专属测试，并在 `targetCliffTransitStructure.js` 内接入默认关闭的选项。未改轨道、山体、main 或 candidate。结构版本 `target-cliff-transit-structure-4`，新模块版本 `target-new-city-transit-links-1`。

## 启用与回退

```js
cliffTransitStructureOptions: {
  newCityTransitLinks: true
  // 或 { stations: [55, 65] }
}
```

默认 `false`，不新增几何、不剪原栏杆。现有 candidate 已透传结构参数，无需在本轮改其源码。传入 `true` 后，结构工厂构造两条连接、裁剪自己拥有的地侧栏杆开口、纳入完整载货检查，并公开 `report.newCityTransitLinks`、`handle.plazaLinks` 和追加 `walkPaths`。新连接有限检查失败时明确抛出含 `transitLinkReport` 的错误；所有本次结构资源回收，不发布半连接。父工厂仍负责总体候选事务。

回退设 `false` 并重建。施工前结构源码保存在 `targetCliffTransitStructure.before.js`。没有对既有场景对象做就地裁切；开口只发生在本次新建 gallery。需要刷新浏览器结构依赖缓存；本轮未改 candidate 的 import revision。

## 实际端点与实体

坐标均为 castle-local；站号是本次 156.595 m 新岸 center 曲线按最大 2 m 采样所得 `station / 79`。曲线仍为真实 world 坐标。

|连接|上步道起点|真实广场落点|长度|最大级差|最小踏进|
|---|---|---|---:|---:|---:|
|55 南段上行|42.771426, 0.709294, 100.157820|51.535401, 2.847590, 89.240278|14 m|0.150 m|0.438 m|
|65 西段下行|31.404055, 7.355966, 85.414977|44.686310, 2.871903, 78.444920|15 m|0.147 m|0.327 m|

不是把保护椭圆 0.65 点当落点。每个落点用实际最终山面九点采样，要求完整 2.4 m 宽平坦区域、实际高度落在广场范围、实际海面明确低于踏面。初筛候选及被拒距离保留在报告 `trials` 中。落点踏面高于九点最高值 12 mm，与原地形接通，不挖或抬广场。

起端先有约 5.35/5.31 m 的扭转平段，保持轨顶 6.9 m 原保护平面，走出两线地侧 7 m 横向位置后才开始升降。净宽 2.4 m，端部开放，侧栏杆独立非 walkable。中段由两侧窄支墩和真实开放石拱承托；基础按实际山面四角采样，没有假设 sea−3 海床。没有沿岸整片补山。全模块合并为 **3 个网格、3,132 三角形**：踏面、窄支墩/拱、侧栏杆。

保留雕塑 `[56,78]` 半径 4.6 m、木马 `[72,78]` 半径 5 m 的保护圈，另计步道半宽。它们是保守静态保护范围，不能宣称测过活动中演员的全姿态。两条原有回城连接仍保留，新增连接不占其路线。

## 有限检查结果

两套相关测试 **9 passed / 0 failed**，包含默认关闭、失败原子清理、资源单次释放及旧结构回归。

- 真实生产 source 曲线、user-marked release、正式最终 cuts + global curves 地形、真实 planet/ocean fixture。
- 新连接对红蓝两线 **949 载货姿态**实际三角/OBB：0 碰撞。独立模块包络半宽 2.32 m、半长 3.49 m、底 −0.6 m、顶 5.71 m；不是仅空车测试。完整实际结构联合载货检查也为 0 碰撞。
- 两连接实际 terrain 踏面探针共 **354**，没有已知穿地或缺采；每个基础四角采样。
- 实际 candidate 玩家 provider：从上步道中心穿开口、全阶梯到落点以外真实广场，正反向、中心及左右 0.4 m、每步 ≤0.1 m：**2,628 ground / 2,616 walls 查询，0 失败**。
- 65 站初版下降阶沿曾被径向地面射线击中立面后漏到下方。增加真实 **4 cm 石阶鼻口**后重测通过；未改 provider 或容差。
- 原山体 position buffer 保持完全不变。

`joined-cpu.json` 是完整数值报告；`joined-cpu-geometry.json` 是新模块实际 Three.js ObjectLoader 几何快照；`initial-cpu.json` 保留初次本体有限检查结果。几何快照不含原山体或全场，也不是 GPU 截图。

## 待实机

仍是默认关闭、未 GPU 验收的候选。需要同机位看两条短阶是否与崖岸比例协调，实际玩家走过接头，并检查动态雕塑/木马演员与植被。有限离散姿态/身体射线不等于连续动态碰撞证明，石拱为视觉承托几何，不是工程承载认证。本轮不更新艺术分或 FPS 结论。源码及测试所有权交回主线程。
