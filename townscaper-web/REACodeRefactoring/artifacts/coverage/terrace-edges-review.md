# 台地格边三种遍 · 新模块局部迁移

## 承接与素材

读GUIDE/PIPELINE/MODULE-MAP/coverage/CHANGELOG与会话，原版islandpasses.js为本窗口并行新增，只读对照。其注释2017-01-11/六帧与README不符：1669315384619540487实际2023-06-15、The generator consistently spits out pretty cool islands now。

复用grid-kinds-review.md此前全部649帧0–648的连续复核，原尺寸80（3.54秒）、375（19.28秒）再看：80为高崖/小屋与黄色坡面、浅色岸，375为另一个带凹湾/坡道/小屋的岛例。不能从成果转镜两帧证明作者三遍共边算法。旧649帧不重计，总计175/285；本批是Workbuddy工程策略迁移。

## 共享管线实现

core/terrace-edges.js直接读World.ground和真实pts/edgeNeighbors，从高侧只取一次不同高度共享格边，外边/海邻列为岸界；所有陆顶边按共享顶点身份＋层高去重作为线框。不造第二份方格高度场，也不把连续标量等值线的marching算法删掉：连续场插值与离散台地格边是两种语义。

world/terrace-edges.js共用WorldMesh当前shape.at端点投影，三种模式都沿同一笼形变，默认关闭。terraces.html可选成图/台地层界/顶面线框/格边岸界，直接控制实际共享场景；成图只是关闭线，线框为叠加诊断，不声称实现独立线框渲染流水线。只有逻辑地表顶列，岸界浮在陆顶高度，不是海平面泡沫岸线；最终倒角/草边/屋顶/悬垂并不保证逐点重合。

## 验收

terrace-edges.mjs在混合/四边网格验证全部层界是源格pts原端点、每共享边只一次、层界是线框子集、层界数和原terraceProfile一致、岸界长度与原只读统计一致、格序反转稳定、World快照不变。

terrace-edges-browser：实际四边616层界/2005线框/166岸界，混合488/1454/117；每个显示顶点逐项对比当前shape.at，误差<1e-5。三模式切换均不改World，编辑/恢复刷新版本、关闭隐藏通过。两张实际层界截图已看，黄色线叠加在当前岛屿，未假称原片视觉等价。

原完整traceRings/interpContour/measure接口、最终倒角网格完全一致、连续软坡与联合生成仍缺；islandpasses只从未覆盖转部分。terraceladder仍未迁移，原源码日期/帧数也不准确，不能仅凭已有楼梯标完成。现161模块：34增强/87部分/39静态/1未覆盖；新增未知职责减少不等于全项目完成。原版/.workbuddy只读，无TigerMessenger同步。
