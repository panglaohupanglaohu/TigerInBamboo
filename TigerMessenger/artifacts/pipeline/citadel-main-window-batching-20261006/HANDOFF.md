# 新城主楼窗饰合批候选交接

默认关闭，只改 `src/world/citadel/targetNewCityMain.js`，新增 `tests/world/targetNewCityMainWindowBatching.test.mjs`。没有改 candidate、main、UI、地形、旧城编辑事务，也没有浏览器操作。源码交回主线程。

## 接口

```js
createTargetNewCityMain({
  // existing seed, palette, proportion ...
  batchWindowDetails: true
});
```

参数必须为 boolean，默认 false。关闭时 source 快照的原始/expanded 几何 buffers、变换及颜色逐项一致，仍返回原 v2/v3 版本。开启时 `report.version='target-new-city-main-v4-window-batches'`，`report.windowBatching.version='main-window-batches-1'`；proportion 和入口缩放合同保持原值。建议 import cache revision `window-batches-1`，由主线程接候选测量后决定启用。

合批在 expanded 形变全部完成之后执行。34 扇窗按鼓座12、左翼11、右翼11三组分区，每区分别合并框材质与窗片材质，得到6个Mesh。合批复用原材质对象，保留颜色、roughness、shadow、layers、renderOrder、frustumCulled，保留材质防重涂标记。总三角数不变，不删细节，不新增纹理或灯光。

## 身份、碰撞和回退

原34个 window Group 仍存在，原组名与变换不变；原204个子Mesh真实移除并释放几何，未将其隐藏假作碰撞物。每个新 batch 的 `userData.targetWindowBatch.sourceFaces` 保存原 sourceName、windowName、materialName、语义及 firstTriangle/triangleCount/firstVertex/vertexCount。给定命中 faceIndex，落在哪个 range 即可恢复原窗件名，减 firstTriangle 即为原三角序号。

原窗口Group的 `userData.targetWindowSource.batches` 给出对应batch名称。原件Mesh的 getObjectByName 将找不到；原名保存在语义数据中，不能声称旧逐件Mesh引用仍有效。主楼公共面、真实主门拱墙、入口踏步/landing和所有非窗几何原样保留。新批次 targetWalkable=false，仍是保护建筑，最近表面拾取不会穿透到旧城住宅。

批次在factory返回之前完成，随后创建provider即可；若替换既有asset，必须正常 refresh provider。provider 从新实际三角创建查询代理，不依赖隐藏的原网格。窗饰不属于旧城15栋注册表，没有改删房、改色、屋顶事务规则。合批几何归主楼factory统一dispose，材质仍由factory原集合持有；关闭选项重建就是回退。

## CPU 实测

执行：

```sh
CITADEL_MAIN_WINDOW_REPORT=artifacts/pipeline/citadel-main-window-batching-20261006/cpu.json \
/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test \
tests/world/targetNewCityMainWindowBatching.test.mjs tests/world/targetNewCityMain.test.mjs
```

14 项通过，0 失败。

| 比较 | 原始比例 | 正式 expanded-1 |
| --- | ---: | ---: |
| 主楼 Mesh | 316 → 118 | 317 → 119 |
| 三角形 | 13232 → 13232 | 13338 → 13338 |
| 材质对象 | 13 → 13 | 13 → 13 |
| 逐世界顶点对比 | 14484 | 14484 |
| 窗口实际射线 | 204 | 204 |
| 最大世界顶点误差 | 9.11e-7 m | 1.03e-6 m |
| 最大单位法线误差 | 2.76e-8 | 3.71e-8 |

UV数值和材质颜色逐项一致。比较包含主楼与父节点旋转/平移，204条窗件射线命中点、距离及批内原件映射一致。两种比例的非窗Mesh完整快照一致，工厂report局部bounds和精确世界顶点bounds一致；入口、footprints、passage、stairs报告不变。

专门验证真实可编辑旧城放在窗后时，最近批次仍被entity editor判定为protected；删房/改色/undo不会改变此结果。provider刷新后，正门内部身体通过、门柱挡人、地面承托结果与原资产相同，屋顶不吸附。候选geometry/material各dispose一次，独立原版factory不受影响。

Three.js默认 setFromObject 的保守世界AABB取决于Mesh分组；旋转后合批保守框会比原散件框粗，不能要求这种裁剪近似框逐位相等。因此分别验证真实几何边界和factory局部report bounds；保留三空间区限制包络膨胀。这是待GPU测量的明确成本，不是实体体积变化。

## GPU 待测

预期在相同可见集合的单色pass中少198个提交单元；没有把这个值称为实测draw或FPS。主线程提供的未合批同全景/.49光照baseline为 renderer.info calls=9932、triangles=4204295、lines=69052、frame=4607，仅作为后续同镜头对照基线。阴影pass、视锥合批包络和全场其他对象会影响最终差值，应由主线程renderer.info及同机位截图验证。

留存：`targetNewCityMain.before.js`、`cpu-original.json`、`cpu-expanded.json`。未直接启用生产。
