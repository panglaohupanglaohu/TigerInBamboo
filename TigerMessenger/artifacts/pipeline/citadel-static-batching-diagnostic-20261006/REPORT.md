# 静态渲染合批只读诊断

建议下一步只试新城主楼窗饰的局部合批。34 扇窗共 204 个 Mesh，使用两个实际共享材质；按鼓座、左翼、右翼三个空间区分别合并白框与窗片，可以变成 6 个 Mesh，理论减少 198 个单色 pass 提交单元。未修改任何源文件，未合并实际几何，未测 GPU draw calls 或 FPS。

## 测量范围和复现

`measure.mjs` 使用 actualUserMarkedStructureFixture 的正式来源曲线/最终地形和实际 createTargetCityDetailCandidate 工厂。选项与本轮 main 对应：stacked-connected、oldShore pierWidth 0.9、newCityTransitLinks、streetInfill、foundationRefinement 开启；frontRail 关闭。fitSunShadow 为 false，因为本次没有 renderer，不测阴影渲染。街梯为 stairs7、旧城为 oldCity11、主楼 expanded v3、桥廊 structure4。完整版本和源文件 SHA256 在 `statistics.json`，两次统计运行期间读取的源码均未变化。

```sh
/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
artifacts/pipeline/citadel-static-batching-diagnostic-20261006/measure.mjs
```

以下是候选已构造并挂入 fixture 后、实际留在四组中的网格；不是工厂中已经移走的 authored 楼梯，也不是报告中的旧缓存计数。三角数对 InstancedMesh 乘实例数，材质数是实际被网格引用的 material 对象数，不是同名或同色数量。

| 实际组 | Mesh 对象 | 使用中材质对象 | 实例展开三角形 | InstancedMesh |
| --- | ---: | ---: | ---: | ---: |
| 旧城 | 274 | 9 | 25,828 | 4（合计 104 根栏杆） |
| 新城主楼 | 317 | 13 | 13,338 | 0 |
| 新城六屋/基座/共墙翼楼 | 176 | 8 | 13,200 | 0 |
| 沿崖上步道及下层承托 | 161 | 27 | 60,468 | 0 |
| 合计 | 928 | 57 | 112,834 | 4 |

单材质 Mesh 即使 geometry 有多个 groups，也没有按 groups 数乘渲染次数。4 个 InstancedMesh 各算一个提交单元，不把 104 个栏杆误作 104 次调用。脚本记录 ancestor-visible 仅便于查漏；它没有视锥、遮挡、render.info、阴影 pass、材质编译或帧耗时信息，不能从 traverseVisible 得出实际 draw 改善。

## 已经合并的部分

- 旧城：窗玻璃/窗框已按住宅合并；住宅拱廊、彩墙、街缘低房也有真实 material merge；主塔 20 窗框/玻璃已有两批。四个露台栏杆已经实例化。剩余不是全部可自由打平。
- stairs7：三处新基座已分材质合并为 3/3/4 个网格，三个共墙翼楼一起合并为 7 个网格；上部房屋小窗仍多为散件。合并后的基座三角很多，但再合并并不减少三角数。
- 桥廊：每段上层连续踏面、顶板、边缘、手栏、栏杆柱已经按长带汇总；每个海侧拱跨仍是一个网格，下层桥的各支墩、柱头、横梁等也保留独立网格。旧岸 64、中央 22、新岸 64，余下 11 个为两城连接及 B 链接等结构。各段有独立材料所有权；同名 double-deck-stone 是三个不同 material 对象，不能仅看名称就混成一批。
- 新城主楼：未采用 merge 或 InstancedMesh，34 扇窗各由五件白框（含中梃）和一片窗片组成。实际白框 170 个 Mesh / 4760 triangles，窗片 34 个 Mesh / 68 triangles，这是最集中、风险较小的局部。

`statistics.json` 的 knownBatchNames 是名称辅助索引；“已经合并”的结论另由实际工厂构造代码确认。compatiblePartitionUpperBound 只按 material 对象/编辑所属/属性格式/显式 walkable/阴影/layers/renderOrder 等机械分桶，仍未处理全部语义，不是获准合批清单。

## 最小试验模块建议：主楼窗饰三分区

