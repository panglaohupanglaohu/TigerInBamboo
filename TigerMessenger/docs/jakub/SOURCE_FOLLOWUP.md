# Jakub 作者材料补充与目标 v1 的实施约束

2026-10-11。本批只读运行时代码及现有图片，新增本文，不修改 root 正在写的 STATE.md。

## 官方作者讲解：已全文读取

[Why Frostpunk 2 Is a True and Creatively Necessary Sequel](https://news.xbox.com/en-us/2024/09/20/why-frostpunk-2-is-a-true-and-creatively-necessary-sequel/)，2024-09-20，作者 Kuba Stokalski，署名 Frostpunk 2 Co-Director & Design Director。

作者说明二代通过社会冲突与长期决策扩展主题，时间和建造单位随之扩大为周/月及区域。**这是一篇文本讲解，没有实际视频观看**，也不披露地形、拓扑、材质、LOD或程序化建造算法。迁移到书店镇的推断是：厂院的可辨功能、生产物流和生活空间先于装饰密度；不据此复制原作规模。

仅审阅指定的官方候选 YouTube [PWlLOpqIYjA](https://www.youtube.com/watch?v=PWlLOpqIYjA)：web.run 直接打开仍无法取得正文/播放。没有取得官方字幕或实际时间点，实际观看0秒，与X第四条是否同源仍未证明。没有反复尝试X403、没有猜测其它视频URL。五条原X视频及账号全量状态不因本篇作者文章变成已学习完。

## 本日图片实看

本批用 view_image 实际打开 `artifacts/pipeline/jakub-bookshop-20261011/target-v1.png` 和 `current-overview-close.jpg`。目标v1的铜管、石材、窗光与工业生活层次可以作为方向；但其平台更平、铁路曲线已艺术化、后管廊比实景重、蚂蚁/蝗虫/甲壳虫岗位也没有逐一对齐。不能照着生成图重排生产坐标。root 的 TARGET_RESULT.md 已正确注明此边界。

## 实施必须满足的约束

| 内容 | 当前正式代码证据 | 后续实施边界 |
|---|---|---|
| 球面与地面 | bookshopTownSite.js 的 R=160、GROUND_LIFT=.9、townSurfacePoint/seatTownObject；bookshopSurfaceWarp.js 的 warpFactoryToSphere | 所有新增墙基、管架脚、石路按真实球面落地；跨长距离几何细分后变形。不能将整个镇压平为概念图平台。动态排口在同一形变下求变换。 |
| 已有公共布局 | bookshopRobotBase.js，三厂规格由角度[-2.15,π,2.15]和半径48围绕(0,32)生成；原书店与单侧港保留 | 只调三厂局部体量/材质/设备，圆广场净空、四店身份及前海弧不变；主管从工业后场绕行，不切过中央。 |
| 铁路与运输包络 | robotOps/runtime.js 的 cargoPose跟随实际车厢；tests/world/robotTransportEnvelope.test.mjs 储运半宽1.75、桥上净空总量5.36 | 新管廊/桥架不得沿概念图改铁路；对红蓝实际曲线和完整货载做净空采样，上述数字是现有测试断言，不能据此声称新增几何已通过。 |
| 物流岗位 | runtime.js 工厂kind、loading/unloading、transit、ready/deployed/repair及真实handling rig | 蝗虫装配、蚂蚁动力、甲壳虫精密工厂各保留对应模型；画面机器人生活动作是目标示意，改动不得给同一整机重复部署或遮挡货位。 |
| 存档与故事 | runtime.js localStorage键 tigermessenger-robot-operations-v1，load/save校验和恢复站锁；story/rescueState.js书店为第一剧情节点 | 纯美术模块不能改存档字段、出厂批次、运输时序、任务目标；测试时保留用户存档。 |
| 蒸汽预算 | bookshopSteamClouds.js每厂126实例；factoryCompounds rev17独立球泡；noDistanceCulling/frustumCulled关闭 | 优先统一排口和重复表现，近/中/远透明层有预算；新增铜管和绿植不可在没有性能基线时无限叠加。 |

## 窄批次验证建议

先在副本加一个厂院的真实排口与蒸汽改进，保留开关/源件；同镜头同日光 t=0/2/5/10 对照，排口贴合、上升和消散都实际可见。CPU应核对球面变换后有限几何与排口/烟囱匹配；增加跨轨结构时才跑现有运输包络/铁路回归。GPU性能记录帧时、calls、三角及透明覆盖，不能把零GL错误当性能通过。

本文没有跑测试或修改生产模块。本文提供的检验界限与数值来自实际已读源码/测试；未声称目标v1已实现、验收或达到90分。
