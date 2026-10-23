# 十二门徒：同侧连接的草台群山

2026-10-07，本轮用户授权覆盖旧“孤柱/少植被”限制。实际默认 seat 调用已改；`?seaStackConnected=0` 可回到原孤柱分支，source-before 保留原文件。

## 实改

- 根据真实 railCurves 找叹息之门原选区附近轨道，左右各四个不等高模块，通过较低宽肩相连。两侧独立体积，禁止跨轨连接。
- 低/中/高草台与短陡崖共享闭合实体。节点高 12–26m；下台约5.8m，中台约11.3m；高台偏心，连接肩约8–9.5m。这是本项目手工模块/接口组合，不是作者私有WFC实现。
- 最终边界在XZ限0.32m两轮松弛，台面高度不变，保留台崖硬边。未以法线变更冒充减少三角：岩体依然4276/5020面。
- 旧柱及旧柱所属植被/浪沫/碎岩移除；新植被为宽草甸+低频场控制的圆叶簇，大片草坪内部留白，不保留针叶小树。每组草皮+灌丛2 drawcalls。
- 实际海面BVH/任务yield保留。闭合网格采样缺海面或碰保护盒时拒绝相应格，不补假海平面。城市instanced meshes使用逐instance矩阵；船、门、步道和书店广场额外保护。
- 同surface/water版本发布contract与新shore contact。`scene.userData.seaStackCollisionSurfaces`、`seaStackCloudSurfaces`交root接最终消费者；本模块没有伪称所有云/导航缓存已更新。

## CPU证据

`node --test tests/world/seaStackConnectedLandscape.test.mjs`：5/5。
包含两侧闭合/不跨轨、真实根点承托、缺海拒绝、全部保护时不填、正常seat替换旧物与contract、有限边界松弛/高度保真/无翻面。

`tools/pipeline/check_connected_sea_stack_landscape.mjs`：使用本轮真实production-rails.json与三角海洋局部fixture（非live ocean），两组均1连通；总岩体9296tri，草面积933/1204平方米；圆叶簇50/52；附近载货姿态250+246，实际三角/OBB碰撞0。独立脚本没有全局车辆内部parity检查，不宣称全场验证。

`geometry-preview.png`是亲自查看的CPU几何投影，不是GPU：连接宽台成立，局部轮廓仍保留离散折面，需完整场景查看其尺度/光照。预览没有城市/船保护盒，实际默认构建才使用其最终矩阵，可能进一步裁小或分断山体。不得将此CPU单连通数当最终场景结果。

## 待root完整验证

- 实际两组位置、受保护格裁切后连通性/视觉范围，不遮门、不占书店。
- 真实轨道载货全包络与船、门步道，完整海水/浪沫位置；旧cloud数组不再引用旧柱。
- 新草坪与灌丛相对于用户目标的画面覆盖及岩壁网格边痕。尚未GPU验证，不评分。
