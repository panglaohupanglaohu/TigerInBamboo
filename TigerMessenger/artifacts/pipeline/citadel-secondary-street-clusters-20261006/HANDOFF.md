# 新城第二层街群候选交接（默认关闭）

仅改 `src/world/citadel/targetNewCityStairs.js`，新增 `tests/world/targetNewCitySecondaryStreetClusters.test.mjs`。没有修改 candidate/main/terrain/UI，不浏览器，不直接启用生产。源码交回主线程。

## 依据与真实结果

查看了 14:52 `artifacts/pipeline/citadel-main-window-batching-20261006/live-front.png`，对照已认可 `artifacts/pipeline/citadel-rail-cliffs-20261006/target-v11-smooth-east-connection.png`。当前主门侧房稀疏、长阶裸露，因此只在现有街屋侧后方增加与原房实体连接的低房，不增加高塔、上移穹顶或大裙房。

从8个确定邻接位置筛选，实际保留6间：左上屋后房、右上屋侧房、中段右屋侧房、粉屋后房/侧房、下层蓝屋后房。两间被明确淘汰：左上屋另一侧侵入 `entrance-landing-surveyed-joint`；下层蓝屋另一侧对着原盲拱空腔，虽然包络相交，但射线没有实体共墙，故不建。没有为了凑数放置散点盒子。

现6屋、stairs7基座、3低翼、原houseOffsets和footprints都保持；6间新房另列自身占地，不混入原六房footprints或旧城WFC。材料复用现有粉、粉蓝、暖奶油墙、橙顶、白窗，均为低层真实房体，带保留背墙的门凹，不宣称为新公共室内。

## 必须后置安装

默认不构建。实际 surveyed 踏面和结构步行面生成、原3翼楼完成后，才调用：

```js
// 原接口保留，并先完成它。
stairs.completeStreetInfill({ publicFootprints: actualPublicLocalPolygons });
const result = stairs.completeSecondaryStreetClusters({
  enabled: true,
  publicFootprints: actualPublicLocalPolygons,
  protectedFootprints: main.report.footprints
});
```

`enabled` 默认 false；不传或传false不安装。`publicFootprints` 与 `protectedFootprints` 都必须是非空 `[{id,polygon:[[x,z],...]}]`，均为 stairs-local XZ。两者缺失则拒绝；原3低翼尚未通过实际承托报告也拒绝。新城主楼与stairs同框，所以当前 main.report.footprints 可直接作为protected列表；其他城堡坐标多边形必须先转换，不能原样混用。

当前坐标：原点 castle `[74,12,33]`，yaw −55°。castle转stairs：`localX=(x-74)*cos(yaw)-(z-33)*sin(yaw)`，`localZ=(x-74)*sin(yaw)+(z-33)*cos(yaw)`。实际公共列表应沿用现有后置 infill 的 surveyed treads、bridgeConnector、gallery walkSurfaces、原回城连接和 B links。

`surfaceHeightAt` 继续使用现有实际最终地形回调，输出 stairs-local Y。新方法在发布几何前完成全部地形取样/占地/实体共墙筛选；非有限采样抛错且不留下部分房组。缺地形、不满足低房高度、接触不足的个别候选记录在 rejected，不硬塞。

完成后 revision 为 `target-new-city-stairs-8-secondary-clusters`，内部 `report.secondaryStreetClusters.version='new-city-secondary-street-clusters-1'`。报告包含每间的polygon、坐标、尺寸、父屋ID、实际共墙射线证据、地形样本、基座高度和拒绝原因。有限pass要求至少4间且承托样本无gap/掩埋；调用方仍应检查此字段，不能将任意partial发布称已验收。

方法只可启用一次；修改输入、关闭或回退应重新创建原候选。对已建实例再传 `enabled:false` 不拆几何，也不是回退接口。若provider已经创建，增加几何后必须正常refresh。新组名称 `new-city-stair-house-secondary-clusters` 可通过现有 house-prefix过滤；所有新mesh为 `targetWalkable=false`，不让屋顶吸附脚底。没有新增编辑实体或控制器。

## 尺寸与位置

全部新房宽2.4、深1.8、墙高2.5米，橙瓦顶及檐口在约0.61米以内。任何需要超过2.05米基座或盖过原父屋屋顶的候选都会淘汰。基座向真实地形内埋0.12米，不填山、不拉高平台。

| 新房 | stairs-local X/Y/Z（地板） | 基座高 | 实体共墙射线命中 |
| --- | --- | ---: | ---: |
| upper-left-back | −7.339 / −0.042 / 13.710 | 0.224 m | 9 |
| upper-right-side | 9.350 / −0.020 / 12.776 | 0.221 m | 9 |
| middle-right-link | 4.139 / −0.052 / 18.083 | 0.220 m | 9 |
| pink-back-room | 5.579 / −0.097 / 23.395 | 1.346 m | 9 |
| pink-side-room | 3.049 / −0.830 / 27.025 | 1.758 m | 6 |
| lower-blue-back | 12.760 / −7.935 / 29.408 | 1.376 m | 3 |

精确值以 joined-cpu.json 为准。六间分别直接接五栋原屋；左上街簇与右侧逐级街簇仍由原建筑组织，新增低房不自立为新的塔楼列。

## 实际候选有限检查

```sh
CITADEL_SECONDARY_STREET_REPORT=artifacts/pipeline/citadel-secondary-street-clusters-20261006/joined-cpu.json \
/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test \
tests/world/targetNewCitySecondaryStreetClusters.test.mjs \
tests/world/targetNewCityFoundationRefinement.test.mjs \
tests/world/targetNewCityStreetInfill.test.mjs \
tests/world/targetNewCityStairs.test.mjs
```

最终22项通过，0失败。使用实际 user-marked 来源曲线、最终裁崖地形、真实candidate公共模型；在测试实例中后置新房，未改生产调用。

- 默认关闭与保存的stairs7 before几何、变换、颜色逐项一致；原六屋/三翼/地基报告保留。
- 每房99个真实山面样本，最大间距0.25米，共594个；承托gap和房体埋入计数0。
- 54条基座顶面实际三角射线通过；12条门口射线证实凹腔及实心背墙。凹门宽0.76米、深0.38米，仅私人建筑细节，不是公共通路。
- 公共真实网格三角与每间完整包络（含橙檐/窗台）冲突0。
- 沿 surveyed stairs、原回城连接、两条B链接、桥头和广场路线共5508条身体射线，新增网格冲突0。
- 实际红蓝线949个载货姿态对新增三角/OBB碰撞0；包络halfWidth2.32、halfLength3.49、bottom−0.6、top5.71米。
- 缺采样拒绝、异常不发布、重复构建拒绝、dispose幂等/恰好释放均通过。

本轮新增8个合并材质Mesh，未增加材质数。实际留存屋组176→184 Mesh，13200→15984 triangles（+2784）。没有FPS测量，不把少量mesh称性能验收。

## 待GPU与留存

仍需主线程同机位核验这些低房能否明显改善街簇密度、屋檐节奏与阶梯尺度，及附房对父屋侧窗的自然遮挡是否合理。最高原基座和长主阶不在本轮重排范围，不能用新增房间声称整个新城已贴近目标或提高独立评分。CPU有限采样不等于全连续曲面或实际玩家路线验收。

本目录保存 source before、先期两个survey脚本/JSON、最终 joined-cpu.json 与 ObjectLoader几何快照。最终实际结果以joined报告为准；没有新GPU截图。
