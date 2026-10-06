# 球面连续场景连接：五点只读评审

2026-10-04。响应用户希望除特有场景外采用连续不规则网格连接的方向。此评审实际阅读代码；未观看新增 `RPjBi_ojS7o`、`Y2CYNIjN-qk` 两段视频，未修改运行时，也未运行验收。方案不把代码存在等同已接入游戏。

## 1. 可复用不规则四边形算法，缺跨区合同

`src/procgen/graph/irregularQuadGrid.js`已有稳定seed、三角配对、细分、形状和尺寸松弛、锁点、边界边、hash，可接`halfEdgeGraph.js`。目前生成一个平面六边形范围，不能输入任意既有岸线或共享跨区边界；独立片区各自生成后重叠不是连续连接。

建议由全局边界合同提供稳定顶点/边ID，再生成局部内部格。注意末尾最小角修正会移动未冻结点但不执行边界切线投影，可能破坏前一阶段的沿边界限制；需专门反例验证，不能只信注释。

## 2. 已有球面拓扑，须区分不同网格的职责

`src/procgen/planet/geodesicGrid.js`提供细分二十面体与邻接、球面方向、charts；`geodesicMainGrid.js`及`geodesicDualGrid.js`为同构建器导出。实际main为三角面；`dual.cells`是三角面中心邻接；另有`vertexCells`五/六邻接。这不是现成Townscaper式不规则四边形铺装。

建议全局球面图负责区块关系/地形采样，局部四边形或混合模块图负责城市和可行走面；双方保留明确映射。不能把每种表示统称为“六边形算法”。

## 3. 坐标和表面查询能复用，真实法线与多层面仍有缺口

`src/world/sphereMath.js`已有`flatToWorld`、径向up、`quatUprightOnSphere`；`src/world/planetV8/surfaceProviderV8.js`提供sample/project/surfaceId等统一入口。目前sample返回径向normal及单一径向高度，不是最终斜坡的几何法线，也不能充分表达桥面/桥下/洞内多层表面。

建议合同区分`gravityUp、geometricNormal、surfaceId、layer、revision`。角色、植被、阴影和相机读取同一最终表面；特殊场景用明确的门/桥/坡道端口衔接，不能单纯就近投射到一层球面。

## 4. 平滑和接缝有骨架，不能误报通过

`src/procgen/planet/hierarchicalSmoothing.js`可按优先级松弛和重投影；尚未表达沿具体语义边滑动或内角/反面验证，且reproject回调会作用于锁点。调用方须确保锁点不被回调移动。

`chartSeamValidator.js`仅比较量化位置已一致的点。两片接缝整体错开后可能根本没有匹配点，因此仍返回ok。这不等于证明闭合。应按预期共享边ID验证两侧都存在、顶点对应、采样位置与法线/语义连续，另外检查裸边、孔洞和重复覆盖。

## 5. 发布和导航可以接入，需核实功能开关及真实连通

已有`planetV8/navigationV8.js`、route/portal、`snapshotCommitV8.js`和dirty occupant迁移。`surfaceProviderV8.portalBetween()`按方向近似找端口，不能代替指定from/to连通及真实通道宽度验证；发布队列本身也不等于所有调用链已排除过期revision。

`planetV8/runtime.js`根据feature gates启用新地形/水/云，须核实实际页面参数及场景消费者。最小试验从叹息之门—十二门徒邻岸的两片共享边开始，保持已批准8个岩柱位置、铁路包络和书店广场，验证穿越、承托、连续材质/照明和过期任务拒绝后再逐区推广。

## 建议统一方案表述

所有普通场景使用统一的球面表面、邻接和边界合同，各场景内部保留适合其形态的拓扑与模块。统一的是位置、接口、采样和可达性，不要求每个建筑、悬崖、水晶体都改造成相同多边形。新视频的实际技术内容由视频研究另行核验，不由此代码评审代替。
