# 931196707236392960 · 共享World用途量化与洞内风场修复

先读素材README.md第224行：虚拟体素空间用于光照、软法线、3D贴图、简化碰撞与风。原版flowdemo.js自身没有帖子ID，但导入voxelflow.js，后者明确引用该帖子；本轮按这一代码依赖建立素材对应关系。查看全部223帧（0–6.689秒），原尺寸帧、时间戳与sheet-00/01/02保存在同ID目录。

观察：岛屿带洞地形在圆润渲染与方块体素显示之间切换，约1.1–2.5秒、4.2–5.5秒为明显块状显示，其间镜头旋转。视频没有直接展示风向、碰撞探针或法线算法。这些用途由原文说明，不能把本轮工程测试称为原视频画面复刻。

原版flowdemo有独立碰撞/风/软法线开关，使用land与houses两份Town再合成场。重构已有单World与Atmosphere，但审核发现Atmosphere逐层阻挡由top高度推导，会把洞顶以下的空气全部填实，与World中真实空洞不一致。

修复life/atmosphere.js：空间采样缓存格子ID，逐层读取world.isSolid(cell,lv+1)再做原有模糊/绕障；ground高度缓存仅保留给从上方落下的雪使用。派生风场记录worldVersion。实际风、雪的风场采样共同获益，不另建可编辑体素源。

新增core/world-probes.js：按真实solid位检查点占用，带最高Y限制的下方支撑查询，有限占用采样梯度法线；洞内不会直接吸到屋顶。normalAt无梯度返回null。占用梯度仍是诊断，不替代现有基于几何的软法线，不声称完整角色身体碰撞或形变表面精确碰撞。

flow.html直接加载真实index的World/渲染器，构造floor1+roof3夹具，封洞只补第2层；提供碰撞探针、梯度箭头和实际Atmosphere风箭头开关。最初父页面创建的Three几何跨iframe导致TypedArray类型检查失败，改为在渲染iframe内加载ui/flow-markers.js创建几何，重跑无未捕获异常。

验证：tests/world-probes.mjs通过孔洞/屋顶、支撑限制、场外无地板、实时编辑、平面法线、参数及两种网格。tests/world-probes-browser.cjs通过：混合69格/四边形120格为逻辑夹具；实际页面使用主场景网格。通洞0.75高度为空，支撑层1；封洞实心，支撑层2；同一点风速通洞约1.0000，封洞混合约0.9185/四边形约0.8815。World/风版本一致。这是当前启发式风场回归数据，不是物理流体精度认证。截图world-probes-{mixed,quad}.png和world-probes-regression-{town,terrain,fusion}.png已目视检查。

保留缺口：原版验收页的体素梯度软化网格法线并约束硬边，尚未完整迁移；目前只提供梯度诊断。形变后碰撞、身体半径与流体边界精度仍有其他任务。flowdemo模块记部分覆盖；已有共享World、现有几何软法线和风场成果继续保留。
