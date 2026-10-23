# 机器人绘制候选 · 2026-10-11 05:08

当前**默认关闭**，正式入口已接好 `?robotRenderBatch=1` 可验证，`=0` 为原路径。未把减少 draw 的候选称为帧率优化完成。

## 实现与恢复

`src/gameplay/robotOps/renderBatch.js` 对 runtime 原 template.clone 共享的刚性几何/材质做同型三人分组实例化。每帧跟随原关节 matrixWorld，重新计算当帧包围球；没有停物流、战斗、卸车、炮口或原角色层级。仅原几何叶节点关闭重复显示，原几何/材质/raycast引用保留，Box3及射线仍能读取原件；不批有孩子的Mesh、透明标识、未知着色器、morph或蒙皮。batch raycast为空避免重复碰撞，dispose/rebuild恢复原显示状态。wear材料仅追加安全标记，其shader读取相同局部顶点，未改变配色/纹理。原runtime与robotSurfaceDetail见source-before/robot-render-batch。

实际三种工厂各3台fixture：612源表面→204实例批；包含3个动画阶段逐矩阵对齐、原射线仍命中、隐藏/重新显示/移除与清理恢复、三人包围球不拉入远处军团。机器人物流/战斗/存档/运输专项一起**38/38通过**，见robot-batch-cpu-tests.txt。

## GPU实测与未达标

- 单个全局大批尝试：3672→204批；rim 60帧10.3FPS、4542calls、9.24Mtris。过宽包围球拉入远方实例/阴影，未采用，证据robot-global-batch-rim.json。
- 改三人组：3672→1224批；rim 60帧10.2FPS、5359calls、6.31Mtris；主robot回调2358（此前原始4005）。仍无FPS提高，证据robot-trio-batch-rim.json。
- 原材质mask改为只关闭几何叶节点后：60帧约10FPS/99.68ms、5358calls；profile60帧机器人整体更新均值7.98ms，pose+defense5.90ms、batch1.98ms。source叶仍按原动态层级计算矩阵，完整主游戏并未达到稳定流畅。证据robot-leaf-batch-profile.json；不是GPU分段计时。
- 正式近景actor LOC-0001原版与候选同世界坐标已拍并实看robot-original-near.jpg / robot-trio-near.jpg：身体面、装甲、轮与炮口没有明显缺件；阶段相位有差异，不称像素完全相同。手工近景5561→3734calls，但三角4.90→5.27M；不是整帧FPS。
- 控制台仍有此前MutationObserver.observe Node参数错误，来源未确认，未看到新的shader编译错误；不称零错误。临时游戏页已关闭。

## 下一步

完整场景仍约10FPS，draw回调份额不等于真实瓶颈。应做**实际GPU分段/遮挡**验证，再考虑安全的绘制顺序或近远复杂度；不能单凭回调高就默认启用本批，也不能隐藏远处书店镇/机器人来虚称改善。可以先验证不透明planet-surface提前绘制是否减少被地形遮住的昂贵fragment；须保留湖沼坑洞discard与所有可见地标，验证顺序相关贴面/透明情况，不能先实施未经核实的全球地平线裁剪。


05:49组合复测：虎精确索引默认开启后的robotRenderBatch=1候选，60真实帧17.9FPS/55.71ms，calls4832/tris5775593，render26.84ms、robot8.29ms；默认原绘制18.6FPS/53.90ms，render27.52ms、robot约6ms。减少提交仍没有总帧收益，机器人候选继续默认关闭。证据tiger-index-robot-candidate-rim.json/jpg，临时页已关。
