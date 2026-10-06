# Oskar 方法研究顾问：Bad North × 澳洲十二门徒

2026-09-28。角色标识 `oskar_world_advisor`，本轮先研究后写入几何，主代理负责布局、真实场景截图与验收。已读 repo Skill 及 research/project/colour-and-modelling 引用、AGENTS、交接相关段与实际工厂。没有完整观看所有 OskSta 动图或 2018 年演讲。

## 已核对的原始来源

1. [Maxim Gumin：WaveFunctionCollapse README](https://github.com/mxgmn/WaveFunctionCollapse)，持续维护的算法作者资料，本轮读网页文字。确认最低熵选择、约束传播和可能的矛盾；应用列表包含 Bad North。README 还说明其保持导航的选择启发式。仅局部邻接规则不能代替全局路径检查。
2. [Parks Victoria：Twelve Apostles Marine National Park](https://www.parks.vic.gov.au/places-to-see/parks/twelve-apostles-marine-national-park)，现行公园管理机构资料，本轮读网页文字：地点与海洋石灰岩环境。并非山内孤峰或任意幻想石林。
3. [Parks Victoria：Port Campbell / Bay of Islands 管理规划（1998）](https://sitecore-prd.parks.vic.gov.au/-/media/project/pv/main/parks/documents/management-plans/resource-library/port-campbell-national-park-and-bay-of-islands-coastal-park---management-plan---1998.pdf)，官方公开规划，本轮检索到的地貌段落指出陡峭或被海蚀掏空的海崖、拱洞、石柱和沿海峡谷；未通读整份 PDF。对应本项目海蚀凹槽、孤立板状石柱和破碎顶部。
4. [EPC 2018：Wave Function Collapse in Bad North](https://www.youtube.com/watch?v=0bcZb-SsnrA)，本轮尝试打开返回 Internal Error；原有研究也标记未完整观看。本次不把尚未观看的具体演讲过程当作新证据。

## 当前问题与本项目推断

上一版统一两级绕柱圆裙与垂直规则线，像等距台阶塔；不是十二门徒海岸形态。Bad North 值得借鉴的是先制作可读的几何模块、定义接口，再约束组合，而不是把游戏岛屿复制成十二门徒。下面是 TigerMessenger 的工程改造，不是作者私有源码或官方配色。

## 实施

- 12 个手工定义海蚀截面模块：海蚀基座、两种凹槽、两种下崖、三种岩台、两种上崖、两种破碎顶。
- 六段高度带有确定的角色约束；宽、窄接口强制兼容；使用已有小型链式 WFC 的最低熵选择、邻接传播和回溯。当前模块库形成 3 条合法组合，种子另控制台面高度、方向、断裂轮廓。这是 **一维宏观岩段 WFC**，不是完整三维 Bad North 岛屿生成器。
- 原来 WFC 仅影响小幅壁面扰动；现在它直接决定海蚀凹槽、断面宽度、岩台与顶段的实际几何。
- 岩台用重复高度截面产生真实水平三角面；上体定向退缩形成更宽的一侧岩肩，不再均匀环形蛋糕。板状不规则截面、高低破碎峰顶、灰蓝岩壁与低饱和浅岩台。
- 六模块共用周向顶点模板；邻段端口共享单一顶点环，避免裂缝。朝向和基部海面承托继续由现有 seat 函数处理。
- 未改 `seatTerracedSeaStacks` 内的选址、植被采样、轨道/广场限制；这些由主代理在叹息之门左侧指定区域集成。足迹元数据返回实际半径，保护检测使用它而非假定截面不变。
- `seaStackWfc=0` 使用 seed=0 的固定人工样块组合，但不挂 WFC 已启用标记；`seaStackTerraces=0` 保留更早造型回退。快照位于 source-before。

## 本地几何验证（尚非场景视觉验收）

`tools/pipeline/check_coastal_modules.mjs` 对 100 个 seed 检查：解可复现、接口不匹配 0、非有限值 0、开放边 0、边方向错误 0、全部面非退化、正有向体积。测试半径 10 / 高 60 时，最少水平岩台面积 53.49 平方单位；最大足迹 1.21385r。证据在 module-checks.json。

主代理还必须从真实场景复核岩群位置、上下层轮廓、铁路净空、书店环形广场、远近光照与植被承托；本报告不能替代截图。

## 第二轮：实际近景复核后的几何修正

顾问实际查看主代理产出的 `sea-stacks-gate-left/after-hero.png`（第一轮新模块画面）：层圈仍完整、底盘过宽、顶端像锯齿城垛。因此背侧退缩减至正面退缩的 2.5%，不再以偏移整个上层代替单侧侵蚀；顶部高差压至不超过约 ±1.1%h，脚部膨出从1.12r降为1.04r。再次执行100种子闭合/接口/面积检查通过，以上数值已更新为第二轮。最终实际场景截图由主代理继续生成，不能把第一轮旧图当成第二轮验收。
