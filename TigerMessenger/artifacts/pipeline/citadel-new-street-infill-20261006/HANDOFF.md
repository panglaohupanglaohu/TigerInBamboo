# 新城顺阶低翼楼候选交接

本轮保留默认关闭，未启用生产，也没有进行浏览器或 GPU 验收。3 个低翼楼形成 2 簇连续建筑；不继续跨越 6 米山差补足第三簇。仅修改 `src/world/citadel/targetNewCityStairs.js`，新增专属 `tests/world/targetNewCityStreetInfill.test.mjs`。主线程可收回源码所有权。

## 图像与建模依据

已查看 `artifacts/pipeline/citadel-light-observer-20261006/live-plaza.png` 及 `artifacts/pipeline/citadel-rail-cliffs-20261006/target-v11-smooth-east-connection.png`。实景沿阶住宅之间断开，目标用较低房间、连续橙色屋檐连接较高楼体。本次实际增加共墙房间和低屋顶，不只换色；保留原六栋位置、外包络、偏移参数及导航属性，不移动雕塑、木马、主楼或公共阶梯。新增部分有自己的额外占地报告，不将原六栋 footprints 当成新增占地。

右侧两间低房连接三栋现有楼，左侧一间侧翼连接一栋现有楼。`lower-stepped-link` 因实际地形采样落差 6.0843 米被拒绝，没有偷偷加高成塔。`upper-east-link` 的上层房间高 2.35 米，但下方实际基座高 4.2705 米；这处基座的视觉比例仍需同机位 GPU 评阅，不能把它描述成全高都很低的房间。

## 默认关闭与后置接口

未传参数、不调用方法时，仍为 `target-new-city-stairs-5-stepped-flanks`，默认几何保持原样。启用后 revision 为 `target-new-city-stairs-6-street-infill`；内部报告版本为 `new-city-street-infill-1`。

推荐等实际 surveyed stairs、接桥平台和上层步道全部生成后调用：

```js
const result = stairs.completeStreetInfill({
  publicFootprints: [
    { id: 'actual-tread-or-platform-id', polygon: [[localX, localZ], /* ... */] }
  ]
});
```

`publicFootprints` 必须覆盖实际公共踏面，使用 stairs-local XZ 坐标。原点对应 castle `[74,12,33]`，yaw −55°。castle XZ 转换为：

```js
const yaw = -55 * Math.PI / 180;
const dx = castleX - 74, dz = castleZ - 33;
const localX = dx * Math.cos(yaw) - dz * Math.sin(yaw);
const localZ = dx * Math.sin(yaw) + dz * Math.cos(yaw);
```

工厂现有 `surfaceHeightAt` 应继续返回实际地形的 stairs-local Y（castleY −12）。缺少实际地形采样会拒绝建造，不能用解析平面当已承托。构造时也支持 `streetInfill:{publicFootprints}`，但生产应优先后置方法；`streetInfill:true` 仅使用原 authored 阶梯，不能替代后生成的 surveyed 路线保护。

方法只可成功构建一次；再次调用会抛出 `street infill already constructed; recreate to change inputs`。调整输入应重新建候选，不在既有几何上叠建。dispose 后禁止调用。返回 `result` 与 `report.streetInfill` 为同一对象，包含 modules、rejected、supportSamples、finitePass；失败原因保留。

新组名 `new-city-stair-house-street-infill` 可通过现有 candidate 的 house-prefix 保留过滤。所有新 mesh 均为 `targetWalkable=false`，不让屋顶变成承托面。它们不是新可编辑实体或 WFC 地块。新几何归原 factory dispose 管理，复用现有材料，不新增灯光；更新 candidate import cache revision 由主线程决定，本轮未改 candidate。

## 实际几何

| 模块 | 连接对象 | 跨长 / 深度 | 基座高 |
| --- | --- | --- | --- |
| upper-party-link | house-1-1 ↔ house-0-1 | 1.1203 / 1.85 m | 0.2088 m |
| upper-east-link | house-0-1 ↔ house-2-1 | 3.2996 / 2.15 m | 4.2705 m |
| west-low-wing | house-0--1 的侧翼 | 2.4 / 2.2 m | 0.2273 m |

额外 7 个合并材质网格，低于 12 个预算，原材料数量不变。两处入口是宽 0.94 米、深 0.48 米的真实凹门，后墙保留；它们不是公共穿行通道。最窄共墙连接没有强塞窗或新门。额外占地 polygon 已含屋檐及窗台余量。

## CPU 检查及复现

```sh
CITADEL_STREET_INFILL_REPORT=artifacts/pipeline/citadel-new-street-infill-20261006/joined-cpu.json \
/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test \
tests/world/targetNewCityStreetInfill.test.mjs tests/world/targetNewCityStairs.test.mjs
```

最终 14 项通过，0 失败。新测试使用 `actualUserMarkedStructureFixture()` 的正式来源曲线、最终裁崖地形和实际候选，后置生成并按 candidate 的 house-prefix 规则保留新增组：

- 原六栋 footprints、IDs、offsets 不变；默认关闭时与 before 的几何 buffers、变换及颜色一致。
- 27 条基座顶面射线有实际三角承托；底部使用真实地形样本，非悬空假底。
- 4 条门深度射线验证近处开口、深处背墙。
- 新增完整包络与实际公共网格三角碰撞 0。
- 沿实际 surveyed stairs、两条接城连接、两条 B 链接、桥头接头和木马广场路段，5508 条站立身体射线与新增几何碰撞 0（高度 0.05/0.55/1.2/1.8 m，横向 −0.4/0/0.4 m，步长 ≤0.5 m）。这里只证明新增几何没有侵入这些路线，并不重新认证所有其他物体。
- 实际红蓝轨道 949 个载货姿态，新三角与车体 OBB 碰撞 0；包络 halfWidth 2.32、halfLength 3.49、bottom −0.6、top 5.71 m。
- 启用后全部活跃资源 dispose 一次，材料数量不增加，重复后置构建明确拒绝。

CPU 结果不等于艺术分或实际行走/GPU 通过。仍需主线程以同机位候选开关比较低翼楼读形、4.27 米基座、遮挡和受光，再决定启用。

## 留存

- `targetNewCityStairs.before.js`：修改前源快照。
- `joined-cpu.json`：本轮最终真实候选有限检查与全部模块报告。
- `joined-cpu-geometry.json`：新增组的 Three.js ObjectLoader 几何快照，不是 GPU 截图。
- `tests/world/targetNewCityStreetInfill.test.mjs`：后置接入与实际通路检查的可运行脚本。
