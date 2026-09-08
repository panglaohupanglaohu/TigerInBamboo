# Townscaper 机制核查（2026-09-08）

## 2026-09-08 后续实现：共享边基线与重建保护

- 生产 `faceLayerGraph` / 两端局部侧兼容 / topologyHash 缓存 / face-layer role 已接通。`legacy-faces` 保留原ASCII街道边，三个种子下978格选择相同；92424个实际镇体三角面位置与朝向对照一致。该结果不消除下文任意 irregular nearest-mapping 的反例，也不证明全局通行。
- 连续拆顶、改色、恢复的小型生产场景，增量与全量三角面几何一致。缓存前检查graph/grid的占用、楼层和颜色；增量拒绝更换全局seed/模式。
- 全量重建现在是独立候选，各terrace约束通过才提交；第二terrace故意全ban失败的浏览器验证，旧几何/缓存/spec/配置/待合并均保持，旧dispose为0。正常全量切换兼容既有两参数调用。
- WFC关闭时保留原null上下文，三个非空terrace逐属性/变换/材质指纹与原路径一致。
- 待完成：几何与导航整体消费不规则face数据、庭院/道路的全局可达性、原城堡人高行走及战斗验证。不能把这批基础接线称为完整Townscaper复刻。


结论：项目确实已有不规则四边形生成、八角占用和约束求解的基础，但目前不是完整一致的 Townscaper 机制。把功能开关打开不能解决拓扑映射、角模块选型、局部传播和战场可达性之间的脱节。先完成独立反例检查；随后按任务授权只修复增量传播，未改拓扑映射或角模块。

## 原始资料与边界

用户提供的[作者访谈文章](https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making)完整读到技术章节：Townscaper 组合不规则四边形网格、角部建筑模块与约束求解；结构选型后再装饰，编辑可能影响整个相连结构。文章还区分 Bad North 的导航与关卡验证要求。这是采访报道，不是公开的 Townscaper 引擎源码，不能据此声称已逐行复刻。

