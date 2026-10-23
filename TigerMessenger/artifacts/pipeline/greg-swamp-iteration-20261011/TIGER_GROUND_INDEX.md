# 老虎真实支撑射线索引 · 2026-10-11

本批 root 独占 `src/world/swampGroundRayIndex.js`、`src/world/moebiusTiger.js` 的射线调用入口与 `src/assets/characters/tigerTargetV1.js` 的支撑查询入口。现已接正式默认入口，`tigerGroundIndex=0` 保留原始对照。原件在 source-before/tiger-ray-index；鼻部矩阵实验已恢复，没有混入本批。

## 保留原始支撑

不减少17点足底与腹底采样，不减慢更新频率，不改路径、步态、迎客、饮水、爪位或外观。将每个静态几何三角形按局部XZ覆盖放入2单位网格，垂直射线只让原 `THREE.Mesh.raycast` 检查覆盖该坐标的真实三角形。共享原 positions/normals/uv、材质与实际 matrixWorld；返回原对象及原 faceIndex，命中仍按世界距离排序。不会焊死虎、伪造地面高度或隐藏远处角色。

geometry/attribute/index引用及version变化重新建索引，mesh变换逐查询读取。倾斜射线、蒙皮、实例、多材质组、部分drawRange、自定义raycast等未知情况走原始Three路径。没有改任何地形raycast函数，外部碰撞仍原路径。

## CPU证据

swampGroundRayIndex.test.mjs 两项通过：实际旋转/移位/缩放湖沼，5040点覆盖整圈与阶边，逐点比较全部命中数量、坐标、距离、原对象和面序；45360网格查询无fallback，候选三角总93041，平均每点18.46。额外覆盖indexed/nonindexed、三种材质side、顶点needsUpdate、负缩放/移动、倾斜回退、layers与drawRange。

完整轨迹差分测试已通过：两个相同旋转湖沼模型、2700个实际更新帧逐一比较原版与索引版的根位置、朝向、全部足底点及诊断，覆盖to-steps/descend/drink/ascend/patrol；另120帧迎客触发两版姿态一致。共3项新专项通过。之前原始targetV1支撑测试重跑证实同样两项失败（旧阶采样报告/巡逻角覆盖不足），见 tiger-support-original-tests.txt；不把这个基线称为全通过，也不掩盖缺陷。classic CPU外皮不覆盖V3蒙皮；需正式GPU补证。

## 正式 GPU 与帧窗口

`tiger-index-candidate-rim.json` 正式入口显式候选60帧18.5FPS/54.17ms；tiger.update均值3.06ms、湖沼5.12ms、主岛17.38ms。此前原路径同rim窗口10.4–10.5FPS/约95ms、tiger.update41.59ms，绘制数量和三角数量处于同一量级。相位与资源数量有差别，不能作为像素完全同步A/B，但真实精确射线差分与CPU分段共同支持瓶颈被减轻；仍远低于稳定流畅标准，未达90分。

`tiger-default-live.json` 无候选query加载正常默认代码，V3实际蒙皮成功，两个真实时点相隔5.2秒，虎从入口转向岸边、四足步态和position实际改变；四足各17支撑样本都命中真实地面。实际近景`tiger-default-t1.jpg`/`tiger-default-t2.jpg`已实看。V3外皮爪位与旧支撑代理仍有视觉距离，不称所有外皮爪底贴合验收；本批未改原骨骼驱动。控制台仍有MutationObserver.observe Node参数异常，未定位，不称零错误。

正式默认无tigerGroundIndex参数窗口已归档 tiger-index-default-rim.json：18.6FPS/53.90ms、tiger.update3.14ms、主岛17.31ms，60/windowFull=true；临时GPU页按批关闭，避免多个世界同时渲染。
