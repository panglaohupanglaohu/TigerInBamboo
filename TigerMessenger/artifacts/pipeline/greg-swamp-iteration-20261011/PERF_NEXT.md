# 下一轮正式场景性能窄审查 · 2026-10-11

只读运行时代码审查；本文件是唯一写入。未修改模型、剧情、碰撞或裁剪系统。未执行本轮 GPU 计时，不把源码迹象说成已定位帧耗时。

## 实测基线由主代理提供

- 正式 rim 单窗口：samples 60，9.6 FPS，5880 calls，约 5.27M triangles。
- 让路 v4 后 `rim-perf-v4-window.txt`：samples 60，9.9 FPS，5878 calls，约 5.25M triangles。
- 两次动画相位和 geometry 数不同，不能据此宣称 FPS 提升。calls 是整帧累积提交（可能包含多个渲染 pass），不是湖沼专属。
- 本代理前批 CPU 湖沼工厂盘点是约 938 个可提交 render 节点、1.175M 粗略三角，未做 camera/frustum；不得将它与 GPU calls 直接相减当成非湖沼提交数。

## 可核实的非湖沼强制提交路径

`src/scenes/messengerIsland.js:170` 建旧港，`:337` 建水路；`src/scenes/messenger/updateIsland.js:32` 无论相机位置都继续运行港口更新。保留这些更新是合理的：不能为性能停剧情或物流。

`src/assets/harborLogistics.js:407–416` 出船巡逻时最多生成 16 个 `harbor-patrol-soldier`，然后将其所有 Mesh 的 `frustumCulled` 强制设为 false。`src/core/sceneDistanceCulling.js:15` 又按 soldier / boat / ship 等父链名字排除它们，因此此路径既不受默认距离裁剪，也不受 Three.js 视锥裁剪。只要巡逻根仍可见，即使整个港口在湖沼相机视野外，这批网格依然进入提交路径。

CPU 直接调用当前 `createHarborPatrolSoldier()` 验证：40 个 Mesh（20 描边），其中祖先和材质可见的为 38 个（19 描边），没有 SkinnedMesh。16 人上界对应 608 个可提交 Mesh。**这只是潜在上界：当前 rim 实景是否正有这支巡逻队、实际提交多少尚未在 GPU trace 核对，不将 608 当成已测节省。**

此外，`harbor.js:916–919` 船员实例批也强制关闭 frustum；云、瀑布、天气和部分粒子类似。Shader 中 discard / opacity=0 不等于取消提交。后续应通过正式页面渲染对象计数逐项确认，不统一乱改粒子包围盒。

## 推荐一个最小可逆实现：恢复旧港刚性巡逻网格的正常视锥裁剪

仅改 `harborLogistics.js` 上述 patrol spawn 的刚性 Mesh，恢复 `frustumCulled=true`。其动作通过各关节 Object3D 的 transform 驱动，现有几何不是蒙皮网格；Three.js 每帧用当前 matrixWorld 变换局部包围球。为旧反向壳描边保留材质法线外扩的保守裕量（从该实例材质/厚度获取；不能修改共享 geometry 的 boundingSphere 影响别人，可用共享原件对应的独立保守 bounds 或克隆 bounds 方案）。不要删士兵、隐藏港口根、暂停 update、改 collision list 或地图/故事 actor 名称。

新增 `?harborPatrolFrustum=0` 回退强制绘制。材质、位置、动画、剧情、碰撞与远处地标都不变；只有完整落在 camera frustum 外的刚性网格被正常剔除。需要注意阴影相机也使用 bounds，必须保守覆盖描边，不能仅按主相机设置 visible=false 来作弊降低 calls。

船员 InstancedMesh 不属于这批：其 instanceMatrix 动画后包围球需要更新或事先求全动作包络；不直接套巡逻方案。

## 验证与交接

1. CPU 断言巡逻角色/关节/动画引用、有效 visible 状态、剧情与碰撞标识不变；各主体与描边 bounds 覆盖当前几何及 shader 外扩。
2. 正式游戏先确认巡逻活跃；统计这些对象的实际 render callbacks、相机 frustum 外数量和 pass 类型，不把 factory inventory 当成 GPU trace。
3. 同机位 A/B/A，完整 60 帧窗口；固定天气、昼夜、相机与可重复剧情阶段，记录 raw calls / triangles / frameMs。检查港口近景、离开与转回视野边缘、环湖、飞艇航拍和阴影边缘，没有突然缺角色或地标。
4. 如果当前没有巡逻，则本批预期效果可以为零，如实报告；不能为看起来有收益而触发/改写剧情。

## 已存在系统与非目标项

- `core/params.js` 当前 `distanceCullV1=true`（旁边注释“默认关闭”已过时）；仍可被 localStorage/URL 覆盖，GPU检查需读实际 `P.distanceCullV1`，不能假定未开启。`main.js:195` 实际创建，`:2193` 每帧更新。
- 距离裁剪阈值是 150 + altitude×5，maxObjectRadius 8（局部几何范围），无星球遮挡判定。航拍高度增大时效果减弱，但不能直接缩距离让地标突然消失。
- `updateIsland.js:83` storyActors 全场 traverse 已节流到每模拟秒一次；`lightPool` 全场扫描间隔 5 秒并提供 `lastCollectMs`。这些可能是尖峰调查项，不是已证实 9 FPS 原因，不重复改成缓存。
- 巨树/树冠/花合批已做，不重复；静态露根和蘑菇是上一批局部备选，不是此文推荐。