[Maxim Gumin 原库 README](https://github.com/mxgmn/WaveFunctionCollapse)说明局部约束的观察—传播过程及可能矛盾；[原 Model.cs](https://github.com/mxgmn/WaveFunctionCollapse/blob/master/Model.cs)可直接看到域删除、支持计数传播和失败返回。它并不提供本项目建筑目录、不规则网格、可玩关卡或 Townscaper 完整实现。项目可以保留自己的六向图和回溯器，正确性应按契约测试。

## 机制差距矩阵

| 层 | 本项目代码证据 | 实测/判断 | 最小下一步 |
|---|---|---|---|
| 8 角 occupancy | `src/world/citadel/cornerGraphAdapter.js:18`，位序 `dx | dz<<1 | dy<<2` | 256 种输入全部还原；498 条相邻有向面共享位一致 | 保留位序；后续用真实几何接缝测试，不能把 bits 一致当成模型已经无缝 |
| mask 到几何 | `cornerPrototypes.js:368/380/453` 按上下层轨道选原型，再生成 box/prism | 256 mask 有候选，非空 mask 有几何 | 当前测试只证明覆盖，不证明每个角型的审美、法线、接缝或旋转方向 |
| 真正角模块 WFC | `cornerAssembly.js:92` 直接取 `cornerAllowedProtoIds(mask)[0]`；`cornerBans` 只按 class | 实际装配没有消费角模块求解结果及 transform；格体 WFC oracle 是另一条路径 | 导出 mask + variant + transform + shared-face 签名，装配必须消费同一份解；方向不对称模块需按 mask 校验旋转，不能只看 D4 类 |
| 底部边界 | `cornerGraphAdapter.js:55` 从 iy=0 建图；`cornerAssembly.js:130` 另补 iy=-1 | 单个地面体素图只有 4 个角节点，完整对偶覆盖应有 8 个；装配有补丁，所以不等于现在必有地面洞 | 求解图与装配都消费同一边界节点集合，防止底部模块跳过约束 |
| 不规则网格 | `src/procgen/graph/irregularQuadGrid.js` 三角配对、细分、松弛 | 10 种子共 1,984 个四边形，凸性、边引用不超过2、确定性通过 | 保留生成器；无限扩展、跨块接缝和极端参数未验证 |
| 拓扑映射 | `gridMigration.js:139` 用距离竞价建立 ASCII 列到 face 双射；`wfcGraphAdapter.js` 仍用整数六邻域 | 9×9 / radius5 样本144条逻辑邻边中48对真实面不共边；双射不是拓扑同构 | face ID 与 half-edge 作为新编辑/求解主键，ASCII仅存档迁移；单独设计映射方案，不能靠位移抹平 |
| 笼变形 | `cageDeform.js:8/17` 双线性；`:52` 贪心配角；`:75` 四个旧逻辑格中心，缺项退方格 | 真共享边的人工笼21采样点误差0；不证明生产笼共享真实拓扑，也没证明所有 Jacobian 为正 | 用实际共享顶点、统一绕序和边ID构笼；测翻折、连续边、不同价数顶点，禁止混用缺失face与方格回退 |
| 局部编辑传播 | `wfcIncremental.js:28/44` 区外旧解 pin，最多 ring+2，冲突全部在外才扩圈 | 12格同型约束链：旧解可解、编辑后全解可解，增量 ring2 失败 | 小范围优先，失败扩展受影响连通分量；保留无关分量原解；见后续修复记录 |
| 战场全局可达 | `compatibilityTable.js:104` 只检查相邻 walkable；格图还可按颜色断边 | 两个互不相连分量仍可 WFC success；这是可复现的求解范围边界，不是局部求解器bug | 独立导航门户连通验证：登陆点→房屋/城门/楼层目标，含宽度、高差、兵种半径和模块内部可达矩阵 |

## 实际执行与证据

运行 `rtk proxy node TigerMessenger/tools/pipeline/test_townscaper_contract.mjs`。

首次结果：9 项中 5 通过、4 个契约未满足；退出码1用于明确报告差距，不是把已知反例伪装成绿色测试。证据 `artifacts/pipeline/townscaper-contract/report.json`。反例是纯数据单测，没有启动浏览器，也不代表完成原场景游玩验收。邻接反例参数不是生产默认全城，证明的是当前映射算法没有一般性邻接保证。

## 可执行收口顺序

1. 先修复增量重解的受影响分量升级，长链和断开分量必须通过，原城市外部解不得随机变化。
2. 单独制定 face/half-edge 主键迁移；保留原山谷大世界、山城真实坐标和存档，不退回退役五台地。
3. 用 256 mask 的定向几何与共享面签名建立角模块合约，再让角装配消费实际求解结果。纳入 iy=-1 边界。
4. 在真实不规则网格上验证变形接缝及正 Jacobian，再测编辑增删/换色、露台、退台、拱与庭院配方。
5. 关卡交付另外验证登陆/寻路/战术目标与可玩性；成功出图、WFC success、导航通过分开记录。

概念图应来自原城堡真实同镜头截图，约束模块比例、材质与构件连接；它不能证明生成器的拓扑正确性。当前未进行几何接缝穷举、Godot迁移验证或 Townscaper 私有源码对照。

## 增量传播修复与复测

已修改 `src/world/citadel/wfcIncremental.js`：先按现有图找到编辑格及其直接邻居所涉及的连通分量；局部区域只从这些分量选节点，因此即使距离很近的断开建筑也不会被释放旧 pin。尝试 ring、ring+1、ring+2 后，升级到完整受影响分量，不再依赖缺失或混合内外的冲突说明才扩圈。删除格通过仍存在的邻居启动传播。仍保留真正无解的失败返回，上一解对象不被修改。

`rtk proxy node TigerMessenger/tools/pipeline/test_townscaper_contract.mjs --incremental`：4/4 通过、退出0。覆盖12格长链、近处及远处断开分量逐项保持原 variant、删除后两侧连通分量重解、真正矛盾仍失败。记录 `artifacts/pipeline/townscaper-contract/incremental-report.json`。

完整审计复测：12项中9通过、3个机制契约仍未满足（底部角图覆盖、ASCII→face拓扑、求解与全局可达的边界），退出1。这些不是本次增量修复回归。现存 tools 中未找到历史注释所称的旧角模块/WFC测试，test/及tests/目录也不存在，因此没有声称跑过未找到的旧测试。

限制：新测试使用可控两原型目录来构造明确反例；尚未测完整大城的耗时与多次真实编辑操作。受影响分量很大时仍会增加计算量，但其余分量原选型固定。本修复保留现有求解器及其回溯预算，不声称解决任意约束系统。

## 底部统一节点修复

已让 `createCornerGraph` 从 iy=-1 开始采样，角装配只遍历图节点，删除装配末尾的独立补底循环。没有接入角 WFC，也没有改拓扑映射。

`rtk proxy node TigerMessenger/tools/pipeline/test_corner_boundary.mjs`：空网格、单格、三层柱、阶梯四种布局通过。实际调用生产装配函数及仓库 vendored Three：修改前后网格数分别为0/32/72/89，逐网格顶点位置（忽略对象遍历顺序）的 SHA256 完全一致，底界与顶界一致；图节点从0/4/12/12补齐为0/8/16/20，无重复及缺失。基线是在修改前真实执行并保存，并非修改后重建假基线；证据 `corner-boundary-before.json` 与 `corner-boundary-after.json`。

机制全检最新结果10/12通过，剩余2项是实际face邻接与全局战场可达性。684条角图共享面位全部一致。完整命令仍退出1，明确保留尚未解决的机制边界。

## 2026-09-08 后续实作：WFC 对应到实际几何重建

- `cornerGraphAdapter`纳入底部iy=-1，`cornerAssembly`删掉独立补底分支。同一图驱动全部装配，空/单格/三层/阶梯四例实际生产装配的网格数、顶点SHA及边界均与修改前一致。
- `odysseyCitadel.rebuildCitadelTownIncremental`在生成与删除前统一WFC影响分量和跨格构件闭包，避免选型改变但旧屋顶遗留。各terrace独立保存上一解；初建和编辑保存seed/显式开关。所有terrace成功才替换旧几何；增量无解保持旧几何和旧选择，不提前取消待合并装饰。
- 浏览器实际调用生产装配，12列两层建筑加一顶层格：重建25格，同布局增量/全量均3846三角形；种子37保持；两个非空terrace缓存各为24/2格且独立。小夹具编辑约25ms，此数不代表全圣城性能；还需正式原城堡、多轮编辑、碰撞和可达性验证。
- `tools/pipeline/test_wfc_geometry_browser.mjs`、`artifacts/pipeline/townscaper-contract/geometry-edit.json`与截图保留。对比只证明本夹具数量与接口，不把三角形数量相等宣称逐像素等同。
- 新真实半边原型验证了两端局部侧（含E:E）和反向共享边。`docs/TOWNSCAPER_TOPOLOGY_MIGRATION.md`记录现存位置双射破坏邻接反例；正式街道迁移必须先保留原连接关系再变形，未把原型直接覆盖当前城堡。

下一项：原圣城三个实际视角捕获 → 图/几何共用真实邻接的小批迁移；侦察机Blender候选→Godot独立检视并行。全机制清单仍有真实邻接和全局可达性两项未满足，不声称Townscaper复现完成。


### 正式源布局规模验证与前台检视

`test_castle_wfc_scale.mjs`直接读取HIGHLAND_TOWNSCAPER_TOWN_SPEC（12层/978占格），种子1、37、20260808全部求解成功，约15–34ms（只含求解，非完整城堡帧耗时）；证据castle-scale.json。尚未把拓扑原型接到正式街道，也未宣称战场可达性通过。

通过Godot前台真实点击：原作全局→91条目资产库→三重门侦察机→查看优化候选，已确认显示候选；可拖动旋转、缩放、返回资产库。镜像实验关卡headless启动10帧无脚本错误，仍不代表完整通关。
