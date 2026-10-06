# 新城基座轮廓修整候选（默认关闭）

仅修改 `src/world/citadel/targetNewCityStairs.js`，新增 `tests/world/targetNewCityFoundationRefinement.test.mjs`。没有修改 candidate、main、terrain、运行时 UI，也没有进行浏览器操作或 GPU 验收。root 可以收回文件所有权。

## 图像依据与当前问题

已实际查看本轮广场 `artifacts/pipeline/citadel-four-hour-20261005/runtime-1791267140645.png`，对照目标 `artifacts/pipeline/citadel-rail-cliffs-20261006/target-v11-smooth-east-connection.png`，并读取 stairs6 和上轮 street infill HANDOFF。当前粉楼彩色底面被灰岩不规则切入，最高蓝楼基座重复叠放大拱门、整体像长柱。此次只改六屋范围内三处高基座，不重新布城、不抬屋顶，不用雾或换色遮掩几何问题。

工厂原本按 plot 角点选底高，但粉楼侧面中段比角点又低约 1.90 米。新密采轮廓发现原包络底部没有完整跟随侧坡，因此同步延伸该屋的私人内部承托到真实土面；没有向公共路线或山外增加台地。

## 接入与回退

```js
const stairs = createTargetNewCityStairs({
  // existing seed, palette, houseOffsets, surfaceHeightAt ...
  facadeFoundationRefinement: true
});
// 既有后置接口保留；仍传真实公共踏面 polygons。
stairs.completeStreetInfill({ publicFootprints });
```

新参数必须为 boolean，默认 `false`。本轮不修改生产调用方，不默认启用。root 后续如接候选，只需将该选项传入现有工厂并刷新 import cache。打开时 revision 为 `target-new-city-stairs-7-foundation-refinement`；即使之后完成 street infill，revision 仍保留 v7。关闭时保持原 v5/v6 版本和几何。回退为关闭参数、重新创建候选，资源仍归 factory dispose 管理。

`report.facadeFoundationRefinement` 提供 `enabled/version/refined/rejected`；其内部版本为 `new-city-foundation-refinement-1`。缺少实际周边地形，或地形已高于固定楼层，记录拒绝并保留该屋原基座，不声称修整成功。`surfaceHeightAt` 合同不变：stairs-local XZ 输入、真实山面 local Y 输出，原点 castle `[74,12,33]`、yaw −55°。

## 实际几何改变

- 六栋上部房屋的 position、size、roof、入口和 houseOffsets 完全不变。所有 XZ footprints、roofY、walkSurfaces、中央路线及后置共墙翼楼保留。
- 三处高基座的四面以最大 0.24 米间隔取样，包含外墙及凹室背侧两排真实地形，共 512 个地形样本。石质接地带底边落入样本土面 0.12 米，顶边跟随实际接触线；彩墙在石带上终止。
- 粉楼 `house-1--1`：原报告总基座高 3.377 米；本次实际最低中段探测后，内部承托总高 5.275 米。楼层高度不变，新增深度向下补足真实侧坡。足迹的 floorY 随真实承托更新，XZ 不扩张。粉楼正面保留墙体、接地带，侧面有一个抬高窗台式盲拱。
- 较低蓝楼 `house-2--1`：接地轮廓及两处浅盲拱，背墙保留。
- 最高蓝楼 `house-2-1`：下基座四面内退 0.18 米、暖石色承托，顶面完整承住原房屋；两处单层盲拱替代原重复门洞。上段保留彩色房层，并加入六个 0.56 米方形凹窗，窗后有玻璃和保留的核心墙。上部屋高和橙顶没有上移。
- 五个盲拱深 0.65 米，窗台至少高于邻近实际山面 0.48 米，均保留实心背墙。报告明确 `throughPassage:false`；没有开出无出口的假公共通道。
- 新基座网格均 `targetWalkable=false`，不把窗台或屋顶加入导航。复用现有材质，继续遵守 preserveCitadelMaterials 契约，不新增灯光。

## 有限验证

执行：

```sh
CITADEL_FOUNDATION_REPORT=artifacts/pipeline/citadel-new-foundation-refinement-20261006/joined-cpu.json \
/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test \
tests/world/targetNewCityFoundationRefinement.test.mjs \
tests/world/targetNewCityStreetInfill.test.mjs \
tests/world/targetNewCityStairs.test.mjs
```

联合 18 项通过。最后收紧凹窗与接地带的间距后，又重跑本轮 3 项，全部通过。使用 actualUserMarkedStructureFixture 正式来源曲线和最终地形、实际 candidate 公共网格；仅测试中的 stairs 实例替换为候选，生产源调用未改变。

- default-off 与保存的 stairs6 源快照几何位置 buffers、变换和颜色逐项相同；街道和原屋组不变。
- 232 条实际生成基座三角射线有承托；另外 732 个样本间 1/4、1/2、3/4 位置使用真实地形重新检查，接地缺口 0。该有限采样不是全连续面数学证明。
- 10 条凹室射线证明五处开口近端空、后端有实体背墙。
- 真实公共踏面和护栏三角对完整基座包络检查 0 冲突。
- 实际 surveyed stairs、两条回城连接、两条 B 链接、桥头及广场路段共 5508 身体射线与候选基座碰撞 0，未放宽阈值。
- 红蓝新线 949 个真实载货姿态与实际基座三角/OBB 检查 0 碰撞（halfWidth 2.32、halfLength 3.49、bottom −0.6、top 5.71 米）。此检查限本轮新增/替换几何，不代替全世界航线认证。
- dispose 幂等、资源恰好释放一次，几何有限，基座顶面不超过原屋地板，全部 XZ 在原 footprint 内。

保留候选实际屋组（已移除原 authored 楼梯）计数：原 178 meshes / 8528 triangles → 候选 176 meshes / 13200 triangles。少 2 个网格，增加 4672 个三角形；没有测 FPS，不能称性能提升。

## 待 GPU 检查与留存

待 root 同机位对比粉楼接地带是否真正改善岩墙接触、最高蓝楼石基座与彩色层是否仍显过高，以及侧面盲拱/凹窗的受光。保留 8 米高的既有蓝楼承托是本轮固定楼层/山体条件的结果；本候选只改善层次，没有把高地形落差消除。不能据 CPU 通过抬艺术分。

本目录保存：`targetNewCityStairs.before.js`（stairs6 before）、`joined-cpu.json`（最终证据）、`joined-cpu-geometry.json`（实际候选 Three.js ObjectLoader 几何）、`preliminary.json`（初步采样；最终以 joined 为准）。新测试即独立可复现检查脚本。没有生成伪 GPU 截图。
