# 三块簇、黑白对偶与实际模式接缝审核

README 1151770831619534848（2019-07-18）明确三块取代七块使更早开始松弛、黑白网互为对偶。先原文再全532帧联系表00–05逐格复核，原尺寸0/38/110/300/430/531。前段圆界/变换轴拖动与白网分离、放大后黑白网及白色局部持续变形。3/7簇因配文成立，视频不提供实际生成耗时。原版patchcluster称6帧不符，本地四边形替代实验也不能当原版算法完全等价。

对照现有core/infinite：已按三两邻接块建簇、块/簇独立松弛和三份坐标插值，不从头替换。真实缺陷：verify(mode)翻折查mode，接缝却始终查blend；多owner点只查前两块，第三块不一致可被漏掉。页面又统一用首owner坐标画各块，把差异掩盖。

本批versionAt暴露每个owner/mode独立表示，verify按当前mode查每块quads，并查同点全部owner两两组合，单列非法数/翻折/比较数；页面逐块绘制真实表示。老versions/weights/blendAt保留。按块模式外圈钉住，实际接缝为零，不继续声称“按块必有缝”。只簇模式实际有缝，blend约4e-15。

逻辑infinite-verify.mjs：N2/3/4、rings1/2、四模式共24例，零翻折/非法；第三owner偏移2的回归和raw/blend不同统计通过。实际grids.html?t=infinite四模式Canvas：3946格、330共享点、378owner对；raw0/patch0/cluster0.3759592281/blend3.972e-15，截图infinite-raw/patch/cluster/blend.png逐张查看，无pageerror。

本地验证不是无限输入的数学证明，也不证明原作性能、动态按需加载、7对3计时优化或完整原对偶编辑动画。只是现有共享网格算法与审核修复，不同步游戏副本。532帧新增1段；133241旧片不重计。

## 第 56 批（C06）

### 1151770831619534848
- 做了什么：新建 core/infinite-c06.js streamWindow：焦点半径内的块按需最终化（白网），外一圈只生成未松弛拓扑（暗网），更远缓存丢弃（infinite.js 流式生成器加 evict/cached，默认不调用不影响旧行为）；windowDual 用共享 quadDual 画黑网；页面同时显示 3 块簇最终化一块需 7 块拓扑、7 块簇需 19 块（×2.71）
- 落点：src/core/infinite.js · src/core/infinite-c06.js · infinite-stream.html
- 测试：tests/infinite-c06.mjs、tests/infinite-stream.mjs（通过）
- 截图：artifacts/coverage/shots-r56/C06-inf-stream-0.png、artifacts/coverage/shots-r56/C06-inf-stream-far.png（已看）
- 对照：圆内白网、圈外暗色未松弛网、黄色焦点 gizmo，与 0200–0299 帧一致；块间接缝 3e-14
- 判定：done
