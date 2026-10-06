# 新城贴崖小外移 + 真实边界重网格候选交接

**有限 CPU 联合检查通过；未安装、未 GPU 验收、不是艺术评分或全场最终通行认证。** 原失败数据及最小样块留存，本轮未改 main、正式 release、核心 terrain 或别人的建筑文件。

## 可调用入口

### 地形预览（可直接给 root 做真实 GPU）

- 模块 `src/world/citadel/targetEastCliffRemeshPreview.js`
- `createEastCliffRemeshPreview({enabled:true, castle, sourceMesh, artifact})`
- `sourceMesh` 只能是 `citadel-oskar-grid-mountain-surface`。
- `artifact` 读取同目录 `remesh-expanded-geometry.json`（约6.1MB）。
- 返回 `{mesh, report, dispose}`；**不自动挂场景、不隐藏原物件、不安装**。调用者将 `mesh` 加到 `castle`，临时隐藏原 source，回退时恢复原 visible 并 dispose 候选。
- `mesh.position=[85,0,82.5]`。buffer 的位置加这个 origin 才是 castle-local，随后乘 `castle.matrixWorld` 才是 world。不能把 buffer 直接当 castle chart，也不能同时额外 apply origin 导致平移两遍。
- 复用原岩材质和 onBeforeRender，补白色 `color` attribute；自身仅处置候选 geometry，**不会 dispose 共享材质**。当前 rock7 的 vMt 从 `mtInverse*modelMatrix*position` 得到，故正常保留城堡空间色带；旧材质 normalToCastle 要求 source 与 castle 线性基一致，helper 对非一致情况明确拒绝。
- 自动校验 castleMatrix 及原几何 epoch：position hash=772107960，index hash=1617888706，原 vertices=34612。实机不一致就拒绝，不强行安装过期文件。
- 替换后必须重新构建 terrain ray/BVH index、玩家/碰撞引用、植被承托缓存；旧 index 不能继续宣称新山通过。原建筑、广场、雕塑木马不是替换对象。不会自行隐藏旧地标。

### 曲线重放（不是安装器）

- `src/world/citadel/targetEastCliffAlignmentCandidate.js`
- `createEastCliffAlignmentCandidate({enabled:true,input:audit.candidateInput,sourceCurves,retainedRelease,castleMatrix})`
- `audit`=同目录 `remesh-expanded-shift-audit.json`；`sourceCurves` 为真实生产纯曲线，`retainedRelease` 为现已安装的 user-marked release。
- 返回 `{curves:{red,blue},report}`。该函数用球面圆弧/切线原构造，不是把 JSON 稀疏采样连成折线。实际重放与存储0.5m样本误差<1e-7m（测试）。
- 东端生产源参数：red u=.59，blue u=.5925844302347414。约新增157m原全球替换范围，不能默认为只动9m。
- 西端不是 production source u，而是 **当前 retainedRelease 各 lane 的弧长 fraction=.2683333333333333**。root 后续须把这段与 retainedRelease 剩余弧长段合成，然后再接原全球保留段。不要把这个 fraction 当全球原曲线 u。
- 尚无 center lane 的安装/站点/联锁更新适配，也未更新廊道和上步道结构。不要单独换红蓝轨却继续让中心导引/车辆/站点用旧线。

## 实际改了什么

1. 在车辆侵土最大区使用真实被接受的铺装三角。合并共享边/T点后得到1条实际连续铺装外轮廓，再作5cm承托边与三角化（19个约束三角）。不使用广场大 ellipse，也不逐个内部三角外扩制造微碎片。
2. x76..94/z69..96 内拆分原受影响 top faces，在保护边插入顶点，保留原面重心插值/实际表面高度，向海侧重建垂直崖壁。底部跟原真实底面；不是下压原1.7m顶点，也不是盖住列车的暗隧道。
3. 补片与原山的顶/底/边共同裁分、拆分共边T点、接缝1e-5m焊接；修正16片接缝面绕序，最终单连通闭合体。其它外裸坡仍用原独立受限海侧 cut 副本，且受实际公共面及原格承托裕量保护。
4. 保留承托，双轨仅在已测瓶颈附近最大 **0.22m海侧外移**，半长22m、总44m范围用三次紧支撑权重平滑退回；没有在9m内急偏。源端和保留段端位置未变。

## 有限联合实测

|项目|红线|蓝线|
|---|---:|---:|
|实际载货姿态数（约1.5m步长）|173|177|
|OBB 与最终整个闭合山体三角接触|0|0|
|27点/姿态土体 parity 内点|0|0|
|最小世界曲率半径|31.010m|27.437m|
|最大径向坡度|3.282%|3.473%|
|两端位置变化|0m|0m|
|最大端切线变化|0.000106°|0.000286°|

- 最终81,440三角、1个连通体，非两面共边0、绕序冲突0、Float32退化0，正有向体积1,540,681.64m³。正体积不是额外证明全球无自交；本块按原高度面及垂直边重建。
- 2,949个实际公共面承托探针全部保持，最大高度差1.99e-6m。
- 7项针对性测试通过：默认关闭、缺海拒绝、原面/承托边插入、封闭接缝、源数据不动、曲线精确重放、预览只处置自己 geometry。
- CPU 剖面图 `remesh-expanded-sections.png` 已实际查看：z70/80/90退为明确陡崖，平台不再通过一段粗斜面延到轨内。图是离线工程剖面，不是游戏画面。

## 水位与剩余硬门

实际 ocean scale=1，shader 最大径向波幅 .067m。扩张车体包络底（up=-.6，非最低实车顶点）的最小静余量红 .09059m、蓝 .10817m；本次有限静态湿点0，分别比波幅上界多 .02359/.04117m。额外 .3m 工程储备仍有红74/蓝63个足点未过，**.3m不是波幅**。

仍需 root：原实际演员占据体/功能及真实最低车体几何核查、上层步道与柱拱/瀑布对新线净空、中心轨/站点/联锁一致性、动态波峰与更细连续包络、GPU材料与城崖构图。工程通过不等于视觉90，也不自动授权生产安装。

复现：`tools/pipeline/audit_east_cliff_remesh_expanded.mjs`。原小样块未移线、移线和扩大阶段的 JSON 保留；不再用此前粗格失败报告作为本候选结果。
