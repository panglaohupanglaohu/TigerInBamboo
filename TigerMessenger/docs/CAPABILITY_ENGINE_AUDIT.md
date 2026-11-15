# 能力组合执行引擎与十二门徒差距核对

日期：2026-11-13。用户优先级：先修编辑视角自由旋转/平移/缩放，再补能力组合与编辑能力。本页为实际源码核对，不是全部能力已回接的声明。

## 引擎确实已存在

| 执行部分 | 现有代码 | 实际职责 |
| --- | --- | --- |
| 能力注册与组合 | townscaper-web/REACodeRefactoring/src/capabilities/registry.js | meta/match/run，runPlan在同一World副本依次执行 |
| 体素场景调度 | src/scene-authoring/agent/orchestrator.js | 扫描、规划、改造Worker、验证Worker、候选和采用 |
| 体素代码执行 | src/scene-authoring/agent/transform-worker.js | 实际import注册表、runPlan、编码候选 |
| 实景落地 | src/scene-authoring/capability-runtime.js | cap.preview/show/revert/commit，显示层与几何重建 |
| 通用三层调度 | src/system-workshop/tier-agent.js | 实际改造/验证Worker、预览/对照/采用/放弃及执行报告 |
| 通用场景 | src/system-workshop/gscene-workshop.js、gscene/transform-worker.js | 当前主要是材质色表候选 |
| 实景通信与场景路由 | src/scene-authoring/pipeline-bridge.js | 固定命令调用真实游戏插件 |

本次只读导出：体素/显示层注册9项（5几何+4显示层），通用场景5项材质能力，物件4项变换能力。菜单中的104项现有功能入口不等于104个已经封装成Worker能力的模块；登记来源条目也不等于执行代码。数量以之后注册表为准。

## 已证实的接入缺口

1. 体素执行器cap.state/cap.preview仍绑定安装时传入的莫西斯湖World、grid和stage。orchestrator.generate还会request('open')回到该插件。十二门徒的通用场景插件并没有因此获得这9项体素/显示层能力。
2. 十二门徒并非没有复用重构代码：apostlesReacode.js使用World/WorldMesh、shape、烘焙、岸浪和Vegetation。但这是src/vendor/townscaper-rea-refactoring副本；与学习工坊当前读取的REACodeRefactoring并非同一路径。
3. 本次只读比较10项核心模块（grid、world、meshwriter、worldmesh、shape、terrainmesh、buildings、bake、vegetation、shore），10项均不同。证据：artifacts/workshop-tests/viewport-engine-20261113/library-drift.json。哈希不同说明版本分叉，不单独证明每一项都有可见退化。
4. 最新WorldMesh有aEdge/aBand代理、更多烘焙模式等修改，旧游戏副本没有对应完整代码。源库能力更新不会自动进入游戏。
5. 十二门徒的材质与融合View基类都为MeshStandardMaterial；差别是融合View额外挂载了地表/灌木/雪/颜色体积/阴影等shader扩展与显示层，十二门徒的rockMat没有整套View扩展。不能仅因两者都叫WorldMesh就断言渲染一致。
6. 十二门徒刻意使用石灰岩配色、球面弯曲、固定地理轮廓、较低面数和较少植被，并关闭灌木/树冠墨线；融合示例使用另一套地形生成和环境。用户两图另有白天/黄昏、取景、尺度和密度差异，完整视觉归因需同条件对照。

## 镜头修复

- 局部建造镜头取得输入所有权时清除前一场景/物件的planetCamera和orbitInput，避免拖动送到空的旧控制器。
- createViewportOrbit复用到场景/物件镜头：右键环绕，中键按相机平面平移，滚轮有界缩放；保持目标及对象不变。
- 正在同一场景进入构建编辑时可保留当前镜头控制器；通用场景编辑回退focus支持preserveCamera，避免切模式造成额外重取景。
- 新测试使用真实菜单事件处理器和实际generic-scene；另跑真实pipeline→十二门徒→进入编辑的鼠标手势，不以调用rig.drag代替用户操作。

## 后续接通顺序

先为十二门徒的多World目标补显式执行适配（选哪座岩体/哪些格、使用哪份网格身份、候选与恢复归谁），让Worker输入输出绑定实际sceneId与快照；然后逐项接共享渲染扩展和显示层。保持认可岩群轮廓、轨道净空、现有建筑及用户存档，按候选预览/同视角对照/验证/采用/撤销落地。

不能用一键复制整个最新View或覆盖vendor来假装完成：该View假设平面单World，而游戏是球面、多岩体、共享主渲染器，且上游正并行学习迭代。每项升级应记录实际源版本、适配文件、执行范围和运行回执。目标是复用已有引擎、补真实适配，不另造只记录步骤的管线。