可在主楼 factory 内新增局部、默认关闭选项及 helper（尚未实现）：完整 expanded 形变完成后，把窗饰变换烘焙到主楼坐标，以鼓座、左翼、右翼三组空间边界分别合并两种既有材质。鼓座 12 扇为 72→2，左右各 11 扇为 66→2，总计 204→6。主楼对象数相应 317→119；本次四组总数 928→730。只表达无裁剪单色 pass 提交单元潜力，真实渲染收益由同机位实机测量决定。

保留三个空间分区可限制视锥包络膨胀，优于把整城或左右相距很远的建筑揉成一个包络。三角形仍为 4828；合并不简化模型。非索引 position/normal/uv 约 0.44 MiB 的新顶点数据量级，构建时有一次复制成本；原几何只有在提交后不再被 query proxy 引用时才能释放，防止双份常驻。当前材质为不透明 MeshStandardMaterial，必须复用原 material 对象、阴影和材质保护标记，不能仅按 hex 新建材质。

具体保护合同：

1. 保留主楼 root 和 34 个窗口 Group 的稳定名称与变换。新合并 mesh 保存 sourceName→faceRange 映射供诊断。当前检查到的生产外部代码没有通过这些窗饰单件名字改几何；不能推论任意外部调试脚本都不依赖旧子 Mesh，实施前仍需明确兼容边界。
2. 不触碰入口踏步、入口 landing、hall floor、真实拱墙及门洞。createTargetNewCityApproachSampler 按 `^entrance-(stair-|landing)` 读取网格，维持这些名字与几何可保持承托采样合同。
3. 新窗饰仍为保护建筑，targetWalkable=false，名称不能误匹配 provider 的公共面或屋顶规则。现有 player provider 会从新 mesh 生成自己的几何 query proxy；在 factory 完成后初建或 refresh provider，使 ray triangles 与渲染一致。只保留旧缓存、或隐藏旧 mesh 却不 refresh 都不安全。
4. 不采用 `original.visible=false` 但声称原物体仍可碰撞的实现。provider 的 active() 检查源对象祖先可见性；material.visible=false 也会被 materialVisible 排除。若另做渲染专用代理，必须新增正式 render/collision 双树合同，已经超出这次最小模块。
5. 主楼不属于旧城15栋实体注册表；合并网格 ray hit 仍返回 protected，不应穿透挑到后面的可编辑房屋。回归必须实际验证最近可见保护面，不能只保持颜色。
6. 旧城不参与本试验。targetCityEntityEditor 根据 Group 祖先映射实体，单独 clone targetWall 材质，occupied=false 隐藏整栋；跨住宅合并会破坏删除/改色。屋顶会话还会离线重建整个旧城 asset 并原子替换，跨 asset 材质或合批资源会破坏所有权。未来若做旧城，只能在每个 house Group 内合并相同 targetWall 语义的部件，并在 staged asset 构建完成时重建批次。
7. 不动雕塑、木马、全局车辆、动态控制器及原地标对象。关闭候选选项并重建主楼就是回退，不能把“恢复旧材质”当作几何回退。

## 桥廊备选及风险

中央桥单独有 22 个 Mesh；机械分桶表明可把 3 横梁→1、11 个石质承托/纵拱→1、3 个顶板/海侧拱→1、2 手栏/栏杆柱→1，理论最多少 15 个提交单元。但这不是直接施工授权：

- structure 构造末尾按名字正则 `handrails|rail-posts|edge-curbs` 裁真实接城口，必须在裁剪之后合批，否则会重新封口或失去裁剪目标。
- doubleDeckStructuralRole、原 mesh name、碰撞 faceIndex 会随合批改变，需要 source-face/structuralRole 映射；walkable 踏面必须保持独立。
- 沿整岸合并放大包络，provider 的 near 检索和 ray BVH成本可能增加；全岸帧率收益无法只用 mesh 数预测。
- 直接共享三个 gallery 的同名材料会跨 factory dispose 所有权；最小桥试验应只做中央一段，而不是全岸统一材质。

因此本次优先级选择窗饰三分区。预计少 198 个提交单元，投入主要在几何属性烘焙、face 映射、provider 刷新与对照验证；没有宣称会恢复到某个 FPS。

## 真正实施时所需验收

逐三角世界位置/normal/uv/材料一致；入口及窗墙实际射线命中距离一致；旧城编辑保护拾取不点穿；dispose/关闭重建回退；同机位截图无新接缝；provider 地面/墙查询耗时与 renderer.info.render.calls/triangles 含阴影测量。只有这些完成后，才报告实际 draw 和帧时差异。本次只完成统计与代码依赖诊断，没有运行这些改后测试。
